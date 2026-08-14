"""quotation attention_to field and consolidated notes_and_exclusions

Revision ID: d4f2a8c91e3b
Revises: c7e91a3f2b1d
Create Date: 2026-08-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4f2a8c91e3b'
down_revision: Union[str, Sequence[str], None] = 'c7e91a3f2b1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('attention_to', sa.String(255), nullable=True))
    op.add_column('quotations', sa.Column('notes_and_exclusions', sa.Text(), nullable=True))
    op.drop_column('quotations', 'scope_of_works')
    op.drop_column('quotations', 'bill_of_materials')
    op.drop_column('quotations', 'notes')
    op.drop_column('quotations', 'exclusions')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('quotations', sa.Column('exclusions', sa.String(2000), nullable=True))
    op.add_column('quotations', sa.Column('notes', sa.String(2000), nullable=True))
    op.add_column('quotations', sa.Column('bill_of_materials', sa.JSON(), nullable=True))
    op.add_column('quotations', sa.Column('scope_of_works', sa.String(2000), nullable=True))
    op.drop_column('quotations', 'notes_and_exclusions')
    op.drop_column('quotations', 'attention_to')
