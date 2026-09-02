"""widen base64 logo/signature columns to MEDIUMTEXT (TEXT's 64KB cap rejects real image uploads)

Revision ID: a3f7c2d81b90
Revises: e6e5a6057aa0
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import MEDIUMTEXT

# revision identifiers, used by Alembic.
revision: str = 'a3f7c2d81b90'
down_revision: Union[str, Sequence[str], None] = 'e6e5a6057aa0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ('companies', 'logo_url'),
    ('companies', 'signature_url'),
    ('quotations', 'company_logo_url'),
    ('quotations', 'signatory_signature_url'),
]


def upgrade() -> None:
    """Upgrade schema."""
    for table, column in COLUMNS:
        op.alter_column(table, column, type_=MEDIUMTEXT(), existing_type=sa.Text())


def downgrade() -> None:
    """Downgrade schema."""
    for table, column in COLUMNS:
        op.alter_column(table, column, type_=sa.Text(), existing_type=MEDIUMTEXT())
