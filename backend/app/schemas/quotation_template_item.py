from pydantic import BaseModel
from typing import Optional

class QuotationTemplateItemCreate(BaseModel):
    category: str
    text: str

class QuotationTemplateItemUpdate(BaseModel):
    text: Optional[str] = None

class QuotationTemplateItemRead(BaseModel):
    id: int
    category: str
    text: str
    archived: bool = False
    model_config = {"from_attributes": True}
