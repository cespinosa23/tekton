"""widen quotation company_logo_url to Text (base64 logos exceed String(500))

Revision ID: e91b4d2f7a6c
Revises: d4f2a8c91e3b
Create Date: 2026-08-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e91b4d2f7a6c'
down_revision: Union[str, Sequence[str], None] = 'd4f2a8c91e3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('quotations', 'company_logo_url', type_=sa.Text(), existing_type=sa.String(500))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('quotations', 'company_logo_url', type_=sa.String(500), existing_type=sa.Text())
