"""What a project's permanent delete would take with it — shown in the
Archive page's warning before the Admin confirms. See app/core/project_purge.py."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.core.project_purge import related_counts
from app.db.database import get_db
from app.models.project import Project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/{project_id}/delete-impact")
def project_delete_impact(project_id: int, db: Session = Depends(get_db), _=Depends(require_role(["Admin"]))):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return related_counts(db, project_id)
