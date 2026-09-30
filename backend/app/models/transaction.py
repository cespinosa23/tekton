from sqlalchemy import Column, Integer, String, Boolean, Date, Numeric, ForeignKey, JSON
from app.db.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String(100), nullable=False)
    transaction_date = Column(Date, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    project_name = Column(String(255), nullable=True)
    is_office_expense = Column(Boolean, default=False)
    amount = Column(Numeric(12, 2), default=0)
    description = Column(String(500), nullable=True)
    expenditure_category = Column(String(100), nullable=True)
    supplier = Column(String(255), nullable=True)
    archived = Column(Boolean, default=False)
    archived_by = Column(String(255), nullable=True)
    materials = Column(JSON, nullable=True)
    use_fifo_pricing = Column(Boolean, default=False)
    reference_number = Column(String(100), nullable=True)
    remarks = Column(String(500), nullable=True)
    adjustment_direction = Column(String(10), nullable=True)  # 'add' or 'deduct'
    billing_id = Column(Integer, ForeignKey("billings.id"), nullable=True)
    # Who requested the transaction — currently only set from the Materials
    # tab. requested_by_name is a snapshot taken at save time (same pattern
    # as project_name alongside project_id), so it keeps reading correctly
    # even if the employee record is later renamed or archived.
    requested_by_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    requested_by_name = Column(String(255), nullable=True)