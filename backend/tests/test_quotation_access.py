"""Quotation access while QUOTATIONS_OPEN_TO_ALL is on (temporary, Oct 2026):
every quotation role sees and edits any quotation; approval and direct
finalizing stay with Admin / PM. Also checks the switch restores the old
"own quotations only" rule."""
import pytest

from tests.conftest import TestingSessionLocal, _create_user, _token_for
from app.api import quotations as quotations_api
from app.models.role import Role


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def tokens(client):
    db = TestingSessionLocal()
    for name in ("Project Manager", "Project Coordinator"):
        if not db.query(Role).filter(Role.name == name).first():
            db.add(Role(name=name))
    db.commit()
    _create_user(db, "admin@q.com", "pw123456", ["Admin"])
    _create_user(db, "eng1@q.com", "pw123456", ["Engineer"])
    _create_user(db, "eng2@q.com", "pw123456", ["Engineer"])
    _create_user(db, "pm@q.com", "pw123456", ["Project Manager"])
    _create_user(db, "acc@q.com", "pw123456", ["Accounting"])
    db.close()
    return {k: _auth(_token_for(client, f"{k}@q.com", "pw123456")) for k in ("admin", "eng1", "eng2", "pm", "acc")}


def _new_quote(client, headers, **kw):
    r = client.post("/quotations/", json={"quote_number": "Q-T-1", "addressee_name": "Client", "subject": "Job", **kw}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_open_access_everyone_with_quotations_sees_and_edits_all(client, tokens):
    qid = _new_quote(client, tokens["eng1"])
    # Another Engineer and a PM see it and can edit it
    for who in ("eng2", "pm"):
        assert any(q["id"] == qid for q in client.get("/quotations/", headers=tokens[who]).json()), who
        assert client.get(f"/quotations/{qid}", headers=tokens[who]).status_code == 200
        r = client.put(f"/quotations/{qid}", json={"subject": f"edited by {who}"}, headers=tokens[who])
        assert r.status_code == 200, (who, r.text)
    # A role without the Quotations page still sees nothing
    assert client.get("/quotations/", headers=tokens["acc"]).json() == []
    assert client.put(f"/quotations/{qid}", json={"subject": "x"}, headers=tokens["acc"]).status_code == 403


def test_finalizing_and_approval_stay_with_admin_and_pm(client, tokens, monkeypatch):
    # Requesting approval emails the PM — don't actually send mail in tests.
    monkeypatch.setattr(quotations_api, "send_approval_requested_email", lambda *a, **k: None)
    qid = _new_quote(client, tokens["eng1"])
    # Engineer can't finalize directly, on create or update
    assert client.put(f"/quotations/{qid}", json={"status": "Finalized"}, headers=tokens["eng2"]).status_code == 403
    assert client.post("/quotations/", json={"quote_number": "Q-T-2", "status": "Finalized"}, headers=tokens["eng1"]).status_code == 403
    # Approval: sent to the PM; another Engineer can't approve, the PM can
    from app.models.user import User
    db = TestingSessionLocal()
    pm_id = db.query(User).filter(User.email == "pm@q.com").first().id
    db.close()
    assert client.post(f"/quotations/{qid}/request-approval", json={"approver_user_id": pm_id}, headers=tokens["eng2"]).status_code == 200
    assert client.post(f"/quotations/{qid}/approve", headers=tokens["eng1"]).status_code == 403
    r = client.post(f"/quotations/{qid}/approve", headers=tokens["pm"])
    assert r.status_code == 200 and r.json()["status"] == "Finalized"
    # PM can still finalize directly
    qid2 = _new_quote(client, tokens["eng1"], quote_number="Q-T-3")
    assert client.put(f"/quotations/{qid2}", json={"status": "Finalized"}, headers=tokens["pm"]).status_code == 200


def test_switch_off_restores_own_quotations_only(client, tokens, monkeypatch):
    monkeypatch.setattr(quotations_api, "QUOTATIONS_OPEN_TO_ALL", False)
    qid = _new_quote(client, tokens["eng1"])
    assert not any(q["id"] == qid for q in client.get("/quotations/", headers=tokens["eng2"]).json())
    assert client.get(f"/quotations/{qid}", headers=tokens["eng2"]).status_code == 404
    assert client.put(f"/quotations/{qid}", json={"subject": "x"}, headers=tokens["eng2"]).status_code == 403
    assert any(q["id"] == qid for q in client.get("/quotations/", headers=tokens["admin"]).json())
