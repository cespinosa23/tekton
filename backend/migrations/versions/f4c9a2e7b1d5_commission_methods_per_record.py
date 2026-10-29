"""commission methods and per-record terms

Revision ID: f4c9a2e7b1d5
Revises: d3a8f6c2e9b4
Create Date: 2026-10-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f4c9a2e7b1d5'
down_revision: Union[str, Sequence[str], None] = 'd3a8f6c2e9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('commissions', sa.Column('method', sa.String(length=20), nullable=True))
    op.add_column('commissions', sa.Column('rate', sa.Numeric(precision=6, scale=4), nullable=True))
    op.add_column('commissions', sa.Column('margin_rate', sa.Numeric(precision=6, scale=4), nullable=True))
    op.add_column('commissions', sa.Column('released_method', sa.String(length=20), nullable=True))
    op.add_column('commissions', sa.Column('released_margin_rate', sa.Numeric(precision=6, scale=4), nullable=True))
    # Everything released so far was computed as project cost minus actual
    # expenses. Unreleased ones keep NULL terms, so they follow the new
    # default (assumed margin) — client decision, Oct 2026.
    op.execute("UPDATE commissions SET released_method = 'actual' "
               "WHERE is_released = 1 AND commission_type = 'project_management'")

    op.add_column('commission_rates', sa.Column('margin_rate', sa.Numeric(precision=6, scale=4), nullable=True))
    op.add_column('commission_rates', sa.Column('method', sa.String(length=20), nullable=True))
    # The rate is reset to 7% on purpose: staging had it set to 1.4% (= 7% x
    # 20%) to imitate the assumed margin under the old single formula; kept
    # under the new method, the 20% margin would apply twice.
    op.execute("UPDATE commission_rates SET rate = 0.07, margin_rate = 0.20, method = 'assumed_margin' "
               "WHERE commission_type = 'project_management'")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('commission_rates', 'method')
    op.drop_column('commission_rates', 'margin_rate')
    op.drop_column('commissions', 'released_margin_rate')
    op.drop_column('commissions', 'released_method')
    op.drop_column('commissions', 'margin_rate')
    op.drop_column('commissions', 'rate')
    op.drop_column('commissions', 'method')
