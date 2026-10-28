import pytest
from app.services.text_grouping_service import TextGroupingService
from app.core.models import DetectedTextRegion, WordRegion

def test_grouping_bhim_header():
    """
    Requirement 2: 'BHIM - Bharat's Own Payments App' -> one line-level group.
    """
    raw_words = [
        {"text": "BHIM", "polygon": [[20, 30], [80, 30], [80, 55], [20, 55]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "-", "polygon": [[85, 35], [95, 35], [95, 50], [85, 50]], "confidence": 0.95, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "Bharat's", "polygon": [[100, 30], [180, 30], [180, 55], [100, 55]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "Own", "polygon": [[185, 30], [225, 30], [225, 55], [185, 55]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "Payments", "polygon": [[230, 30], [315, 30], [315, 55], [230, 55]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "App", "polygon": [[320, 30], [360, 30], [360, 55], [320, 55]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "LINE_BREAK"},
    ]
    groups = TextGroupingService.group_words(raw_words, image_width=500, image_height=1000)
    assert len(groups) == 1
    g = groups[0]
    assert g["text"] == "BHIM - Bharat's Own Payments App"
    assert g["bbox"][0] == 20.0
    assert g["bbox"][1] == 30.0
    assert g["bbox"][2] == 340.0  # 360 - 20
    assert len(g["words"]) == 6
    assert g["words"][0]["text"] == "BHIM"
    assert g["words"][-1]["text"] == "App"

def test_grouping_timeline_initiated_and_transferred():
    """
    Requirement 2:
    - 'Payment initiated by PANNAGA J A' -> one line-level group.
    - 'Payment transferred from PANNAGA J A's' -> one line-level group.
    - 'account' on the next line -> separate line-level group with same paragraphId.
    """
    raw_words = [
        # Timeline step 1: Payment initiated
        {"text": "Payment", "polygon": [[30, 80], [90, 80], [90, 100], [30, 100]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "initiated", "polygon": [[95, 80], [150, 80], [150, 100], [95, 100]], "confidence": 0.98, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "by", "polygon": [[155, 80], [175, 80], [175, 100], [155, 100]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "PANNAGA", "polygon": [[180, 80], [255, 80], [255, 100], [180, 100]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "J", "polygon": [[260, 80], [270, 80], [270, 100], [260, 100]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "A", "polygon": [[275, 80], [290, 80], [290, 100], [275, 100]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "LINE_BREAK"},

        # Timeline step 2: Payment transferred from ... (line 1)
        {"text": "Payment", "polygon": [[30, 120], [90, 120], [90, 140], [30, 140]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 1, "break_type": "SPACE"},
        {"text": "transferred", "polygon": [[95, 120], [180, 120], [180, 140], [95, 140]], "confidence": 0.98, "block_idx": 0, "paragraph_idx": 1, "break_type": "SPACE"},
        {"text": "from", "polygon": [[185, 120], [220, 120], [220, 140], [185, 140]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 1, "break_type": "SPACE"},
        {"text": "PANNAGA", "polygon": [[225, 120], [300, 120], [300, 140], [225, 140]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 1, "break_type": "SPACE"},
        {"text": "J", "polygon": [[305, 120], [315, 120], [315, 140], [305, 140]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 1, "break_type": "SPACE"},
        {"text": "A's", "polygon": [[320, 120], [345, 120], [345, 140], [320, 140]], "confidence": 0.98, "block_idx": 0, "paragraph_idx": 1, "break_type": "EOL_SURE_SPACE"},

        # Wrapped second line of step 2: account
        {"text": "account", "polygon": [[30, 148], [95, 148], [95, 168], [30, 168]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 1, "break_type": "LINE_BREAK"},
    ]

    groups = TextGroupingService.group_words(raw_words, image_width=500, image_height=1000)
    assert len(groups) == 3

    assert groups[0]["text"] == "Payment initiated by PANNAGA J A"
    assert groups[1]["text"] == "Payment transferred from PANNAGA J A's"
    assert groups[2]["text"] == "account"

    # Verify that 'Payment transferred...' and 'account' share the same paragraphId for multi-line block selection
    assert groups[1]["paragraphId"] == groups[2]["paragraphId"]
    assert groups[0]["paragraphId"] != groups[1]["paragraphId"]

def test_grouping_bank_details_and_account():
    """
    Requirement 2: 'BANK OF BARODA' -> one text group; 'XXXX0572' -> separate line if wrapped.
    """
    raw_words = [
        {"text": "BANK", "polygon": [[40, 200], [80, 200], [80, 220], [40, 220]], "confidence": 0.99, "block_idx": 1, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "OF", "polygon": [[85, 200], [110, 200], [110, 220], [85, 220]], "confidence": 0.99, "block_idx": 1, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "BARODA", "polygon": [[115, 200], [180, 200], [180, 220], [115, 220]], "confidence": 0.99, "block_idx": 1, "paragraph_idx": 0, "break_type": "LINE_BREAK"},
        {"text": "XXXX0572", "polygon": [[40, 226], [120, 226], [120, 244], [40, 244]], "confidence": 0.97, "block_idx": 1, "paragraph_idx": 0, "break_type": "LINE_BREAK"},
    ]
    groups = TextGroupingService.group_words(raw_words, image_width=500, image_height=1000)
    assert len(groups) == 2
    assert groups[0]["text"] == "BANK OF BARODA"
    assert groups[1]["text"] == "XXXX0572"
    assert groups[0]["paragraphId"] == groups[1]["paragraphId"]

def test_grouping_amount_and_txnid():
    """
    Requirement 2:
    - '₹320.00' -> one amount group.
    - '084926670403' -> one transaction ID group.
    """
    raw_words = [
        {"text": "₹", "polygon": [[100, 300], [120, 300], [120, 340], [100, 340]], "confidence": 0.96, "block_idx": 2, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "320.00", "polygon": [[122, 300], [220, 300], [220, 340], [122, 340]], "confidence": 0.99, "block_idx": 2, "paragraph_idx": 0, "break_type": "LINE_BREAK"},
        {"text": "084926670403", "polygon": [[40, 400], [160, 400], [160, 420], [40, 420]], "confidence": 0.99, "block_idx": 3, "paragraph_idx": 0, "break_type": "LINE_BREAK"},
    ]
    groups = TextGroupingService.group_words(raw_words, image_width=500, image_height=1000)
    assert len(groups) == 2
    assert groups[0]["text"] == "₹320.00"
    assert groups[1]["text"] == "084926670403"

def test_grouping_two_column_separation():
    """
    Requirement 3 & 8: Do not group unrelated columns or labels across wide horizontal gaps.
    e.g. Left column 'UPI Ref ID' and Right column '123456789' separated by wide gap.
    """
    raw_words = [
        # Left column
        {"text": "UPI", "polygon": [[30, 500], [60, 500], [60, 518], [30, 518]], "confidence": 0.99},
        {"text": "Ref", "polygon": [[65, 500], [90, 500], [90, 518], [65, 518]], "confidence": 0.99},
        {"text": "ID", "polygon": [[95, 500], [115, 500], [115, 518], [95, 518]], "confidence": 0.99},
        # Right column across wide gap (gap = 250 - 115 = 135px, while h = 18px -> gap > 7 * h)
        {"text": "123456789", "polygon": [[250, 500], [360, 500], [360, 518], [250, 518]], "confidence": 0.98},
    ]
    groups = TextGroupingService.group_words(raw_words, image_width=500, image_height=1000)
    assert len(groups) == 2
    assert groups[0]["text"] == "UPI Ref ID"
    assert groups[1]["text"] == "123456789"

def test_accurate_union_polygon_no_clipping():
    """
    Requirement 4: Calculate each group's bounds from the union of constituent word polygons.
    Complete first and last characters are fully enclosed without clipping.
    """
    raw_words = [
        {"text": "Google", "polygon": [[12.5, 45.0], [68.0, 45.0], [68.0, 70.0], [12.5, 70.0]], "confidence": 0.99},
        {"text": "Pay", "polygon": [[73.0, 45.0], [105.2, 45.0], [105.2, 70.0], [73.0, 70.0]], "confidence": 0.99},
    ]
    groups = TextGroupingService.group_words(raw_words, image_width=500, image_height=1000)
    assert len(groups) == 1
    g = groups[0]
    assert g["text"] == "Google Pay"
    assert g["polygon"] == [[12.5, 45.0], [105.2, 45.0], [105.2, 70.0], [12.5, 70.0]]
    assert g["bbox"] == (12.5, 45.0, 92.7, 25.0)

def test_grouping_wide_space_keeps_groups_separate():
    """
    User Request: On line select, if there's too much space keep it separate group of words.
    e.g. 'paytmqr12ij4o@payt' and 'NO REMARK' separated by table column whitespace.
    """
    # 1. Test geometric grouping with wide column whitespace
    raw_words_geo = [
        {"text": "paytmqr12ij4o@payt", "polygon": [[42, 410], [150, 410], [150, 426], [42, 426]], "confidence": 0.98},
        {"text": "NO", "polygon": [[193, 410], [215, 410], [215, 424], [193, 424]], "confidence": 0.99},
        {"text": "REMARK", "polygon": [[220, 410], [262, 410], [262, 424], [220, 424]], "confidence": 0.99},
    ]
    groups_geo = TextGroupingService.group_words(raw_words_geo, image_width=500, image_height=1000)
    assert len(groups_geo) == 2
    assert groups_geo[0]["text"] == "paytmqr12ij4o@payt"
    assert groups_geo[1]["text"] == "NO REMARK"

    # 2. Test hierarchy grouping with wide column whitespace
    raw_words_hier = [
        {"text": "paytmqr12ij4o@payt", "polygon": [[42, 410], [150, 410], [150, 426], [42, 426]], "confidence": 0.98, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "NO", "polygon": [[193, 410], [215, 410], [215, 424], [193, 424]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "SPACE"},
        {"text": "REMARK", "polygon": [[220, 410], [262, 410], [262, 424], [220, 424]], "confidence": 0.99, "block_idx": 0, "paragraph_idx": 0, "break_type": "LINE_BREAK"},
    ]
    groups_hier = TextGroupingService.group_words(raw_words_hier, image_width=500, image_height=1000)
    assert len(groups_hier) == 2
    assert groups_hier[0]["text"] == "paytmqr12ij4o@payt"
    assert groups_hier[1]["text"] == "NO REMARK"

    # 3. Test OCR item with internal multiple spaces
    raw_words_multi = [
        {"text": "paytmqr12ij4o@payt      NO REMARK", "polygon": [[42, 410], [262, 410], [262, 426], [42, 426]], "confidence": 0.98},
    ]
    groups_multi = TextGroupingService.group_words(raw_words_multi, image_width=500, image_height=1000)
    assert len(groups_multi) == 2
    assert groups_multi[0]["text"] == "paytmqr12ij4o@payt"
    assert groups_multi[1]["text"] == "NO REMARK"

