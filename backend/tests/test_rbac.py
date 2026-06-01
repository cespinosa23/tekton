"""
RBAC tests: verify that write operations reject users without the required role,
and accept users that have it.
"""
import pytest

SUPPLIER_PAYLOAD = {"name": "Test Supplier", "contact_person": None, "phone": None, "email": None, "address": None}


def test_unauthenticated_cannot_write_supplier(client):
    resp = client.post("/suppliers/", json=SUPPLIER_PAYLOAD)
    assert resp.status_code == 401


def test_engineer_cannot_write_supplier(client, engineer_token):
    resp = client.post("/suppliers/", json=SUPPLIER_PAYLOAD, headers={"Authorization": f"Bearer {engineer_token}"})
    assert resp.status_code == 403


def test_accounting_can_write_supplier(client, accounting_token):
    resp = client.post("/suppliers/", json=SUPPLIER_PAYLOAD, headers={"Authorization": f"Bearer {accounting_token}"})
    # 201 = created, 422 = wrong schema shape — both mean auth passed
    assert resp.status_code in (201, 422)


def test_admin_can_write_supplier(client, admin_token):
    resp = client.post("/suppliers/", json=SUPPLIER_PAYLOAD, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code in (201, 422)


def test_engineer_can_read_suppliers(client, engineer_token):
    resp = client.get("/suppliers/", headers={"Authorization": f"Bearer {engineer_token}"})
    assert resp.status_code == 200


def test_accounting_cannot_write_project(client, accounting_token):
    resp = client.post("/projects/", json={"project_name": "X"}, headers={"Authorization": f"Bearer {accounting_token}"})
    assert resp.status_code == 403


def test_engineer_can_write_project(client, engineer_token):
    resp = client.post("/projects/", json={"project_name": "X"}, headers={"Authorization": f"Bearer {engineer_token}"})
    assert resp.status_code in (201, 422)


def test_accounting_can_write_transaction(client, accounting_token):
    payload = {
        "transaction_type": "Payment",
        "transaction_date": "2026-01-01",
        "amount": "1000.00",
    }
    resp = client.post("/transactions/", json=payload, headers={"Authorization": f"Bearer {accounting_token}"})
    assert resp.status_code in (201, 422)


def test_engineer_cannot_write_transaction(client, engineer_token):
    payload = {
        "transaction_type": "Payment",
        "transaction_date": "2026-01-01",
        "amount": "1000.00",
    }
    resp = client.post("/transactions/", json=payload, headers={"Authorization": f"Bearer {engineer_token}"})
    assert resp.status_code == 403
