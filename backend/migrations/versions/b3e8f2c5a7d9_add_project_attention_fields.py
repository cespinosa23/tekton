"""add project attention fields

Revision ID: b3e8f2c5a7d9
Revises: f7c2b8e4a1d5
Create Date: 2026-10-03 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b3e8f2c5a7d9'
down_revision: Union[str, Sequence[str], None] = 'f7c2b8e4a1d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('attention_account_type', sa.String(length=20), nullable=True))
    op.add_column('projects', sa.Column('attention_salutation', sa.String(length=20), nullable=True))
    op.add_column('projects', sa.Column('attention_first_name', sa.String(length=100), nullable=True))
    op.add_column('projects', sa.Column('attention_last_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('projects', 'attention_last_name')
    op.drop_column('projects', 'attention_first_name')
    op.drop_column('projects', 'attention_salutation')
    op.drop_column('projects', 'attention_account_type')
