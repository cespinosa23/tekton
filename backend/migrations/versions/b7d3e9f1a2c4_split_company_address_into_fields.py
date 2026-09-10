"""split company address into structured fields

Revision ID: b7d3e9f1a2c4
Revises: a3f7c2d81b90
Create Date: 2026-09-08 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7d3e9f1a2c4'
down_revision: Union[str, Sequence[str], None] = 'a3f7c2d81b90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('companies', sa.Column('address_line1', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('address_line2', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('companies', sa.Column('state_province', sa.String(length=100), nullable=True))
    op.add_column('companies', sa.Column('postal_code', sa.String(length=20), nullable=True))
    op.add_column('companies', sa.Column('country', sa.String(length=100), nullable=True, server_default='Philippines'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('companies', 'country')
    op.drop_column('companies', 'postal_code')
    op.drop_column('companies', 'state_province')
    op.drop_column('companies', 'city')
    op.drop_column('companies', 'address_line2')
    op.drop_column('companies', 'address_line1')
