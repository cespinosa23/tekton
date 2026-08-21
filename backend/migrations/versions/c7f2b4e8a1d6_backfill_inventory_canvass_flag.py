"""backfill NULL inventory.latest_cost_is_canvass to False

Rows created before that column existed (or before the app was restarted to
pick it up) were left with NULL instead of a real boolean, which the
InventoryRead schema rejects — breaking GET /inventory/ entirely.

Revision ID: c7f2b4e8a1d6
Revises: b3e6a9c1d5f8
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c7f2b4e8a1d6'
down_revision: Union[str, Sequence[str], None] = 'b3e6a9c1d5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE inventory SET latest_cost_is_canvass = 0 WHERE latest_cost_is_canvass IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    pass
