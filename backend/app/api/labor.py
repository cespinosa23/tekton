"""Per-project labor totals.

Attendance pay is Admin-only per record (app/core/attendance_pay.py), but PC
and PM still see labor inside totals — a project's Total Expenses, the PM
payments chart, the Dashboard. Those totals used to be summed in the browser
from per-person pay; this endpoint returns the sums instead, so no
individual's pay leaves the server.

Same rule as every labor figure in the app: non-archived attendance, Direct
Hire excluded (the client pays it). Scoped by app/core/access.project_scope.
"""
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.access import project_scope
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.attendance import Attendance

router = APIRouter(prefix="/labor", tags=["labor"])


@router.get("/totals")
def labor_totals(
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """{"by_project": {"<project_id>": "<amount>"}, "unassigned": "<amount>"}.
    `unassigned` is labor not tied to a project (office-based) — only for
    roles with unrestricted scope. `start`/`end` are inclusive dates."""
    scope = project_scope(db, current_user)
    empty = {"by_project": {}, "unassigned": "0.00"}
    if scope is not None and not scope:
        return empty

    q = db.query(Attendance.project_id, func.sum(Attendance.total_salary)).filter(
        Attendance.archived == False,
        or_(Attendance.is_direct_hire == False, Attendance.is_direct_hire.is_(None)),
    )
    if start:
        q = q.filter(Attendance.date >= start)
    if end:
        q = q.filter(Attendance.date <= end)
    if scope is not None:
        q = q.filter(Attendance.project_id.in_(scope))

    by_project, unassigned = {}, Decimal("0")
    for project_id, total in q.group_by(Attendance.project_id):
        amount = Decimal(str(total or 0)).quantize(Decimal("0.01"))
        if project_id is None:
            unassigned += amount
        else:
            by_project[str(project_id)] = str(amount)
    return {"by_project": by_project, "unassigned": str(unassigned)}
