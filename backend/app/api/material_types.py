from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.material_type import MaterialType, MaterialTypeBrand
from app.schemas.material_type import (
    MaterialTypeCreate, MaterialTypeUpdate, MaterialTypeRead, MaterialTypeBrandCreate, MaterialTypeBrandRead
)

router = APIRouter(prefix="/material-types", tags=["material_types"])

@router.get("/", response_model=list[MaterialTypeRead])
def list_types(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(MaterialType).filter(MaterialType.archived == False).all()

@router.post("/", response_model=MaterialTypeRead, status_code=status.HTTP_201_CREATED)
def create_type(payload: MaterialTypeCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    existing = db.query(MaterialType).filter(MaterialType.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Material type already exists")
    mt = MaterialType(name=payload.name)
    db.add(mt)
    db.commit()
    db.refresh(mt)
    return mt

@router.put("/{type_id}", response_model=MaterialTypeRead)
def update_type(type_id: int, payload: MaterialTypeUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    mt = db.query(MaterialType).filter(MaterialType.id == type_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Material type not found")
    if payload.name:
        mt.name = payload.name
    db.commit()
    db.refresh(mt)
    return mt

@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_type(type_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    mt = db.query(MaterialType).filter(MaterialType.id == type_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Material type not found")
    mt.archived = True
    db.commit()

@router.post("/{type_id}/brands", response_model=MaterialTypeBrandRead, status_code=status.HTTP_201_CREATED)
def add_brand(type_id: int, payload: MaterialTypeBrandCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    mt = db.query(MaterialType).filter(MaterialType.id == type_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Material type not found")
    existing = db.query(MaterialTypeBrand).filter(
        MaterialTypeBrand.material_type_id == type_id,
        MaterialTypeBrand.brand_name == payload.brand_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Brand already exists for this type")
    brand = MaterialTypeBrand(material_type_id=type_id, brand_name=payload.brand_name)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand

@router.delete("/{type_id}/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_brand(type_id: int, brand_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    brand = db.query(MaterialTypeBrand).filter(
        MaterialTypeBrand.id == brand_id,
        MaterialTypeBrand.material_type_id == type_id
    ).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    db.delete(brand)
    db.commit()