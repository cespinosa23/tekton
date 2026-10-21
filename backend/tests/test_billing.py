from tests.conftest import TestingSessionLocal
from app.models.project import Project


def _create_project(contract_cost):
    db = TestingSessionLocal()
    project = Project(
        owner_company_name="Test Owner",
        project_name="Test Project",
        contract_cost=contract_cost,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    project_id = project.id
    db.close()
    return project_id


def _auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_full_billing_chain(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)

    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 30000,
        "retention_amount": 10000,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 30000

    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-02-01",
        "current_percentage": 50,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 30000

    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-03-01",
        "current_percentage": 80,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 18000

    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-04-01",
        "current_percentage": 100,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 12000

    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "retention_release",
        "billing_date": "2026-05-01",
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 10000


def test_cannot_record_second_down_payment(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    payload = {
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 0,
    }
    assert client.post("/billing/", json=payload, headers=headers).status_code == 201
    resp = client.post("/billing/", json=payload, headers=headers)
    assert resp.status_code == 400


def test_progress_billing_requires_down_payment_first(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-01-01",
        "current_percentage": 50,
    }, headers=headers)
    assert resp.status_code == 400


def test_retention_release_requires_100_percent(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 10000,
    }, headers=headers)
    client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-02-01",
        "current_percentage": 50,
    }, headers=headers)
    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "retention_release",
        "billing_date": "2026-03-01",
    }, headers=headers)
    assert resp.status_code == 400


def test_duplicate_retention_release_rejected(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 10000,
    }, headers=headers)
    client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-02-01",
        "current_percentage": 100,
    }, headers=headers)
    first = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "retention_release",
        "billing_date": "2026-03-01",
    }, headers=headers)
    assert first.status_code == 201
    second = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "retention_release",
        "billing_date": "2026-04-01",
    }, headers=headers)
    assert second.status_code == 400


def test_engineer_cannot_create_billing(client, engineer_token):
    project_id = _create_project(100000)
    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 0,
    }, headers={"Authorization": f"Bearer {engineer_token}"})
    assert resp.status_code == 403


def test_only_latest_billing_can_be_archived(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    dp_resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 0,
    }, headers=headers)
    dp_id = dp_resp.json()["id"]

    progress_resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-02-01",
        "current_percentage": 50,
    }, headers=headers)
    assert progress_resp.status_code == 201

    resp = client.delete(f"/billing/{dp_id}", headers=headers)
    assert resp.status_code == 400


def test_mark_billing_paid(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    dp_resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 30000,
        "retention_amount": 10000,
    }, headers=headers)
    billing_id = dp_resp.json()["id"]
    assert dp_resp.json()["is_paid"] is False

    resp = client.put(f"/billing/{billing_id}/paid", json={
        "is_paid": True,
        "paid_date": "2026-01-05",
    }, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_paid"] is True
    assert resp.json()["paid_date"] == "2026-01-05"

    resp = client.put(f"/billing/{billing_id}/paid", json={"is_paid": False}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_paid"] is False
    assert resp.json()["paid_date"] is None


def test_engineer_cannot_mark_billing_paid(client, admin_token, engineer_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    dp_resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 0,
    }, headers=headers)
    billing_id = dp_resp.json()["id"]

    resp = client.put(f"/billing/{billing_id}/paid", json={"is_paid": True},
                       headers={"Authorization": f"Bearer {engineer_token}"})
    assert resp.status_code == 403


def test_down_payment_stores_scope_description(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 30000,
        "retention_amount": 10000,
        "scope_description": "Installation of Service Entrance",
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["scope_description"] == "Installation of Service Entrance"


def test_zero_amount_down_payment_is_auto_paid(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 0,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["amount"] == 0
    assert body["is_paid"] is True
    assert body["paid_date"] == "2026-01-01"


def test_zero_amount_billing_cannot_be_unpaid(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    dp_resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 0,
        "retention_amount": 0,
    }, headers=headers)
    billing_id = dp_resp.json()["id"]

    resp = client.put(f"/billing/{billing_id}/paid", json={"is_paid": False}, headers=headers)
    assert resp.status_code == 400


def test_reset_project_billing(client, admin_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 30000,
        "retention_amount": 10000,
    }, headers=headers)
    client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "progress",
        "billing_date": "2026-02-01",
        "current_percentage": 50,
    }, headers=headers)

    resp = client.post(f"/billing/project/{project_id}/reset", headers=headers)
    assert resp.status_code == 204

    resp = client.get("/billing/", headers=headers)
    assert all(b["project_id"] != project_id for b in resp.json())

    # Project is clean — a fresh down payment can be recorded again
    resp = client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-03-01",
        "dp_amount": 5000,
        "retention_amount": 0,
    }, headers=headers)
    assert resp.status_code == 201, resp.text


