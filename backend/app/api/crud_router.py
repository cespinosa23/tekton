from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.core.deps import get_current_user, require_role

def make_crud_router(
    prefix, tag, Model, CreateSchema, UpdateSchema, ReadSchema,
    allow_archive=True, write_roles: Optional[list[str]] = None
):
    router = APIRouter(prefix=prefix, tags=[tag])
    write_auth = Depends(require_role(write_roles)) if write_roles else Depends(get_current_user)

    @router.get("/", response_model=list[ReadSchema])
    def list_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
        q = db.query(Model)
        if allow_archive and hasattr(Model, "archived"):
            q = q.filter(Model.archived == False)
        return q.offset(skip).limit(limit).all()

    @router.get("/{item_id}", response_model=ReadSchema)
    def get_item(item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
        item = db.query(Model).filter(Model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{tag} not found")
        return item

    @router.post("/", response_model=ReadSchema, status_code=status.HTTP_201_CREATED)
    def create_item(payload: CreateSchema, db: Session = Depends(get_db), _=write_auth):
        item = Model(**payload.model_dump())
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @router.put("/{item_id}", response_model=ReadSchema)
    def update_item(item_id: int, payload: UpdateSchema, db: Session = Depends(get_db), _=write_auth):
        item = db.query(Model).filter(Model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{tag} not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        db.commit()
        db.refresh(item)
        return item

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_item(item_id: int, db: Session = Depends(get_db), _=write_auth):
        item = db.query(Model).filter(Model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{tag} not found")
        if allow_archive and hasattr(Model, "archived"):
            item.archived = True
            db.commit()
        else:
            db.delete(item)
            db.commit()

    return router