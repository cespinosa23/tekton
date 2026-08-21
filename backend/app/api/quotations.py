from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.quotation import Quotation
from app.models.user import User
from app.schemas.quotation import (
    QuotationCreate, QuotationUpdate, QuotationRead,
    RequestApprovalPayload, RejectQuotationPayload,
)

router = APIRouter(prefix="/quotations", tags=["quotations"])
_write_auth = require_role(["Admin", "Project Coordinator", "Project Manager"])


def _is_admin(user: User) -> bool:
    return any(ur.role.name == "Admin" for ur in user.roles)


def _has_role(user: User, role_name: str) -> bool:
    return any(ur.role.name == role_name for ur in user.roles)


def _scope_visible(query, current_user: User):
    """Admin sees everything. Everyone else sees only quotes they created,
    quotes currently awaiting their approval, or quotes with no recorded
    creator (predates this feature — grandfathered as visible to all rather
    than silently disappearing for whoever was using them)."""
    if _is_admin(current_user):
        return query
    return query.filter(or_(
        Quotation.created_by_user_id == current_user.id,
        Quotation.approval_requested_to_id == current_user.id,
        Quotation.created_by_user_id.is_(None),
    ))


def _can_edit(item: Quotation, current_user: User) -> bool:
    return _is_admin(current_user) or item.created_by_user_id in (None, current_user.id)


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
    visible = _is_admin(current_user) or item.created_by_user_id in (None, current_user.id) or item.approval_requested_to_id == current_user.id
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
# everyone else (currently just Project Coordinator) submits for approval. ──

@router.post("/{item_id}/request-approval", response_model=QuotationRead)
def request_approval(item_id: int, payload: RequestApprovalPayload, db: Session = Depends(get_db), current_user: User = Depends(_write_auth)):
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
    db.commit()
    db.refresh(item)
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
    db.commit()
    db.refresh(item)
    return item
