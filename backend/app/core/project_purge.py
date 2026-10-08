"""Permanently deleting a project together with everything that belongs to it.

A project's billings, commissions and attendance can't exist without it
(their project_id is required), and its transactions would be orphaned
ledger entries. So a permanent delete removes them all, in FK-safe order,
and then recomputes inventory for any material those transactions moved.
The Archive page shows `related_counts` first so the Admin sees exactly
what goes with it.

The source quotation is kept: with its project gone, Quotations treats it
as not yet converted again.
"""
from decimal import Decimal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.inventory import sync_inventory
from app.models.attendance import Attendance
from app.models.billing import Billing
from app.models.commission import Commission
from app.models.transaction import Transaction


def _transactions(db: Session, project_id: int):
    """The project's own transactions, plus any payment/commission expense
    linked to its billings or commissions (archived ones included)."""
    billing_ids = db.query(Billing.id).filter(Billing.project_id == project_id)
    commission_ids = db.query(Commission.id).filter(Commission.project_id == project_id)
    return db.query(Transaction).filter(or_(
        Transaction.project_id == project_id,
        Transaction.billing_id.in_(billing_ids),
        Transaction.commission_id.in_(commission_ids),
    ))


_STOCK_TYPES = {"Incoming Materials", "Outgoing Materials", "Adjustment"}
_MATERIAL_TYPES = {"Materials Procurement": 1, "Outgoing Materials": 1, "Incoming Materials": -1}


def related_counts(db: Session, project_id: int) -> dict:
    """What a permanent delete would remove: record counts (archived ones
    included), plus the money that currently counts toward the app's totals
    (non-archived only, same rules as the Dashboard) and how many materials'
    stock would change."""
    txs = _transactions(db, project_id).all()
    live = [t for t in txs if not t.archived]
    amt = lambda t: Decimal(str(t.amount or 0))
    income = sum((amt(t) for t in live if t.transaction_type == "Payment"), Decimal(0))
    materials = sum((_MATERIAL_TYPES[t.transaction_type] * amt(t) for t in live if t.transaction_type in _MATERIAL_TYPES), Decimal(0))
    general = sum((amt(t) for t in live if t.transaction_type == "General Expenditure"), Decimal(0))
    commission_payouts = sum((amt(t) for t in live if t.commission_id), Decimal(0))
    labor = db.query(func.sum(Attendance.total_salary)).filter(
        Attendance.project_id == project_id, Attendance.archived == False,
        or_(Attendance.is_direct_hire == False, Attendance.is_direct_hire.is_(None)),
    ).scalar() or Decimal(0)
    unpaid_billed = db.query(func.sum(Billing.amount)).filter(
        Billing.project_id == project_id, Billing.archived == False, Billing.is_paid == False,
    ).scalar() or Decimal(0)
    stock_materials = {
        m.get("material_id")
        for t in live
        if t.transaction_type in _STOCK_TYPES or (t.transaction_type == "Materials Procurement" and t.is_office_expense)
        for m in (t.materials or []) if isinstance(m, dict) and m.get("material_id")
    }
    money = lambda d: str(Decimal(str(d)).quantize(Decimal("0.01")))
    return {
        "transactions": len(txs),
        "billings": db.query(Billing).filter(Billing.project_id == project_id).count(),
        "commissions": db.query(Commission).filter(Commission.project_id == project_id).count(),
        "attendance": db.query(Attendance).filter(Attendance.project_id == project_id).count(),
        "income": money(income),
        "materials_cost": money(materials),
        "other_expenses": money(general),
        "labor_cost": money(labor),
        "commission_payouts": money(commission_payouts),
        "unpaid_billed": money(unpaid_billed),
        "stock_materials": len(stock_materials),
    }


def purge_project(db: Session, project) -> None:
    """Delete the project and all its related records, then commit."""
    pid = project.id
    txs = _transactions(db, pid).all()
    material_ids = {
        m.get("material_id")
        for tx in txs for m in (tx.materials or [])
        if isinstance(m, dict) and m.get("material_id")
    }
    for tx in txs:
        db.delete(tx)
    db.flush()
    db.query(Commission).filter(Commission.project_id == pid).delete(synchronize_session=False)
    db.query(Billing).filter(Billing.project_id == pid).delete(synchronize_session=False)
    db.query(Attendance).filter(Attendance.project_id == pid).delete(synchronize_session=False)
    db.delete(project)
    db.commit()
    for mid in material_ids:
        sync_inventory(db, mid)
