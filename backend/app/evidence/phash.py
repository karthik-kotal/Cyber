import struct
import zlib
from typing import Optional
import numpy as np
from app.config import settings


def _decode_png_to_gray(png_bytes: bytes) -> Optional[np.ndarray]:
    """Decodes standard PNG bytes into a 2D float32 grayscale numpy array."""
    try:
        if not png_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return None
        idx = 8
        idat_parts = []
        w, h, bit_depth, color_type = 0, 0, 0, 0
        total_len = len(png_bytes)

        while idx < total_len:
            if idx + 8 > total_len:
                break
            length = struct.unpack(">I", png_bytes[idx : idx + 4])[0]
            chunk_type = png_bytes[idx + 4 : idx + 8]
            data = png_bytes[idx + 8 : idx + 8 + length]
            idx += 12 + length

            if chunk_type == b"IHDR":
                w, h, bit_depth, color_type = struct.unpack(">IIBB", data[:10])
            elif chunk_type == b"IDAT":
                idat_parts.append(data)
            elif chunk_type == b"IEND":
                break

        if not idat_parts or w == 0 or h == 0 or bit_depth != 8:
            return None

        decompressed = zlib.decompress(b"".join(idat_parts))
        bpp = 3 if color_type == 2 else (4 if color_type == 6 else (2 if color_type == 4 else 1))
        stride = 1 + w * bpp
        expected_len = stride * h
        if len(decompressed) < expected_len:
            return None

        gray = np.zeros((h, w), dtype=np.float32)
        for y in range(h):
            offset = y * stride + 1
            row = decompressed[offset : offset + w * bpp]
            if bpp >= 3:
                r = np.frombuffer(row[0::bpp], dtype=np.uint8)
                g = np.frombuffer(row[1::bpp], dtype=np.uint8)
                b = np.frombuffer(row[2::bpp], dtype=np.uint8)
                gray[y, :] = 0.299 * r + 0.587 * g + 0.114 * b
            else:
                gray[y, :] = np.frombuffer(row[:w], dtype=np.uint8)

        return gray
    except Exception:
        return None


def _decode_bmp_to_gray(bmp_bytes: bytes) -> Optional[np.ndarray]:
    """Decodes standard uncompressed 24-bit or 32-bit BMP bytes to grayscale."""
    try:
        if not bmp_bytes.startswith(b"BM") or len(bmp_bytes) < 54:
            return None
        pixel_offset = struct.unpack("<I", bmp_bytes[10:14])[0]
        w = struct.unpack("<i", bmp_bytes[18:22])[0]
        h = struct.unpack("<i", bmp_bytes[22:26])[0]
        bpp = struct.unpack("<H", bmp_bytes[28:30])[0]

        if w <= 0 or h == 0 or bpp not in (24, 32):
            return None

        is_top_down = h < 0
        h = abs(h)
        bytes_per_pixel = bpp // 8
        row_stride = ((w * bytes_per_pixel + 3) // 4) * 4

        gray = np.zeros((h, w), dtype=np.float32)
        for y in range(h):
            actual_y = y if is_top_down else (h - 1 - y)
            row_start = pixel_offset + y * row_stride
            row_bytes = bmp_bytes[row_start : row_start + w * bytes_per_pixel]
            b = np.frombuffer(row_bytes[0::bytes_per_pixel], dtype=np.uint8)
            g = np.frombuffer(row_bytes[1::bytes_per_pixel], dtype=np.uint8)
            r = np.frombuffer(row_bytes[2::bytes_per_pixel], dtype=np.uint8)
            gray[actual_y, :] = 0.299 * r + 0.587 * g + 0.114 * b

        return gray
    except Exception:
        return None


def _decode_image_bytes(image_bytes: bytes) -> Optional[np.ndarray]:
    """Attempts PIL decode if installed; otherwise falls back to native decoders."""
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes)).convert("L")
        return np.array(img, dtype=np.float32)
    except Exception:
        pass

    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return _decode_png_to_gray(image_bytes)
    elif image_bytes.startswith(b"BM"):
        return _decode_bmp_to_gray(image_bytes)

    return None


def compute_perceptual_hash(image_bytes: bytes, hash_size: int = 8) -> Optional[str]:
    """
    Computes a 64-bit perceptual hash (average hash / block distribution) from image bytes.
    Robust against scaling, resizing, and compression artifacts.
    Returns a 16-character hexadecimal string, or None if the image cannot be decoded.
    """
    if not image_bytes or len(image_bytes) < 8:
        return None

    gray = _decode_image_bytes(image_bytes)
    if gray is None or gray.shape[0] < 2 or gray.shape[1] < 2:
        return None

    h, w = gray.shape
    resized = np.zeros((hash_size, hash_size), dtype=np.float32)
    y_step, x_step = h / hash_size, w / hash_size

    for i in range(hash_size):
        for j in range(hash_size):
            y_start = int(i * y_step)
            y_end = max(int((i + 1) * y_step), y_start + 1)
            x_start = int(j * x_step)
            x_end = max(int((j + 1) * x_step), x_start + 1)
            resized[i, j] = np.mean(gray[y_start:y_end, x_start:x_end])

    avg = np.mean(resized)
    bits = (resized > avg).flatten()
    val = 0
    for bit in bits:
        val = (val << 1) | int(bit)

    return f"{val:016x}"


def hamming_distance(hash1: Optional[str], hash2: Optional[str]) -> int:
    """Computes the bitwise Hamming distance between two 16-hex perceptual hashes."""
    if not hash1 or not hash2 or len(hash1) != 16 or len(hash2) != 16:
        return 64
    try:
        v1 = int(hash1, 16)
        v2 = int(hash2, 16)
        return bin(v1 ^ v2).count("1")
    except ValueError:
        return 64


def perceptual_similarity(hash1: Optional[str], hash2: Optional[str]) -> float:
    """Returns normalized similarity between 0.0 and 1.0 (1.0 = identical)."""
    dist = hamming_distance(hash1, hash2)
    return round(1.0 - (dist / 64.0), 4)


def is_perceptual_match(
    hash1: Optional[str],
    hash2: Optional[str],
    max_distance: Optional[int] = None
) -> bool:
    """Returns True if Hamming distance <= threshold."""
    thresh = max_distance if max_distance is not None else settings.PHASH_MAX_HAMMING_DISTANCE
    return hamming_distance(hash1, hash2) <= thresh
