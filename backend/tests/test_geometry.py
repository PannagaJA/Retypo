import math
from PIL import Image, ImageDraw
from app.services.geometry_service import (
    calculate_polygon_angle,
    calculate_font_size,
    calculate_bounding_box,
    calculate_geometry_confidence,
    estimate_text_color,
    estimate_text_weight,
    refine_polygon_to_text,
)

def test_calculate_polygon_angle():
    # Horizontal quad (0 degrees)
    quad_horiz = [[10.0, 20.0], [110.0, 20.0], [110.0, 50.0], [10.0, 50.0]]
    assert calculate_polygon_angle(quad_horiz) == 0.0

    # 45 degree quad
    quad_45 = [[0.0, 0.0], [10.0, 10.0], [10.0, 20.0], [0.0, 10.0]]
    assert calculate_polygon_angle(quad_45) == 45.0

def test_calculate_font_size():
    # Height is 30px
    quad = [[10.0, 20.0], [110.0, 20.0], [110.0, 50.0], [10.0, 50.0]]
    # 30px visual line box height calibrates to 26.4px font em-size (30.0 * 0.88)
    assert calculate_font_size(quad) == 26.4

def test_calculate_bounding_box():
    quad = [[10.0, 20.0], [110.0, 20.0], [110.0, 50.0], [10.0, 50.0]]
    bbox = calculate_bounding_box(quad)
    assert bbox == (10.0, 20.0, 100.0, 30.0)

def test_calculate_geometry_confidence():
    quad_perfect = [[0.0, 0.0], [100.0, 0.0], [100.0, 40.0], [0.0, 40.0]]
    conf = calculate_geometry_confidence(quad_perfect)
    assert conf == 1.0

def test_estimate_text_color():
    # Draw white background with a bright red square text block in center
    img = Image.new('RGB', (200, 100), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([30, 20, 170, 80], fill=(255, 0, 0))

    quad = [[25.0, 15.0], [175.0, 15.0], [175.0, 85.0], [25.0, 85.0]]
    color = estimate_text_color(img, quad)
    assert color.lower() == "#ff0000"


def test_estimate_text_weight():
    # Regular text: thin stroke
    img_reg = Image.new("RGB", (100, 30), color=(255, 255, 255))
    draw_reg = ImageDraw.Draw(img_reg)
    draw_reg.line([(10, 15), (90, 15)], fill=(0, 0, 0), width=1)
    quad = [[10.0, 5.0], [90.0, 5.0], [90.0, 25.0], [10.0, 25.0]]
    assert estimate_text_weight(img_reg, quad, 20.0) == "400"

    # Bold text: thick stroke
    img_bold = Image.new("RGB", (100, 30), color=(255, 255, 255))
    draw_bold = ImageDraw.Draw(img_bold)
    draw_bold.line([(10, 15), (90, 15)], fill=(0, 0, 0), width=6)
    assert estimate_text_weight(img_bold, quad, 20.0) in ["600", "700"]

def test_refine_polygon_to_text():
    # Draw dark background with white text block at [50, 40, 150, 70]
    img = Image.new("RGB", (200, 120), color=(20, 20, 20))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 40, 150, 70], fill=(255, 255, 255))

    # Oversized polygon with vertical offset and top padding
    sloppy_poly = [[40.0, 25.0], [160.0, 25.0], [160.0, 85.0], [40.0, 85.0]]
    refined = refine_polygon_to_text(img, sloppy_poly, angle=0.0)

    # Refined poly should tightly enclose [50, 40, 150, 70] with ~2px margin
    min_x, min_y = refined[0][0], refined[0][1]
    max_x, max_y = refined[2][0], refined[2][1]
    assert 47.0 <= min_x <= 50.0
    assert 150.0 <= max_x <= 153.0
    assert 37.0 <= min_y <= 40.0
    assert 70.0 <= max_y <= 73.0
