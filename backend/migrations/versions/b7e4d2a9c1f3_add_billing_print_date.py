"""add billing print_date

Revision ID: b7e4d2a9c1f3
Revises: e5b1c8f3d6a2
Create Date: 2026-10-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7e4d2a9c1f3'
down_revision: Union[str, Sequence[str], None] = 'e5b1c8f3d6a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The date first chosen when printing a billing letter; pre-fills the
    # date on every later print (which can still be changed per print).
    op.add_column('billings', sa.Column('print_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('billings', 'print_date')
