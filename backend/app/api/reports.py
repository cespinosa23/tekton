"""Totals calculated on the server, so report screens don't download every
transaction and attendance record ever entered just to add them up.

Each figure mirrors the browser calculation it replaces, so the numbers on
screen don't change:
- materials cost per project / overall: sum of each materials line's
  total_cost (Procurement + Outgoing, minus Incoming returns)
- materials in the monthly trend: the transaction amount (same netting)
- other costs: General Expenditure amounts; revenue: Payment amounts
- labor: non-archived attendance pay, Direct Hire excluded
Archived records never count. Read scope follows app/core/access.py.
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.access import project_scope
from app.core.deps import get_current_user, require_role
from app.db.database import get_db
from app.models.attendance import Attendance
from app.models.transaction import Transaction

router = APIRouter(prefix="/reports", tags=["reports"])

_MATERIAL_SIGN = {"Materials Procurement": 1, "Outgoing Materials": 1, "Incoming Materials": -1}
_ZERO = Decimal("0")


def _dec(v) -> Decimal:
    try:
        return Decimal(str(v or 0))
    except Exception:
        return _ZERO


def _lines_cost(tx) -> Decimal:
    return sum((_dec(m.get("total_cost")) for m in (tx.materials or []) if isinstance(m, dict)), _ZERO)


def _money(d: Decimal) -> str:
    return str(d.quantize(Decimal("0.01")))


def _empty_totals():
    return {"labor_cost": _ZERO, "materials_cost": _ZERO, "others_cost": _ZERO, "total_paid": _ZERO, "last_activity": None}


@router.get("/project-totals")
def project_totals(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """All-time totals per project, plus the same totals for records with no
    project ("unassigned": office expenses, office payments, office labor).
    {"projects": {"<id>": {labor_cost, materials_cost, others_cost,
    total_paid, last_activity}}, "unassigned": {...}} — money as strings,
    last_activity as "YYYY-MM-DD" (latest transaction or attendance date)."""
    scope = project_scope(db, current_user)
    if scope is not None and not scope:
        return {"projects": {}, "unassigned": {k: (_money(v) if isinstance(v, Decimal) else v) for k, v in _empty_totals().items()}}

    totals = defaultdict(_empty_totals)

    def bump_activity(t, d):
        if d and (t["last_activity"] is None or d > t["last_activity"]):
            t["last_activity"] = d

    tq = db.query(Transaction).filter(Transaction.archived == False)
    if scope is not None:
        tq = tq.filter(Transaction.project_id.in_(scope))
    for tx in tq:
        t = totals[tx.project_id]
        bump_activity(t, tx.transaction_date)
        if tx.transaction_type in _MATERIAL_SIGN:
            t["materials_cost"] += _MATERIAL_SIGN[tx.transaction_type] * _lines_cost(tx)
        elif tx.transaction_type == "General Expenditure":
            t["others_cost"] += _dec(tx.amount)
        elif tx.transaction_type == "Payment":
            t["total_paid"] += _dec(tx.amount)

    aq = db.query(Attendance.project_id, Attendance.date, Attendance.total_salary, Attendance.is_direct_hire) \
        .filter(Attendance.archived == False)
    if scope is not None:
        aq = aq.filter(Attendance.project_id.in_(scope))
    for project_id, d, pay, direct_hire in aq:
        t = totals[project_id]
        bump_activity(t, d)
        if not direct_hire:
            t["labor_cost"] += _dec(pay)

    def out(t):
        return {
            "labor_cost": _money(t["labor_cost"]), "materials_cost": _money(t["materials_cost"]),
            "others_cost": _money(t["others_cost"]), "total_paid": _money(t["total_paid"]),
            "last_activity": t["last_activity"].isoformat() if t["last_activity"] else None,
        }

    unassigned = totals.pop(None, _empty_totals())
    return {"projects": {str(pid): out(t) for pid, t in totals.items()}, "unassigned": out(unassigned)}


def _month_bounds(ym: str):
    try:
        y, m = (int(p) for p in ym.split("-"))
        start = date(y, m, 1)
    except Exception:
        raise HTTPException(status_code=400, detail="Month must look like YYYY-MM")
    end = date(y + (m == 12), (m % 12) + 1, 1)
    return start, end  # end is exclusive


@router.get("/monthly")
def monthly_trend(
    end_month: str = Query(..., description="Last month to include, YYYY-MM (the browser's current month)"),
    months: int = Query(6, ge=1, le=36),
    db: Session = Depends(get_db),
    _=Depends(require_role(["Admin"])),
):
    """Revenue and costs per month for the `months` months ending at
    end_month: [{month: "YYYY-MM", revenue, labor, materials, general}]."""
    _, end_excl = _month_bounds(end_month)
    y, m = (int(p) for p in end_month.split("-"))
    keys = []
    for i in range(months - 1, -1, -1):
        mm, yy = m - i, y
        while mm <= 0:
            mm += 12
            yy -= 1
        keys.append(f"{yy:04d}-{mm:02d}")
    first_start, _ = _month_bounds(keys[0])
    rows = {k: {"revenue": _ZERO, "labor": _ZERO, "materials": _ZERO, "general": _ZERO} for k in keys}

    for tx in db.query(Transaction).filter(
        Transaction.archived == False,
        Transaction.transaction_date >= first_start, Transaction.transaction_date < end_excl,
    ):
        r = rows.get(tx.transaction_date.strftime("%Y-%m"))
        if r is None:
            continue
        if tx.transaction_type == "Payment":
            r["revenue"] += _dec(tx.amount)
        elif tx.transaction_type in _MATERIAL_SIGN:
            r["materials"] += _MATERIAL_SIGN[tx.transaction_type] * _dec(tx.amount)
        elif tx.transaction_type == "General Expenditure":
            r["general"] += _dec(tx.amount)

    for d, pay in db.query(Attendance.date, Attendance.total_salary).filter(
        Attendance.archived == False,
        or_(Attendance.is_direct_hire == False, Attendance.is_direct_hire.is_(None)),
        Attendance.date >= first_start, Attendance.date < end_excl,
    ):
        r = rows.get(d.strftime("%Y-%m"))
        if r is not None:
            r["labor"] += _dec(pay)

    return [{"month": k, **{f: _money(v) for f, v in rows[k].items()}} for k in keys]


@router.get("/inventory-movement")
def inventory_movement(month: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Stock movement per material + brand for one month (YYYY-MM), matching
    the stored stock levels (app/core/inventory.py sync_inventory):
    project-direct Materials Procurement doesn't touch stock; office
    Procurement + Incoming add, Outgoing subtracts; Adjustments add or
    subtract per adjustment_direction ('add' = in, anything else = out);
    Canvass never counts.
    [{material_id, brand, starting_quantity, quantity_in, quantity_out}]"""
    start, end_excl = _month_bounds(month)
    scope = project_scope(db, current_user)
    if scope is not None and not scope:
        return []

    moves = defaultdict(lambda: {"starting_quantity": _ZERO, "quantity_in": _ZERO, "quantity_out": _ZERO})
    q = db.query(Transaction).filter(
        Transaction.archived == False,
        Transaction.transaction_date < end_excl,
        Transaction.transaction_type.in_(["Materials Procurement", "Incoming Materials", "Outgoing Materials", "Adjustment"]),
    )
    for tx in q:
        if tx.transaction_type == "Materials Procurement" and tx.is_office_expense is not True:
            continue
        if tx.transaction_type == "Adjustment":
            adds = tx.adjustment_direction == "add"
        else:
            adds = tx.transaction_type != "Outgoing Materials"
        before = tx.transaction_date < start
        for m in tx.materials or []:
            if not isinstance(m, dict) or not m.get("material_id"):
                continue
            row = moves[(m["material_id"], m.get("brand") or "")]
            qty = _dec(m.get("quantity"))
            if before:
                row["starting_quantity"] += qty if adds else -qty
            elif adds:
                row["quantity_in"] += qty
            else:
                row["quantity_out"] += qty

    return [
        {"material_id": mid, "brand": brand, **{k: float(v) for k, v in row.items()}}
        for (mid, brand), row in moves.items()
    ]
