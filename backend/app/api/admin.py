from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.deps import get_db, require_role, get_current_user
from app.models.user import User
from app.models.role import Role, UserRole
from app.schemas.user import UserRead
from app.models.employee import Employee
from app.models.project import Project
from app.models.attendance import Attendance
from app.models.material import Material
from app.models.inventory import Inventory
from app.models.supplier import Supplier
from app.models.transaction import Transaction

router = APIRouter(prefix="/admin", tags=["admin"])

_admin_only = require_role(["Admin"])


@router.post("/reset", status_code=200)
def reset_data(db: Session = Depends(get_db), _=Depends(_admin_only)):
    # Delete in FK-safe order: dependents first
    db.query(Attendance).delete(synchronize_session=False)
    db.query(Transaction).delete(synchronize_session=False)
    db.query(Inventory).delete(synchronize_session=False)

    # Delete non-admin users (keeps Admin accounts so the admin can still log in)
    admin_role = db.query(Role).filter(Role.name == "Admin").first()
    if admin_role:
        admin_user_ids = {ur.user_id for ur in db.query(UserRole).filter(UserRole.role_id == admin_role.id).all()}
    else:
        admin_user_ids = set()
    non_admin_users = db.query(User).filter(~User.id.in_(admin_user_ids)).all()
    for user in non_admin_users:
        db.delete(user)
    db.flush()

    # Null out admin user→employee FK before deleting employees
    db.query(User).update({User.employee_id: None}, synchronize_session=False)

    db.query(Employee).delete(synchronize_session=False)
    db.query(Project).delete(synchronize_session=False)
    db.query(Material).delete(synchronize_session=False)
    db.query(Supplier).delete(synchronize_session=False)

    db.commit()
    return {"message": "All data has been reset."}


@router.get("/users", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), _=Depends(_admin_only)):
    return db.query(User).order_by(User.id).all()


@router.post("/users/{user_id}/force-logout", status_code=200)
def force_logout_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(_admin_only),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot force-logout yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.token_version += 1
    db.commit()
    return {"message": f"{user.email} has been logged out."}
