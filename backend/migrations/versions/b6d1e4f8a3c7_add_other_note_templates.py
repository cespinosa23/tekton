"""add other note templates

Revision ID: b6d1e4f8a3c7
Revises: a2c6f9e4d7b3
Create Date: 2026-08-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b6d1e4f8a3c7'
down_revision: Union[str, Sequence[str], None] = 'a2c6f9e4d7b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('other_note_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_other_note_templates_id'), 'other_note_templates', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_other_note_templates_id'), table_name='other_note_templates')
    op.drop_table('other_note_templates')
