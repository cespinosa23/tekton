from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, Enum
from app.db.database import Base
import enum

class EmployeeStatus(str, enum.Enum):
    Active = "Active"
    Inactive = "Inactive"
    Resigned = "Resigned"
    Terminated = "Terminated"

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=True)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    date_hired = Column(Date, nullable=True)
    daily_salary = Column(Numeric(10, 2), default=0)
    sss_number = Column(String(50), nullable=True)
    philhealth_number = Column(String(50), nullable=True)
    pagibig_number = Column(String(50), nullable=True)
    tin_number = Column(String(50), nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    emergency_phone = Column(String(50), nullable=True)
    address = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.Active)
    archived = Column(Boolean, default=False)
    email = Column(String(255), nullable=True)