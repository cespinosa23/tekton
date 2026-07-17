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
        "billing_date": "2026-01-01",
        "dp_amount": 30000,
        "retention_amount": 10000,
        "scope_description": "Installation of Service Entrance",
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["scope_description"] == "Installation of Service Entrance"
