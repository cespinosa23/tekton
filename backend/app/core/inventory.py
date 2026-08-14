from sqlalchemy.orm import Session
from app.models.inventory import Inventory
from app.models.transaction import Transaction
from decimal import Decimal

def sync_inventory(db: Session, material_id: int):
    """
    Recalculate inventory balance per material+brand.
    
    Rules:
    - Materials Procurement (is_office_expense=True only) → adds to stock
    - Incoming Materials → adds to stock
    - Outgoing Materials → deducts from stock
    - Materials Procurement (is_office_expense=False) → ignored (direct to project)
    
    latest_unit_cost = max unit cost from last 5 office procurement transactions
    latest_cost_supplier / latest_cost_date = supplier and date of whichever of
    those last 5 entries actually set that max (most recent one, if tied)
    """
    transactions = db.query(Transaction).filter(
        Transaction.archived == False
    ).order_by(Transaction.transaction_date.asc()).all()

    # Group by brand
    brand_data = {}  # key: brand -> {balance, procurement_entries: [{unit_cost, date, supplier}]}

    for tx in transactions:
        if not tx.materials:
            continue
        for mat in tx.materials:
            if mat.get("material_id") != material_id:
                continue

            qty = Decimal(str(mat.get("quantity") or 0))
            unit_cost = Decimal(str(mat.get("unit_cost") or 0))
            brand = mat.get("brand") or ""

            if brand not in brand_data:
                brand_data[brand] = {
                    "balance": Decimal("0"),
                    "procurement_entries": []
                }

            if tx.transaction_type == "Materials Procurement":
                if tx.is_office_expense:
                    # Affects stock balance
                    brand_data[brand]["balance"] += qty
                # ALL procurement affects unit cost (office or project-direct)
                if unit_cost > 0:
                    brand_data[brand]["procurement_entries"].append({
                        "unit_cost": unit_cost,
                        "date": tx.transaction_date,
                        "supplier": tx.supplier,
                    })

            elif tx.transaction_type == "Incoming Materials":
                brand_data[brand]["balance"] += qty

            elif tx.transaction_type == "Outgoing Materials":
                brand_data[brand]["balance"] -= qty

            elif tx.transaction_type == "Adjustment":
                if tx.adjustment_direction == 'add':
                    brand_data[brand]["balance"] += qty
                else:
                    brand_data[brand]["balance"] -= qty

    # Delete existing inventory records for this material
    db.query(Inventory).filter(Inventory.material_id == material_id).delete()
    db.flush()

    # Insert updated records per brand
    for brand, data in brand_data.items():
        # Take last 5 procurement entries, get the max cost among them
        last_5 = data["procurement_entries"][-5:]
        latest_unit_cost = max((e["unit_cost"] for e in last_5), default=Decimal("0"))

        # Source/date of that max — most recent entry if the max cost is tied
        top_entry = None
        for e in last_5:
            if e["unit_cost"] == latest_unit_cost:
                top_entry = e

        inv = Inventory(
            material_id=material_id,
            brand=brand if brand else None,
            quantity=data["balance"],
            latest_unit_cost=latest_unit_cost,
            latest_cost_supplier=top_entry["supplier"] if top_entry else None,
            latest_cost_date=top_entry["date"] if top_entry else None,
        )
        db.add(inv)

    db.commit()