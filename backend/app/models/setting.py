from sqlalchemy import Column, Integer, String, Boolean
from app.db.database import Base

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), nullable=False)
    value = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    archived = Column(Boolean, default=False)