"""quotation approval history

Revision ID: 487851b0a0c2
Revises: d5a8c2f6b9e3
Create Date: 2026-08-25 14:19:42.799845

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '487851b0a0c2'
down_revision: Union[str, Sequence[str], None] = 'd5a8c2f6b9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('approval_history', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('quotations', 'approval_history')
