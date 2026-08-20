from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.quotation_template_item import QuotationTemplateItem
from app.schemas.quotation_template_item import (
    QuotationTemplateItemCreate, QuotationTemplateItemUpdate, QuotationTemplateItemRead
)

router = APIRouter(prefix="/quotation-template-items", tags=["quotation_template_items"])

@router.get("/", response_model=list[QuotationTemplateItemRead])
def list_items(category: Optional[str] = Query(default=None), db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(QuotationTemplateItem).filter(QuotationTemplateItem.archived == False)
    if category:
        q = q.filter(QuotationTemplateItem.category == category)
    return q.all()

@router.post("/", response_model=QuotationTemplateItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: QuotationTemplateItemCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    existing = db.query(QuotationTemplateItem).filter(
        QuotationTemplateItem.category == payload.category,
        QuotationTemplateItem.text == payload.text,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This item already exists")
    item = QuotationTemplateItem(category=payload.category, text=payload.text)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{item_id}", response_model=QuotationTemplateItemRead)
def update_item(item_id: int, payload: QuotationTemplateItemUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(QuotationTemplateItem).filter(QuotationTemplateItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if payload.text:
        item.text = payload.text
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_item(item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(QuotationTemplateItem).filter(QuotationTemplateItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.archived = True
    db.commit()
