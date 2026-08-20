"""add inventory latest_cost_is_canvass flag

Revision ID: a1d4f7b9c3e2
Revises: f9c3e5a1d7b2
Create Date: 2026-08-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1d4f7b9c3e2'
down_revision: Union[str, Sequence[str], None] = 'f9c3e5a1d7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('inventory', sa.Column('latest_cost_is_canvass', sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('inventory', 'latest_cost_is_canvass')
