"""generalize other_note_templates into quotation_template_items with category

Revision ID: d8a2c6f4b1e9
Revises: c2e7f1a9b5d4
Create Date: 2026-08-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd8a2c6f4b1e9'
down_revision: Union[str, Sequence[str], None] = 'c2e7f1a9b5d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table('other_note_templates', 'quotation_template_items')
    op.add_column('quotation_template_items', sa.Column('category', sa.String(length=50), nullable=True))
    op.execute("UPDATE quotation_template_items SET category = 'other_note'")
    op.alter_column('quotation_template_items', 'category', existing_type=sa.String(length=50), nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('quotation_template_items', 'category')
    op.rename_table('quotation_template_items', 'other_note_templates')