def test_reset_project_billing_requires_admin(client, admin_token, engineer_token):
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    client.post("/billing/", json={
        "project_id": project_id,
        "billing_type": "down_payment",
        # Required on every down payment since the payee ("Through") fields were added.
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01",
        "dp_amount": 30000,
        "retention_amount": 10000,
    }, headers=headers)

    resp = client.post(f"/billing/project/{project_id}/reset",
                        headers={"Authorization": f"Bearer {engineer_token}"})
    assert resp.status_code == 403


def test_reset_project_billing_with_no_billings_404s(client, admin_token):
    project_id = _create_project(100000)
    resp = client.post(f"/billing/project/{project_id}/reset", headers=_auth(admin_token))
    assert resp.status_code == 404


def test_edit_billing_payment_date(client, admin_token):
    """The Payments tab sends the whole form on every save. A payment made by
    marking a billing paid must still save a new date (the billing's paid
    date follows it) and other edits, while its amount stays locked."""
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    billing_id = client.post("/billing/", json={
        "project_id": project_id, "billing_type": "down_payment",
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01", "dp_amount": 30000, "retention_amount": 10000,
    }, headers=headers).json()["id"]
    client.put(f"/billing/{billing_id}/paid", json={"is_paid": True, "paid_date": "2026-01-05"}, headers=headers)
    tx = next(t for t in client.get("/transactions/", headers=headers).json() if t["billing_id"] == billing_id)

    form = {
        "transaction_type": "Payment", "transaction_date": tx["transaction_date"], "project_id": project_id,
        "project_name": tx["project_name"] or "", "is_office_expense": False, "amount": float(tx["amount"]),
        "reference_number": tx["reference_number"] or "", "description": tx["description"] or "", "remarks": "OR #123",
    }
    resp = client.put(f"/transactions/{tx['id']}", json=form, headers=headers)
    assert resp.status_code == 200, resp.text

    resp = client.put(f"/transactions/{tx['id']}", json={**form, "transaction_date": "2026-01-09"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["transaction_date"] == "2026-01-09"
    billing = next(b for b in client.get("/billing/", headers=headers).json() if b["id"] == billing_id)
    assert billing["paid_date"] == "2026-01-09"

    resp = client.put(f"/transactions/{tx['id']}", json={**form, "transaction_date": "2026-01-09", "amount": 1}, headers=headers)
    assert resp.status_code == 400


def test_mark_paid_requires_a_date(client, admin_token):
    """Mark as Paid asks the user for the date paid; the API refuses without one
    (it becomes the Payment transaction's date, which can't be empty)."""
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    billing_id = client.post("/billing/", json={
        "project_id": project_id, "billing_type": "down_payment",
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01", "dp_amount": 30000, "retention_amount": 10000,
    }, headers=headers).json()["id"]

    resp = client.put(f"/billing/{billing_id}/paid", json={"is_paid": True}, headers=headers)
    assert resp.status_code == 400
    assert not any(t["billing_id"] == billing_id for t in client.get("/transactions/", headers=headers).json())

    resp = client.put(f"/billing/{billing_id}/paid", json={"is_paid": True, "paid_date": "2026-01-20"}, headers=headers)
    assert resp.status_code == 200 and resp.json()["paid_date"] == "2026-01-20"
    tx = next(t for t in client.get("/transactions/", headers=headers).json() if t["billing_id"] == billing_id)
    assert tx["transaction_date"] == "2026-01-20"


def test_print_date_keeps_the_first_date(client, admin_token, engineer_token):
    """The first date picked in the Print dialog is saved as the billing's
    print_date; later prints may use other dates without overwriting it."""
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    billing = client.post("/billing/", json={
        "project_id": project_id, "billing_type": "down_payment",
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01", "dp_amount": 30000, "retention_amount": 10000,
    }, headers=headers).json()
    assert billing["print_date"] is None

    resp = client.put(f"/billing/{billing['id']}/print-date", json={"print_date": "2026-02-03"}, headers=headers)
    assert resp.status_code == 200 and resp.json()["print_date"] == "2026-02-03"
    resp = client.put(f"/billing/{billing['id']}/print-date", json={"print_date": "2026-03-09"}, headers=headers)
    assert resp.status_code == 200 and resp.json()["print_date"] == "2026-02-03"

    # A role that can't see billings can't set it either.
    resp = client.put(f"/billing/{billing['id']}/print-date", json={"print_date": "2026-03-09"}, headers=_auth(engineer_token))
    assert resp.status_code == 404


def test_cannot_restore_payment_of_a_reset_billing(client, admin_token):
    """Restoring an archived billing payment whose billing was reset would
    bring back income with no billing behind it — refused."""
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    billing_id = client.post("/billing/", json={
        "project_id": project_id, "billing_type": "down_payment",
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01", "dp_amount": 30000, "retention_amount": 10000,
    }, headers=headers).json()["id"]
    client.put(f"/billing/{billing_id}/paid", json={"is_paid": True, "paid_date": "2026-01-05"}, headers=headers)
    tx_id = next(t["id"] for t in client.get("/transactions/", headers=headers).json() if t["billing_id"] == billing_id)

    assert client.post(f"/billing/project/{project_id}/reset", headers=headers).status_code == 204
    resp = client.post(f"/transactions/{tx_id}/restore", headers=headers)
    assert resp.status_code == 400
    assert not any(t["id"] == tx_id for t in client.get("/transactions/", headers=headers).json())


def test_restore_payment_of_unmarked_billing_still_works(client, admin_token):
    """The normal restore path is unaffected: a payment archived by marking its
    billing unpaid comes back and puts the billing back to Paid."""
    project_id = _create_project(100000)
    headers = _auth(admin_token)
    billing_id = client.post("/billing/", json={
        "project_id": project_id, "billing_type": "down_payment",
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01", "dp_amount": 30000, "retention_amount": 10000,
    }, headers=headers).json()["id"]
    client.put(f"/billing/{billing_id}/paid", json={"is_paid": True, "paid_date": "2026-01-05"}, headers=headers)
    tx_id = next(t["id"] for t in client.get("/transactions/", headers=headers).json() if t["billing_id"] == billing_id)
    client.put(f"/billing/{billing_id}/paid", json={"is_paid": False}, headers=headers)

    resp = client.post(f"/transactions/{tx_id}/restore", headers=headers)
    assert resp.status_code == 200, resp.text
    billing = next(b for b in client.get("/billing/", headers=headers).json() if b["id"] == billing_id)
    assert billing["is_paid"] is True and billing["paid_date"] == "2026-01-05"


def _setup_dp(client, headers, contract, dp=0, retention=0):
    project_id = _create_project(contract)
    resp = client.post("/billing/", json={
        "project_id": project_id, "billing_type": "down_payment",
        "account_type": "Personal", "salutation": "Mr.", "first_name": "Test", "last_name": "Client",
        "billing_date": "2026-01-01", "dp_amount": dp, "retention_amount": retention,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    return project_id


def _progress(client, headers, project_id, **kw):
    return client.post("/billing/", json={"project_id": project_id, "billing_type": "progress",
                                          "billing_date": "2026-02-01", **kw}, headers=headers)


def test_progress_billing_by_amount_keeps_the_exact_amount(client, admin_token):
    """PB-000015: ₱250,000 on a ₱1,650,000 base used to be stored as ₱249,975
    (sent as a rounded 15.15%). The amount is now kept exactly."""
    headers = _auth(admin_token)
    project_id = _setup_dp(client, headers, 1650000)

    resp = _progress(client, headers, project_id, amount=250000)
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 250000
    assert resp.json()["current_percentage"] == 15.15

    # A percentage billing after it bills against what was actually billed:
    # 50% of 1,650,000 = 825,000, minus the 250,000 already billed.
    resp = _progress(client, headers, project_id, current_percentage=50)
    assert resp.status_code == 201, resp.text
    assert resp.json()["amount"] == 575000

    # More than the remaining balance (825,000) is refused.
    resp = _progress(client, headers, project_id, amount=825000.01)
    assert resp.status_code == 400

    # Billing the exact remainder by amount reaches 100%.
    resp = _progress(client, headers, project_id, amount=825000)
    assert resp.status_code == 201, resp.text
    assert resp.json()["current_percentage"] == 100
    total = sum(b["amount"] for b in client.get("/billing/", headers=headers).json()
                if b["project_id"] == project_id and b["billing_type"] == "progress")
    assert total == 1650000


def test_progress_by_amounts_then_100_percent_bills_the_exact_rest(client, admin_token):
    """Amounts that don't land on round percentages never leave the total off:
    the 100% billing takes exactly what's left."""
    headers = _auth(admin_token)
    project_id = _setup_dp(client, headers, 1000000, dp=300000, retention=100000)  # base 600,000

    for amt in (123456.78, 98765.43):
        resp = _progress(client, headers, project_id, amount=amt)
        assert resp.status_code == 201, resp.text
        assert resp.json()["amount"] == amt
        assert resp.json()["current_percentage"] < 100

    resp = _progress(client, headers, project_id, current_percentage=100)
    assert resp.status_code == 201, resp.text
    assert round(resp.json()["amount"], 2) == round(600000 - 123456.78 - 98765.43, 2)

    resp = client.post("/billing/", json={"project_id": project_id, "billing_type": "retention_release",
                                          "billing_date": "2026-03-01"}, headers=headers)
    assert resp.status_code == 201, resp.text


def test_progress_amount_must_be_positive(client, admin_token):
    headers = _auth(admin_token)
    project_id = _setup_dp(client, headers, 1000000)
    assert _progress(client, headers, project_id, amount=0).status_code == 400
    assert _progress(client, headers, project_id, amount=-5).status_code == 400
    assert _progress(client, headers, project_id).status_code == 400
