from sqlalchemy import Column, Integer, String, Text, Boolean, Index
from app.db.database import Base

class QuotationTemplateItem(Base):
    __tablename__ = "quotation_template_items"
    # The table was renamed from other_note_templates; its id index kept the
    # old name in every existing database. Declared explicitly so the model
    # matches it instead of autogenerate trying to drop and re-create it.
    __table_args__ = (Index("ix_other_note_templates_id", "id"),)

    id = Column(Integer, primary_key=True)
    category = Column(String(50), nullable=False)  # 'other_note' | 'payment_term'
    text = Column(Text, nullable=False)
    archived = Column(Boolean, default=False)
