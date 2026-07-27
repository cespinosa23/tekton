"""add billing paid tracking

Revision ID: 20a6d4a40928
Revises: 5c1a2f20e744
Create Date: 2026-07-16 16:25:31.490165

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20a6d4a40928'
down_revision: Union[str, Sequence[str], None] = '5c1a2f20e744'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # No-op: 'is_paid'/'paid_date' are now created directly in the
    # initial_schema migration (2262fd1ee262). See that migration's
    # docstring for why.
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
