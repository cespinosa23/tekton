"""project source quotation link

Revision ID: e6e5a6057aa0
Revises: 487851b0a0c2
Create Date: 2026-08-25 15:24:14.414108

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6e5a6057aa0'
down_revision: Union[str, Sequence[str], None] = '487851b0a0c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('source_quotation_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_projects_source_quotation_id', 'projects', 'quotations', ['source_quotation_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_projects_source_quotation_id', 'projects', type_='foreignkey')
    op.drop_column('projects', 'source_quotation_id')
