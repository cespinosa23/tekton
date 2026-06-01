from sqlalchemy import Column, Integer, String, Boolean, Date, Numeric, ForeignKey
from app.db.database import Base

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    employee_name = Column(String(255), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    project_name = Column(String(255), nullable=True)
    is_office_based = Column(Boolean, default=False)
    date = Column(Date, nullable=False)
    regular_time_in = Column(String(10), nullable=True)
    regular_time_out = Column(String(10), nullable=True)
    regular_hours = Column(Numeric(5, 2), default=0)
    overtime_time_in = Column(String(10), nullable=True)
    overtime_time_out = Column(String(10), nullable=True)
    overtime_hours = Column(Numeric(5, 2), default=0)
    overtime_multiplier = Column(Numeric(5, 2), default=1.15)
    regular_salary = Column(Numeric(12, 2), default=0)
    overtime_salary = Column(Numeric(12, 2), default=0)
    total_salary = Column(Numeric(12, 2), default=0)
    status = Column(String(50), default="Present")
    remarks = Column(String(500), nullable=True)
    archived = Column(Boolean, default=False)