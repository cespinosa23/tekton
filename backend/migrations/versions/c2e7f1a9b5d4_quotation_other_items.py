"""replace quotation notes_and_exclusions with structured other_items

Revision ID: c2e7f1a9b5d4
Revises: b6d1e4f8a3c7
Create Date: 2026-08-21 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c2e7f1a9b5d4'
down_revision: Union[str, Sequence[str], None] = 'b6d1e4f8a3c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('other_items', sa.JSON(), nullable=True))
    op.drop_column('quotations', 'notes_and_exclusions')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('quotations', sa.Column('notes_and_exclusions', sa.Text(), nullable=True))
    op.drop_column('quotations', 'other_items')
