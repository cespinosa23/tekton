from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.email import send_approval_requested_email
from app.models.quotation import Quotation
from app.models.user import User
from app.schemas.quotation import (
    QuotationCreate, QuotationUpdate, QuotationRead,
    RequestApprovalPayload, RejectQuotationPayload,
)


def _display_name(user: User) -> str:
    emp = user.employee
    if emp and (emp.first_name or emp.last_name):
        return f"{emp.first_name or ''} {emp.last_name or ''}".strip()
    return user.email

router = APIRouter(prefix="/quotations", tags=["quotations"])
_write_auth = require_role(["Admin", "Project Coordinator", "Project Manager", "Engineer"])


def _is_admin(user: User) -> bool:
    return any(ur.role.name == "Admin" for ur in user.roles)


def _has_role(user: User, role_name: str) -> bool:
    return any(ur.role.name == role_name for ur in user.roles)


def _scope_visible(query, current_user: User):
    """Admin sees everything. Everyone else sees only quotes they created or
    quotes currently awaiting their approval. A quote with no recorded owner
    is visible to Admin only — never grandfathered open to everyone."""
    if _is_admin(current_user):
        return query
    return query.filter(or_(
        Quotation.created_by_user_id == current_user.id,
        Quotation.approval_requested_to_id == current_user.id,
    ))


def _can_edit(item: Quotation, current_user: User) -> bool:
    return _is_admin(current_user) or item.created_by_user_id == current_user.id


def _can_act_on_approval(item: Quotation, current_user: User) -> bool:
    return _is_admin(current_user) or item.approval_requested_to_id == current_user.id


@router.get("/", response_model=list[QuotationRead])
def list_quotations(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Quotation).filter(Quotation.archived == False).order_by(Quotation.id.asc())
    q = _scope_visible(q, current_user)
    return q.offset(skip).limit(limit).all()


# Must be registered BEFORE /{item_id} — otherwise "archived" is captured as the id
@router.get("/archived", response_model=list[QuotationRead])
def list_archived_quotations(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Quotation).filter(Quotation.archived == True).order_by(Quotation.id.asc())
    q = _scope_visible(q, current_user)
    return q.offset(skip).limit(limit).all()


@router.get("/{item_id}", response_model=QuotationRead)
def get_quotation(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    visible = _is_admin(current_user) or item.created_by_user_id == current_user.id or item.approval_requested_to_id == current_user.id
    if not visible:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return item


@router.post("/", response_model=QuotationRead, status_code=status.HTTP_201_CREATED)
def create_quotation(payload: QuotationCreate, db: Session = Depends(get_db), current_user: User = Depends(_write_auth)):
    item = Quotation(**payload.model_dump(), created_by_user_id=current_user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=QuotationRead)
def update_quotation(item_id: int, payload: QuotationUpdate, db: Session = Depends(get_db), current_user: User = Depends(_write_auth)):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not _can_edit(item, current_user):
        raise HTTPException(status_code=403, detail="You can only edit quotations you created")
    # Finalized is a one-way door — no exceptions, Admin included. The only
    # way to change a Finalized quote's content is to clone it into a new
    # Draft and route that through approval again.
    if item.status == "Finalized":
        raise HTTPException(status_code=400, detail="Finalized quotations can no longer be edited — clone it to make changes")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_quotation(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(_write_auth)):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not _can_edit(item, current_user):
        raise HTTPException(status_code=403, detail="You can only archive quotations you created")
    item.archived = True
    db.commit()


@router.post("/{item_id}/restore", response_model=QuotationRead)
def restore_quotation(item_id: int, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    item.archived = False
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanent_delete_quotation(item_id: int, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    db.delete(item)
    db.commit()


# ── Approval workflow — Admin and Project Manager finalize directly;
# everyone else (currently Project Coordinator and Engineer) submits for approval. ──

@router.post("/{item_id}/request-approval", response_model=QuotationRead)
def request_approval(item_id: int, payload: RequestApprovalPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(_write_auth)):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not _can_edit(item, current_user):
        raise HTTPException(status_code=403, detail="You can only request approval on quotations you created")
    if item.status != "Draft":
        raise HTTPException(status_code=400, detail="Only draft quotations can be submitted for approval")

    approver = db.query(User).filter(User.id == payload.approver_user_id, User.is_active == True).first()
    if not approver:
        raise HTTPException(status_code=404, detail="Approver not found")
    if not _has_role(approver, "Project Manager"):
        raise HTTPException(status_code=400, detail="Approver must be a Project Manager")

    item.approval_status = "pending"
    item.approval_requested_to_id = approver.id
    item.approval_requested_by_id = current_user.id
    item.approval_note = None
    item.approval_history = (item.approval_history or []) + [{
        "action": "requested",
        "by_user_id": current_user.id,
        "by_name": _display_name(current_user),
        "to_user_id": approver.id,
        "to_name": _display_name(approver),
        "at": datetime.utcnow().isoformat(),
    }]
    db.commit()
    db.refresh(item)

    quote_label = item.quote_number or item.subject or f"Quotation #{item.id}"
    background_tasks.add_task(send_approval_requested_email, approver.email, quote_label, _display_name(current_user))

    return item


@router.post("/{item_id}/approve", response_model=QuotationRead)
def approve_quotation(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(_write_auth)):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if item.approval_status != "pending":
        raise HTTPException(status_code=400, detail="This quotation has no pending approval request")
    if not _can_act_on_approval(item, current_user):
        raise HTTPException(status_code=403, detail="Only the requested approver or an Admin can approve this")

    item.status = "Finalized"
    item.approval_status = "approved"
    item.approval_history = (item.approval_history or []) + [{
        "action": "approved",
        "by_user_id": current_user.id,
        "by_name": _display_name(current_user),
        "at": datetime.utcnow().isoformat(),
    }]
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/reject", response_model=QuotationRead)
def reject_quotation(item_id: int, payload: RejectQuotationPayload, db: Session = Depends(get_db), current_user: User = Depends(_write_auth)):
    item = db.query(Quotation).filter(Quotation.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if item.approval_status != "pending":
        raise HTTPException(status_code=400, detail="This quotation has no pending approval request")
    if not _can_act_on_approval(item, current_user):
        raise HTTPException(status_code=403, detail="Only the requested approver or an Admin can reject this")
    if not payload.reason.strip():
        raise HTTPException(status_code=400, detail="A rejection reason is required")

    item.status = "Draft"
    item.approval_status = "rejected"
    item.approval_note = payload.reason.strip()
    item.approval_history = (item.approval_history or []) + [{
        "action": "rejected",
        "by_user_id": current_user.id,
        "by_name": _display_name(current_user),
        "reason": payload.reason.strip(),
        "at": datetime.utcnow().isoformat(),
    }]
    db.commit()
    db.refresh(item)
    return item
