"""Commission methods and per-record terms (client decision, Oct 29, 2026):

  Project Management, assumed margin (default) = Project Cost x 20% x 7%
  Project Management, actual                   = (Project Cost - expenses) x 7%
  Electrical Plan                              = Electrical Plan cost x 5%

PM shows only on Completed projects, Electrical Plan only once its scope is
marked complete. Terms are per record; untouched records follow the defaults.
"""
from datetime import date
from decimal import Decimal

import pytest

from tests.conftest import TestingSessionLocal
from app.models.attendance import Attendance
from app.models.commission import Commission
from app.models.employee import Employee
from app.models.project import Project
from app.models.transaction import Transaction


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def setup(admin_token):
    db = TestingSessionLocal()
    pm = Employee(first_name="Maria", last_name="Santos")
    ep_person = Employee(first_name="Jose", last_name="Cruz")
    db.add_all([pm, ep_person])
    db.flush()
    project = Project(
        owner_company_name="Owner", project_name="Job A", status="Completed", contract_cost=10000,
        project_manager="Maria Santos",
        scope_electrical_plan=True, scope_electrical_plan_cost=4000, scope_electrical_plan_status="complete",
    )
    db.add(project)
    db.flush()
    # Expenses 3,000: materials 1,500 (2,000 bought - 500 returned), other 1,000, labor 500
    db.add_all([
        Transaction(transaction_type="Materials Procurement", transaction_date=date(2026, 10, 1), project_id=project.id, amount=2000),
        Transaction(transaction_type="Incoming Materials", transaction_date=date(2026, 10, 2), project_id=project.id, amount=500),
        Transaction(transaction_type="General Expenditure", transaction_date=date(2026, 10, 3), project_id=project.id, amount=1000),
        # Not counted: office expense, payment
        Transaction(transaction_type="General Expenditure", transaction_date=date(2026, 10, 3), is_office_expense=True, amount=9999),
        Transaction(transaction_type="Payment", transaction_date=date(2026, 10, 4), project_id=project.id, amount=5000),
        Attendance(employee_id=ep_person.id, project_id=project.id, date=date(2026, 10, 5), total_salary=500, is_direct_hire=False),
    ])
    db.commit()
    ids = {"project": project.id, "pm": pm.id, "ep_person": ep_person.id}
    db.close()
    return {"h": _auth(admin_token), **ids}


def _rows(client, h):
    return {r["commission_type"]: r for r in client.get("/commissions/", headers=h).json()}


def _set_project(project_id, **fields):
    db = TestingSessionLocal()
    p = db.get(Project, project_id)
    for k, v in fields.items():
        setattr(p, k, v)
    db.commit()
    db.close()


def test_default_is_assumed_margin(client, setup):
    rows = _rows(client, setup["h"])
    pm = rows["project_management"]
    assert pm["method"] == "assumed_margin"
    assert Decimal(pm["margin_rate"]) == Decimal("0.2")
    assert Decimal(pm["base"]) == Decimal("2000.00")     # 10,000 x 20%
    assert Decimal(pm["amount"]) == Decimal("140.00")    # x 7%
    assert pm["custom_terms"] is False
    ep = rows["electrical_plan"]
    assert Decimal(ep["amount"]) == Decimal("200.00")    # 4,000 x 5%


def test_actual_method_uses_tagged_expenses(client, setup):
    h = setup["h"]
    r = client.put("/commissions/terms", json={"project_id": setup["project"], "commission_type": "project_management",
                                               "method": "actual", "rate": "7", "margin_rate": "20"}, headers=h)
    assert r.status_code == 200, r.text
    pm = r.json()
    assert pm["custom_terms"] is True and pm["margin_rate"] is None
    assert (Decimal(pm["expenses_materials"]), Decimal(pm["expenses_other"]), Decimal(pm["expenses_labor"])) == (1500, 1000, 500)
    assert Decimal(pm["base"]) == Decimal("7000.00")     # 10,000 - 3,000
    assert Decimal(pm["amount"]) == Decimal("490.00")


