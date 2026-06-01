from sqlalchemy import Column, Integer, String, Boolean, Date
from app.db.database import Base

class CalendarDay(Base):
    __tablename__ = "calendar_days"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, unique=True)
    day_type = Column(String(50), default="Working Day")
    description = Column(String(255), nullable=True)