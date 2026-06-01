"""
Unit tests for schema validation — no DB required.
"""
import pytest
from pydantic import ValidationError
from app.schemas.transaction import MaterialItem, TransactionCreate
from datetime import date


def test_material_item_valid():
    item = MaterialItem(material_id=1, quantity=5.0, unit_cost=100.0, brand="Brand A")
    assert item.material_id == 1
    assert item.quantity == 5.0


def test_material_item_negative_quantity_rejected():
    with pytest.raises(ValidationError) as exc_info:
        MaterialItem(material_id=1, quantity=-1.0, unit_cost=50.0)
    assert "non-negative" in str(exc_info.value)


def test_material_item_negative_unit_cost_rejected():
    with pytest.raises(ValidationError):
        MaterialItem(material_id=1, quantity=1.0, unit_cost=-0.01)


def test_material_item_brand_optional():
    item = MaterialItem(material_id=2, quantity=1.0, unit_cost=10.0)
    assert item.brand is None


def test_transaction_create_materials_typed():
    tx = TransactionCreate(
        transaction_type="Outgoing Materials",
        transaction_date=date(2026, 1, 1),
        materials=[{"material_id": 1, "quantity": 3.0, "unit_cost": 50.0, "brand": "X"}],
    )
    assert isinstance(tx.materials[0], MaterialItem)
    assert tx.materials[0].quantity == 3.0


def test_transaction_create_invalid_material_rejected():
    with pytest.raises(ValidationError):
        TransactionCreate(
            transaction_type="Outgoing Materials",
            transaction_date=date(2026, 1, 1),
            materials=[{"material_id": 1, "quantity": -5.0, "unit_cost": 10.0}],
        )


def test_transaction_create_no_materials():
    tx = TransactionCreate(
        transaction_type="Payment",
        transaction_date=date(2026, 1, 1),
        amount=500,
    )
    assert tx.materials is None
