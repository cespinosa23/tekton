"""add quotation discount_amount

Revision ID: d6a1c9e4b2f7
Revises: c3f8b6e1a7d4
Create Date: 2026-09-21 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd6a1c9e4b2f7'
down_revision: Union[str, Sequence[str], None] = 'c3f8b6e1a7d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), nullable=True, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('quotations', 'discount_amount')
