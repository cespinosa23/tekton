"""quotation letterhead fields (short_name, pcab_license, phones, signature)

Replaces the old flattened company_contact string with the same granular
fields Company/BillingPrint already use, so Quotations can reuse that exact
letterhead + signature layout.

Revision ID: a2c6f9e4d7b3
Revises: f3a7c5e0b8d1
Create Date: 2026-08-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a2c6f9e4d7b3'
down_revision: Union[str, Sequence[str], None] = 'f3a7c5e0b8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('quotations', sa.Column('company_short_name', sa.String(100), nullable=True))
    op.add_column('quotations', sa.Column('company_email', sa.String(255), nullable=True))
    op.add_column('quotations', sa.Column('company_telephone_number', sa.String(255), nullable=True))
    op.add_column('quotations', sa.Column('company_contact_number', sa.String(255), nullable=True))
    op.add_column('quotations', sa.Column('company_pcab_license', sa.String(100), nullable=True))
    op.add_column('quotations', sa.Column('company_letterhead_color', sa.String(20), nullable=True))
    op.add_column('quotations', sa.Column('signatory_signature_url', sa.Text(), nullable=True))
    op.drop_column('quotations', 'company_contact')
    op.alter_column('quotations', 'mode_of_payment', type_=sa.String(2000), existing_type=sa.String(255))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('quotations', 'mode_of_payment', type_=sa.String(255), existing_type=sa.String(2000))
    op.add_column('quotations', sa.Column('company_contact', sa.String(100), nullable=True))
    op.drop_column('quotations', 'signatory_signature_url')
    op.drop_column('quotations', 'company_letterhead_color')
    op.drop_column('quotations', 'company_pcab_license')
    op.drop_column('quotations', 'company_contact_number')
    op.drop_column('quotations', 'company_telephone_number')
    op.drop_column('quotations', 'company_email')
    op.drop_column('quotations', 'company_short_name')
