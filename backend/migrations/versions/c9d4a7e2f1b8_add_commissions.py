"""add commissions

Revision ID: c9d4a7e2f1b8
Revises: b3e8f2c5a7d9
Create Date: 2026-10-07 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c9d4a7e2f1b8'
down_revision: Union[str, Sequence[str], None] = 'b3e8f2c5a7d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'commissions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('commission_type', sa.String(length=30), nullable=False),
        sa.Column('payee_employee_id', sa.Integer(), sa.ForeignKey('employees.id'), nullable=True),
        sa.Column('payee_name', sa.String(length=255), nullable=True),
        sa.Column('is_released', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('released_base', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('released_amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('released_date', sa.Date(), nullable=True),
        sa.Column('released_by', sa.String(length=255), nullable=True),
        sa.UniqueConstraint('project_id', 'commission_type', name='uq_commission_project_type'),
    )
    op.add_column('transactions', sa.Column('commission_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_transactions_commission_id', 'transactions', 'commissions',
        ['commission_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_transactions_commission_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'commission_id')
    op.drop_table('commissions')
