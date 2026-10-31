from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


# --- REPORT SCHEMAS ---

class ReportCreate(BaseModel):
    # Official PRD fields
    report_id: Optional[str] = Field(None, description="Optional client report ID")
    occurred_at: Optional[str] = Field(None, description="ISO timestamp of scam occurrence")
    reported_at: Optional[str] = Field(None, description="ISO timestamp when reported")
    reporter_id: Optional[str] = Field(None, description="Test tool or user simulated reporter ID")
    ip_prefix: Optional[str] = Field(None, description="Network prefix (e.g. 103.21.58)")
    channel: Optional[str] = Field(None, description="Phone call, SMS or WhatsApp, QR code, Fake website, etc.")
    category: Optional[str] = Field(None, description="Category: PHONE, BANK_ACCOUNT, UPI, URL, WHATSAPP, SMS, EMAIL, OTHER")
    scam_type: Optional[str] = Field(None, description="Scam type from Appendix C or other")
    identifier_type: Optional[str] = Field(None, description="phone, upi, url, sender_id, bank_account, whatsapp, email, sms")
    identifier_value: Optional[str] = Field(None, description="Raw target identifier value")
    
    # Backward-compatible alias
    identifier: Optional[str] = Field(None, description="Target identifier alias")
    
    pincode: Optional[Union[str, int]] = Field(None, description="6-digit area code from Appendix B")
    locality: Optional[str] = Field(None, description="Locality name")
    city: Optional[str] = Field(None, description="City name")
    note: Optional[str] = Field(None, description="Report description")
    has_screenshot: Optional[bool] = Field(False, description="Whether screenshot was attached")
    amount_lost_inr: Optional[float] = Field(0.0, description="Financial loss in INR")
    loss_amount: Optional[float] = Field(None, description="Alias for amount_lost_inr")
    
    # Optional evidence fields
    evidence_url: Optional[str] = None
    evidence_base64: Optional[str] = None
    evidence_filename: Optional[str] = None
    transaction_ref: Optional[str] = None


class ReportResponse(BaseModel):
    report_id: str
    case_id: str
    merged: bool
    # Additional optional fields for rich clients
    id: Optional[str] = None
    status: Optional[str] = "ACCEPTED"
    case_status: Optional[str] = None
    distinct_reporters: Optional[int] = None
    display_value: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[str] = None
    evidence_duplicate_detected: Optional[bool] = False
    tx_ref_duplicate_detected: Optional[bool] = False
    similarity_risk_signals: Optional[Dict[str, Any]] = None


# --- LOOKUP SCHEMAS ---

class EvidenceItem(BaseModel):
    occurred_at: str
    channel: Optional[str] = "Phone call"
    scam_type: str
    pincode: Optional[str] = None


class LookupResponse(BaseModel):
    verdict: str  # KNOWN_SCAM, SUSPICIOUS, NO_REPORTS, VERIFIED_BUSINESS
    report_count: int
    distinct_reporters: int
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    scam_type: Optional[str] = None
    display_value: str
    evidence: Union[List[Dict[str, Any]], Dict[str, Any], None] = None
    challenged: bool = False


# --- MAP SCHEMAS ---

class MapCluster(BaseModel):
    pincode: str
    locality: str
    city: str
    count: int
    top_scam_type: str
    scam_type: Optional[str] = None
    severity: str  # CRIT, HIGH, MED
    lat: float
    lng: float


class MapDiagnostic(BaseModel):
    total_reports: int = 0
    reports_with_valid_pincodes: int = 0
    reports_with_recognized_areas: int = 0
    reports_with_coordinates: int = 0
    reports_in_clusters: int = 0
    unmapped_reports_count: int = 0
    unmapped_pincodes: List[str] = Field(default_factory=list)
    exclusion_reasons: Dict[str, int] = Field(default_factory=dict)


class UnmappedAreaInfo(BaseModel):
    pincode: str
    count: int
    locality: Optional[str] = None
    city: Optional[str] = None
    reason: str = "Coordinates not yet registered for this pincode"


class MapResponse(BaseModel):
    clusters: List[MapCluster]
    points: Optional[List[Dict[str, Any]]] = None
    diagnostics: Optional[MapDiagnostic] = None
    unmapped: Optional[List[UnmappedAreaInfo]] = None


# --- ALERT SCHEMAS ---

class AlertItem(BaseModel):
    id: Optional[str] = None
    type: str
    pincode: Optional[str] = None
    window: str = "24h"
    count: Optional[int] = None
    baseline_per_day: Optional[float] = None
    scam_type: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    created_at: Optional[str] = None

    def __getitem__(self, item: str):
        return getattr(self, item)

    def get(self, item: str, default=None):
        return getattr(self, item, default)


class AlertsResponse(BaseModel):
    alerts: List[AlertItem]
    count: Optional[int] = None


# --- CHALLENGE SCHEMAS ---

class ChallengeCreate(BaseModel):
    report_id: Optional[str] = None
    identifier_type: Optional[str] = Field("phone", description="phone, upi, url, sender_id, bank_account, whatsapp, email, sms")
    identifier_value: Optional[str] = Field(None, description="Disputed identifier value")
    identifier: Optional[str] = Field(None, description="Alias for identifier_value")
    claimant_name: Optional[str] = Field(None, description="Business or claimant name")
    challenger_name: Optional[str] = Field(None, description="Alias for claimant_name")
    contact_email: Optional[str] = Field(None, description="Contact email")
    proof_note: Optional[str] = Field(None, description="Proof / justification notes")
    reason: Optional[str] = Field(None, description="Alias for proof_note")
    proof_url: Optional[str] = None


class StatusString(str):
    def __eq__(self, other):
        if isinstance(other, str):
            return self.lower() == other.lower()
        return False


class ChallengeResponse(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    challenge_id: str
    id: Optional[str] = None
    status: Any = "under_review"
    identifier: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[str] = None


# --- ADMIN RESET SCHEMA ---

class VerifiedBusinessCreate(BaseModel):
    identifier: str
    business_name: str
    category: str
    official_website: Optional[str] = None
    verification_notes: Optional[str] = None


class VerifiedBusinessItem(BaseModel):
    identifier: str
    business_name: str
    category: str
    official_website: Optional[str] = None


class AdminResetResponse(BaseModel):
    ok: bool = True
    status: str = "RESET_OK"
    message: str = "Deleted all reports and re-seeded verified businesses"
