"""add structured scope of work items to quotations

Revision ID: aa348581f421
Revises: 101294a9d0bd
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'aa348581f421'
down_revision: Union[str, Sequence[str], None] = '101294a9d0bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('scope_of_work_items', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('quotations', 'scope_of_work_items')
