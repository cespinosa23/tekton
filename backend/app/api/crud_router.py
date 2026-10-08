from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import Any, Callable, Optional
from app.db.database import get_db
from app.core.deps import get_current_user, require_role

_admin_only = Depends(require_role(["Admin"]))


def _changed_fields(item, updates: dict) -> set[str]:
    """Fields whose value actually differs — numbers compared by value so a
    stored Decimal('8.00') and an incoming 8 count as unchanged."""
    def norm(v):
        if v is None or isinstance(v, (bool, str)):
            return v
        try:
            return Decimal(str(v)).normalize()
        except Exception:
            return v
    return {f for f, v in updates.items() if norm(getattr(item, f, None)) != norm(v)}

def make_crud_router(
    prefix, tag, Model, CreateSchema, UpdateSchema, ReadSchema,
    allow_archive=True, write_roles: Optional[list[str]] = None,
    # Optional (payload_dict, db) -> None hook run just before insert, so a
    # resource can compute a server-generated field (e.g. a sequential
    # reference number) without needing its own hand-rolled router.
    before_create: Optional[Callable[[dict, Session], None]] = None,
    # Optional (payload_dict, user) -> payload_dict, run on create and update
    # payloads before they touch the model (e.g. drop client-sent figures the
    # server computes itself).
    sanitize: Optional[Callable[[dict, Any], dict]] = None,
    # Optional (item, db, changed_fields) -> None, run after fields are set
    # and before commit; changed_fields is None on create.
    on_save: Optional[Callable[[Any, Session, Optional[set]], None]] = None,
    # Optional (read_schema_obj, user) -> read_schema_obj, applied to every
    # record sent back (e.g. blank out Admin-only fields for other roles).
    read_transform: Optional[Callable[[Any, Any], Any]] = None,
):
    router = APIRouter(prefix=prefix, tags=[tag])
    write_auth = Depends(require_role(write_roles)) if write_roles else Depends(get_current_user)

    def out(item, user):
        if not read_transform:
            return item
        return read_transform(ReadSchema.model_validate(item, from_attributes=True), user)

    @router.get("/", response_model=list[ReadSchema])
    def list_items(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
        q = db.query(Model).order_by(Model.id.asc())
        if allow_archive and hasattr(Model, "archived"):
            q = q.filter(Model.archived == False)
        return [out(i, current_user) for i in q.offset(skip).limit(limit).all()]

    # Must be registered BEFORE /{item_id} — otherwise "archived" is captured as the id
    @router.get("/archived", response_model=list[ReadSchema])
    def list_archived(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), current_user=_admin_only):
        # Archived records are Admin-only, matching the Admin-only Archive page.
        if not (allow_archive and hasattr(Model, "archived")):
            return []
        return [out(i, current_user) for i in
                db.query(Model).filter(Model.archived == True).order_by(Model.id.asc()).offset(skip).limit(limit).all()]

    @router.get("/{item_id}", response_model=ReadSchema)
    def get_item(item_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
        item = db.query(Model).filter(Model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{tag} not found")
        return out(item, current_user)

    @router.post("/", response_model=ReadSchema, status_code=status.HTTP_201_CREATED)
    def create_item(payload: CreateSchema, db: Session = Depends(get_db), current_user=write_auth):
        data = payload.model_dump()
        if sanitize:
            data = sanitize(data, current_user)
        if before_create:
            before_create(data, db)
        item = Model(**data)
        db.add(item)
        if on_save:
            on_save(item, db, None)
        db.commit()
        db.refresh(item)
        return out(item, current_user)

    @router.put("/{item_id}", response_model=ReadSchema)
    def update_item(item_id: int, payload: UpdateSchema, db: Session = Depends(get_db), current_user=write_auth):
        item = db.query(Model).filter(Model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{tag} not found")
        updates = payload.model_dump(exclude_unset=True)
        if sanitize:
            updates = sanitize(updates, current_user)
        changed = _changed_fields(item, updates)
        for field, value in updates.items():
            setattr(item, field, value)
        if on_save:
            on_save(item, db, changed)
        db.commit()
        db.refresh(item)
        return out(item, current_user)

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_item(item_id: int, db: Session = Depends(get_db), current_user=write_auth):
        item = db.query(Model).filter(Model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{tag} not found")
        if allow_archive and hasattr(Model, "archived"):
            item.archived = True
            if hasattr(item, "archived_by"):
                item.archived_by = current_user.email
            db.commit()
        else:
            db.delete(item)
            db.commit()

    if allow_archive and hasattr(Model, "archived"):
        @router.post("/{item_id}/restore", response_model=ReadSchema)
        def restore_item(item_id: int, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
            item = db.query(Model).filter(Model.id == item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail=f"{tag} not found")
            item.archived = False
            db.commit()
            db.refresh(item)
            return item

        @router.delete("/{item_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
        def permanent_delete(item_id: int, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
            item = db.query(Model).filter(Model.id == item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail=f"{tag} not found")
            db.delete(item)
            db.commit()

    return router