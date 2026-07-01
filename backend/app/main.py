from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base
from app.models import user, role, employee  # noqa
from app.models import project, attendance, calendar_day  # noqa
from app.models import company, material, inventory  # noqa
from app.models import supplier, transaction, quotation, setting  # noqa
from app.api import auth, employees, users, admin
from app.api.crud_router import make_crud_router
from app.models.project import Project
from app.models.attendance import Attendance
from app.models.calendar_day import CalendarDay
from app.models.company import Company
from app.models.material import Material
from app.models.inventory import Inventory
from app.models.supplier import Supplier
from app.models.transaction import Transaction
from app.models.quotation import Quotation
from app.models.setting import Setting
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectRead
from app.schemas.attendance import AttendanceCreate, AttendanceUpdate, AttendanceRead
from app.schemas.calendar_day import CalendarDayCreate, CalendarDayUpdate, CalendarDayRead
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyRead
from app.schemas.material import MaterialCreate, MaterialUpdate, MaterialRead
from app.schemas.inventory import InventoryCreate, InventoryUpdate, InventoryRead
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierRead
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionRead
from app.schemas.quotation import QuotationCreate, QuotationUpdate, QuotationRead
from app.schemas.setting import SettingCreate, SettingUpdate, SettingRead
from app.models import material_type  # noqa
from app.api import material_types
from app.api import transactions as transactions_router

app = FastAPI(title="Tekton")

_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth & user routes
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(users.router)
app.include_router(material_types.router)
app.include_router(admin.router)

# CRUD routes
app.include_router(make_crud_router("/projects", "projects", Project, ProjectCreate, ProjectUpdate, ProjectRead, write_roles=["Admin", "Engineer", "Liaison"]))
app.include_router(make_crud_router("/attendance", "attendance", Attendance, AttendanceCreate, AttendanceUpdate, AttendanceRead, write_roles=["Admin", "HR"]))
app.include_router(make_crud_router("/calendar-days", "calendar_days", CalendarDay, CalendarDayCreate, CalendarDayUpdate, CalendarDayRead, allow_archive=False, write_roles=["Admin"]))
app.include_router(make_crud_router("/companies", "companies", Company, CompanyCreate, CompanyUpdate, CompanyRead, allow_archive=False, write_roles=["Admin"]))
app.include_router(make_crud_router("/materials", "materials", Material, MaterialCreate, MaterialUpdate, MaterialRead, write_roles=["Admin", "Engineer"]))
app.include_router(make_crud_router("/inventory", "inventory", Inventory, InventoryCreate, InventoryUpdate, InventoryRead, write_roles=["Admin"]))
app.include_router(make_crud_router("/suppliers", "suppliers", Supplier, SupplierCreate, SupplierUpdate, SupplierRead, write_roles=["Admin", "Accounting"]))
app.include_router(transactions_router.router)
app.include_router(make_crud_router("/quotations", "quotations", Quotation, QuotationCreate, QuotationUpdate, QuotationRead, write_roles=["Admin", "Engineer"]))
app.include_router(make_crud_router("/settings", "settings", Setting, SettingCreate, SettingUpdate, SettingRead, write_roles=["Admin"]))