def test_per_record_rate_and_defaults(client, setup):
    h, pid = setup["h"], setup["project"]
    # Own rate on the EP commission; the PM one keeps following defaults
    r = client.put("/commissions/terms", json={"project_id": pid, "commission_type": "electrical_plan", "rate": "10"}, headers=h)
    assert Decimal(r.json()["amount"]) == Decimal("400.00")
    # Change defaults in Settings: PM 10%, margin 30%; EP default 8%
    r = client.put("/commissions/rates", json={"electrical_plan": "8", "project_management": "10",
                                                "project_management_margin": "30", "project_management_method": "assumed_margin"}, headers=h)
    assert r.status_code == 200, r.text
    rows = _rows(client, h)
    assert Decimal(rows["project_management"]["amount"]) == Decimal("300.00")   # follows defaults: 10,000 x 30% x 10%
    assert Decimal(rows["electrical_plan"]["amount"]) == Decimal("400.00")      # own 10% kept
    # Back to defaults
    r = client.put("/commissions/terms", json={"project_id": pid, "commission_type": "electrical_plan"}, headers=h)
    assert r.json()["custom_terms"] is False and Decimal(r.json()["amount"]) == Decimal("320.00")
    assert client.get("/commissions/rates", headers=h).json()["project_management_method"] == "assumed_margin"


def test_visibility_conditions(client, setup):
    h, pid = setup["h"], setup["project"]
    _set_project(pid, status="Active", scope_electrical_plan_status="pending")
    assert _rows(client, h) == {}
    # Can't be edited or released while not eligible either
    r = client.put("/commissions/terms", json={"project_id": pid, "commission_type": "project_management",
                                               "method": "actual", "rate": "7"}, headers=h)
    assert r.status_code == 400 and "Completed" in r.json()["detail"]
    r = client.post("/commissions/release", json={"project_id": pid, "commission_type": "electrical_plan"}, headers=h)
    assert r.status_code == 400 and "complete" in r.json()["detail"]
    _set_project(pid, scope_electrical_plan_status="complete")
    assert set(_rows(client, h)) == {"electrical_plan"}
    _set_project(pid, status="Completed")
    assert set(_rows(client, h)) == {"electrical_plan", "project_management"}


def test_release_freezes_terms_and_reverse_resets(client, setup):
    h, pid = setup["h"], setup["project"]
    client.put("/commissions/payee", json={"project_id": pid, "commission_type": "project_management",
                                           "payee_employee_id": setup["pm"]}, headers=h)
    r = client.post("/commissions/release", json={"project_id": pid, "commission_type": "project_management",
                                                  "release_date": "2026-10-29"}, headers=h)
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["amount"]) == Decimal("140.00") and r.json()["method"] == "assumed_margin"
    # Locked: terms can't change; defaults changing doesn't move it; still shown after the project reopens
    assert client.put("/commissions/terms", json={"project_id": pid, "commission_type": "project_management",
                                                  "method": "actual", "rate": "7"}, headers=h).status_code == 400
    client.put("/commissions/rates", json={"electrical_plan": "5", "project_management": "50",
                                           "project_management_margin": "50", "project_management_method": "actual"}, headers=h)
    _set_project(pid, status="Active")
    pm = _rows(client, h)["project_management"]
    assert pm["is_released"] and Decimal(pm["amount"]) == Decimal("140.00")
    assert pm["method"] == "assumed_margin" and Decimal(pm["margin_rate"]) == Decimal("0.2")
    db = TestingSessionLocal()
    c = db.query(Commission).filter(Commission.project_id == pid, Commission.commission_type == "project_management").one()
    db.close()
    _set_project(pid, status="Completed")
    r = client.post(f"/commissions/{c.id}/reverse", headers=h)
    assert r.status_code == 200
    back = r.json()
    # Live again, on the (changed) defaults: actual 50% of (10,000 - 3,000)
    assert not back["is_released"] and back["method"] == "actual"
    assert Decimal(back["amount"]) == Decimal("3500.00")


def test_validation(client, setup):
    h, pid = setup["h"], setup["project"]
    base = {"project_id": pid, "commission_type": "project_management"}
    assert client.put("/commissions/terms", json={**base, "method": "assumed_margin", "rate": "7"}, headers=h).status_code == 400
    assert client.put("/commissions/terms", json={**base, "rate": "7"}, headers=h).status_code == 400
    assert client.put("/commissions/terms", json={**base, "method": "actual", "rate": "101"}, headers=h).status_code == 422
    assert client.put("/commissions/terms", json={**base, "method": "actual", "rate": "7.123"}, headers=h).status_code == 422
