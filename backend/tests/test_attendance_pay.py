from decimal import Decimal

from app.core.attendance_pay import compute_pay


def test_total_equals_the_rounded_parts():
    """Regular + Overtime + Tip as shown always adds up to the Total — the
    parts used to be rounded separately from the total, leaving some records
    a centavo off."""
    for daily in (Decimal("611.00"), Decimal("645.50"), Decimal("703.33")):
        for regular_hours in (Decimal("1.5"), Decimal("3.25"), Decimal("7.75")):
            for overtime_hours in (Decimal("0.5"), Decimal("1.25"), Decimal("2.75")):
                regular, overtime, total = compute_pay(daily, regular_hours, overtime_hours, Decimal("1.15"), Decimal("50"))
                assert regular + overtime + Decimal("50") == total


def test_pay_formula():
    # 800/day -> 100/hour; 8h regular, 2h OT at 1.25x, plus a 100 tip
    regular, overtime, total = compute_pay(Decimal("800"), Decimal("8"), Decimal("2"), Decimal("1.25"), Decimal("100"))
    assert (regular, overtime, total) == (Decimal("800.00"), Decimal("250.00"), Decimal("1150.00"))
