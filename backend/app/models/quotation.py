from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Numeric, JSON, Text, ForeignKey
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from app.db.database import Base

class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(100), nullable=True)
    status = Column(String(50), default="Draft")
    # NULL means no recorded owner (e.g. predates this field) — visible to Admin only.
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # 'pending' | 'approved' | 'rejected' — null when no request has ever been made
    approval_status = Column(String(20), nullable=True)
    approval_requested_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approval_requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approval_note = Column(String(1000), nullable=True)  # rejection reason
    # Full log of every request/approve/reject round, supplementary to the
    # single-value fields above: [{ action, by_user_id, to_user_id?, reason?, at }]
    approval_history = Column(JSON, nullable=True)
    template_type = Column(String(50), default="Traditional")
    company_name = Column(String(255), nullable=True)
    company_short_name = Column(String(100), nullable=True)
    company_logo_url = Column(MEDIUMTEXT, nullable=True)  # base64 data-URI, same as Company.logo_url
    company_address = Column(String(255), nullable=True)
    company_email = Column(String(255), nullable=True)
    company_telephone_number = Column(String(255), nullable=True)
    company_contact_number = Column(String(255), nullable=True)
    company_pcab_license = Column(String(100), nullable=True)
    company_letterhead_color = Column(String(20), nullable=True)
    company_footer = Column(String(500), nullable=True)
    company_payment_method = Column(Text, nullable=True)  # snapshotted from Company.payment_method
    addressee_name = Column(String(255), nullable=True)
    addressee_address = Column(String(255), nullable=True)  # deprecated: superseded by addressee_address_line1/2, addressee_city, etc.
    addressee_address_line1 = Column(String(255), nullable=True)
    addressee_address_line2 = Column(String(255), nullable=True)
    addressee_city = Column(String(100), nullable=True)
    addressee_state_province = Column(String(100), nullable=True)
    addressee_postal_code = Column(String(20), nullable=True)
    addressee_country = Column(String(100), nullable=True, default='Philippines')
    # THROUGH / attention-to, same shape as Billing's Company Owned/Personal
    # attention block, so both documents present it consistently.
    attention_account_type = Column(String(20), nullable=True)  # 'Company Owned' | 'Personal'
    attention_salutation = Column(String(20), nullable=True)
    attention_first_name = Column(String(100), nullable=True)
    attention_last_name = Column(String(100), nullable=True)
    subject = Column(String(500), nullable=True)
    quotation_date = Column(Date, nullable=True)
    signatory_name = Column(String(100), nullable=True)
    signatory_title = Column(String(100), nullable=True)
    signatory_signature_url = Column(MEDIUMTEXT, nullable=True)  # base64 data-URI, same as Company.signature_url
    project_cost = Column(Numeric(12, 2), default=0)
    estimated_savings = Column(Numeric(12, 2), default=0)
    roi = Column(String(100), nullable=True)
    system_size_kwp = Column(Numeric(10, 2), default=0)
    inverter_brand = Column(String(100), nullable=True)
    battery_brand = Column(String(100), nullable=True)
    panel_brand = Column(String(100), nullable=True)
    # Each entry: { sow_type_id, sow_type_name, sub_items: [...], costing: {...}, bom_items: [...] }
    # costing and bom_items are both per scope type, not shared across the whole quotation.
    scope_of_work_items = Column(JSON, nullable=True)

    # Checked items from QuotationTemplateItem, denormalized: [{ item_id, text }]
    payment_term_items = Column(JSON, nullable=True)
    other_items = Column(JSON, nullable=True)
    # Optional flat deduction shown as a "DISCOUNT" row in the Scope of Works
    # table; total_contract_cost is stored already net of it.
    discount_amount = Column(Numeric(12, 2), default=0)
    # Optional 12% VAT, computed on the cost AFTER the discount. Only the flag
    # is stored — the VAT amount is derived — and total_contract_cost is stored
    # already including it.
    include_vat = Column(Boolean, default=False)
    total_contract_cost = Column(Numeric(12, 2), default=0)
    archived = Column(Boolean, default=False)

    # Set only on a Finalized quote once the client (not an internal approver)
    # turns it down — distinct from approval_status, which is the internal
    # PM sign-off before a quote is even Finalized. A client-rejected quote
    # can no longer be converted into a Project.
    client_rejected = Column(Boolean, default=False)
    client_rejected_note = Column(String(1000), nullable=True)
    client_rejected_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    client_rejected_at = Column(DateTime, nullable=True)