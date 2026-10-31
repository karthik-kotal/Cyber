from typing import Dict, Any, List


APPENDIX_C_VERIFIED: List[Dict[str, str]] = [
    # Helplines
    {"type": "phone", "raw": "1930", "normalized": "1930", "belongs_to": "National Cybercrime Helpline", "category": "GOVERNMENT"},
    {"type": "phone", "raw": "1909", "normalized": "1909", "belongs_to": "TRAI Do Not Disturb", "category": "GOVERNMENT"},
    # 1800 Toll-Free numbers
    {"type": "phone", "raw": "1800 1600", "normalized": "18001600", "belongs_to": "HDFC Bank customer care", "category": "BANKING"},
    {"type": "phone", "raw": "1800 2600", "normalized": "18002600", "belongs_to": "HDFC Bank customer care", "category": "BANKING"},
    {"type": "phone", "raw": "1800 1080", "normalized": "18001080", "belongs_to": "ICICI Bank customer care", "category": "BANKING"},
    {"type": "phone", "raw": "1800 1234", "normalized": "18001234", "belongs_to": "State Bank of India customer care", "category": "BANKING"},
    {"type": "phone", "raw": "1800 2100", "normalized": "18002100", "belongs_to": "State Bank of India customer care", "category": "BANKING"},
    # 1860 Toll numbers
    {"type": "phone", "raw": "1860 419 5555", "normalized": "18604195555", "belongs_to": "Axis Bank customer care", "category": "BANKING"},
    {"type": "phone", "raw": "1860 266 2666", "normalized": "18602662666", "belongs_to": "Kotak Mahindra Bank customer care", "category": "BANKING"},
    # SMS Sender IDs
    {"type": "sender_id", "raw": "HDFCBK", "normalized": "HDFCBK", "belongs_to": "HDFC Bank SMS sender", "category": "BANKING"},
    {"type": "sender_id", "raw": "ICICIB", "normalized": "ICICIB", "belongs_to": "ICICI Bank SMS sender", "category": "BANKING"},
    {"type": "sender_id", "raw": "SBIINB", "normalized": "SBIINB", "belongs_to": "State Bank of India SMS sender", "category": "BANKING"},
    {"type": "sender_id", "raw": "AXISBK", "normalized": "AXISBK", "belongs_to": "Axis Bank SMS sender", "category": "BANKING"},
    {"type": "sender_id", "raw": "KOTAKB", "normalized": "KOTAKB", "belongs_to": "Kotak Mahindra Bank SMS sender", "category": "BANKING"},
    # Official URLs
    {"type": "url", "raw": "https://cybercrime.gov.in", "normalized": "https://cybercrime.gov.in", "belongs_to": "National Cyber Crime Reporting Portal", "category": "GOVERNMENT"},
    {"type": "url", "raw": "https://sancharsaathi.gov.in", "normalized": "https://sancharsaathi.gov.in", "belongs_to": "Sanchar Saathi", "category": "GOVERNMENT"},
    # Made-up Local Shops
    {"type": "phone", "raw": "+91 80 4100 2233", "normalized": "+918041002233", "belongs_to": "Fresh Bakes, Indiranagar (made up)", "category": "LOCAL_BUSINESS"},
    {"type": "phone", "raw": "+91 80 2553 0190", "normalized": "+918025530190", "belongs_to": "Koramangala Pharmacy (made up)", "category": "LOCAL_BUSINESS"},
    {"type": "upi", "raw": "freshbakes@okaxis", "normalized": "freshbakes@okaxis", "belongs_to": "Fresh Bakes, Indiranagar (made up)", "category": "LOCAL_BUSINESS"},
]


def get_verified_entity(normalized_id: str) -> Dict[str, Any] | None:
    for item in APPENDIX_C_VERIFIED:
        if item["normalized"] == normalized_id or item["raw"] == normalized_id:
            return item
    return None

