"""The optional list filters (dates, project, type, search) and the server
report totals."""
from tests.conftest import TestingSessionLocal
from app.models.project import Project


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _project(name="P", cost=100000):
    db = TestingSessionLocal()
    p = Project(owner_company_name="Owner", project_name=name, contract_cost=cost)
    db.add(p); db.commit(); pid = p.id; db.close()
    return pid


def _tx(client, headers, **kw):
    body = {"transaction_type": "General Expenditure", "transaction_date": "2026-10-05", "amount": 100,
            "is_office_expense": True, "project_id": None, "project_name": "Office Expense", **kw}
    r = client.post("/transactions/", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_transaction_filters_and_search_all_dates(client, admin_token):
    h = _auth(admin_token)
    pid = _project()
    march = _tx(client, h, transaction_date="2026-03-10", reference_number="OR-5512", description="Old payment",
                transaction_type="Payment", project_id=pid, project_name="P", is_office_expense=False)
    octo = _tx(client, h, description="Cement delivery", supplier="ABC Hardware")
    _tx(client, h, transaction_date="2026-10-20", description="Fuel")

    ids = lambda params: {t["id"] for t in client.get("/transactions/", params=params, headers=h).json()}
    assert ids({"start": "2026-10-01", "end": "2026-10-31"}) == {octo, octo + 1}
    assert ids({"project_id": pid}) == {march}
    assert ids([("transaction_type", "Payment")]) == {march}
    # Search ignores dates: an October view's search still finds March
    assert ids({"q": "or-5512"}) == {march}                      # reference no., case-insensitive
    assert ids({"q": "abc hard"}) == {octo}                      # supplier
    assert ids([("q", "cement"), ("transaction_type", "General Expenditure")]) == {octo}
    assert ids({"q": "nothing like this"}) == set()
    assert len(ids({})) == 3                                     # no filters: everything, as before


def test_project_totals_and_monthly(client, admin_token):
    h = _auth(admin_token)
    pid = _project("Totals", 50000)
    _tx(client, h, transaction_type="Payment", amount=20000, project_id=pid, project_name="Totals", is_office_expense=False,
        transaction_date="2026-09-15")
    _tx(client, h, amount=1500, project_id=pid, project_name="Totals", is_office_expense=False, transaction_date="2026-10-02")
    _tx(client, h, amount=700)  # office expense, no project

    t = client.get("/reports/project-totals", headers=h).json()
    p = t["projects"][str(pid)]
    assert (p["total_paid"], p["others_cost"], p["last_activity"]) == ("20000.00", "1500.00", "2026-10-02")
    assert t["unassigned"]["others_cost"] == "700.00"

    months = client.get("/reports/monthly", params={"end_month": "2026-10", "months": 2}, headers=h).json()
    assert [m["month"] for m in months] == ["2026-09", "2026-10"]
    assert months[0]["revenue"] == "20000.00" and months[1]["general"] == "2200.00"
