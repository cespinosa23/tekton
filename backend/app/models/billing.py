from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, ForeignKey
from app.db.database import Base

class Billing(Base):
    __tablename__ = "billings"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    billing_type = Column(String(20), nullable=False)  # 'down_payment' | 'progress' | 'retention_release'
    sequence_number = Column(Integer, nullable=False)
    billing_date = Column(Date, nullable=False)

    current_percentage = Column(Numeric(5, 2), nullable=True)
    previous_percentage = Column(Numeric(5, 2), nullable=True)

    dp_amount = Column(Numeric(12, 2), nullable=True)
    retention_amount = Column(Numeric(12, 2), nullable=True)
    scope_description = Column(String(500), nullable=True)

    amount = Column(Numeric(12, 2), default=0)
    notes = Column(String(500), nullable=True)

    is_paid = Column(Boolean, default=False)
    paid_date = Column(Date, nullable=True)

    archived = Column(Boolean, default=False)
    archived_by = Column(String(255), nullable=True)
