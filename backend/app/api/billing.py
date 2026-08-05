from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.billing import Billing
from app.models.project import Project
from app.schemas.billing import BillingCreate, BillingRead, BillingPaidUpdate

_write_auth = require_role(["Admin"])

router = APIRouter(prefix="/billing", tags=["billing"])


def _project_billings(db: Session, project_id: int):
    return db.query(Billing).filter(Billing.project_id == project_id, Billing.archived == False)


def _next_sequence(db: Session, project_id: int) -> int:
    last = _project_billings(db, project_id).order_by(Billing.sequence_number.desc()).first()
    return (last.sequence_number + 1) if last else 1


def _is_zero_amount(amount) -> bool:
    return round(float(amount or 0), 2) == 0


@router.get("/", response_model=list[BillingRead])
def list_billings(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Billing).filter(Billing.archived == False).offset(skip).limit(limit).all()


# Must be before /{item_id} — otherwise "archived" is captured as the id
@router.get("/archived", response_model=list[BillingRead])
def list_archived_billings(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Billing).filter(Billing.archived == True).offset(skip).limit(limit).all()


@router.get("/{item_id}", response_model=BillingRead)
def get_billing(item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    billing = db.query(Billing).filter(Billing.id == item_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")
    return billing


@router.post("/", response_model=BillingRead, status_code=status.HTTP_201_CREATED)
def create_billing(payload: BillingCreate, db: Session = Depends(get_db), _=Depends(_write_auth)):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dp_row = _project_billings(db, project.id).filter(Billing.billing_type == "down_payment").first()

    if payload.billing_type == "down_payment":
        if dp_row:
            raise HTTPException(status_code=400, detail="Down payment already recorded for this project")
        if not payload.account_type or not payload.salutation or not payload.first_name or not payload.last_name:
            raise HTTPException(status_code=400, detail="Type of Account, Salutation, First Name, and Last Name are required")
        dp_amount = payload.dp_amount or 0
        retention_amount = payload.retention_amount or 0
        billing = Billing(
            project_id=project.id,
            billing_type="down_payment",
            sequence_number=1,
            billing_date=payload.billing_date,
            current_percentage=0,
            previous_percentage=0,
            dp_amount=dp_amount,
            retention_amount=retention_amount,
            scope_description=payload.scope_description,
            account_type=payload.account_type,
            salutation=payload.salutation,
            first_name=payload.first_name,
            last_name=payload.last_name,
            amount=dp_amount,
            notes=payload.notes,
            is_paid=_is_zero_amount(dp_amount),
            paid_date=payload.billing_date if _is_zero_amount(dp_amount) else None,
        )

    elif payload.billing_type == "progress":
        if not dp_row:
            raise HTTPException(status_code=400, detail="Record the down payment / retention setup first")
        if payload.current_percentage is None:
            raise HTTPException(status_code=400, detail="current_percentage is required for progress billings")

        last_progress = (
            _project_billings(db, project.id)
            .filter(Billing.billing_type == "progress")
            .order_by(Billing.sequence_number.desc())
            .first()
        )
        previous_percentage = float(last_progress.current_percentage) if last_progress else 0.0

        if payload.current_percentage <= previous_percentage or payload.current_percentage > 100:
            raise HTTPException(
                status_code=400,
                detail=f"current_percentage must be greater than {previous_percentage} and at most 100",
            )

        base = float(project.contract_cost or 0) - float(dp_row.dp_amount or 0) - float(dp_row.retention_amount or 0)
        amount = (payload.current_percentage - previous_percentage) / 100 * base

        billing = Billing(
            project_id=project.id,
            billing_type="progress",
            sequence_number=_next_sequence(db, project.id),
            billing_date=payload.billing_date,
            current_percentage=payload.current_percentage,
            previous_percentage=previous_percentage,
            amount=amount,
            notes=payload.notes,
            is_paid=_is_zero_amount(amount),
            paid_date=payload.billing_date if _is_zero_amount(amount) else None,
        )

    elif payload.billing_type == "retention_release":
        if not dp_row:
            raise HTTPException(status_code=400, detail="Record the down payment / retention setup first")

        existing_release = _project_billings(db, project.id).filter(Billing.billing_type == "retention_release").first()
        if existing_release:
            raise HTTPException(status_code=400, detail="Retention has already been released for this project")

        last_progress = (
            _project_billings(db, project.id)
            .filter(Billing.billing_type == "progress")
            .order_by(Billing.sequence_number.desc())
            .first()
        )
        if not last_progress or float(last_progress.current_percentage) < 100:
            raise HTTPException(status_code=400, detail="Project must reach 100% progress before releasing retention")

        billing = Billing(
            project_id=project.id,
            billing_type="retention_release",
            sequence_number=_next_sequence(db, project.id),
            billing_date=payload.billing_date,
            amount=dp_row.retention_amount,
            notes=payload.notes,
            is_paid=_is_zero_amount(dp_row.retention_amount),
            paid_date=payload.billing_date if _is_zero_amount(dp_row.retention_amount) else None,
        )

    else:
        raise HTTPException(status_code=400, detail="Invalid billing_type")

    db.add(billing)
    db.commit()
    db.refresh(billing)
    return billing


@router.put("/{item_id}/paid", response_model=BillingRead)
def set_billing_paid(item_id: int, payload: BillingPaidUpdate, db: Session = Depends(get_db), _=Depends(_write_auth)):
    billing = db.query(Billing).filter(Billing.id == item_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")

    if not payload.is_paid and _is_zero_amount(billing.amount):
        raise HTTPException(status_code=400, detail="A zero-amount billing is always considered paid")

    billing.is_paid = payload.is_paid
    billing.paid_date = payload.paid_date if payload.is_paid else None
    db.commit()
    db.refresh(billing)
    return billing


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_billing(item_id: int, db: Session = Depends(get_db), current_user=Depends(_write_auth)):
    billing = db.query(Billing).filter(Billing.id == item_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing not found")

    latest = (
        _project_billings(db, billing.project_id)
        .order_by(Billing.sequence_number.desc())
        .first()
    )
    if not latest or latest.id != billing.id:
        raise HTTPException(status_code=400, detail="Only the most recent billing entry can be removed")

    billing.archived = True
    billing.archived_by = current_user.email
    db.commit()


@router.post("/project/{project_id}/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_project_billing(project_id: int, db: Session = Depends(get_db), current_user=Depends(_write_auth)):
    """Archive every billing entry for a project so it can be set up from scratch."""
    rows = _project_billings(db, project_id).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No billing entries found for this project")

    for row in rows:
        row.archived = True
        row.archived_by = current_user.email
    db.commit()
