import hashlib
import io
import os
import re
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from PIL import Image, ExifTags
import numpy as np

# Storage directory definitions (relative to workspace or configured)
PROD_EVIDENCE_DIR = os.path.join("data", "evidence", "prod")
DEMO_EVIDENCE_DIR = os.path.join("data", "evidence", "demo")

# Allowed extensions and MIME types
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def compute_sha256(raw_bytes: bytes) -> str:
    """Calculates SHA-256 hash directly from raw bytes before any processing."""
    return hashlib.sha256(raw_bytes).hexdigest()


def detect_magic_bytes_format(raw_bytes: bytes) -> Optional[str]:
    """Inspects magic header bytes to determine the actual image format."""
    if not raw_bytes or len(raw_bytes) < 4:
        return None
    if raw_bytes.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WEBP":
        return "webp"
    if raw_bytes.startswith(b"BM"):
        return "bmp"
    if raw_bytes.startswith(b"GIF87a") or raw_bytes.startswith(b"GIF89a"):
        return "gif"
    if raw_bytes.startswith(b"%PDF"):
        return "pdf"
    if raw_bytes.startswith(b"MZ"):
        return "exe"
    return None


def validate_evidence_image(
    raw_bytes: bytes,
    claimed_filename: Optional[str] = None,
    max_size_bytes: int = MAX_IMAGE_SIZE_BYTES
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validates uploaded evidence image:
    - Non-empty
    - Under 5 MB size limit
    - File extension and magic bytes match allowed formats (JPG, JPEG, PNG, WEBP)
    - Valid readable image structure
    Returns: (is_valid, error_message, detected_format)
    """
    if not raw_bytes or len(raw_bytes) == 0:
        return False, "Uploaded evidence file is empty.", None

    size = len(raw_bytes)
    if size > max_size_bytes:
        size_mb = round(size / (1024 * 1024), 2)
        limit_mb = round(max_size_bytes / (1024 * 1024), 1)
        return False, f"Evidence file size ({size_mb} MB) exceeds maximum allowed limit of {limit_mb} MB.", None

    # Check extension if filename provided
    if claimed_filename:
        _, ext = os.path.splitext(claimed_filename.lower())
        if ext and ext not in ALLOWED_EXTENSIONS:
            return False, f"Unsupported file type '{ext}'. Allowed image formats: JPG, JPEG, PNG, WEBP.", None

    # Detect magic bytes
    fmt = detect_magic_bytes_format(raw_bytes)
    if fmt not in ("jpeg", "png", "webp"):
        return False, f"Unsupported file format (detected: {fmt or 'unknown'}). Allowed formats: JPG, JPEG, PNG, WEBP.", None

    # Verify image decodes safely
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
    except Exception as exc:
        return False, f"Corrupted or invalid image structure: {str(exc)}", None

    return True, None, fmt


def analyze_crop(image: Image.Image, ref_image: Optional[Image.Image] = None) -> Dict[str, Any]:
    """
    Check 1: Crop Detection.
    Compares image aspect ratio against standard phone and desktop screen resolutions.
    """
    w, h = image.size
    ratio = w / h if h > 0 else 1.0

    # Standard portrait ratios (w/h)
    # 9:16 ~0.5625, 9:18 ~0.50, 9:19 ~0.4737, 9:19.5 ~0.4615, 9:20 ~0.4500, 9:21 ~0.4286, 3:4 ~0.75
    standard_portrait = [0.5625, 0.5000, 0.4737, 0.4615, 0.4500, 0.4286, 0.7500]
    # Standard landscape ratios (w/h)
    # 16:9 ~1.7778, 16:10 ~1.6000, 4:3 ~1.3333, 21:9 ~2.3333, 18:9 ~2.0000
    standard_landscape = [1.7778, 1.6000, 1.3333, 2.3333, 2.0000]

    all_standards = standard_portrait + standard_landscape
    is_standard = any(abs(ratio - std) / std <= 0.035 for std in all_standards)

    if ref_image:
        ref_w, ref_h = ref_image.size
        if (w, h) == (ref_w, ref_h):
            status = "Dimensions match reference"
            explanation = f"Image dimensions ({w}x{h}) exactly match the reference image ({ref_w}x{ref_h})."
        else:
            status = "Non-matching dimensions against reference"
            explanation = f"Image dimensions ({w}x{h}) differ from reference image ({ref_w}x{ref_h}), indicating cropping or resizing."
    else:
        if is_standard:
            status = "Standard dimensions detected"
            explanation = f"Aspect ratio {ratio:.3f} ({w}x{h}) corresponds to standard device screen profiles."
        else:
            status = "Non-standard dimensions — possible crop"
            explanation = f"Aspect ratio {ratio:.3f} ({w}x{h}) does not align with standard device screen profiles, suggesting manual cropping."

    return {
        "status": status,
        "is_standard": is_standard,
        "width": w,
        "height": h,
        "aspect_ratio": round(ratio, 3),
        "explanation": explanation,
        "disclaimer": "Unable to verify cropping without an original reference image",
    }


def analyze_brightness(image: Image.Image, ref_image: Optional[Image.Image] = None) -> Dict[str, Any]:
    """
    Check 2: Brightness Modification Detection.
    Analyzes mean luminance, standard deviation, and histogram clipping.
    """
    gray = image.convert("L")
    w, h = gray.size
    total = max(w * h, 1)

    pixels = np.array(gray, dtype=np.float32)
    mean_lum = float(np.mean(pixels))
    std_dev = float(np.std(pixels))

    hist = gray.histogram()
    clipped_shadows = hist[0] / total
    clipped_highlights = hist[255] / total

    # Anomalies: extreme mean, severe clipping (>15%), or abnormally high variance (>95)
    is_extreme = mean_lum < 20.0 or mean_lum > 235.0 or clipped_shadows > 0.15 or clipped_highlights > 0.15 or std_dev > 95.0

    if ref_image:
        ref_gray = ref_image.convert("L")
        ref_pixels = np.array(ref_gray, dtype=np.float32)
        ref_mean = float(np.mean(ref_pixels))
        delta = abs(mean_lum - ref_mean)
        if delta > 30.0:
            status = "Potential brightness alteration detected"
            explanation = f"Mean luminance differs by {delta:.1f} units from reference screenshot ({ref_mean:.1f} vs {mean_lum:.1f})."
        else:
            status = "Normal brightness distribution"
            explanation = f"Luminance profile closely aligns with reference (delta: {delta:.1f})."
    else:
        if is_extreme:
            status = "Potential brightness alteration detected"
            explanation = (
                f"Luminance anomaly: mean {mean_lum:.1f}/255, standard deviation {std_dev:.1f}, "
                f"shadow clipping {clipped_shadows*100:.1f}%, highlight clipping {clipped_highlights*100:.1f}%."
            )
        else:
            status = "Normal brightness distribution"
            explanation = f"Mean luminance {mean_lum:.1f}/255 and spread {std_dev:.1f} fall within normal screenshot ranges."

    return {
        "status": status,
        "average_luminance": round(mean_lum, 2),
        "std_dev": round(std_dev, 2),
        "clipped_shadows_ratio": round(clipped_shadows, 4),
        "clipped_highlights_ratio": round(clipped_highlights, 4),
        "explanation": explanation,
        "disclaimer": "Brightness cannot be reliably verified without the original unedited screenshot",
    }


def analyze_watermark(
    image: Image.Image,
    raw_bytes: bytes,
    ocr_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check 3: Watermark Detection.
    Heuristic checks for watermark text, overlays, and corner anomalies.
    """
    watermark_keywords = [
        "sample", "confidential", "preview", "watermark", "draft",
        "getty", "shutterstock", "istock", "alamy", "picsart",
        "kinemaster", "bandicam", "camscanner", "shot on", "screen recorder",
        "timestamp camera", "inshot", "filmmaker", "watermark remover"
    ]

    detected_keyword = None
    # 1. Check OCR text
    if ocr_text:
        text_lower = ocr_text.lower()
        for kw in watermark_keywords:
            if kw in text_lower:
                detected_keyword = kw
                break

    # 2. Check metadata / raw text
    if not detected_keyword:
        try:
            raw_sample = raw_bytes[:4096].lower() + raw_bytes[-4096:].lower()
            for kw in watermark_keywords:
                if kw.encode("utf-8") in raw_sample:
                    detected_keyword = kw
                    break
        except Exception:
            pass

    # 3. Corner overlay heuristic: check 4 corners
    corner_anomaly = False
    corner_loc = ""
    try:
        gray = image.convert("L")
        w, h = gray.size
        cw, ch = max(int(w * 0.12), 4), max(int(h * 0.12), 4)
        corners = {
            "top-left": (0, 0, cw, ch),
            "top-right": (w - cw, 0, w, ch),
            "bottom-left": (0, h - ch, cw, h),
            "bottom-right": (w - cw, h - ch, w, h),
        }
        for name, box in corners.items():
            crop = gray.crop(box)
            arr = np.array(crop)
            # If corner has high standard deviation on a contrasting patch
            if np.std(arr) > 65.0:
                corner_anomaly = True
                corner_loc = name
                break
    except Exception:
        pass

    if detected_keyword:
        status = f"Possible watermark or overlay detected ('{detected_keyword}')"
        location = "Embedded text / metadata"
        detected = True
        explanation = f"Detected watermark pattern '{detected_keyword}' in image content or metadata."
    elif corner_anomaly:
        status = f"Possible watermark or overlay detected at {corner_loc}"
        location = corner_loc
        detected = True
        explanation = f"High-contrast pattern or overlay detected in {corner_loc} region."
    else:
        status = "No obvious watermark detected"
        location = "None"
        detected = False
        explanation = "No known watermark signatures, editor logos, or prominent corner overlays detected."

    return {
        "status": status,
        "detected": detected,
        "location": location,
        "explanation": explanation,
        "disclaimer": "Watermark check is heuristic and may not detect all watermark types",
    }


def analyze_text_integrity(
    image: Image.Image,
    raw_bytes: bytes,
    ref_ocr_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check 4: Text Character Modification Detection.
    Extracts visible OCR text and compares against reference if available.
    """
    extracted_text = ""
    try:
        from app.evidence.ocr import extract_ocr_text
        extracted_text = extract_ocr_text(raw_bytes) or ""
    except Exception:
        extracted_text = ""

    text_found = bool(extracted_text.strip())

    if ref_ocr_text:
        ref_norm = " ".join(ref_ocr_text.strip().split())
        img_norm = " ".join(extracted_text.strip().split())
        if ref_norm == img_norm:
            status = "Text matches reference image"
            explanation = "Extracted text characters are identical to the reference image."
            anomalies = []
        else:
            status = "Text character differences detected against reference"
            explanation = "Detected character additions, deletions, or substitutions compared to reference."
            anomalies = [f"Reference: '{ref_norm[:60]}...' vs Uploaded: '{img_norm[:60]}...'"]
    else:
        if text_found:
            status = "Text extracted for review"
            explanation = f"Extracted {len(extracted_text.split())} words from screenshot for audit review."
            anomalies = []
        else:
            status = "No machine-readable text detected"
            explanation = "No OCR text patterns detected or OCR capability unavailable."
            anomalies = []

    return {
        "status": status,
        "extracted_text": extracted_text[:1000] if extracted_text else None,
        "text_detected": text_found,
        "anomalies": anomalies,
        "disclaimer": "Text character modification check has limited accuracy on single images without a trusted reference.",
    }


def analyze_format_and_metadata(
    image: Image.Image,
    raw_bytes: bytes,
    claimed_filename: str = "",
    claimed_mime: str = ""
) -> Dict[str, Any]:
    """
    Check 5: Image Format Conversion Detection & EXIF Inspection.
    Verifies actual magic bytes against claimed extension, and checks EXIF software tags.
    """
    actual_fmt = detect_magic_bytes_format(raw_bytes) or "unknown"
    claimed_ext = os.path.splitext(claimed_filename)[1].lower() if claimed_filename else ""

    # Map extension to format
    ext_to_fmt = {
        ".jpg": "jpeg",
        ".jpeg": "jpeg",
        ".png": "png",
        ".webp": "webp",
    }
    expected_fmt = ext_to_fmt.get(claimed_ext)

    format_matches = True
    if expected_fmt and expected_fmt != actual_fmt:
        format_matches = False
        format_status = f"Format mismatch: file claims {claimed_ext} but is actually {actual_fmt.upper()}"
    else:
        format_matches = True
        format_status = f"Format matches extension ({actual_fmt.upper()})"

    # Inspect EXIF metadata
    known_editors = [
        "photoshop", "gimp", "canva", "picsart", "snapseed",
        "lightroom", "vsco", "pixlr", "paint.net", "facetune",
        "afterlight", "fotor", "corel", "affinity"
    ]
    software_tag = None
    editor_detected = False

    try:
        exif_data = image._getexif()
        if exif_data:
            for tag_id, value in exif_data.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if tag_name in ("Software", "ProcessingSoftware", "HostComputer"):
                    val_str = str(value).strip()
                    software_tag = val_str
                    val_lower = val_str.lower()
                    for ed in known_editors:
                        if ed in val_lower:
                            editor_detected = True
                            software_tag = f"Edited with {ed.capitalize()} ({val_str})"
                            break
                    break
    except Exception:
        pass

    # Check PNG info chunks if no EXIF
    if not software_tag and hasattr(image, "info"):
        software_chunk = image.info.get("Software") or image.info.get("software")
        if software_chunk:
            software_tag = str(software_chunk).strip()
            for ed in known_editors:
                if ed in software_tag.lower():
                    editor_detected = True
                    software_tag = f"Edited with {ed.capitalize()} ({software_chunk})"
                    break

    software_finding = software_tag if software_tag else "No editor metadata found"

    return {
        "format_matches": format_matches,
        "format_status": format_status,
        "actual_format": actual_fmt.upper(),
        "claimed_extension": claimed_ext or claimed_mime or "unspecified",
        "software_tag": software_finding,
        "editor_detected": editor_detected,
        "metadata_note": "Metadata note: messaging apps typically strip metadata during transmission",
    }


def run_all_integrity_checks(
    raw_bytes: bytes,
    claimed_filename: str = "",
    claimed_mime: str = "",
    ref_image_bytes: Optional[bytes] = None
) -> Dict[str, Any]:
    """Runs all 5 manipulation detection checks and generates overall integrity summary."""
    sha256_hash = compute_sha256(raw_bytes)

    with Image.open(io.BytesIO(raw_bytes)) as img:
        # Load reference image if provided
        ref_img = None
        ref_ocr = None
        if ref_image_bytes:
            try:
                ref_img = Image.open(io.BytesIO(ref_image_bytes))
                from app.evidence.ocr import extract_ocr_text
                ref_ocr = extract_ocr_text(ref_image_bytes)
            except Exception:
                ref_img = None

        crop_res = analyze_crop(img, ref_img)
        bright_res = analyze_brightness(img, ref_img)
        watermark_res = analyze_watermark(img, raw_bytes)
        text_res = analyze_text_integrity(img, raw_bytes, ref_ocr)
        format_res = analyze_format_and_metadata(img, raw_bytes, claimed_filename, claimed_mime)

    # Calculate overall integrity indicators score
    risk_score = 0
    anomalies_list = []
    if not format_res["format_matches"]:
        risk_score += 2
        anomalies_list.append(format_res["format_status"])
    if format_res["editor_detected"]:
        risk_score += 2
        anomalies_list.append(format_res["software_tag"])
    if watermark_res["detected"]:
        risk_score += 1
        anomalies_list.append(watermark_res["status"])
    if "Potential brightness" in bright_res["status"]:
        risk_score += 1
        anomalies_list.append(bright_res["status"])
    if not crop_res["is_standard"]:
        risk_score += 1
        anomalies_list.append("Non-standard aspect ratio (possible crop)")

    if risk_score == 0:
        overall_status = "PASS"
        overall_summary = "No obvious manipulation detected. Automated checks are assistive indicators and require human review."
    elif risk_score <= 2:
        overall_status = "POTENTIAL_INDICATOR"
        overall_summary = "Potential integrity indicators flagged. Automated checks are assistive indicators and require human review."
    else:
        overall_status = "SUSPICIOUS_ANOMALIES"
        overall_summary = "Multiple potential anomalies flagged (software tags, format mismatch, or dimension anomalies). Detailed review recommended."

    return {
        "sha256_hash": sha256_hash,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "overall_status": overall_status,
        "overall_summary": overall_summary,
        "risk_score": risk_score,
        "flagged_anomalies": anomalies_list,
        "disclaimer": "Automated checks are assistive heuristics. They do not constitute definitive forensic proof.",
        "checks": {
            "crop": crop_res,
            "brightness": bright_res,
            "watermark": watermark_res,
            "text": text_res,
            "format": format_res,
        }
    }


def compare_hashes(hash_a: str, hash_b: str) -> Dict[str, Any]:
    """
    Compares two SHA-256 hashes with required honest disclaimers.
    """
    clean_a = (hash_a or "").strip().lower()
    clean_b = (hash_b or "").strip().lower()

    if not clean_a or not clean_b:
        return {
            "match": False,
            "status": "INVALID_INPUT",
            "summary": "Both SHA-256 hashes are required for comparison.",
            "hash_a": clean_a,
            "hash_b": clean_b,
        }

    if clean_a == clean_b:
        return {
            "match": True,
            "status": "MATCH",
            "summary": "MATCH: Hashes are identical — files are byte-for-byte identical.",
            "explanation": "Both files produce the identical SHA-256 cryptographic digest.",
            "hash_a": clean_a,
            "hash_b": clean_b,
        }
    else:
        return {
            "match": False,
            "status": "NO_MATCH",
            "summary": "NO MATCH: Hashes differ — files are not identical.",
            "explanation": (
                "A hash difference indicates the files are not byte-identical. This can occur from "
                "re-saving, compression, format conversion, or content modification. A hash difference "
                "alone does not prove malicious tampering."
            ),
            "hash_a": clean_a,
            "hash_b": clean_b,
        }


def save_evidence_file(
    raw_bytes: bytes,
    original_filename: Optional[str] = None,
    is_demo: bool = False
) -> Tuple[str, str, str]:
    """
    Saves evidence image securely to disk:
    - Generates UUID-based unique filename (prevents path traversal)
    - Isolates production vs demo storage
    Returns: (evidence_id, filename, relative_path)
    """
    target_dir = DEMO_EVIDENCE_DIR if is_demo else PROD_EVIDENCE_DIR
    os.makedirs(target_dir, exist_ok=True)

    evidence_id = str(uuid.uuid4())
    ext = ".jpg"
    if original_filename:
        _, raw_ext = os.path.splitext(original_filename.lower())
        if raw_ext in ALLOWED_EXTENSIONS:
            ext = raw_ext
        elif raw_ext == ".jpeg":
            ext = ".jpg"

    safe_filename = f"{evidence_id}{ext}"
    full_path = os.path.join(target_dir, safe_filename)

    with open(full_path, "wb") as f:
        f.write(raw_bytes)

    return evidence_id, safe_filename, full_path
