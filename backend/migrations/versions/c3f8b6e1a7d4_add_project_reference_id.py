"""add project reference_id (PRJ-YYYYMM-####), backfill existing rows

Revision ID: c3f8b6e1a7d4
Revises: a4d8e2c6f9b1
Create Date: 2026-09-17 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3f8b6e1a7d4'
down_revision: Union[str, Sequence[str], None] = 'a4d8e2c6f9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('reference_id', sa.String(length=20), nullable=True))
    op.create_unique_constraint('uq_projects_reference_id', 'projects', ['reference_id'])

    # Backfill existing projects. This table has no real creation timestamp,
    # so quotation_date (present on every existing row at the time of this
    # migration) is the closest available proxy for "which month this
    # project belongs to" — grouped by that month, numbered in id order
    # (insertion order) starting at 0001 per month. A project with no
    # quotation_date at all is left with reference_id NULL rather than
    # guessing a month for it.
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, quotation_date FROM projects ORDER BY id ASC")).fetchall()

    counters = {}
    for proj_id, q_date in rows:
        if q_date is None:
            continue
        month_key = q_date.strftime('%Y%m')
        counters[month_key] = counters.get(month_key, 0) + 1
        reference_id = f"PRJ-{month_key}-{counters[month_key]:04d}"
        conn.execute(
            sa.text("UPDATE projects SET reference_id = :ref WHERE id = :id"),
            {"ref": reference_id, "id": proj_id},
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_projects_reference_id', 'projects', type_='unique')
    op.drop_column('projects', 'reference_id')
