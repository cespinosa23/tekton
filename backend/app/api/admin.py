from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.deps import get_db, require_role
from app.models.user import User
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

    # Null out user→employee FK before deleting employees
    db.query(User).update({User.employee_id: None}, synchronize_session=False)

    db.query(Employee).delete(synchronize_session=False)
    db.query(Project).delete(synchronize_session=False)
    db.query(Material).delete(synchronize_session=False)
    db.query(Supplier).delete(synchronize_session=False)

    db.commit()
    return {"message": "All transactional data has been reset."}
