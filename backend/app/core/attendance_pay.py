"""Attendance pay, computed on the server.

Pay used to be calculated in the browser (Attendance.jsx calculateSalaries)
from the employee's daily salary. Once daily salary became Admin-only, a
PC/PM's browser no longer has it — so the server computes pay itself, for
every role, and ignores whatever pay figures a client sends. Same formula as
the browser had:

  hourly    = daily_salary / 8
  regular   = hourly x regular_hours
  overtime  = hourly x overtime_multiplier x overtime_hours
  total     = regular + overtime + tip

Tip is entered by whoever logs attendance, so it stays an input (and stays
visible to them); the three computed figures are Admin-only.
"""
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.core.access import is_admin
from app.models.attendance import Attendance
from app.models.employee import Employee

COMPUTED_FIELDS = ("regular_salary", "overtime_salary", "total_salary")
# A change to any of these is what makes stored pay stale.
PAY_INPUTS = ("employee_id", "regular_hours", "overtime_hours", "overtime_multiplier", "tip")

_CENT = Decimal("0.01")
_ZERO = Decimal("0")


def _dec(v) -> Decimal:
    return Decimal(str(v)) if v is not None else _ZERO


def compute_pay(daily_salary, regular_hours, overtime_hours, overtime_multiplier, tip) -> tuple[Decimal, Decimal, Decimal]:
    hourly = _dec(daily_salary) / 8
    regular = hourly * _dec(regular_hours)
    multiplier = _dec(overtime_multiplier) if overtime_multiplier is not None else Decimal("1.15")
    overtime = hourly * multiplier * _dec(overtime_hours)
    total = regular + overtime + _dec(tip)
    q = lambda d: d.quantize(_CENT, rounding=ROUND_HALF_UP)
    return q(regular), q(overtime), q(total)


def strip_client_pay(data: dict, user) -> dict:
    """Drop pay figures a client sends — the server is the only source."""
    for f in COMPUTED_FIELDS:
        data.pop(f, None)
    return data


def apply_pay(item: Attendance, db: Session, changed: set[str] | None) -> None:
    """Recompute stored pay on create (changed is None) or when a pay input
    actually changed. Otherwise leave it: re-saving an old record for an
    unrelated edit (remarks, project) must not reprice it at a daily rate
    that's changed since."""
    if changed is not None and not changed.intersection(PAY_INPUTS):
        return
    employee = db.query(Employee).filter(Employee.id == item.employee_id).first()
    daily = employee.daily_salary if employee else None
    item.regular_salary, item.overtime_salary, item.total_salary = compute_pay(
        daily, item.regular_hours, item.overtime_hours, item.overtime_multiplier, item.tip
    )


def mask_pay(read_obj, user):
    if not is_admin(user):
        for f in COMPUTED_FIELDS:
            setattr(read_obj, f, None)
    return read_obj
