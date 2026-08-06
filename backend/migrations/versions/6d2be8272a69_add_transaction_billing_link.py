"""link transactions to the billing they were auto-generated from

Revision ID: 6d2be8272a69
Revises: e6ba98cc3380
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6d2be8272a69'
down_revision: Union[str, Sequence[str], None] = 'e6ba98cc3380'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('transactions', sa.Column('billing_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_transactions_billing_id', 'transactions', 'billings', ['billing_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_transactions_billing_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'billing_id')
