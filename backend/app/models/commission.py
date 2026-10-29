from sqlalchemy import Column, Integer, String, Boolean, Date, Numeric, ForeignKey, UniqueConstraint
from app.db.database import Base


class Commission(Base):
    """One row per (project, commission_type), created the first time a payee
    is assigned or the commission is released. Until then the commission
    exists only as a live calculation in api/commissions.py — every project
    gets one in the Commissions tab whether or not a row has been saved yet.

    Once released, released_amount/released_base are the frozen figures; the
    live formula is never applied to a released commission again."""
    __tablename__ = "commissions"
    __table_args__ = (UniqueConstraint("project_id", "commission_type", name="uq_commission_project_type"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    commission_type = Column(String(30), nullable=False)  # 'electrical_plan' | 'project_management'

    payee_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    # Snapshot taken when the payee is set — same pattern as project_name /
    # requested_by_name, so a released commission still reads correctly if
    # the employee is later renamed or deleted.
    payee_name = Column(String(255), nullable=True)

    # Per-record terms, editable until release. NULL = follow the current
    # default for this type (commission_rates), so a default change still
    # reaches every commission nobody has set by hand.
    #   method: 'assumed_margin' | 'actual' (Project Management only)
    method = Column(String(20), nullable=True)
    rate = Column(Numeric(6, 4), nullable=True)
    margin_rate = Column(Numeric(6, 4), nullable=True)

    is_released = Column(Boolean, default=False, nullable=False)
    # The terms in effect at release (rates as fractions, e.g. 0.0500) — a
    # released commission keeps what it was paid at.
    released_rate = Column(Numeric(6, 4), nullable=True)
    released_method = Column(String(20), nullable=True)
    released_margin_rate = Column(Numeric(6, 4), nullable=True)
    released_base = Column(Numeric(12, 2), nullable=True)
    released_amount = Column(Numeric(12, 2), nullable=True)
    released_date = Column(Date, nullable=True)
    released_by = Column(String(255), nullable=True)


class CommissionRate(Base):
    """Default terms per commission type, managed in Settings: rate (a
    fraction, e.g. 0.0700 for 7%), and for Project Management also the
    default method and margin. Applies to every unreleased commission that
    hasn't been given its own terms. Seeded 5% / 7%, assumed margin 20%."""
    __tablename__ = "commission_rates"

    commission_type = Column(String(30), primary_key=True)
    rate = Column(Numeric(6, 4), nullable=False)
    margin_rate = Column(Numeric(6, 4), nullable=True)
    method = Column(String(20), nullable=True)
    updated_by = Column(String(255), nullable=True)
