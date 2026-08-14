"""add inventory latest cost supplier and date tracking

Revision ID: c7e91a3f2b1d
Revises: aa348581f421
Create Date: 2026-08-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c7e91a3f2b1d'
down_revision: Union[str, Sequence[str], None] = 'aa348581f421'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('inventory', sa.Column('latest_cost_supplier', sa.String(255), nullable=True))
    op.add_column('inventory', sa.Column('latest_cost_date', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('inventory', 'latest_cost_date')
    op.drop_column('inventory', 'latest_cost_supplier')
