"""Project permanent delete (cascades to its records) and Settings → Reset All
Data. Foreign keys are enforced for these tests (SQLite leaves them off by
default), since FK order is exactly what both used to get wrong."""
import datetime

import pytest
from sqlalchemy import text

from tests.conftest import TestingSessionLocal, engine, _create_user
from app.models.attendance import Attendance
from app.models.billing import Billing
from app.models.commission import Commission
from app.models.employee import Employee
from app.models.project import Project
from app.models.quotation import Quotation
from app.models.setting import Setting
from app.models.transaction import Transaction
from app.models.user import User


@pytest.fixture(autouse=True)
def enforce_fks():
    with engine.connect() as c:
        c.execute(text("PRAGMA foreign_keys=ON"))
    yield
    with engine.connect() as c:
        c.execute(text("PRAGMA foreign_keys=OFF"))


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_project(db, name, employee):
    p = Project(owner_company_name="Owner", project_name=name, contract_cost=100000)
    db.add(p); db.flush()
    b = Billing(project_id=p.id, billing_type="down_payment", sequence_number=1, amount=30000, billing_date=datetime.date(2026, 1, 1))
    c = Commission(project_id=p.id, commission_type="pm", is_released=False)
    db.add_all([b, c]); db.flush()
    db.add_all([
        Attendance(project_id=p.id, employee_id=employee.id, date=datetime.date(2026, 1, 2), regular_hours=8, total_salary=800),
        Transaction(project_id=p.id, transaction_type="General Expenditure", amount=500, transaction_date=datetime.date(2026, 1, 3)),
        Transaction(project_id=p.id, billing_id=b.id, transaction_type="Payment", amount=30000, transaction_date=datetime.date(2026, 1, 4)),
    ])
    db.commit()
    return p.id


def _counts(db, pid):
    return tuple(db.query(M).filter(M.project_id == pid).count() for M in (Billing, Commission, Attendance, Transaction))


def test_project_permanent_delete_takes_related_records(client, admin_token, engineer_token):
    db = TestingSessionLocal()
    emp = Employee(first_name="Juan", last_name="Cruz", daily_salary=800)
    db.add(emp); db.commit()
    doomed, kept = _seed_project(db, "Doomed", emp), _seed_project(db, "Kept", emp)

    assert client.get(f"/projects/{doomed}/delete-impact", headers=_auth(engineer_token)).status_code == 403
    impact = client.get(f"/projects/{doomed}/delete-impact", headers=_auth(admin_token)).json()
    assert impact == {
        "transactions": 2, "billings": 1, "commissions": 1, "attendance": 1,
        "income": "30000.00", "materials_cost": "0.00", "other_expenses": "500.00",
        "labor_cost": "800.00", "commission_payouts": "0.00", "unpaid_billed": "30000.00",
        "stock_materials": 0,
    }

    r = client.delete(f"/projects/{doomed}/permanent", headers=_auth(admin_token))
    assert r.status_code == 204, r.text
    db.expire_all()
    assert db.query(Project).filter(Project.id == doomed).first() is None
    assert _counts(db, doomed) == (0, 0, 0, 0)
    assert _counts(db, kept) == (1, 1, 1, 2)
    db.close()


def test_reset_all_data(client, admin_token, engineer_token):
    db = TestingSessionLocal()
    emp = Employee(first_name="Juan", last_name="Cruz", daily_salary=800)
    db.add(emp); db.commit()
    eng = db.query(User).filter(User.email == "eng@test.com").first()
    db.add(Quotation(created_by_user_id=eng.id))
    db.add(Setting(category="Unit", value="pcs"))
    db.commit()
    _seed_project(db, "P1", emp)

    assert client.post("/admin/reset", headers=_auth(engineer_token)).status_code == 403
    r = client.post("/admin/reset", headers=_auth(admin_token))
    assert r.status_code == 200, r.text

    db.expire_all()
    for M in (Project, Billing, Commission, Attendance, Transaction, Quotation, Employee):
        assert db.query(M).count() == 0, M.__name__
    assert [u.email for u in db.query(User)] == ["admin@test.com"]
    assert db.query(Setting).count() == 1
    assert client.post("/admin/reset", headers=_auth(admin_token)).status_code == 200
    db.close()
