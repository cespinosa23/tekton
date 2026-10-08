"""Who can read what, enforced on the server.

The screens hide plenty per role (permissions.js), but until Oct 2026 the API
returned every record to any logged-in user. These helpers are the server-side
rules, decided Oct 7, 2026:

  Salaries (employee daily salary, attendance pay) .... Admin only
  Per-project labor totals ............................ Admin, PC (all), PM (own projects)
  Billings (read) ..................................... Admin, PC (all), PM (own projects)
  Transactions (read) ................................. Admin, PC (all), PM (own projects)
  Archived records .................................... Admin only

A PM's "own" projects are the ones whose project_manager names them —
project_manager is a plain "First Middle Last" string, not a link, so it's
matched by name (see is_project_manager).
"""
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.project import Project
from app.models.user import User


def role_names(user: User) -> set[str]:
    return {ur.role.name for ur in user.roles}


def is_admin(user: User) -> bool:
    return "Admin" in role_names(user)


def norm_name(name: str | None) -> str:
    return " ".join((name or "").split()).lower()


def full_name(employee: Employee) -> str:
    # Same "First Middle Last" join Projects.jsx stores in project_manager.
    return " ".join(p.strip() for p in [employee.first_name, employee.middle_name, employee.last_name] if p and p.strip())


def is_project_manager(employee: Employee, project_manager: str | None) -> bool:
    """Whether this employee is the person named in project.project_manager.

    Matches on first + last name, with any middle name/initial (or none) in
    between — older projects store "Maria Santos" while the employee record
    is "Maria L. Santos". Compared against the stored string as a
    prefix/suffix so multi-word names ("Juan Carlos", "Dela Cruz") work."""
    pm = norm_name(project_manager)
    first = norm_name(employee.first_name)
    last = norm_name(employee.last_name)
    if not pm or not first or not last:
        return False
    if pm == norm_name(full_name(employee)) or pm == f"{first} {last}":
        return True
    return pm.startswith(first + " ") and pm.endswith(" " + last) and len(pm) > len(first) + len(last) + 1


def pm_project_ids(db: Session, user: User) -> set[int]:
    """Projects this user manages, by name. A PM login with no linked
    Employee record manages nothing."""
    if not user.employee_id:
        return set()
    employee = db.query(Employee).filter(Employee.id == user.employee_id).first()
    if not employee:
        return set()
    return {
        pid for pid, pm in db.query(Project.id, Project.project_manager).all()
        if is_project_manager(employee, pm)
    }


def project_scope(db: Session, user: User) -> set[int] | None:
    """Which projects' billings, transactions and labor totals this user may
    read. None means unrestricted (Admin, Project Coordinator); a set means
    only those project ids (Project Manager); an empty set means none
    (Engineer, Accounting, Liaison, HR, Others)."""
    roles = role_names(user)
    if "Admin" in roles or "Project Coordinator" in roles:
        return None
    if "Project Manager" in roles:
        return pm_project_ids(db, user)
    return set()
