"""add scope of work types and sub-items

Revision ID: 101294a9d0bd
Revises: 6d2be8272a69
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '101294a9d0bd'
down_revision: Union[str, Sequence[str], None] = '6d2be8272a69'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('sow_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_sow_types_id'), 'sow_types', ['id'], unique=False)
    op.create_table('sow_type_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sow_type_id', sa.Integer(), nullable=False),
        sa.Column('item_name', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['sow_type_id'], ['sow_types.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sow_type_items_id'), 'sow_type_items', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_sow_type_items_id'), table_name='sow_type_items')
    op.drop_table('sow_type_items')
    op.drop_index(op.f('ix_sow_types_id'), table_name='sow_types')
    op.drop_table('sow_types')
