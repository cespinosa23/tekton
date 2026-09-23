"""add quotation include_vat

Revision ID: e2b7d4f1a9c3
Revises: d6a1c9e4b2f7
Create Date: 2026-09-21 00:00:00.000002

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e2b7d4f1a9c3'
down_revision: Union[str, Sequence[str], None] = 'd6a1c9e4b2f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('include_vat', sa.Boolean(), nullable=True, server_default=sa.false()))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('quotations', 'include_vat')
