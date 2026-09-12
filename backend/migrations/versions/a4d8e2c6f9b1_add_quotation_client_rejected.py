"""add quotation client_rejected fields

Revision ID: a4d8e2c6f9b1
Revises: f2c8a4e6b9d3
Create Date: 2026-09-12 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a4d8e2c6f9b1'
down_revision: Union[str, Sequence[str], None] = 'f2c8a4e6b9d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('client_rejected', sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column('quotations', sa.Column('client_rejected_note', sa.String(length=1000), nullable=True))
    op.add_column('quotations', sa.Column('client_rejected_by_id', sa.Integer(), nullable=True))
    op.add_column('quotations', sa.Column('client_rejected_at', sa.DateTime(), nullable=True))
    op.create_foreign_key(
        'fk_quotations_client_rejected_by_id',
        'quotations', 'users',
        ['client_rejected_by_id'], ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_quotations_client_rejected_by_id', 'quotations', type_='foreignkey')
    op.drop_column('quotations', 'client_rejected_at')
    op.drop_column('quotations', 'client_rejected_by_id')
    op.drop_column('quotations', 'client_rejected_note')
    op.drop_column('quotations', 'client_rejected')
