"""backfill missing quotation logo / signature from the company profile

Each quotation snapshots its company's logo and signature when the company is
picked, so quotations created before those were uploaded to Company Settings
have none. One-time fill (decided Oct 2026, Drafts and Finalized alike):

- logo: from the company with the same name, when the quotation has none
- signature: only when the quotation's signatory is that company's default
  signatory (the signature belongs to that person), and it has none

Only empty fields are filled; nothing is overwritten. Safe to run twice.

Revision ID: d3a8f6c2e9b4
Revises: b7e4d2a9c1f3
Create Date: 2026-10-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd3a8f6c2e9b4'
down_revision: Union[str, Sequence[str], None] = 'b7e4d2a9c1f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE quotations
        SET company_logo_url = (
            SELECT c.logo_url FROM companies c
            WHERE c.company_name = quotations.company_name
              AND c.logo_url IS NOT NULL AND c.logo_url <> ''
            ORDER BY c.id LIMIT 1
        )
        WHERE (company_logo_url IS NULL OR company_logo_url = '')
          AND EXISTS (
            SELECT 1 FROM companies c
            WHERE c.company_name = quotations.company_name
              AND c.logo_url IS NOT NULL AND c.logo_url <> ''
          )
    """)
    op.execute("""
        UPDATE quotations
        SET signatory_signature_url = (
            SELECT c.signature_url FROM companies c
            WHERE c.company_name = quotations.company_name
              AND LOWER(TRIM(c.default_signatory)) = LOWER(TRIM(quotations.signatory_name))
              AND c.signature_url IS NOT NULL AND c.signature_url <> ''
            ORDER BY c.id LIMIT 1
        )
        WHERE (signatory_signature_url IS NULL OR signatory_signature_url = '')
          AND signatory_name IS NOT NULL AND TRIM(signatory_name) <> ''
          AND EXISTS (
            SELECT 1 FROM companies c
            WHERE c.company_name = quotations.company_name
              AND LOWER(TRIM(c.default_signatory)) = LOWER(TRIM(quotations.signatory_name))
              AND c.signature_url IS NOT NULL AND c.signature_url <> ''
          )
    """)


def downgrade() -> None:
    # Data-only backfill: there's no record of which quotations were empty
    # before, so it can't be undone here (restore the pre-deploy backup instead).
    pass
