"""add company telephone_number and letterhead print color

Revision ID: 6ec5f8c6444d
Revises: f5d7fa826dc4
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6ec5f8c6444d'
down_revision: Union[str, Sequence[str], None] = 'f5d7fa826dc4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('companies', sa.Column('telephone_number', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('letterhead_color', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('companies', 'letterhead_color')
    op.drop_column('companies', 'telephone_number')
