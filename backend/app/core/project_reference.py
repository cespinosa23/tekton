from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.project import Project


def assign_reference_id(data: dict, db: Session) -> None:
    """before_create hook for the /projects CRUD router — stamps a new
    project with PRJ-YYYYMM-#### based on the creation month, #### restarting
    at 0001 each month. Runs inside the same request/transaction as the
    insert; the column's unique constraint is the backstop against a
    concurrent duplicate rather than any locking here (this app's write
    volume doesn't warrant it — see the equivalent quote_number precedent)."""
    month_key = datetime.now(timezone.utc).strftime("%Y%m")
    prefix = f"PRJ-{month_key}-"

    existing = db.query(Project.reference_id).filter(
        Project.reference_id.like(f"{prefix}%")
    ).all()
    max_seq = 0
    for (ref,) in existing:
        try:
            seq = int(ref[len(prefix):])
        except (TypeError, ValueError):
            continue
        max_seq = max(max_seq, seq)

    data["reference_id"] = f"{prefix}{max_seq + 1:04d}"
