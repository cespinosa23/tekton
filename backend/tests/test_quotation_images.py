"""The quotations list leaves out the logo and signature images (they're most
of a quotation's size); the single-quotation endpoint still returns them, and
a save that leaves those fields out keeps what's stored."""

LOGO = "data:image/png;base64," + "A" * 5000
SIGNATURE = "data:image/png;base64," + "B" * 2000


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _create(client, headers, **extra):
    resp = client.post("/quotations/", json={
        "quote_number": "Q-2026-001", "addressee_name": "ACME Corp", "subject": "Rewiring",
        "company_logo_url": LOGO, "signatory_signature_url": SIGNATURE, **extra,
    }, headers=headers)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def test_list_omits_images_detail_keeps_them(client, admin_token):
    headers = _auth(admin_token)
    qid = _create(client, headers)

    row = next(q for q in client.get("/quotations/", headers=headers).json() if q["id"] == qid)
    assert "company_logo_url" not in row and "signatory_signature_url" not in row
    assert row["addressee_name"] == "ACME Corp" and row["subject"] == "Rewiring"  # everything else is there

    full = client.get(f"/quotations/{qid}", headers=headers).json()
    assert full["company_logo_url"] == LOGO and full["signatory_signature_url"] == SIGNATURE


def test_save_without_image_fields_keeps_stored_images(client, admin_token):
    """The editor leaves the images out of a save until it has loaded them —
    the stored ones must survive."""
    headers = _auth(admin_token)
    qid = _create(client, headers)

    resp = client.put(f"/quotations/{qid}", json={"subject": "Rewiring, phase 2"}, headers=headers)
    assert resp.status_code == 200, resp.text
    full = client.get(f"/quotations/{qid}", headers=headers).json()
    assert full["subject"] == "Rewiring, phase 2"
    assert full["company_logo_url"] == LOGO and full["signatory_signature_url"] == SIGNATURE

    # Sending a new logo on purpose (company re-picked) still replaces it.
    new_logo = "data:image/png;base64," + "C" * 100
    client.put(f"/quotations/{qid}", json={"company_logo_url": new_logo}, headers=headers)
    assert client.get(f"/quotations/{qid}", headers=headers).json()["company_logo_url"] == new_logo
