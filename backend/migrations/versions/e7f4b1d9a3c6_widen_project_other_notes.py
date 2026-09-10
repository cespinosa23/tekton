"""widen project other_notes past its 1000-char cap

Revision ID: e7f4b1d9a3c6
Revises: d1a5c7e9f3b2
Create Date: 2026-09-08 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e7f4b1d9a3c6'
down_revision: Union[str, Sequence[str], None] = 'd1a5c7e9f3b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('projects', 'other_notes',
               existing_type=sa.String(length=1000),
               type_=sa.Text(),
               existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('projects', 'other_notes',
               existing_type=sa.Text(),
               type_=sa.String(length=1000),
               existing_nullable=True)
