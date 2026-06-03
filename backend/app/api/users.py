from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets
from app.db.database import SessionLocal, get_db
from app.core.deps import require_role, get_current_user
from app.core.security import hash_password
from app.core.email import send_invite_email, send_reset_email
from app.models.user import User
from app.models.role import Role, UserRole
from app.models.employee import Employee
from app.schemas.user import UserInvite, CompleteRegistration, UserRead

router = APIRouter(prefix="/users", tags=["users"])

# MySQL DATETIME has no timezone — always store/compare as naive UTC
def _utcnow():
    return datetime.utcnow().replace(tzinfo=None)


@router.post("/invite", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def invite_user(
    payload: UserInvite,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "HR"])),
):
    # Check duplicate email
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Find existing employee by email instead of creating new one
    employee = db.query(Employee).filter(Employee.email == payload.email).first()
    
    token = secrets.token_urlsafe(32)
    expires = _utcnow() + timedelta(hours=48)

    user = User(
        email=payload.email,
        hashed_password=None,
        is_active=False,
        employee_id=employee.id if employee else None,
        invite_token=token,
        invite_token_expires=expires,
    )
    db.add(user)
    db.flush()

    for role_name in payload.roles:
        role = db.query(Role).filter(Role.name == role_name.value).first()
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{role_name.value}' not found")
        db.add(UserRole(user_id=user.id, role_id=role.id))

    db.commit()
    db.refresh(user)
    background_tasks.add_task(send_invite_email, payload.email, token)
    return user


@router.post("/complete-registration", response_model=UserRead)
def complete_registration(
    payload: CompleteRegistration,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.invite_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.invite_token_expires < _utcnow():
        raise HTTPException(status_code=400, detail="Invite token has expired")
    if user.is_active:
        raise HTTPException(status_code=400, detail="Registration already completed")
    if not payload.first_name or not payload.last_name:
        raise HTTPException(status_code=400, detail="First name and last name are required")

    if user.employee:
        user.employee.first_name = payload.first_name
        user.employee.last_name = payload.last_name
        user.employee.middle_name = payload.middle_name

    user.hashed_password = hash_password(payload.password)
    user.is_active = True
    user.invite_token = None
    user.invite_token_expires = None

    db.commit()
    db.refresh(user)
    return user


@router.post("/forgot-password")
async def forgot_password(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Don't reveal if email exists
        return {"message": "If that email exists, a reset link has been sent"}

    token = secrets.token_urlsafe(32)
    expires = _utcnow() + timedelta(hours=24)

    user.invite_token = token
    user.invite_token_expires = expires
    db.commit()

    background_tasks.add_task(send_reset_email, email, token)
    return {"message": "If that email exists, a reset link has been sent"}


@router.post("/reset-password")
def reset_password(
    token: str,
    new_password: str,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.invite_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.invite_token_expires < _utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user.hashed_password = hash_password(new_password)
    user.is_active = True
    user.invite_token = None
    user.invite_token_expires = None
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/admin-reset-password")
def admin_reset_password(
    user_email: str,
    new_password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"])),
):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)
    user.is_active = True
    user.invite_token = None
    user.invite_token_expires = None
    db.commit()
    return {"message": f"Password reset for {user_email}"}

@router.get("/registration-info")
def get_registration_info(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.invite_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.invite_token_expires < _utcnow():
        raise HTTPException(status_code=400, detail="Token has expired")
    return {
        "email": user.email,
        "first_name": user.employee.first_name if user.employee else "",
        "last_name": user.employee.last_name if user.employee else "",
        "middle_name": user.employee.middle_name if user.employee else "",
    }
    
@router.get("/employee-roles")
def get_employee_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = db.query(User).filter(User.employee_id != None).all()
    return {
        u.employee_id: {
            "roles": [ur.role.name for ur in u.roles],
            "is_active": u.is_active,
        }
        for u in users
    }


@router.post("/resend-invite")
async def resend_invite(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "HR"])),
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")
    if user.is_active:
        raise HTTPException(status_code=400, detail="This user has already completed registration")

    # Generate a fresh token with a new 48-hour window
    user.invite_token = secrets.token_urlsafe(32)
    user.invite_token_expires = _utcnow() + timedelta(hours=48)
    db.commit()

    background_tasks.add_task(send_invite_email, email, user.invite_token)
    return {"message": "Invite resent successfully"}