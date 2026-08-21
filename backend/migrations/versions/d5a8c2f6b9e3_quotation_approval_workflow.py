"""quotation approval workflow: creator tracking + approval request fields

Revision ID: d5a8c2f6b9e3
Revises: c7f2b4e8a1d6
Create Date: 2026-08-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd5a8c2f6b9e3'
down_revision: Union[str, Sequence[str], None] = 'c7f2b4e8a1d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('created_by_user_id', sa.Integer(), nullable=True))
    op.add_column('quotations', sa.Column('approval_status', sa.String(length=20), nullable=True))
    op.add_column('quotations', sa.Column('approval_requested_to_id', sa.Integer(), nullable=True))
    op.add_column('quotations', sa.Column('approval_requested_by_id', sa.Integer(), nullable=True))
    op.add_column('quotations', sa.Column('approval_note', sa.String(length=1000), nullable=True))
    op.create_foreign_key('fk_quotations_created_by_user_id', 'quotations', 'users', ['created_by_user_id'], ['id'])
    op.create_foreign_key('fk_quotations_approval_requested_to_id', 'quotations', 'users', ['approval_requested_to_id'], ['id'])
    op.create_foreign_key('fk_quotations_approval_requested_by_id', 'quotations', 'users', ['approval_requested_by_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_quotations_approval_requested_by_id', 'quotations', type_='foreignkey')
    op.drop_constraint('fk_quotations_approval_requested_to_id', 'quotations', type_='foreignkey')
    op.drop_constraint('fk_quotations_created_by_user_id', 'quotations', type_='foreignkey')
    op.drop_column('quotations', 'approval_note')
    op.drop_column('quotations', 'approval_requested_by_id')
    op.drop_column('quotations', 'approval_requested_to_id')
    op.drop_column('quotations', 'approval_status')
    op.drop_column('quotations', 'created_by_user_id')
