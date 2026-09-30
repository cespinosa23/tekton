"""add transaction requested_by

Revision ID: f7c2b8e4a1d5
Revises: a4d7e1c9b3f6
Create Date: 2026-09-30 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f7c2b8e4a1d5'
down_revision: Union[str, Sequence[str], None] = 'a4d7e1c9b3f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('transactions', sa.Column('requested_by_employee_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('requested_by_name', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'fk_transactions_requested_by_employee_id', 'transactions', 'employees',
        ['requested_by_employee_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_transactions_requested_by_employee_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'requested_by_name')
    op.drop_column('transactions', 'requested_by_employee_id')
