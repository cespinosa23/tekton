"""split quotation addressee address into structured fields

Revision ID: d1a5c7e9f3b2
Revises: c9e2f4b6a8d1
Create Date: 2026-09-08 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd1a5c7e9f3b2'
down_revision: Union[str, Sequence[str], None] = 'c9e2f4b6a8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('addressee_address_line1', sa.String(length=255), nullable=True))
    op.add_column('quotations', sa.Column('addressee_address_line2', sa.String(length=255), nullable=True))
    op.add_column('quotations', sa.Column('addressee_city', sa.String(length=100), nullable=True))
    op.add_column('quotations', sa.Column('addressee_state_province', sa.String(length=100), nullable=True))
    op.add_column('quotations', sa.Column('addressee_postal_code', sa.String(length=20), nullable=True))
    op.add_column('quotations', sa.Column('addressee_country', sa.String(length=100), nullable=True, server_default='Philippines'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('quotations', 'addressee_country')
    op.drop_column('quotations', 'addressee_postal_code')
    op.drop_column('quotations', 'addressee_state_province')
    op.drop_column('quotations', 'addressee_city')
    op.drop_column('quotations', 'addressee_address_line2')
    op.drop_column('quotations', 'addressee_address_line1')
