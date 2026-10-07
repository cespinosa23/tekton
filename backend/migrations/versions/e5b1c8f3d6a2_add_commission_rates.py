"""add commission rates

Revision ID: e5b1c8f3d6a2
Revises: c9d4a7e2f1b8
Create Date: 2026-10-07 00:00:00.000002

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5b1c8f3d6a2'
down_revision: Union[str, Sequence[str], None] = 'c9d4a7e2f1b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    rates = op.create_table(
        'commission_rates',
        sa.Column('commission_type', sa.String(length=30), primary_key=True),
        sa.Column('rate', sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column('updated_by', sa.String(length=255), nullable=True),
    )
    op.bulk_insert(rates, [
        {'commission_type': 'electrical_plan', 'rate': 0.05},
        {'commission_type': 'project_management', 'rate': 0.07},
    ])

    op.add_column('commissions', sa.Column('released_rate', sa.Numeric(precision=6, scale=4), nullable=True))
    # Anything released before rates became editable was released at the
    # original fixed rates.
    op.execute("UPDATE commissions SET released_rate = 0.05 WHERE is_released = 1 AND commission_type = 'electrical_plan'")
    op.execute("UPDATE commissions SET released_rate = 0.07 WHERE is_released = 1 AND commission_type = 'project_management'")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('commissions', 'released_rate')
    op.drop_table('commission_rates')
