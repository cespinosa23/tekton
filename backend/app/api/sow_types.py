from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.sow_type import SowType, SowTypeItem
from app.schemas.sow_type import (
    SowTypeCreate, SowTypeUpdate, SowTypeRead, SowTypeItemCreate, SowTypeItemRead
)

router = APIRouter(prefix="/sow-types", tags=["sow_types"])

@router.get("/", response_model=list[SowTypeRead])
def list_types(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(SowType).filter(SowType.archived == False).all()

@router.post("/", response_model=SowTypeRead, status_code=status.HTTP_201_CREATED)
def create_type(payload: SowTypeCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    existing = db.query(SowType).filter(SowType.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Scope of Work type already exists")
    st = SowType(name=payload.name)
    db.add(st)
    db.commit()
    db.refresh(st)
    return st

@router.put("/{type_id}", response_model=SowTypeRead)
def update_type(type_id: int, payload: SowTypeUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    st = db.query(SowType).filter(SowType.id == type_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Scope of Work type not found")
    if payload.name:
        st.name = payload.name
    db.commit()
    db.refresh(st)
    return st

@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_type(type_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    st = db.query(SowType).filter(SowType.id == type_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Scope of Work type not found")
    st.archived = True
    db.commit()

@router.post("/{type_id}/items", response_model=SowTypeItemRead, status_code=status.HTTP_201_CREATED)
def add_item(type_id: int, payload: SowTypeItemCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    st = db.query(SowType).filter(SowType.id == type_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Scope of Work type not found")
    existing = db.query(SowTypeItem).filter(
        SowTypeItem.sow_type_id == type_id,
        SowTypeItem.item_name == payload.item_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Item already exists for this type")
    item = SowTypeItem(sow_type_id=type_id, item_name=payload.item_name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{type_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(type_id: int, item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(SowTypeItem).filter(
        SowTypeItem.id == item_id,
        SowTypeItem.sow_type_id == type_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
