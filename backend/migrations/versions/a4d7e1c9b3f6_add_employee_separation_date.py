"""add employee separation_date

Revision ID: a4d7e1c9b3f6
Revises: e2b7d4f1a9c3
Create Date: 2026-09-30 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a4d7e1c9b3f6'
down_revision: Union[str, Sequence[str], None] = 'e2b7d4f1a9c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('employees', sa.Column('separation_date', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('employees', 'separation_date')
