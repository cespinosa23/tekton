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
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeRead

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/", response_model=List[EmployeeRead])
def list_employees(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Employee).filter(Employee.archived == False).offset(skip).limit(limit).all()


# Must be before /{employee_id} — otherwise "archived" is captured as the id
@router.get("/archived", response_model=List[EmployeeRead])
def list_archived_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Employee).filter(Employee.archived == True).all()


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
    return employee


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
    return employee


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
    return employee


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

    db.flush()

    # 3. Delete the employee
    db.delete(employee)
    db.commit()