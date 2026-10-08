from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from app.db.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.employee import Employee
from app.models.user import User
from app.models.attendance import Attendance
from app.models.quotation import Quotation
from app.models.transaction import Transaction
from app.models.commission import Commission
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeRead

router = APIRouter(prefix="/employees", tags=["employees"])


def _out(employee: Employee, user: User) -> EmployeeRead:
    """Daily salary is Admin-only to read (see app/core/access.py). Writes
    were already guarded: a non-Admin can't set or change it."""
    read = EmployeeRead.model_validate(employee, from_attributes=True)
    if not _is_admin(user):
        read.daily_salary = None
    return read


@router.get("/", response_model=List[EmployeeRead])
def list_employees(
    skip: int = 0,
    limit: int = 10000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(Employee).filter(Employee.archived == False).order_by(Employee.id.asc()).offset(skip).limit(limit).all()
    return [_out(e, current_user) for e in rows]


# Must be before /{employee_id} — otherwise "archived" is captured as the id
@router.get("/archived", response_model=List[EmployeeRead])
def list_archived_employees(
    db: Session = Depends(get_db),
    # Archived records are Admin-only, matching the Admin-only Archive page.
    current_user: User = Depends(require_role(["Admin"])),
):
    return db.query(Employee).filter(Employee.archived == True).order_by(Employee.id.asc()).all()


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.archived == False
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _out(employee, current_user)


def _is_admin(user: User) -> bool:
    return any(ur.role.name == "Admin" for ur in user.roles)


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Project Coordinator"])),
):
    data = payload.model_dump()
    if not _is_admin(current_user):
        data["daily_salary"] = Decimal("0")
    employee = Employee(**data)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return _out(employee, current_user)


@router.put("/{employee_id}", response_model=EmployeeRead)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Project Coordinator"])),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.archived == False
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    data = payload.model_dump(exclude_unset=True)
    if not _is_admin(current_user):
        data.pop("daily_salary", None)

    for field, value in data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return _out(employee, current_user)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Project Coordinator"])),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.archived == False
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee.archived = True
    employee.archived_by = current_user.email
    db.commit()


@router.post("/{employee_id}/restore", response_model=EmployeeRead)
def restore_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"])),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.archived = False
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{employee_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanent_delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"])),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # 1. Delete attendance records (FK: attendance.employee_id → employees.id)
    db.query(Attendance).filter(Attendance.employee_id == employee_id).delete()

    # 2. Delete linked user account + their user_roles (cascade on User.roles)
    linked_user = db.query(User).filter(User.employee_id == employee_id).first()
    if linked_user:
        # Quotation FKs to users.id have no ondelete — deleting a user still
        # referenced there would otherwise fail with a raw IntegrityError.
        blocking = db.query(Quotation).filter(or_(
            Quotation.created_by_user_id == linked_user.id,
            Quotation.approval_requested_to_id == linked_user.id,
            Quotation.approval_requested_by_id == linked_user.id,
        )).count()
        if blocking:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot permanently delete: {blocking} quotation(s) still reference this user",
            )
        db.delete(linked_user)

    # 3. Clear the FK on any transaction that named this employee as the
    # requester (FK: transactions.requested_by_employee_id → employees.id).
    # requested_by_name is a separate snapshot column, kept as-is so the
    # transaction still shows who requested it even after the employee
    # record is gone — only the live reference is cleared.
    db.query(Transaction).filter(Transaction.requested_by_employee_id == employee_id).update(
        {Transaction.requested_by_employee_id: None}
    )
    # Same for commission payees (FK: commissions.payee_employee_id ->
    # employees.id) — payee_name is the snapshot that keeps a released
    # commission readable afterward.
    db.query(Commission).filter(Commission.payee_employee_id == employee_id).update(
        {Commission.payee_employee_id: None}
    )

    db.flush()

    # 4. Delete the employee
    db.delete(employee)
    db.commit()