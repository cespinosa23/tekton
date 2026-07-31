"""merge server-bootstrapped initial schema with repo history

Revision ID: f5d7fa826dc4
Revises: 39da0c033061, f0de4b7effeb
Create Date: 2026-07-31 02:26:31.302219

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5d7fa826dc4'
down_revision: Union[str, Sequence[str], None] = ('39da0c033061', 'f0de4b7effeb')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
