"""split project address into structured fields

Revision ID: c9e2f4b6a8d1
Revises: b7d3e9f1a2c4
Create Date: 2026-09-08 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c9e2f4b6a8d1'
down_revision: Union[str, Sequence[str], None] = 'b7d3e9f1a2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('address_line1', sa.String(length=255), nullable=True))
    op.add_column('projects', sa.Column('address_line2', sa.String(length=255), nullable=True))
    op.add_column('projects', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('projects', sa.Column('state_province', sa.String(length=100), nullable=True))
    op.add_column('projects', sa.Column('postal_code', sa.String(length=20), nullable=True))
    op.add_column('projects', sa.Column('country', sa.String(length=100), nullable=True, server_default='Philippines'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('projects', 'country')
    op.drop_column('projects', 'postal_code')
    op.drop_column('projects', 'state_province')
    op.drop_column('projects', 'city')
    op.drop_column('projects', 'address_line2')
    op.drop_column('projects', 'address_line1')
