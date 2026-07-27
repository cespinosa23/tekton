"""add billing table

Revision ID: 5c1a2f20e744
Revises: 2262fd1ee262
Create Date: 2026-07-15 22:56:15.041075

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5c1a2f20e744'
down_revision: Union[str, Sequence[str], None] = '2262fd1ee262'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # No-op: 'billings' is now created directly in the initial_schema
    # migration (2262fd1ee262), which was rewritten to contain the real
    # DDL for every table instead of being an empty stub.
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
