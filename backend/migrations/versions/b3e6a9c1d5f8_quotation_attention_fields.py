"""replace quotation attention_to with structured attention fields
(account_type/salutation/first_name/last_name), matching Billing

Revision ID: b3e6a9c1d5f8
Revises: a1d4f7b9c3e2
Create Date: 2026-08-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b3e6a9c1d5f8'
down_revision: Union[str, Sequence[str], None] = 'a1d4f7b9c3e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('attention_account_type', sa.String(length=20), nullable=True))
    op.add_column('quotations', sa.Column('attention_salutation', sa.String(length=20), nullable=True))
    op.add_column('quotations', sa.Column('attention_first_name', sa.String(length=100), nullable=True))
    op.add_column('quotations', sa.Column('attention_last_name', sa.String(length=100), nullable=True))
    op.drop_column('quotations', 'attention_to')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('quotations', sa.Column('attention_to', sa.String(length=255), nullable=True))
    op.drop_column('quotations', 'attention_last_name')
    op.drop_column('quotations', 'attention_first_name')
    op.drop_column('quotations', 'attention_salutation')
    op.drop_column('quotations', 'attention_account_type')
