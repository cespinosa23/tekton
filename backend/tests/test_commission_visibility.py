"""Commission transactions are Admin-only (client decision, Oct 30, 2026):
released commission expenses and manual "Commission (...)" expenditures are
hidden from PC and PM in lists, lookups and project totals, and they can't
record or edit one."""
from datetime import date

import pytest

from tests.conftest import TestingSessionLocal, _create_user, _token_for
from app.models.commission import Commission
from app.models.project import Project
from app.models.role import Role
from app.models.transaction import Transaction


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def data(client):
    db = TestingSessionLocal()
    for name in ("Project Manager", "Project Coordinator"):
        if not db.query(Role).filter(Role.name == name).first():
            db.add(Role(name=name))
    db.commit()
    _create_user(db, "admin@v.com", "pw123456", ["Admin"])
    _create_user(db, "pc@v.com", "pw123456", ["Project Coordinator"])
    _create_user(db, "pm@v.com", "pw123456", ["Project Manager"])
    p = Project(owner_company_name="O", project_name="Job", status="Completed", contract_cost=10000)
    db.add(p)
    db.flush()
    c = Commission(project_id=p.id, commission_type="project_management", is_released=True)
    db.add(c)
    db.flush()
    d = date(2026, 10, 1)
    txs = {
        "released": Transaction(transaction_type="General Expenditure", transaction_date=d, project_id=p.id, amount=140,
                                expenditure_category="Commission", commission_id=c.id),
        "manual_internal": Transaction(transaction_type="General Expenditure", transaction_date=d, project_id=p.id, amount=350,
                                       expenditure_category="Commission (Internal)"),
        "manual_external": Transaction(transaction_type="General Expenditure", transaction_date=d, project_id=p.id, amount=560,
                                       expenditure_category="commission (external)"),
        "fuel": Transaction(transaction_type="General Expenditure", transaction_date=d, project_id=p.id, amount=100,
                            expenditure_category="Fuel"),
        "uncategorized": Transaction(transaction_type="General Expenditure", transaction_date=d, project_id=p.id, amount=50),
    }
    db.add_all(txs.values())
    db.commit()
    ids = {k: t.id for k, t in txs.items()}
    pid = p.id
    db.close()
    headers = {k: _auth(_token_for(client, f"{k}@v.com", "pw123456")) for k in ("admin", "pc", "pm")}
    return {"h": headers, "tx": ids, "project": pid}


def _listed(client, h, **params):
    return {t["id"] for t in client.get("/transactions/", headers=h, params=params).json()}


def test_list_hides_commissions_from_pc_and_pm(client, data):
    tx = data["tx"]
    everything = set(tx.values())
    assert _listed(client, data["h"]["admin"]) == everything
    for who in ("pc", "pm"):
        assert _listed(client, data["h"][who]) == {tx["fuel"], tx["uncategorized"]}, who
        # Searching for it doesn't find it either
        assert _listed(client, data["h"][who], q="commission") == set(), who


def test_lookup_edit_archive_by_id_are_404(client, data):
    h, tx = data["h"], data["tx"]
    for key in ("released", "manual_internal", "manual_external"):
        tid = tx[key]
        assert client.get(f"/transactions/{tid}", headers=h["pm"]).status_code == 404
        assert client.get(f"/transactions/{tid}", headers=h["pc"]).status_code == 404
        assert client.put(f"/transactions/{tid}", json={"remarks": "x"}, headers=h["pc"]).status_code == 404
        assert client.delete(f"/transactions/{tid}", headers=h["pc"]).status_code == 404
        assert client.get(f"/transactions/{tid}", headers=h["admin"]).status_code == 200
    assert client.get(f"/transactions/{tx['fuel']}", headers=h["pc"]).status_code == 200


def test_pc_cannot_record_or_recategorize_as_commission(client, data):
    h, tx = data["h"], data["tx"]
    body = {"transaction_type": "General Expenditure", "transaction_date": "2026-10-02", "project_id": data["project"],
            "amount": 99, "expenditure_category": "Commission (Internal)"}
    assert client.post("/transactions/", json=body, headers=h["pc"]).status_code == 403
    assert client.put(f"/transactions/{tx['fuel']}", json={"expenditure_category": "Commission (External)"},
                      headers=h["pc"]).status_code == 403
    # Ordinary edits still work, and Admin can record one
    assert client.put(f"/transactions/{tx['fuel']}", json={"remarks": "ok"}, headers=h["pc"]).status_code == 200
    assert client.post("/transactions/", json=body, headers=h["admin"]).status_code == 201


def test_project_totals_leave_commissions_out_for_non_admins(client, data):
    pid = str(data["project"])
    admin = client.get("/reports/project-totals", headers=data["h"]["admin"]).json()["projects"][pid]
    pm = client.get("/reports/project-totals", headers=data["h"]["pm"]).json()["projects"][pid]
    assert admin["others_cost"] == "1200.00"   # 140 + 350 + 560 + 100 + 50
    assert pm["others_cost"] == "150.00"       # fuel + uncategorized only
