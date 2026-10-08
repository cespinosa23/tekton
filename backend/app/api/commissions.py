"""Commissions — Admin-only.

Two types per project:
  Electrical Plan     = Electrical Plan cost            x rate (default 5%)
  Project Management  = (Project Cost - Expenses)       x rate (default 7%)

Rates live in commission_rates and are Admin-editable. A rate change applies
to every unreleased commission immediately; a released commission keeps the
rate it was released at (released_rate).

Amounts are always computed here, server-side, and the frozen figure at
release comes from this same calculation — never from a value the browser
sends — so a released amount can't be tampered with.

Decisions behind the behavior (client-confirmed, Oct 2026):
  - Released commission expenses are EXCLUDED from the Expenses used in the
    Project Management formula, so one commission's payout doesn't shrink the
    other (or itself).
  - Electrical Plan payee: any employee. Project Management payee: only the
    project's own Project Manager.
  - Releasing locks the commission. Admin can reverse a release, which
    archives the expense it created — mirrors billing.py's mark-paid /
    unmark-paid.
  - Release is allowed any time; the amount is live until release, then
    frozen and never recalculated.
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.access import full_name as _full_name, is_project_manager as _is_project_manager
from app.core.deps import require_role
from app.db.database import get_db
from app.models.attendance import Attendance
from app.models.commission import Commission, CommissionRate
from app.models.employee import Employee
from app.models.project import Project
from app.models.transaction import Transaction
from app.schemas.commission import CommissionPayeeUpdate, CommissionRates, CommissionRelease, CommissionRow

_admin = require_role(["Admin"])

router = APIRouter(prefix="/commissions", tags=["commissions"])

# Fallback only — the migration seeds commission_rates with these, so they
# apply if a row is ever missing, never alongside an edited rate.
DEFAULT_RATES = {"electrical_plan": Decimal("0.0500"), "project_management": Decimal("0.0700")}
TYPE_LABELS = {"electrical_plan": "Electrical Plan", "project_management": "Project Management"}
EXPENDITURE_CATEGORY = "Commission"

_CENT = Decimal("0.01")
_ZERO = Decimal("0")

# How each transaction type moves a project's expenses — the same arithmetic
# ProjectView.jsx uses for its "Total Expenses" card (materials = procurement
# + outgoing - incoming, plus General Expenditures). Keep the two in step.
_EXPENSE_SIGN = {
    "Materials Procurement": 1,
    "Outgoing Materials": 1,
    "Incoming Materials": -1,
    "General Expenditure": 1,
}


def _dec(value) -> Decimal:
    return Decimal(str(value)) if value is not None else _ZERO


def _current_rates(db: Session) -> dict[str, Decimal]:
    rates = dict(DEFAULT_RATES)
    for row in db.query(CommissionRate).all():
        if row.commission_type in rates:
            rates[row.commission_type] = _dec(row.rate)
    return rates


def _expenses_by_project(db: Session, project_ids: list[int] | None = None) -> dict[int, Decimal]:
    """Project expenses for the Project Management formula: materials +
    General Expenditures + labor (non-Direct-Hire attendance), matching
    ProjectView.jsx — except commission payouts themselves (commission_id
    set) are left out, per the decision above."""
    tx_q = db.query(Transaction.project_id, Transaction.transaction_type, func.sum(Transaction.amount)).filter(
        Transaction.archived == False,
        Transaction.project_id.isnot(None),
        Transaction.commission_id.is_(None),
    )
    att_q = db.query(Attendance.project_id, func.sum(Attendance.total_salary)).filter(
        Attendance.archived == False,
        Attendance.project_id.isnot(None),
        or_(Attendance.is_direct_hire == False, Attendance.is_direct_hire.is_(None)),
    )
    if project_ids is not None:
        tx_q = tx_q.filter(Transaction.project_id.in_(project_ids))
        att_q = att_q.filter(Attendance.project_id.in_(project_ids))

    totals: dict[int, Decimal] = defaultdict(lambda: _ZERO)
    for project_id, tx_type, total in tx_q.group_by(Transaction.project_id, Transaction.transaction_type):
        sign = _EXPENSE_SIGN.get(tx_type)
        if sign:
            totals[project_id] += sign * _dec(total)
    for project_id, total in att_q.group_by(Attendance.project_id):
        totals[project_id] += _dec(total)
    return totals


def _electrical_plan_cost(project: Project) -> Decimal:
    return _dec(project.scope_electrical_plan_cost) if project.scope_electrical_plan else _ZERO


def _live_base(project: Project, ctype: str, expenses: Decimal) -> Decimal:
    if ctype == "electrical_plan":
        return _electrical_plan_cost(project)
    return _dec(project.contract_cost) - expenses


def _amount(base: Decimal, rate: Decimal) -> Decimal:
    # Expenses above project cost make the base negative — that's no
    # commission, not a negative one.
    return (max(base, _ZERO) * rate).quantize(_CENT, rounding=ROUND_HALF_UP)


def _applicable_types(project: Project, saved: dict[str, Commission]) -> list[str]:
    """Every project gets a Project Management commission. An Electrical
    Plan commission only exists when the project actually has an Electrical
    Plan cost — or when one was already released (still shown, frozen, even
    if the scope was removed from the project afterward)."""
    types = []
    released_ep = saved.get("electrical_plan")
    if _electrical_plan_cost(project) > 0 or (released_ep and released_ep.is_released):
        types.append("electrical_plan")
    types.append("project_management")
    return types


def _payee_issue(project: Project, ctype: str, commission: Commission | None, payee: Employee | None) -> str | None:
    """Why an unreleased commission's saved payee can't be released to as-is
    — e.g. the project's PM changed after the payee was picked. Lets the
    page explain the problem and keep Release disabled, instead of offering
    a Release that the server then refuses."""
    if not commission or commission.is_released or not commission.payee_employee_id:
        return None
    if ctype != "project_management":
        return None
    if not project.project_manager:
        return "This project no longer has a Project Manager — clear the payee, or set a PM on the project."
    if not payee or not _is_project_manager(payee, project.project_manager):
        return f"The project's Project Manager is now {project.project_manager} — pick the payee again."
    return None


def _row(project: Project, ctype: str, commission: Commission | None, expenses: Decimal,
         rates: dict[str, Decimal], payee: Employee | None = None) -> CommissionRow:
    if commission and commission.is_released:
        base = _dec(commission.released_base)
        amount = _dec(commission.released_amount)
        rate = _dec(commission.released_rate) if commission.released_rate is not None else rates[ctype]
    else:
        base = _live_base(project, ctype, expenses)
        rate = rates[ctype]
        amount = _amount(base, rate)
    return CommissionRow(
        id=commission.id if commission else None,
        project_id=project.id,
        project_name=project.project_name,
        project_reference_id=project.reference_id,
        project_manager=project.project_manager,
        project_status=project.status,
        project_archived=bool(project.archived),
        commission_type=ctype,
        rate=rate,
        base=base.quantize(_CENT, rounding=ROUND_HALF_UP),
        amount=amount,
        payee_employee_id=commission.payee_employee_id if commission else None,
        payee_name=commission.payee_name if commission else None,
        payee_issue=_payee_issue(project, ctype, commission, payee),
        is_released=bool(commission and commission.is_released),
        released_date=commission.released_date if commission else None,
        released_by=commission.released_by if commission else None,
    )


def _get_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.archived == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_or_create(db: Session, project_id: int, ctype: str) -> Commission:
    """Row-locked fetch, creating the row on first use.

    Two InnoDB deadlocks this avoids, both reproduced against a real server
    with simultaneous first-time requests (error 1213):
      - SELECT ... FOR UPDATE on a row that doesn't exist yet takes a gap
        lock; two requests holding it then deadlock on their INSERTs.
      - A losing INSERT that hits the unique (project_id, commission_type)
        key is left holding a *shared* lock on the winner's row; several
        losers then all upgrade to FOR UPDATE at once and deadlock.
    So: a plain (non-locking) read, and if the row is missing, create it
    in its own transaction and COMMIT straight away — a loser's rollback
    releases its shared lock before it ever asks for the exclusive one.
    Only then is the now-existing row locked. Committing an empty row (no
    payee, unreleased) is harmless: that's exactly what a fresh one is.
    Callers must not have pending writes when they call this."""
    def find(lock: bool):
        q = db.query(Commission).filter(Commission.project_id == project_id, Commission.commission_type == ctype)
        return (q.with_for_update() if lock else q).first()

    if not find(lock=False):
        try:
            db.add(Commission(project_id=project_id, commission_type=ctype, is_released=False))
            db.commit()
        except IntegrityError:
            db.rollback()
    return find(lock=True)


def _require_applicable(project: Project, ctype: str):
    if ctype == "electrical_plan" and _electrical_plan_cost(project) <= 0:
        raise HTTPException(status_code=400, detail="This project has no Electrical Plan cost, so it has no Electrical Plan commission.")


def _check_pm_payee(project: Project, employee: Employee | None):
    if not project.project_manager:
        raise HTTPException(status_code=400, detail="This project has no Project Manager assigned yet — set one on the project first.")
    if not employee or not _is_project_manager(employee, project.project_manager):
        raise HTTPException(
            status_code=400,
            detail=f"Only this project's Project Manager ({project.project_manager}) can receive its Project Management commission.",
        )


@router.get("/", response_model=list[CommissionRow])
def list_commissions(db: Session = Depends(get_db), _=Depends(_admin)):
    projects = db.query(Project).filter(Project.archived == False).order_by(Project.id.desc()).all()
    saved: dict[int, dict[str, Commission]] = defaultdict(dict)
    commissions = db.query(Commission).all()
    for c in commissions:
        saved[c.project_id][c.commission_type] = c
    payee_ids = {c.payee_employee_id for c in commissions if c.payee_employee_id}
    # Archived employees included: a payee who has since left is still valid.
    payees = {e.id: e for e in db.query(Employee).filter(Employee.id.in_(payee_ids))} if payee_ids else {}
    expenses = _expenses_by_project(db)
    rates = _current_rates(db)

    rows = []
    for project in projects:
        for ctype in _applicable_types(project, saved[project.id]):
            c = saved[project.id].get(ctype)
            rows.append(_row(project, ctype, c, expenses.get(project.id, _ZERO), rates,
                             payees.get(c.payee_employee_id) if c else None))

    # An archived project's released commissions stay listed (only those —
    # nothing new can be paid on an archived project), otherwise a payout
    # released before archiving would vanish from the only page that can
    # reverse it, while its expense stays locked everywhere else.
    released_project_ids = {c.project_id for c in commissions if c.is_released}
    if released_project_ids:
        archived = db.query(Project).filter(Project.archived == True, Project.id.in_(released_project_ids)).order_by(Project.id.desc())
        for project in archived:
            for ctype, c in saved[project.id].items():
                if c.is_released:
                    rows.append(_row(project, ctype, c, _ZERO, rates, payees.get(c.payee_employee_id)))
    return rows


def _payee_of(db: Session, commission: Commission) -> Employee | None:
    if not commission.payee_employee_id:
        return None
    return db.query(Employee).filter(Employee.id == commission.payee_employee_id).first()


def _rates_as_percent(db: Session) -> CommissionRates:
    return CommissionRates(**{k: (v * 100).quantize(_CENT) for k, v in _current_rates(db).items()})


@router.get("/rates", response_model=CommissionRates)
def get_rates(db: Session = Depends(get_db), _=Depends(_admin)):
    return _rates_as_percent(db)


@router.put("/rates", response_model=CommissionRates)
def update_rates(payload: CommissionRates, db: Session = Depends(get_db), current_user=Depends(_admin)):
    for ctype, percent in payload.model_dump().items():
        rate = (Decimal(percent) / 100).quantize(Decimal("0.0001"))
        row = db.query(CommissionRate).filter(CommissionRate.commission_type == ctype).first()
        if row:
            row.rate = rate
            row.updated_by = current_user.email
        else:
            db.add(CommissionRate(commission_type=ctype, rate=rate, updated_by=current_user.email))
    db.commit()
    return _rates_as_percent(db)


@router.put("/payee", response_model=CommissionRow)
def set_payee(payload: CommissionPayeeUpdate, db: Session = Depends(get_db), _=Depends(_admin)):
    project = _get_project(db, payload.project_id)
    _require_applicable(project, payload.commission_type)
    commission = _get_or_create(db, project.id, payload.commission_type)
    if commission.is_released:
        raise HTTPException(status_code=400, detail="This commission has been released and is locked — reverse the release first to change its payee.")

    if payload.payee_employee_id is None:
        commission.payee_employee_id = None
        commission.payee_name = None
    else:
        employee = db.query(Employee).filter(Employee.id == payload.payee_employee_id, Employee.archived == False).first()
        if not employee:
            raise HTTPException(status_code=400, detail="Employee not found")
        name = _full_name(employee)
        if payload.commission_type == "project_management":
            _check_pm_payee(project, employee)
        commission.payee_employee_id = employee.id
        commission.payee_name = name

    db.commit()
    db.refresh(commission)
    expenses = _expenses_by_project(db, [project.id]).get(project.id, _ZERO)
    return _row(project, commission.commission_type, commission, expenses, _current_rates(db), _payee_of(db, commission))


@router.post("/release", response_model=CommissionRow)
def release_commission(payload: CommissionRelease, db: Session = Depends(get_db), current_user=Depends(_admin)):
    project = _get_project(db, payload.project_id)
    _require_applicable(project, payload.commission_type)
    # Row-locked (via _get_or_create) so two concurrent releases can't both
    # pass the is_released check and each create their own expense.
    commission = _get_or_create(db, project.id, payload.commission_type)
    if commission.is_released:
        raise HTTPException(status_code=400, detail="This commission has already been released.")
    if not commission.payee_employee_id:
        raise HTTPException(status_code=400, detail="Choose who this commission is payable to before releasing it.")
    if payload.commission_type == "project_management":
        # The project's PM may have changed since the payee was picked.
        # Archived employees still count — someone who has since left is
        # still owed a commission earned while they were the PM.
        payee = db.query(Employee).filter(Employee.id == commission.payee_employee_id).first()
        _check_pm_payee(project, payee)

    expenses = _expenses_by_project(db, [project.id]).get(project.id, _ZERO)
    rates = _current_rates(db)
    rate = rates[payload.commission_type]
    base = _live_base(project, payload.commission_type, expenses)
    amount = _amount(base, rate)
    if amount <= 0:
        detail = ("Nothing to release — expenses are at or above the project cost, so the commission is zero."
                  if payload.commission_type == "project_management"
                  else "Nothing to release — the commission amount is zero.")
        raise HTTPException(status_code=400, detail=detail)

    release_date = payload.release_date or date.today()
    commission.is_released = True
    commission.released_rate = rate
    commission.released_base = base.quantize(_CENT, rounding=ROUND_HALF_UP)
    commission.released_amount = amount
    commission.released_date = release_date
    commission.released_by = current_user.email

    db.add(Transaction(
        transaction_type="General Expenditure",
        transaction_date=release_date,
        project_id=project.id,
        project_name=project.project_name,
        is_office_expense=False,
        amount=amount,
        expenditure_category=EXPENDITURE_CATEGORY,
        description=f"{TYPE_LABELS[payload.commission_type]} commission — {commission.payee_name}",
        commission_id=commission.id,
    ))
    db.commit()
    db.refresh(commission)
    return _row(project, commission.commission_type, commission, expenses, rates, _payee_of(db, commission))


@router.post("/{commission_id}/reverse", response_model=CommissionRow)
def reverse_release(commission_id: int, db: Session = Depends(get_db), current_user=Depends(_admin)):
    commission = db.query(Commission).filter(Commission.id == commission_id).with_for_update().first()
    if not commission:
        raise HTTPException(status_code=404, detail="Commission not found")
    if not commission.is_released:
        raise HTTPException(status_code=400, detail="This commission hasn't been released.")

    db.query(Transaction).filter(
        Transaction.commission_id == commission.id, Transaction.archived == False
    ).update({"archived": True, "archived_by": current_user.email})
    commission.is_released = False
    commission.released_rate = None
    commission.released_base = None
    commission.released_amount = None
    commission.released_date = None
    commission.released_by = None
    db.commit()
    db.refresh(commission)

    project = db.query(Project).filter(Project.id == commission.project_id).first()
    expenses = _expenses_by_project(db, [project.id]).get(project.id, _ZERO)
    return _row(project, commission.commission_type, commission, expenses, _current_rates(db), _payee_of(db, commission))
