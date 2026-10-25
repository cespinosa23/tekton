from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.access import project_scope
from app.core.deps import get_current_user, require_role
from app.models.transaction import Transaction
from app.models.billing import Billing
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionRead
from app.core.inventory import sync_inventory
from app.api.crud_router import _changed_fields


def _revert_linked_billing(db: Session, tx: Transaction):
    """Removing a payment transaction that was auto-generated from a billing
    means that billing is no longer actually paid — reflect that instead of
    silently leaving the billing marked Paid with no transaction behind it."""
    if not tx.billing_id:
        return
    billing = db.query(Billing).filter(Billing.id == tx.billing_id).first()
    if billing and billing.is_paid:
        billing.is_paid = False
        billing.paid_date = None


def _reapply_linked_billing(db: Session, tx: Transaction):
    """Restoring an archived payment transaction is the inverse of archiving it —
    put the linked billing back to Paid, recovering paid_date from the transaction's
    own date (that's exactly what it was set from when the transaction was created).
    Skips a billing that's itself been reset/archived in the meantime."""
    if not tx.billing_id:
        return
    billing = db.query(Billing).filter(Billing.id == tx.billing_id, Billing.archived == False).first()
    if billing and not billing.is_paid:
        billing.is_paid = True
        billing.paid_date = tx.transaction_date

def _block_if_commission_linked(tx: Transaction, action: str):
    """A released commission's expense is owned by api/commissions.py —
    editing, archiving, or restoring it here would silently desync it from
    the commission it represents (an archive would undo the release behind
    the Commissions page's back, bypassing its Admin-only reverse)."""
    if tx.commission_id:
        raise HTTPException(
            status_code=400,
            detail=f"This expense is a released commission — {action} it from the Commissions page instead.",
        )


def _is_admin(user) -> bool:
    return any(ur.role.name == "Admin" for ur in user.roles)


_write_auth = require_role(["Admin", "Project Coordinator"])

router = APIRouter(prefix="/transactions", tags=["transactions"])

def get_material_ids(materials):
    if not materials:
        return []
    ids = set()
    for m in materials:
        mid = m.get("material_id") if isinstance(m, dict) else m.material_id
        if mid:
            ids.add(mid)
    return list(ids)

@router.get("/", response_model=list[TransactionRead])
def list_transactions(
    skip: int = 0, limit: int = 10000,
    # Optional filters so screens fetch only what they show (all inclusive):
    # a date range on transaction_date, one project, and/or some types.
    start: Optional[date] = None, end: Optional[date] = None,
    project_id: Optional[int] = None,
    transaction_type: Optional[list[str]] = Query(None),
    # Text search across all dates (the Transactions tabs' search box): any of
    # description, project, reference no., supplier, category or remarks
    # contains it, case-insensitive.
    q: Optional[str] = None,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    # Read scope (app/core/access.py): Admin, PC and PM see everything,
    # everyone else none. An empty list rather than 403 so pages that load
    # transactions for everyone (the Dashboard) keep working.
    query = db.query(Transaction).filter(Transaction.archived == False)
    scope = project_scope(db, current_user)
    if scope is not None:
        if not scope:
            return []
        query = query.filter(Transaction.project_id.in_(scope))
    if start:
        query = query.filter(Transaction.transaction_date >= start)
    if end:
        query = query.filter(Transaction.transaction_date <= end)
    if project_id is not None:
        query = query.filter(Transaction.project_id == project_id)
    if transaction_type:
        query = query.filter(Transaction.transaction_type.in_(transaction_type))
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(*(col.ilike(like) for col in (
            Transaction.description, Transaction.project_name, Transaction.reference_number,
            Transaction.supplier, Transaction.expenditure_category, Transaction.remarks,
        ))))
    return query.order_by(Transaction.id.asc()).offset(skip).limit(limit).all()

