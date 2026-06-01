from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionRead
from app.core.inventory import sync_inventory

_write_auth = require_role(["Admin", "Accounting"])

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
def archive_transaction(item_id: int, db: Session = Depends(get_db), _=Depends(_write_auth)):
    tx = db.query(Transaction).filter(Transaction.id == item_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    material_ids = get_material_ids(tx.materials or [])
    tx.archived = True
    db.commit()

    # Sync inventory after archive
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