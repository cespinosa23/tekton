"""drop unused quotation other_scope_costs column

The Others step no longer has a cost-line-items editor — it's rich-text
notes only now, so this JSON column has no writer left on the frontend.

Revision ID: f3a7c5e0b8d1
Revises: e91b4d2f7a6c
Create Date: 2026-08-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3a7c5e0b8d1'
down_revision: Union[str, Sequence[str], None] = 'e91b4d2f7a6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('quotations', 'other_scope_costs')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('quotations', sa.Column('other_scope_costs', sa.JSON(), nullable=True))
