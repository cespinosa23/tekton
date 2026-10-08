"""Who can read what, enforced on the server.

The screens hide plenty per role (permissions.js), but until Oct 2026 the API
returned every record to any logged-in user. These helpers are the server-side
rules (decided Oct 7, 2026; PM opened to all projects Oct 8, 2026):

  Salaries (employee daily salary, attendance pay) .... Admin only
  Per-project labor totals ............................ Admin, PC, PM (all projects)
  Billings (read) ..................................... Admin, PC, PM (all projects)
  Transactions (read) ................................. Admin, PC, PM (all projects)
  Archived records .................................... Admin only

Billing writes (create, mark paid, archive, reset) are Admin and PM — see
app/api/billing.py. is_project_manager is still used by Commissions to check
that a PM commission's payee matches the project's project_manager name.
"""
from sqlalchemy.orm import Session

from app.models.employee import Employee
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


def project_scope(db: Session, user: User) -> set[int] | None:
    """Which projects' billings, transactions and labor totals this user may
    read. None means unrestricted (Admin, Project Coordinator, and — since
    Oct 2026 — Project Manager, who has full access to every project); an
    empty set means none (Engineer, Accounting, Liaison, HR, Others). A set
    of ids would scope to just those projects; no role uses that today."""
    roles = role_names(user)
    if roles & {"Admin", "Project Coordinator", "Project Manager"}:
        return None
    return set()
