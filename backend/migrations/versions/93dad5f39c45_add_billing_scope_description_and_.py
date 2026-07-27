"""add billing scope description and company letterhead fields

Revision ID: 93dad5f39c45
Revises: 20a6d4a40928
Create Date: 2026-07-16 17:58:18.033322

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '93dad5f39c45'
down_revision: Union[str, Sequence[str], None] = '20a6d4a40928'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # No-op: 'billings.scope_description', 'companies.pcab_license',
    # 'companies.signature_url', and 'companies.logo_url' (as Text) are now
    # created directly in the initial_schema migration (2262fd1ee262).
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
