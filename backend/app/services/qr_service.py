"""
QR code generation service.
"""

import io

import qrcode
from qrcode.constants import ERROR_CORRECT_M


def generate_qr_image(data: str) -> bytes:
    """
    Generate a QR code PNG image encoding the given data string.

    Returns raw PNG bytes suitable for streaming as an HTTP response.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()
