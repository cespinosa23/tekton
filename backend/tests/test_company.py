def test_company_roundtrips_letterhead_fields(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.post("/companies/", json={
        "company_name": "Alfredo Y. Gomez Electrical Contractor",
        "pcab_license": "28147",
        "logo_url": "data:image/png;base64,AAAA",
        "signature_url": "data:image/png;base64,BBBB",
        "default_signatory": "Alfredo Y. Gomez",
        "signatory_position": "Proprietor",
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["pcab_license"] == "28147"
    assert body["logo_url"] == "data:image/png;base64,AAAA"
    assert body["signature_url"] == "data:image/png;base64,BBBB"
