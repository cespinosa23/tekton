"""add company payment method

Revision ID: e4b7d1a8f3c6
Revises: d8a2c6f4b1e9
Create Date: 2026-08-21 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e4b7d1a8f3c6'
down_revision: Union[str, Sequence[str], None] = 'd8a2c6f4b1e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('companies', sa.Column('payment_method', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('companies', 'payment_method')
