"""
Seed script — populates the database with realistic test data.
Run from the backend directory:
    python seed.py
Add --reset to wipe all seeded data first:
    python seed.py --reset
"""

import sys
import os
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import SessionLocal
from app.models.user import User
from app.models.role import Role, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.project import Project
from app.models.material import Material
from app.models.material_type import MaterialType, MaterialTypeBrand
from app.models.supplier import Supplier
from app.models.attendance import Attendance
from app.models.inventory import Inventory
from app.models.transaction import Transaction
from app.models.quotation import Quotation
from app.models.setting import Setting
from app.models.company import Company
from app.models.calendar_day import CalendarDay

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
RESET = "--reset" in sys.argv


def working_days_back(n):
    """Return the last n weekdays (Mon-Sat) ending yesterday."""
    result = []
    d = date.today() - timedelta(days=1)
    while len(result) < n:
        if d.weekday() < 6:
            result.append(d)
        d -= timedelta(days=1)
    return sorted(result)


def run():
    db = SessionLocal()
    try:
        if RESET:
            print("Resetting seeded data...")
            for model in [UserRole, User, Attendance, Transaction, Inventory, Quotation,
                          Employee, Project, MaterialTypeBrand, Material, MaterialType,
                          Supplier, Setting, Company, CalendarDay, Role]:
                db.query(model).delete()
            db.commit()
            print("Data cleared.")

        # ── ROLES ─────────────────────────────────────────────────────────────
        print("Seeding roles...")
        role_names = ["Admin", "Engineer", "Accounting", "HR", "Liaison", "Others"]
        roles = {}
        for name in role_names:
            r = db.query(Role).filter_by(name=name).first()
            if not r:
                r = Role(name=name)
                db.add(r)
                db.flush()
            roles[name] = r
        db.commit()

        # ── COMPANY ───────────────────────────────────────────────────────────
        print("Seeding company...")
        if not db.query(Company).first():
            db.add(Company(
                company_name="Tekton Energy Solutions Inc.",
                short_name="Tekton",
                address="123 Electric Ave., Makati City, Metro Manila",
                contact_number="(02) 8888-1234",
                email="itadmin@tekton.energy",
                website="https://tekton.energy",
                footer_text="Providing quality electrical services since 2015.",
                default_signatory="Engr. Carlos Reyes",
                signatory_position="President / General Manager",
                is_active=True,
            ))
            db.commit()

        # ── SETTINGS ──────────────────────────────────────────────────────────
        print("Seeding settings...")
        settings_data = [
            ("Material Unit", "pcs"),
            ("Material Unit", "meters"),
            ("Material Unit", "rolls"),
            ("Material Unit", "sets"),
            ("Material Unit", "boxes"),
            ("Material Unit", "liters"),
            ("Material Unit", "pairs"),
            ("Material Unit", "kg"),
            ("Material Unit", "lengths"),
            ("Material Unit", "packs"),
            ("Expenditure Category", "Labor"),
            ("Expenditure Category", "Materials"),
            ("Expenditure Category", "Transportation"),
            ("Expenditure Category", "Meals & Allowances"),
            ("Expenditure Category", "Tools & Equipment"),
            ("Expenditure Category", "Office Supplies"),
            ("Expenditure Category", "Utilities"),
        ]
        for cat, val in settings_data:
            if not db.query(Setting).filter_by(category=cat, value=val).first():
                db.add(Setting(category=cat, value=val, is_active=True))
        db.commit()

        # ── MATERIAL TYPES ────────────────────────────────────────────────────
        print("Seeding material types...")
        mt_data = {
            "Wiring":             ["Phelps Dodge", "Philtex", "Omni"],
            "Conduit & Fittings": ["Neltex", "Supreme", "Emerald"],
            "Panel & Breakers":   ["Schneider", "ABB", "Siemens", "Panasonic"],
            "Lighting":           ["Philips", "Osram", "Firefly", "Ecoshift"],
            "Safety Equipment":   ["3M", "Bata", "Mallcom"],
            "Tools & Hardware":   ["Bosch", "Stanley", "DeWalt"],
            "Conduit Boxes":      ["Neltex", "Supreme"],
            "Switches & Outlets": ["Schneider", "ABB", "Legrand"],
        }
        mat_types = {}
        for mt_name, brands in mt_data.items():
            mt = db.query(MaterialType).filter_by(name=mt_name).first()
            if not mt:
                mt = MaterialType(name=mt_name)
                db.add(mt)
                db.flush()
                for b in brands:
                    db.add(MaterialTypeBrand(material_type_id=mt.id, brand_name=b))
            mat_types[mt_name] = mt
        db.commit()

        # ── MATERIALS ─────────────────────────────────────────────────────────
        print("Seeding materials...")
        materials_data = [
            # (rating_size, material_type, unit, description, min_stock, max_stock)
            ("2.0mm2 THHN Wire",          "Wiring",             "meters",  "Single conductor stranded copper wire", 100, 500),
            ("3.5mm2 THHN Wire",          "Wiring",             "meters",  "Single conductor stranded copper wire", 100, 400),
            ("5.5mm2 THHN Wire",          "Wiring",             "meters",  "Single conductor stranded copper wire",  50, 300),
            ("8.0mm2 THHN Wire",          "Wiring",             "meters",  "Single conductor stranded copper wire",  30, 200),
            ("14.0mm2 THHN Wire",         "Wiring",             "meters",  "Single conductor stranded copper wire",  20, 150),
            ("22.0mm2 THHN Wire",         "Wiring",             "meters",  "Single conductor stranded copper wire",  10, 100),
            ("1/2in PVC Conduit",         "Conduit & Fittings", "lengths", "3m length, schedule 40",                20, 100),
            ("3/4in PVC Conduit",         "Conduit & Fittings", "lengths", "3m length, schedule 40",                20, 100),
            ("1in PVC Conduit",           "Conduit & Fittings", "lengths", "3m length, schedule 40",                10,  60),
            ("1/2in RSC Conduit",         "Conduit & Fittings", "lengths", "Rigid steel conduit, 3m",               10,  50),
            ("3/4in RSC Conduit",         "Conduit & Fittings", "lengths", "Rigid steel conduit, 3m",               10,  50),
            ("20A 1P Circuit Breaker",    "Panel & Breakers",   "pcs",     "Single pole, 230V",                     10,  50),
            ("30A 1P Circuit Breaker",    "Panel & Breakers",   "pcs",     "Single pole, 230V",                     10,  50),
            ("60A 2P Circuit Breaker",    "Panel & Breakers",   "pcs",     "Double pole, 230V",                      5,  30),
            ("100A 2P Main Breaker",      "Panel & Breakers",   "pcs",     "Double pole main breaker",               3,  15),
            ("8-way Distribution Board",  "Panel & Breakers",   "pcs",     "Surface/flush type",                     3,  20),
            ("12-way Distribution Board", "Panel & Breakers",   "pcs",     "Surface/flush type",                     2,  15),
            ("9W LED Downlight",          "Lighting",           "pcs",     "Round, recessed, warm white 3000K",     20, 100),
            ("18W LED Panel Light",       "Lighting",           "pcs",     "600x600mm, cool white 6500K",           10,  60),
            ("40W LED Batten Light",      "Lighting",           "pcs",     "Twin tube, surface mounted",            10,  50),
            ("Safety Helmet",             "Safety Equipment",   "pcs",     "Hard hat, class E",                      5,  20),
            ("Safety Harness",            "Safety Equipment",   "pcs",     "Full body harness, double lanyard",      3,  10),
            ("Electrical Tape",           "Safety Equipment",   "rolls",   "PVC insulation tape, 19mm x 20m",       20, 100),
            ("Wire Connectors Box",       "Tools & Hardware",   "boxes",   "Assorted twist-on, 100pcs/box",          5,  30),
            ("Cable Tie Pack",            "Tools & Hardware",   "packs",   "Nylon ties, 100pcs/pack, 200mm",        10,  50),
            ("Junction Box 4x4",          "Conduit Boxes",      "pcs",     "Square junction box with cover",        20, 100),
            ("Utility Box 2x4",           "Conduit Boxes",      "pcs",     "Rectangular outlet box",                20, 100),
            ("2-gang Switch",             "Switches & Outlets", "pcs",     "Modular type, 10A",                     10,  60),
            ("3-gang Switch",             "Switches & Outlets", "pcs",     "Modular type, 10A",                     10,  60),
            ("Universal Outlet",          "Switches & Outlets", "pcs",     "2-gang, 16A, with ground",              10,  60),
        ]
        mat_objs = {}
        for rating_size, mt_name, unit, desc, min_s, max_s in materials_data:
            m = db.query(Material).filter_by(rating_size=rating_size).first()
            if not m:
                m = Material(
                    rating_size=rating_size,
                    material_type=mt_name,
                    unit=unit,
                    description=desc,
                    min_stock=min_s,
                    max_stock=max_s,
                )
                db.add(m)
                db.flush()
            mat_objs[rating_size] = m
        db.commit()

        # ── SUPPLIERS ─────────────────────────────────────────────────────────
        print("Seeding suppliers...")
        suppliers_data = [
            ("ABC Hardware Supply",   "123 Shaw Blvd, Mandaluyong",    "Rico Santos", "09171234567"),
            ("XYZ Electrical Corp",   "456 EDSA, Quezon City",         "Liza Reyes",  "09271234567"),
            ("Metro Electric Supply", "789 Commonwealth Ave, QC",      "Boy Torres",  "09171112222"),
            ("National Hardware",     "321 Marcos Highway, Antipolo",  "Ana Cruz",    "09271112222"),
            ("Builders Depot Ph",     "654 C5 Road, Taguig",           "Mark Garcia", "09181234567"),
        ]
        supp_objs = {}
        for name, addr, contact, phone in suppliers_data:
            s = db.query(Supplier).filter_by(name=name).first()
            if not s:
                s = Supplier(name=name, address=addr, contact_person=contact, contact_number=phone)
                db.add(s)
                db.flush()
            supp_objs[name] = s
        db.commit()

        # ── EMPLOYEES ─────────────────────────────────────────────────────────
        print("Seeding employees...")
        employees_data = [
            # first, middle, last, department, daily_salary, date_hired
            ("Juan",   "P.", "dela Cruz", "Operations",  1000, "2022-01-15"),
            ("Maria",  "L.", "Santos",    "Operations",  1500, "2021-06-01"),
            ("Pedro",  "R.", "Reyes",     "Operations",   500, "2023-03-10"),
            ("Ana",    "M.", "Garcia",    "Admin",        700, "2022-09-01"),
            ("Carlo",  "B.", "Espinosa",  "Engineering", 1200, "2021-01-10"),
            ("Rosa",   "T.", "Flores",    "HR",           800, "2022-05-15"),
            ("Miguel", "A.", "Torres",    "Operations",   800, "2023-01-20"),
            ("Jenny",  "C.", "Cruz",      "Operations",   500, "2023-06-01"),
            ("Roel",   "D.", "Bautista",  "Admin",        700, "2022-11-01"),
            ("Liza",   "E.", "Mendoza",   "Accounting",   750, "2022-08-15"),
        ]
        emp_objs = []
        for idx, (first, mid, last, dept, sal, hired) in enumerate(employees_data):
            e = db.query(Employee).filter_by(first_name=first, last_name=last).first()
            if not e:
                e = Employee(
                    first_name=first,
                    middle_name=mid,
                    last_name=last,
                    department=dept,
                    daily_salary=Decimal(str(sal)),
                    date_hired=date.fromisoformat(hired),
                    status=EmployeeStatus.Active,
                    phone=f"0917{idx+1:07d}",
                    address="Metro Manila",
                    id_number=f"EMP-{idx+1:04d}",
                )
                db.add(e)
                db.flush()
            emp_objs.append(e)
        db.commit()

        # ── USERS ─────────────────────────────────────────────────────────────
        print("Seeding users...")
        users_data = [
            # email, password, roles, emp_idx (-1 = no employee link)
            ("admin@tekton.energy",      "Admin123!", ["Admin"],       -1),
            ("engineer@tekton.energy",   "Admin123!", ["Engineer"],     4),  # Carlo
            ("hr@tekton.energy",         "Admin123!", ["HR"],           5),  # Rosa
            ("accounting@tekton.energy", "Admin123!", ["Accounting"],   9),  # Liza
            ("liaison@tekton.energy",    "Admin123!", ["Liaison"],      8),  # Roel
        ]
        for email, pw, role_list, emp_idx in users_data:
            u = db.query(User).filter_by(email=email).first()
            if not u:
                u = User(
                    email=email,
                    hashed_password=pwd_context.hash(pw),
                    is_active=True,
                    employee_id=emp_objs[emp_idx].id if emp_idx >= 0 else None,
                    token_version=0,
                )
                db.add(u)
                db.flush()
                for rname in role_list:
                    db.add(UserRole(user_id=u.id, role_id=roles[rname].id))
        db.commit()

        # ── PROJECTS ──────────────────────────────────────────────────────────
        print("Seeding projects...")
        projects_data = [
            # owner, address, project_name, pm, q_date, status, cost
            ("Dela Cruz Residence",  "Makati City",  "San Antonio Residence Rewiring",     "Maria Santos",   "2024-06-15", "Active",    85000),
            ("BGC Tower Corp.",      "Taguig City",  "BGC Commercial Fit-Out 3F",          "Carlo Espinosa", "2024-08-01", "Active",   320000),
            ("Springville Homes",    "Cavite",       "Springville Phase 2 Common Area",    "Maria Santos",   "2023-11-01", "Completed",150000),
            ("Laguna Steel Inc.",    "Laguna",       "Industrial Plant Electrical Upgrade", "Carlo Espinosa", "2024-09-10", "Active",   450000),
            ("Sunshine Mall",        "Quezon City",  "Mall Lighting Retrofit",             "Maria Santos",   "2024-07-20", "On Hold",  210000),
        ]
        proj_objs = []
        for owner, addr, proj_name, pm, q_date, status, cost in projects_data:
            p = db.query(Project).filter_by(project_name=proj_name).first()
            if not p:
                p = Project(
                    owner_company_name=owner,
                    address=addr,
                    project_name=proj_name,
                    project_manager=pm,
                    quotation_date=date.fromisoformat(q_date),
                    status=status,
                    contract_cost=Decimal(str(cost)),
                    scope_installation=True,
                    scope_installation_status="in_progress" if status == "Active" else "completed",
                    scope_supply=True,
                    scope_supply_status="completed",
                )
                db.add(p)
                db.flush()
            proj_objs.append(p)
        db.commit()

        # ── INVENTORY (initial stock) ──────────────────────────────────────────
        print("Seeding inventory records...")
        inv_data = [
            ("2.0mm2 THHN Wire",          350,  12.50),
            ("3.5mm2 THHN Wire",          200,  22.00),
            ("5.5mm2 THHN Wire",          120,  35.00),
            ("8.0mm2 THHN Wire",           80,  55.00),
            ("20A 1P Circuit Breaker",     25, 280.00),
            ("30A 1P Circuit Breaker",     18, 380.00),
            ("100A 2P Main Breaker",        6, 950.00),
            ("8-way Distribution Board",    5,1200.00),
            ("9W LED Downlight",           40, 180.00),
            ("Safety Helmet",               8, 350.00),
            ("Electrical Tape",            30,  25.00),
            ("Junction Box 4x4",           45,  35.00),
            ("Utility Box 2x4",            55,  25.00),
            ("2-gang Switch",              28, 120.00),
            ("Universal Outlet",           32, 150.00),
        ]
        for mat_key, qty, cost in inv_data:
            mat = mat_objs.get(mat_key)
            if not mat:
                continue
            if not db.query(Inventory).filter_by(material_id=mat.id).first():
                db.add(Inventory(
                    material_id=mat.id,
                    quantity=Decimal(str(qty)),
                    latest_unit_cost=Decimal(str(cost)),
                ))
        db.commit()

        # ── TRANSACTIONS ──────────────────────────────────────────────────────
        print("Seeding transactions...")
        today = date.today()

        tx_seeds = [
            {
                "reference_number": "PO-2024-001",
                "transaction_type": "Materials Procurement",
                "transaction_date": today - timedelta(days=30),
                "is_office_expense": True,
                "amount": Decimal("52500.00"),
                "description": "Q3 wire and materials replenishment",
                "expenditure_category": "Materials",
                "supplier": "ABC Hardware Supply",
                "remarks": "Partial delivery, balance on next PO",
                "materials": [
                    {"material_id": mat_objs["2.0mm2 THHN Wire"].id,     "material_name": "2.0mm2 THHN Wire",     "quantity": 500, "unit_cost": 12.50,  "total_cost":  6250.00, "unit": "meters"},
                    {"material_id": mat_objs["3.5mm2 THHN Wire"].id,     "material_name": "3.5mm2 THHN Wire",     "quantity": 300, "unit_cost": 22.00,  "total_cost":  6600.00, "unit": "meters"},
                    {"material_id": mat_objs["5.5mm2 THHN Wire"].id,     "material_name": "5.5mm2 THHN Wire",     "quantity": 200, "unit_cost": 35.00,  "total_cost":  7000.00, "unit": "meters"},
                    {"material_id": mat_objs["20A 1P Circuit Breaker"].id,"material_name": "20A 1P Circuit Breaker","quantity":  50, "unit_cost":280.00, "total_cost": 14000.00, "unit": "pcs"},
                    {"material_id": mat_objs["9W LED Downlight"].id,      "material_name": "9W LED Downlight",      "quantity":  60, "unit_cost":180.00, "total_cost": 10800.00, "unit": "pcs"},
                ],
            },
            {
                "reference_number": "PO-2024-002",
                "transaction_type": "Materials Procurement",
                "transaction_date": today - timedelta(days=15),
                "is_office_expense": True,
                "amount": Decimal("38600.00"),
                "description": "Panel boards and safety equipment",
                "expenditure_category": "Materials",
                "supplier": "XYZ Electrical Corp",
                "materials": [
                    {"material_id": mat_objs["100A 2P Main Breaker"].id,    "material_name": "100A 2P Main Breaker",    "quantity":  8, "unit_cost":  950.00, "total_cost":  7600.00, "unit": "pcs"},
                    {"material_id": mat_objs["8-way Distribution Board"].id,"material_name": "8-way Distribution Board","quantity": 10, "unit_cost": 1200.00, "total_cost": 12000.00, "unit": "pcs"},
                    {"material_id": mat_objs["30A 1P Circuit Breaker"].id,  "material_name": "30A 1P Circuit Breaker",  "quantity": 30, "unit_cost":  380.00, "total_cost": 11400.00, "unit": "pcs"},
                    {"material_id": mat_objs["Safety Helmet"].id,           "material_name": "Safety Helmet",           "quantity": 10, "unit_cost":  350.00, "total_cost":  3500.00, "unit": "pcs"},
                    {"material_id": mat_objs["Electrical Tape"].id,         "material_name": "Electrical Tape",         "quantity": 40, "unit_cost":   25.00, "total_cost":  1000.00, "unit": "rolls"},
                ],
            },
            {
                "reference_number": "OUT-2024-001",
                "transaction_type": "Outgoing Materials",
                "transaction_date": today - timedelta(days=20),
                "project_id": proj_objs[0].id,
                "project_name": proj_objs[0].project_name,
                "description": "Materials for San Antonio residential wiring",
                "materials": [
                    {"material_id": mat_objs["2.0mm2 THHN Wire"].id,       "material_name": "2.0mm2 THHN Wire",       "quantity": 150, "unit_cost":  12.50, "total_cost":  1875.00, "unit": "meters"},
                    {"material_id": mat_objs["20A 1P Circuit Breaker"].id,  "material_name": "20A 1P Circuit Breaker",  "quantity":  12, "unit_cost": 280.00, "total_cost":  3360.00, "unit": "pcs"},
                    {"material_id": mat_objs["8-way Distribution Board"].id, "material_name": "8-way Distribution Board","quantity":   2, "unit_cost":1200.00, "total_cost":  2400.00, "unit": "pcs"},
                    {"material_id": mat_objs["Junction Box 4x4"].id,         "material_name": "Junction Box 4x4",         "quantity":  20, "unit_cost":  35.00, "total_cost":   700.00, "unit": "pcs"},
                ],
            },
            {
                "reference_number": "OUT-2024-002",
                "transaction_type": "Outgoing Materials",
                "transaction_date": today - timedelta(days=10),
                "project_id": proj_objs[1].id,
                "project_name": proj_objs[1].project_name,
                "description": "BGC commercial fit-out materials - Phase 1",
                "materials": [
                    {"material_id": mat_objs["3.5mm2 THHN Wire"].id, "material_name": "3.5mm2 THHN Wire", "quantity":  80, "unit_cost":  22.00, "total_cost": 1760.00, "unit": "meters"},
                    {"material_id": mat_objs["5.5mm2 THHN Wire"].id, "material_name": "5.5mm2 THHN Wire", "quantity":  60, "unit_cost":  35.00, "total_cost": 2100.00, "unit": "meters"},
                    {"material_id": mat_objs["9W LED Downlight"].id,  "material_name": "9W LED Downlight",  "quantity":  24, "unit_cost": 180.00, "total_cost": 4320.00, "unit": "pcs"},
                    {"material_id": mat_objs["100A 2P Main Breaker"].id, "material_name": "100A 2P Main Breaker", "quantity": 2, "unit_cost": 950.00, "total_cost": 1900.00, "unit": "pcs"},
                ],
            },
            {
                "reference_number": "EXP-2024-001",
                "transaction_type": "Project Expense",
                "transaction_date": today - timedelta(days=7),
                "project_id": proj_objs[0].id,
                "project_name": proj_objs[0].project_name,
                "amount": Decimal("3500.00"),
                "description": "Transportation and meals during installation week",
                "expenditure_category": "Transportation",
            },
            {
                "reference_number": "EXP-2024-002",
                "transaction_type": "Office Expense",
                "transaction_date": today - timedelta(days=5),
                "is_office_expense": True,
                "amount": Decimal("1800.00"),
                "description": "Office supplies and printing",
                "expenditure_category": "Office Supplies",
            },
        ]
        for tx in tx_seeds:
            if not db.query(Transaction).filter_by(reference_number=tx["reference_number"]).first():
                db.add(Transaction(**tx))
        db.commit()

        # ── ATTENDANCE ────────────────────────────────────────────────────────
        print("Seeding attendance records...")
        work_days = working_days_back(14)

        field_employees = emp_objs[:3] + [emp_objs[4], emp_objs[6], emp_objs[7]]
        for day in work_days:
            for i, emp in enumerate(field_employees):
                if db.query(Attendance).filter_by(employee_id=emp.id, date=day).first():
                    continue
                sal = float(emp.daily_salary)
                hourly = sal / 8
                has_ot = (i % 3 == 0) and (day.weekday() < 5)
                ot_hours = 2.0 if has_ot else 0.0
                ot_salary = round(hourly * 1.15 * ot_hours, 2) if has_ot else 0.0
                reg_salary = round(hourly * 8, 2)
                proj = proj_objs[i % 2]
                db.add(Attendance(
                    employee_id=emp.id,
                    employee_name=f"{emp.first_name} {emp.last_name}",
                    project_id=proj.id,
                    project_name=proj.project_name,
                    is_office_based=False,
                    date=day,
                    regular_time_in="08:00",
                    regular_time_out="17:00",
                    regular_hours=Decimal("8.00"),
                    overtime_time_in="17:00" if has_ot else None,
                    overtime_time_out="19:00" if has_ot else None,
                    overtime_hours=Decimal(str(ot_hours)),
                    overtime_multiplier=Decimal("1.15"),
                    regular_salary=Decimal(str(reg_salary)),
                    overtime_salary=Decimal(str(ot_salary)),
                    total_salary=Decimal(str(round(reg_salary + ot_salary, 2))),
                    status="Present",
                ))

        office_staff = [emp_objs[3], emp_objs[5], emp_objs[9]]
        for day in work_days:
            for emp in office_staff:
                if db.query(Attendance).filter_by(employee_id=emp.id, date=day).first():
                    continue
                sal = float(emp.daily_salary)
                db.add(Attendance(
                    employee_id=emp.id,
                    employee_name=f"{emp.first_name} {emp.last_name}",
                    is_office_based=True,
                    date=day,
                    regular_time_in="08:00",
                    regular_time_out="17:00",
                    regular_hours=Decimal("8.00"),
                    overtime_hours=Decimal("0"),
                    overtime_multiplier=Decimal("1.15"),
                    regular_salary=Decimal(str(round(sal, 2))),
                    overtime_salary=Decimal("0"),
                    total_salary=Decimal(str(round(sal, 2))),
                    status="Present",
                ))
        db.commit()

        # ── QUOTATIONS ────────────────────────────────────────────────────────
        print("Seeding quotations...")
        quotations_data = [
            {
                "quote_number": "Q-2024-001",
                "status": "Finalized",
                "template_type": "Traditional",
                "company_name": "Tekton Energy Solutions Inc.",
                "company_address": "123 Electric Ave., Makati City",
                "company_contact": "(02) 8888-1234",
                "addressee_name": "Mr. Jose Dela Cruz",
                "addressee_address": "San Antonio Village, Makati City",
                "subject": "Residential Rewiring and Panel Upgrade",
                "quotation_date": date(2024, 6, 10),
                "signatory_name": "Engr. Carlos Reyes",
                "signatory_title": "General Manager",
                "scope_of_works": (
                    "1. Supply and installation of new wiring system\n"
                    "2. Panel board replacement with 8-way DB\n"
                    "3. Installation of new outlets and switches\n"
                    "4. Grounding system installation"
                ),
                "terms_of_payment": "50% downpayment, 50% upon completion",
                "total_contract_cost": Decimal("85000.00"),
                "bill_of_materials": [
                    {"description": "2.0mm2 THHN Wire",       "quantity": 150, "unit": "meters", "unit_price":  12.50, "total":  1875.00},
                    {"description": "20A 1P Circuit Breaker",  "quantity":  12, "unit": "pcs",    "unit_price": 280.00, "total":  3360.00},
                    {"description": "8-way Distribution Board","quantity":   1, "unit": "pcs",    "unit_price":1200.00, "total":  1200.00},
                    {"description": "Universal Outlet",         "quantity":  10, "unit": "pcs",    "unit_price": 150.00, "total":  1500.00},
                    {"description": "2-gang Switch",            "quantity":   8, "unit": "pcs",    "unit_price": 120.00, "total":   960.00},
                ],
            },
            {
                "quote_number": "Q-2024-002",
                "status": "Draft",
                "template_type": "Traditional",
                "company_name": "Tekton Energy Solutions Inc.",
                "company_address": "123 Electric Ave., Makati City",
                "company_contact": "(02) 8888-1234",
                "addressee_name": "Engr. Patricia Lim",
                "addressee_address": "BGC Tower, 25F, Taguig City",
                "subject": "Commercial Office Electrical Fit-Out - 3rd Floor",
                "quotation_date": today,
                "signatory_name": "Engr. Carlos Reyes",
                "signatory_title": "General Manager",
                "scope_of_works": (
                    "1. Complete electrical fit-out for 3rd floor office space\n"
                    "2. LED lighting installation (approx. 60 fixtures)\n"
                    "3. Power outlets and data provisions\n"
                    "4. Main panel and sub-panel installation\n"
                    "5. Emergency lighting and exit signs"
                ),
                "terms_of_payment": "30% mobilization, 40% midway, 30% upon turnover",
                "total_contract_cost": Decimal("320000.00"),
                "bill_of_materials": [
                    {"description": "3.5mm2 THHN Wire",         "quantity": 200, "unit": "meters", "unit_price":  22.00, "total":  4400.00},
                    {"description": "5.5mm2 THHN Wire",         "quantity": 100, "unit": "meters", "unit_price":  35.00, "total":  3500.00},
                    {"description": "9W LED Downlight",         "quantity":  60, "unit": "pcs",    "unit_price": 180.00, "total": 10800.00},
                    {"description": "100A 2P Main Breaker",     "quantity":   1, "unit": "pcs",    "unit_price": 950.00, "total":   950.00},
                    {"description": "12-way Distribution Board","quantity":   2, "unit": "pcs",    "unit_price":1800.00, "total":  3600.00},
                ],
            },
            {
                "quote_number": "Q-2024-003",
                "status": "Draft",
                "template_type": "Traditional",
                "company_name": "Tekton Energy Solutions Inc.",
                "company_address": "123 Electric Ave., Makati City",
                "company_contact": "(02) 8888-1234",
                "addressee_name": "Ms. Grace Villanueva",
                "addressee_address": "Sunshine Mall, Quezon City",
                "subject": "Mall-Wide LED Lighting Retrofit",
                "quotation_date": today,
                "signatory_name": "Engr. Carlos Reyes",
                "signatory_title": "General Manager",
                "scope_of_works": (
                    "1. Removal of existing fluorescent fixtures\n"
                    "2. Supply and installation of LED panel lights\n"
                    "3. Supply and installation of LED batten lights (back-of-house)\n"
                    "4. Wiring adjustments\n"
                    "5. Testing and commissioning"
                ),
                "terms_of_payment": "40% downpayment, 60% upon completion",
                "total_contract_cost": Decimal("210000.00"),
            },
        ]
        for q in quotations_data:
            if not db.query(Quotation).filter_by(quote_number=q["quote_number"]).first():
                db.add(Quotation(**q))
        db.commit()

        # ── CALENDAR DAYS (Philippine holidays) ───────────────────────────────
        print("Seeding calendar days...")
        holidays = [
            (date(2025, 1, 1),   "Regular Holiday",     "New Year's Day"),
            (date(2025, 4, 9),   "Regular Holiday",     "Araw ng Kagitingan"),
            (date(2025, 4, 17),  "Regular Holiday",     "Maundy Thursday"),
            (date(2025, 4, 18),  "Regular Holiday",     "Good Friday"),
            (date(2025, 4, 19),  "Special Non-Working", "Black Saturday"),
            (date(2025, 5, 1),   "Regular Holiday",     "Labor Day"),
            (date(2025, 6, 12),  "Regular Holiday",     "Independence Day"),
            (date(2025, 8, 25),  "Regular Holiday",     "National Heroes Day"),
            (date(2025, 11, 1),  "Special Non-Working", "All Saints' Day"),
            (date(2025, 11, 2),  "Special Non-Working", "All Souls' Day"),
            (date(2025, 11, 30), "Regular Holiday",     "Bonifacio Day"),
            (date(2025, 12, 8),  "Special Non-Working", "Feast of the Immaculate Conception"),
            (date(2025, 12, 24), "Special Non-Working", "Christmas Eve"),
            (date(2025, 12, 25), "Regular Holiday",     "Christmas Day"),
            (date(2025, 12, 30), "Regular Holiday",     "Rizal Day"),
            (date(2025, 12, 31), "Special Non-Working", "New Year's Eve"),
            (date(2026, 1, 1),   "Regular Holiday",     "New Year's Day"),
            (date(2026, 4, 2),   "Regular Holiday",     "Maundy Thursday"),
            (date(2026, 4, 3),   "Regular Holiday",     "Good Friday"),
            (date(2026, 5, 1),   "Regular Holiday",     "Labor Day"),
            (date(2026, 6, 12),  "Regular Holiday",     "Independence Day"),
        ]
        for d, day_type, desc in holidays:
            if not db.query(CalendarDay).filter_by(date=d).first():
                db.add(CalendarDay(date=d, day_type=day_type, description=desc))
        db.commit()

        # ── SUMMARY ───────────────────────────────────────────────────────────
        print("\n  Seed complete!")
        print("\n  Test Accounts")
        print("  admin@tekton.energy      / Admin123!  [Admin]")
        print("  engineer@tekton.energy   / Admin123!  [Engineer - Carlo Espinosa]")
        print("  hr@tekton.energy         / Admin123!  [HR - Rosa Flores]")
        print("  accounting@tekton.energy / Admin123!  [Accounting - Liza Mendoza]")
        print("  liaison@tekton.energy    / Admin123!  [Liaison - Roel Bautista]")
        att_count = len(work_days) * (len(field_employees) + len(office_staff))
        print(f"\n  {len(emp_objs)} employees | {len(proj_objs)} projects | {len(materials_data)} materials")
        print(f"  {att_count} attendance rows | {len(tx_seeds)} transactions | {len(quotations_data)} quotations")

    except Exception as e:
        db.rollback()
        print(f"\n  Seed failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run()
