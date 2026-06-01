from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)  # nullable until they set it
    is_active = Column(Boolean, default=False)  # inactive until they complete registration
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    invite_token = Column(String(255), nullable=True)
    invite_token_expires = Column(DateTime, nullable=True)

    # Relationships
    employee = relationship("Employee", backref="user")
    roles = relationship("UserRole", back_populates="user")