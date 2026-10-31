import pytest
from app.normalize import (
    normalize_identifier,
    mask_identifier,
    InvalidIdentifierError
)


def test_normalize_indian_mobile_numbers():
    # Various valid Indian mobile number formats (+91, 0, spaces, dashes)
    examples = [
        ("9876543210", "+919876543210"),
        ("+91 98765 43210", "+919876543210"),
        ("+91-9876543210", "+919876543210"),
        ("09876543210", "+919876543210"),
        ("919876543210", "+919876543210"),
        ("  +91 98765-43210  ", "+919876543210"),
        ("7012345678", "+917012345678"),
        ("8123456789", "+918123456789"),
        ("6234567890", "+916234567890"),
    ]
    for raw, expected in examples:
        res = normalize_identifier(raw)
        assert res.normalized_value == expected
        assert res.identifier_type == "PHONE_MOBILE"


def test_normalize_toll_free_numbers():
    examples = [
        ("1800 123 4567", "18001234567"),
        ("1800-111-222", "1800111222"),
        ("+91 1800 180 1234", "18001801234"),
        ("18002003000", "18002003000"),
    ]
    for raw, expected in examples:
        res = normalize_identifier(raw)
        assert res.normalized_value == expected
        assert res.identifier_type == "PHONE_TOLLFREE"


def test_normalize_short_helplines():
    examples = [
        ("1930", "1930"),  # National Cyber Crime helpline
        ("112", "112"),    # Emergency
        ("100", "100"),    # Police
        ("1091", "1091"),  # Women Helpline
    ]
    for raw, expected in examples:
        res = normalize_identifier(raw)
        assert res.normalized_value == expected
        assert res.identifier_type == "PHONE_HELPLINE"


def test_normalize_landline_numbers():
    examples = [
        ("011-23456789", "+911123456789"),
        ("080 22223333", "+918022223333"),
        ("022-26598765", "+912226598765"),
    ]
    for raw, expected in examples:
        res = normalize_identifier(raw)
        assert res.normalized_value == expected
        assert res.identifier_type == "PHONE_LANDLINE"


def test_normalize_upi_ids():
    examples = [
        ("fraudster@okhdfcbank", "fraudster@okhdfcbank"),
        ("SCAMMER.PAY@paytm", "scammer.pay@paytm"),
        ("fastag-fake@upi", "fastag-fake@upi"),
        ("9876543210@ybl", "9876543210@ybl"),
    ]
    for raw, expected in examples:
        res = normalize_identifier(raw)
        assert res.normalized_value == expected
        assert res.identifier_type == "UPI_ID"


def test_normalize_urls():
    examples = [
        ("http://scam-bank-kyc.in/login", "https://scam-bank-kyc.in/login"),
        ("https://www.fake-lottery.com/claim/", "https://fake-lottery.com/claim"),
        ("https://phishing.co.in", "https://phishing.co.in"),
    ]
    for raw, expected in examples:
        res = normalize_identifier(raw)
        assert res.normalized_value == expected
        assert res.identifier_type == "URL"


def test_normalize_bank_account():
    res = normalize_identifier("SBIN0001234:12345678901")
    assert res.normalized_value == "SBIN0001234:12345678901"
    assert res.identifier_type == "BANK_ACCOUNT"


def test_reject_invalid_and_junk():
    junk_examples = [
        "",
        "   ",
        "a",
        "12",
        "scam",
        "fake",
        "hello",
        "12345",
        "asdfghjk",
        "not-a-number",
        "1234567",
        "+91 12345",  # Invalid mobile length
        "5123456789",  # Mobile not starting with 6-9
        "@paytm",      # Missing user part
        "user@",       # Missing handle part
    ]
    for junk in junk_examples:
        with pytest.raises(InvalidIdentifierError):
            normalize_identifier(junk)


def test_masking():
    assert mask_identifier("+919876543210", "PHONE_MOBILE") == "+91 98765 XXXXX"
    assert mask_identifier("18001234567", "PHONE_TOLLFREE") == "1800-XXX-4567"
    assert mask_identifier("1930", "PHONE_HELPLINE") == "19XX"
    assert mask_identifier("fraudster@okhdfcbank", "UPI_ID") == "fr***er@okhdfcbank"
