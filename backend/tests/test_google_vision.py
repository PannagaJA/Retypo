import os
import pytest
from app.services.google_vision_service import GoogleVisionService

def test_google_vision_availability(monkeypatch):
    monkeypatch.delenv("GOOGLE_VISION_API_KEY", raising=False)
    assert not GoogleVisionService.is_available()

    monkeypatch.setenv("GOOGLE_VISION_API_KEY", "AIzaSyTestKey123")
    assert GoogleVisionService.is_available()
    assert GoogleVisionService.get_api_key() == "AIzaSyTestKey123"

def test_google_vision_parse_full_text():
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
                                                    "boundingPoly": {"vertices": [{"x": 10, "y": 20}, {"x": 60, "y": 20}, {"x": 60, "y": 45}, {"x": 10, "y": 45}]}
                                                },
                                                {
                                                    "symbols": [
                                                        {"text": "Successful", "property": {"detectedBreak": {"type": "LINE_BREAK"}}}
                                                    ],
                                                    "boundingPoly": {"vertices": [{"x": 65, "y": 20}, {"x": 130, "y": 20}, {"x": 130, "y": 45}, {"x": 65, "y": 45}]}
                                                },
                                                {
                                                    "symbols": [
                                                        {"text": "₹300", "property": {"detectedBreak": {"type": "LINE_BREAK"}}}
                                                    ],
                                                    "boundingPoly": {"vertices": [{"x": 10, "y": 60}, {"x": 50, "y": 60}, {"x": 50, "y": 80}, {"x": 10, "y": 80}]}
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
    assert len(items) == 2
    assert items[0][1] == "Transaction Successful"
    assert items[0][0] == [[10.0, 20.0], [130.0, 20.0], [130.0, 45.0], [10.0, 45.0]]
    assert items[1][1] == "₹300"
    assert items[1][0] == [[10.0, 60.0], [50.0, 60.0], [50.0, 80.0], [10.0, 80.0]]

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
