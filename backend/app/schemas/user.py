from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.schemas.role import RoleName, RoleRead

class RoleReadFromUserRole(BaseModel):
    role: RoleRead
    model_config = {"from_attributes": True}

class UserInvite(BaseModel):
    email: EmailStr
    roles: list[RoleName] = []

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, roles):
        if RoleName.admin in roles and len(roles) > 1:
            raise ValueError("Admin role cannot be combined with other roles")
        return roles

class CompleteRegistration(BaseModel):
    token: str
    password: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    roles: list[RoleName] = []

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, roles):
        if RoleName.admin in roles and len(roles) > 1:
            raise ValueError("Admin role cannot be combined with other roles")
        return roles

class UserRead(BaseModel):
    id: int
    email: str
    is_active: bool
    employee_id: Optional[int] = None
    roles: list[RoleReadFromUserRole] = []

    model_config = {"from_attributes": True}
    
class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str