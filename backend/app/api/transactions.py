from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.transaction import Transaction
from app.models.billing import Billing
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionRead
from app.core.inventory import sync_inventory


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
def list_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Transaction).filter(Transaction.archived == False).offset(skip).limit(limit).all()

# Must be before /{item_id} — otherwise "archived" is captured as the id
@router.get("/archived", response_model=list[TransactionRead])
def list_archived_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Transaction).filter(Transaction.archived == True).offset(skip).limit(limit).all()

@router.get("/{item_id}", response_model=TransactionRead)
def get_transaction(item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx

@router.post("/", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db), _=Depends(_write_auth)):
    tx = Transaction(**payload.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)

    # Sync inventory for all materials involved
    for mid in get_material_ids(payload.materials):
        sync_inventory(db, mid)

    return tx

@router.put("/{item_id}", response_model=TransactionRead)
def update_transaction(item_id: int, payload: TransactionUpdate, db: Session = Depends(get_db), _=Depends(_write_auth)):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Get material IDs before and after update for full sync
    old_material_ids = get_material_ids(tx.materials or [])

    for field, value in payload.model_dump(exclude_unset=True).items():
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

    if tx.billing_id:
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