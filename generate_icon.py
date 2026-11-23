import os
from PIL import Image, ImageDraw

def create_localdockit_icon():
    size = (256, 256)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded container (Squircle)
    margin = 12
    # Draw dark blue-indigo gradient-like background
    draw.rounded_rectangle(
        [margin, margin, size[0] - margin, size[1] - margin],
        radius=44,
        fill=(17, 24, 39, 255),
        outline=(99, 102, 241, 255),
        width=5
    )

    # Document shape inside
    doc_left = 58
    doc_top = 46
    doc_right = 198
    doc_bottom = 210
    corner_size = 38

    # Document polygon with folded top-right corner
    doc_poly = [
        (doc_left, doc_top),
        (doc_right - corner_size, doc_top),
        (doc_right, doc_top + corner_size),
        (doc_right, doc_bottom),
        (doc_left, doc_bottom)
    ]
    draw.polygon(doc_poly, fill=(31, 41, 55, 255), outline=(129, 140, 248, 255))

    # Corner fold triangle
    fold_poly = [
        (doc_right - corner_size, doc_top),
        (doc_right - corner_size, doc_top + corner_size),
        (doc_right, doc_top + corner_size)
    ]
    draw.polygon(fold_poly, fill=(99, 102, 241, 255), outline=(165, 180, 252, 255))

    # Document decorative lines (representing text)
    line_x1 = 76
    line_x2 = 180
    draw.line([(line_x1, 106), (line_x2 - 30, 106)], fill=(243, 244, 246, 255), width=7)
    draw.line([(line_x1, 126), (line_x2, 126)], fill=(156, 163, 175, 255), width=5)
    draw.line([(line_x1, 144), (line_x2 - 15, 144)], fill=(156, 163, 175, 255), width=5)

    # Image symbol badge in the bottom-right of document
    badge_rect = [105, 158, 185, 202]
    draw.rounded_rectangle(badge_rect, radius=8, fill=(99, 102, 241, 230), outline=(224, 231, 255, 255), width=2)

    # Small mountain / landscape inside badge
    draw.polygon([(115, 194), (135, 172), (150, 186), (160, 176), (175, 194)], fill=(255, 255, 255, 255))
    # Sun dot
    draw.ellipse([(160, 165), (170, 175)], fill=(253, 224, 71, 255))

    out_path = os.path.join(os.path.dirname(__file__), "icon.ico")
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(out_path, format="ICO", sizes=icon_sizes)
    print(f"Icon generated successfully at: {out_path}")

if __name__ == "__main__":
    create_localdockit_icon()
