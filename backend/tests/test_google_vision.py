import os
import pytest
from app.services.google_vision_service import GoogleVisionService

def test_google_vision_availability(monkeypatch):
    monkeypatch.delenv("GOOGLE_VISION_API_KEY", raising=False)
    assert not GoogleVisionService.is_available()

    monkeypatch.setenv("GOOGLE_VISION_API_KEY", "AIzaSyTestKey123")
    assert GoogleVisionService.is_available()
    assert GoogleVisionService.get_api_key() == "AIzaSyTestKey123"

def test_google_vision_parse_word_level_full_text():
    """
    Verifies that words are preserved at the word level from
    fullTextAnnotation.pages[].blocks[].paragraphs[].words[].boundingBox
    without being merged into sentence lines.
    """
    mock_resp = {
        "responses": [
            {
                "fullTextAnnotation": {
                    "pages": [
                        {
                            "blocks": [
                                {
                                    "paragraphs": [
                                        {
                                            "words": [
                                                {
                                                    "symbols": [{"text": "Transaction"}],
                                                    "boundingBox": {"vertices": [{"x": 10, "y": 20}, {"x": 60, "y": 20}, {"x": 60, "y": 45}, {"x": 10, "y": 45}]},
                                                    "confidence": 0.99
                                                },
                                                {
                                                    "symbols": [
                                                        {"text": "Successful", "property": {"detectedBreak": {"type": "LINE_BREAK"}}}
                                                    ],
                                                    "boundingBox": {"vertices": [{"x": 65, "y": 20}, {"x": 130, "y": 20}, {"x": 130, "y": 45}, {"x": 65, "y": 45}]},
                                                    "confidence": 0.98
                                                },
                                                {
                                                    "symbols": [
                                                        {"text": "₹300", "property": {"detectedBreak": {"type": "LINE_BREAK"}}}
                                                    ],
                                                    "boundingBox": {"vertices": [{"x": 10, "y": 60}, {"x": 50, "y": 60}, {"x": 50, "y": 80}, {"x": 10, "y": 80}]},
                                                    "confidence": 0.95
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    }

    items = GoogleVisionService.parse_vision_response(mock_resp)
    assert len(items) == 3
    assert items[0][1] == "Transaction"
    assert items[0][0] == [[10.0, 20.0], [60.0, 20.0], [60.0, 45.0], [10.0, 45.0]]
    assert items[1][1] == "Successful"
    assert items[1][0] == [[65.0, 20.0], [130.0, 20.0], [130.0, 45.0], [65.0, 45.0]]
    assert items[2][1] == "₹300"
    assert items[2][0] == [[10.0, 60.0], [50.0, 60.0], [50.0, 80.0], [10.0, 80.0]]

def test_google_vision_missing_zero_coordinates():
    """
    Verifies that proto3 omitted coordinate 0 (e.g. {'y': 20} meaning x=0) is correctly handled.
    """
    mock_resp = {
        "responses": [
            {
                "fullTextAnnotation": {
                    "pages": [
                        {
                            "blocks": [
                                {
                                    "paragraphs": [
                                        {
                                            "words": [
                                                {
                                                    "symbols": [{"text": "Header"}],
                                                    "boundingBox": {
                                                        "vertices": [
                                                            {"y": 10},
                                                            {"x": 80, "y": 10},
                                                            {"x": 80, "y": 30},
                                                            {"y": 30}
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    }

    items = GoogleVisionService.parse_vision_response(mock_resp)
    assert len(items) == 1
    assert items[0][1] == "Header"
    assert items[0][0] == [[0.0, 10.0], [80.0, 10.0], [80.0, 30.0], [0.0, 30.0]]

def test_google_vision_rotated_polygon():
    """
    Verifies that rotated quadrilateral polygons preserve all 4 non-axis-aligned vertices.
    """
    mock_resp = {
        "responses": [
            {
                "fullTextAnnotation": {
                    "pages": [
                        {
                            "blocks": [
                                {
                                    "paragraphs": [
                                        {
                                            "words": [
                                                {
                                                    "symbols": [{"text": "Rotated"}],
                                                    "boundingBox": {
                                                        "vertices": [
                                                            {"x": 20, "y": 10},
                                                            {"x": 60, "y": 20},
                                                            {"x": 55, "y": 40},
                                                            {"x": 15, "y": 30}
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    }

    items = GoogleVisionService.parse_vision_response(mock_resp)
    assert len(items) == 1
    assert items[0][1] == "Rotated"
    assert items[0][0] == [[20.0, 10.0], [60.0, 20.0], [55.0, 40.0], [15.0, 30.0]]

def test_google_vision_normalized_vertices():
    """
    Verifies that normalizedVertices (0.0..1.0) are accurately multiplied by page dimensions.
    """
    mock_resp = {
        "responses": [
            {
                "fullTextAnnotation": {
                    "pages": [
                        {
                            "width": 1000,
                            "height": 2000,
                            "blocks": [
                                {
                                    "paragraphs": [
                                        {
                                            "words": [
                                                {
                                                    "symbols": [{"text": "ScaleTest"}],
                                                    "boundingBox": {
                                                        "normalizedVertices": [
                                                            {"x": 0.1, "y": 0.05},
                                                            {"x": 0.3, "y": 0.05},
                                                            {"x": 0.3, "y": 0.08},
                                                            {"x": 0.1, "y": 0.08}
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    }

    items = GoogleVisionService.parse_vision_response(mock_resp, image_width=1000, image_height=2000)
    assert len(items) == 1
    assert items[0][1] == "ScaleTest"
    assert items[0][0] == [[100.0, 100.0], [300.0, 100.0], [300.0, 160.0], [100.0, 160.0]]

def test_google_vision_symbol_expansion_account():
    """
    Verifies that when a word's trailing symbol (such as 't' in 'account') extends beyond
    the word-level boundingBox, the polygon expands to enclose the full word without clipping.
    """
    mock_resp = {
        "responses": [
            {
                "fullTextAnnotation": {
                    "pages": [
                        {
                            "width": 362,
                            "height": 1024,
                            "blocks": [
                                {
                                    "paragraphs": [
                                        {
                                            "words": [
                                                {
                                                    "symbols": [
                                                        {"text": "a", "boundingBox": {"vertices": [{"x": 85, "y": 609}, {"x": 91, "y": 609}, {"x": 91, "y": 620}, {"x": 85, "y": 620}]}},
                                                        {"text": "c", "boundingBox": {"vertices": [{"x": 92, "y": 609}, {"x": 98, "y": 609}, {"x": 98, "y": 620}, {"x": 92, "y": 620}]}},
                                                        {"text": "c", "boundingBox": {"vertices": [{"x": 99, "y": 609}, {"x": 105, "y": 609}, {"x": 105, "y": 620}, {"x": 99, "y": 620}]}},
                                                        {"text": "o", "boundingBox": {"vertices": [{"x": 106, "y": 609}, {"x": 112, "y": 609}, {"x": 112, "y": 620}, {"x": 106, "y": 620}]}},
                                                        {"text": "u", "boundingBox": {"vertices": [{"x": 113, "y": 609}, {"x": 119, "y": 609}, {"x": 119, "y": 620}, {"x": 113, "y": 620}]}},
                                                        {"text": "n", "boundingBox": {"vertices": [{"x": 120, "y": 609}, {"x": 124, "y": 609}, {"x": 124, "y": 620}, {"x": 120, "y": 620}]}},
                                                        {"text": "t", "boundingBox": {"vertices": [{"x": 125, "y": 609}, {"x": 129, "y": 609}, {"x": 129, "y": 620}, {"x": 125, "y": 620}]}}
                                                    ],
                                                    # Truncated word-level box (only reaching 123)
                                                    "boundingBox": {"vertices": [{"x": 85, "y": 609}, {"x": 123, "y": 609}, {"x": 123, "y": 620}, {"x": 85, "y": 620}]},
                                                    "confidence": 0.95
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    }

    items = GoogleVisionService.parse_vision_response(mock_resp, image_width=362, image_height=1024)
    assert len(items) == 1
    poly, text, conf = items[0]
    assert text == "account"
    # Verify that the right boundary extends to 129.0 to enclose the 't'
    xs = [p[0] for p in poly]
    assert max(xs) >= 129.0
    assert min(xs) <= 85.0

def test_google_vision_multi_line_wrapped_words():
    """
    Verifies that words wrapping to a second line (such as 'Payment transferred...' on line 1
    and 'account' on line 2) preserve their distinct line coordinates.
    """
    mock_resp = {
        "responses": [
            {
                "fullTextAnnotation": {
                    "pages": [
                        {
                            "width": 362,
                            "height": 1024,
                            "blocks": [
                                {
                                    "paragraphs": [
                                        {
                                            "words": [
                                                {
                                                    "symbols": [{"text": "Payment"}],
                                                    "boundingBox": {"vertices": [{"x": 84, "y": 593}, {"x": 130, "y": 593}, {"x": 130, "y": 607}, {"x": 84, "y": 607}]}
                                                },
                                                {
                                                    "symbols": [{"text": "transferred"}],
                                                    "boundingBox": {"vertices": [{"x": 134, "y": 593}, {"x": 190, "y": 593}, {"x": 190, "y": 607}, {"x": 134, "y": 607}]}
                                                },
                                                {
                                                    "symbols": [{"text": "account"}],
                                                    "boundingBox": {"vertices": [{"x": 85, "y": 609}, {"x": 128, "y": 609}, {"x": 128, "y": 620}, {"x": 85, "y": 620}]}
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    }

    items = GoogleVisionService.parse_vision_response(mock_resp)
    assert len(items) == 3
    assert items[0][1] == "Payment"
    assert items[0][0][0][1] == 593.0  # Line 1 y
    assert items[1][1] == "transferred"
    assert items[1][0][0][1] == 593.0  # Line 1 y
    assert items[2][1] == "account"
    assert items[2][0][0][1] == 609.0  # Line 2 y

def test_google_vision_parse_text_annotations_fallback():
    mock_resp = {
        "responses": [
            {
                "textAnnotations": [
                    {"description": "Transaction Successful\n₹300"},
                    {
                        "description": "Transaction",
                        "boundingPoly": {"vertices": [{"x": 10, "y": 20}, {"x": 50, "y": 20}, {"x": 50, "y": 40}, {"x": 10, "y": 40}]}
                    },
                    {
                        "description": "₹300",
                        "boundingPoly": {"vertices": [{"x": 10, "y": 60}, {"x": 50, "y": 60}, {"x": 50, "y": 80}, {"x": 10, "y": 80}]}
                    }
                ]
            }
        ]
    }

    items = GoogleVisionService.parse_vision_response(mock_resp)
    assert len(items) == 2
    assert items[0][1] == "Transaction"
    assert items[1][1] == "₹300"
