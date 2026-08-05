"""add billing payee account type, salutation, first/last name

Revision ID: e6ba98cc3380
Revises: 6ec5f8c6444d
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e6ba98cc3380'
down_revision: Union[str, Sequence[str], None] = '6ec5f8c6444d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('billings', sa.Column('account_type', sa.String(length=20), nullable=True))
    op.add_column('billings', sa.Column('salutation', sa.String(length=20), nullable=True))
    op.add_column('billings', sa.Column('first_name', sa.String(length=100), nullable=True))
    op.add_column('billings', sa.Column('last_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('billings', 'last_name')
    op.drop_column('billings', 'first_name')
    op.drop_column('billings', 'salutation')
    op.drop_column('billings', 'account_type')
