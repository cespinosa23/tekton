"""add attendance is_direct_hire flag

Revision ID: f2c8a4e6b9d3
Revises: e7f4b1d9a3c6
Create Date: 2026-09-10 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f2c8a4e6b9d3'
down_revision: Union[str, Sequence[str], None] = 'e7f4b1d9a3c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('attendance', sa.Column('is_direct_hire', sa.Boolean(), nullable=True, server_default=sa.false()))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('attendance', 'is_direct_hire')
