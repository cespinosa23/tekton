from pydantic import BaseModel
from enum import Enum

class RoleName(str, Enum):
    admin = "Admin"
    engineer = "Engineer"
    accounting = "Accounting"
    hr = "HR"
    liaison = "Liaison"
    others = "Others"

class RoleRead(BaseModel):
    id: int
    name: RoleName

    model_config = {"from_attributes": True}