# Must be before /{item_id} — otherwise "archived" is captured as the id
@router.get("/archived", response_model=list[TransactionRead])
def list_archived_transactions(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
    return db.query(Transaction).filter(Transaction.archived == True).order_by(Transaction.id.asc()).offset(skip).limit(limit).all()

@router.get("/{item_id}", response_model=TransactionRead)
def get_transaction(item_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    scope = project_scope(db, current_user)
    if not tx or (scope is not None and tx.project_id not in scope):
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx

@router.post("/", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db), current_user=Depends(_write_auth)):
    # billing_id links a transaction to a specific billing's paid status — only
    # the Admin-only mark-paid flow (billing.py) is allowed to set it, so a
    # lower-privileged transaction writer can't fabricate a payment that
    # appears linked to (and reportable against) a billing it never touched.
    if payload.billing_id is not None and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only an Admin can link a transaction to a billing")

    tx = Transaction(**payload.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)

    # Sync inventory for all materials involved
    for mid in get_material_ids(payload.materials):
        sync_inventory(db, mid)

    return tx

# Fields of a billing-generated payment that only the billing's mark-paid
# flow may change. The date is not one of them: editing it moves the
# billing's paid_date along with it (see update_transaction).
_BILLING_SENSITIVE_FIELDS = {"amount", "billing_id", "transaction_type"}


@router.put("/{item_id}", response_model=TransactionRead)
def update_transaction(item_id: int, payload: TransactionUpdate, db: Session = Depends(get_db), current_user=Depends(_write_auth)):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    _block_if_commission_linked(tx, "change")

    updates = payload.model_dump(exclude_unset=True)
    # The edit forms send every field, changed or not, so judge by what
    # actually differs — otherwise any save of a billing payment trips the
    # check below even when only its remarks changed.
    changed = _changed_fields(tx, updates)

    if payload.billing_id is not None and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only an Admin can link a transaction to a billing")

    # A transaction linked to a billing (existing or being newly linked here)
    # is a system-managed payment record — its amount/type must match what
    # billing.py's mark-paid flow set, or the billing's own is_paid/amount
    # silently desyncs from the transaction that represents it. Changing
    # those has to go through unmark-paid / mark-paid-again instead.
    linked_billing_id = updates.get("billing_id", tx.billing_id)
    if linked_billing_id and _BILLING_SENSITIVE_FIELDS.intersection(changed):
        raise HTTPException(
            status_code=400,
            detail="This payment was recorded from a billing — mark the billing unpaid and paid again "
                   "to change its amount, type, or billing link.",
        )
    # Its date can be corrected here; the billing's paid date follows it.
    if tx.billing_id and "transaction_date" in changed and updates.get("transaction_date"):
        billing = db.query(Billing).filter(Billing.id == tx.billing_id).first()
        if billing and billing.is_paid:
            billing.paid_date = updates["transaction_date"]

    # Get material IDs before and after update for full sync
    old_material_ids = get_material_ids(tx.materials or [])

    for field, value in updates.items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)

    # Sync inventory for old and new materials
    new_material_ids = get_material_ids(payload.materials or [])
    all_ids = set(old_material_ids + new_material_ids)
    for mid in all_ids:
        sync_inventory(db, mid)

    return tx

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_transaction(item_id: int, db: Session = Depends(get_db), current_user=Depends(_write_auth)):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    _block_if_commission_linked(tx, "reverse")

    material_ids = get_material_ids(tx.materials or [])
    tx.archived = True
    tx.archived_by = current_user.email
    _revert_linked_billing(db, tx)
    db.commit()

    # Sync inventory after archive
    for mid in material_ids:
        sync_inventory(db, mid)
        
@router.post("/{item_id}/restore", response_model=TransactionRead)
def restore_transaction(item_id: int, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Archived only by a commission reverse — bringing it back here would
    # double-count against a commission that's no longer released.
    _block_if_commission_linked(tx, "re-release")

    if tx.billing_id:
        # Its billing was removed (latest entry archived) or the project's
        # billing was reset — a restored payment would be income with no
        # billing behind it.
        billing = db.query(Billing).filter(Billing.id == tx.billing_id).first()
        if not billing or billing.archived:
            raise HTTPException(
                status_code=400,
                detail="This payment's billing was removed or reset, so restoring it would count income "
                       "with no billing behind it. Set up the billing again and mark it paid instead.",
            )
        duplicate = db.query(Transaction).filter(
            Transaction.billing_id == tx.billing_id,
            Transaction.archived == False,
            Transaction.id != tx.id,
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="This billing already has a newer payment transaction on record — "
                       "restoring this one would double-count the payment. Archive the "
                       "current transaction first if you really want to bring this one back.",
            )

    tx.archived = False
    _reapply_linked_billing(db, tx)
    db.commit()
    db.refresh(tx)
    for mid in get_material_ids(tx.materials or []):
        sync_inventory(db, mid)
    return tx


@router.delete("/{item_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanent_delete_transaction(item_id: int, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    # An archived commission expense is already reversed, so deleting it is
    # harmless; a live one is still the record of a released commission.
    if not tx.archived:
        _block_if_commission_linked(tx, "reverse")
    material_ids = get_material_ids(tx.materials or [])
    _revert_linked_billing(db, tx)
    db.delete(tx)
    db.commit()
    for mid in material_ids:
        sync_inventory(db, mid)


@router.post("/admin/sync-inventory")
def sync_all_inventory(db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
    """One-time sync of all inventory from transactions."""
    from app.models.material import Material
    materials = db.query(Material).filter(Material.archived == False).all()
    for mat in materials:
        sync_inventory(db, mat.id)
    return {"message": f"Synced {len(materials)} materials"}