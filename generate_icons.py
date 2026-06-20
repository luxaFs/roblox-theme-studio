"""
Generate simple placeholder icons for the extension.
Run once: python3 generate_icons.py
Requires: pip install Pillow
"""
try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow first: pip install Pillow --break-system-packages")
    exit()

import os

SIZES = [16, 48, 128]
OUTPUT_DIR = "icons"
os.makedirs(OUTPUT_DIR, exist_ok=True)

for size in SIZES:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark rounded background
    margin = max(1, size // 10)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 4,
        fill=(28, 20, 60, 255)
    )

    # Purple palette icon
    cx, cy = size // 2, size // 2
    r = size // 4
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(124, 58, 237, 255))

    inner = r // 2
    draw.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=(167, 139, 250, 255))

    path = os.path.join(OUTPUT_DIR, f"icon{size}.png")
    img.save(path)
    print(f"Created {path}")

print("Icons generated!")
