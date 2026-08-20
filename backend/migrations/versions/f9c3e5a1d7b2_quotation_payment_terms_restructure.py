"""quotation payment terms restructure: structured payment_term_items,
company_payment_method snapshot, drop free-text terms_of_payment/mode_of_payment

Revision ID: f9c3e5a1d7b2
Revises: e4b7d1a8f3c6
Create Date: 2026-08-21 00:00:00.000002

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f9c3e5a1d7b2'
down_revision: Union[str, Sequence[str], None] = 'e4b7d1a8f3c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('company_payment_method', sa.Text(), nullable=True))
    op.add_column('quotations', sa.Column('payment_term_items', sa.JSON(), nullable=True))
    op.drop_column('quotations', 'terms_of_payment')
    op.drop_column('quotations', 'mode_of_payment')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('quotations', sa.Column('mode_of_payment', sa.String(length=2000), nullable=True))
    op.add_column('quotations', sa.Column('terms_of_payment', sa.String(length=2000), nullable=True))
    op.drop_column('quotations', 'payment_term_items')
    op.drop_column('quotations', 'company_payment_method')
