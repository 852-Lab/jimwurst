import pandas as pd
import numpy as np
from ravioli.backend.data.olap.ingestion.utils import process_sheet_with_analysis

def test_process_sheet_with_analysis_basic():
    """Test basic ready-state sheet structural ingestion with normal integers."""
    df = pd.DataFrame([
        ["Title of the spreadsheet", None, None],
        ["ColA", "ColB", "ColC"],
        [1, "foo", 10.5],
        [2, "bar", 20.0]
    ])
    
    analysis = {
        "verdict": "ready",
        "header_row": 1,
        "data_start_row": 2,
        "is_split": False
    }
    
    res = process_sheet_with_analysis(df, analysis)
    
    assert list(res.columns) == ["ColA", "ColB", "ColC"]
    assert len(res) == 2
    assert res.iloc[0]["ColA"] == 1
    assert res.iloc[1]["ColB"] == "bar"

def test_process_sheet_with_analysis_list_and_string_fallback():
    """Test parser fallbacks when LLM returns list/string structures for header_row or data_start_row."""
    df = pd.DataFrame([
        ["Ignored Title Row", None],
        ["Row 1 - Data Info", None],
        ["ColA", "ColB"],
        [100, 200],
        [300, 400]
    ])
    
    # Ollama returns list of strings for header_row and a text string for data_start_row
    analysis = {
        "verdict": "ready",
        "header_row": ["ColA", "ColB"], # list of strings (no digits) -> resolves to 0
        "data_start_row": "Row 3",       # string with digits -> resolves to 3
        "is_split": False
    }
    
    res = process_sheet_with_analysis(df, analysis)
    
    # Headers are taken from row 0 ("Ignored Title Row") due to fallback 0
    assert "Ignored Title Row" in res.columns
    # Data is taken starting from row 3
    assert len(res) == 2
    assert res.iloc[0]["Ignored Title Row"] == 100

def test_process_sheet_with_analysis_list_ints():
    """Test parser fallbacks when LLM returns a list containing integers."""
    df = pd.DataFrame([
        ["Title", None],
        ["Col1", "Col2"],
        [10, 20],
        [30, 40]
    ])
    
    analysis = {
        "verdict": "ready",
        "header_row": [1],       # list of integers
        "data_start_row": [2],   # list of integers
        "is_split": False
    }
    
    res = process_sheet_with_analysis(df, analysis)
    
    assert list(res.columns) == ["Col1", "Col2"]
    assert len(res) == 2
    assert res.iloc[0]["Col1"] == 10

def test_process_sheet_with_analysis_nan_exclusion():
    """Test that empty/NaN values do not trigger false-positive split-table detections."""
    # Dataframe with a header containing NaN values (which normally evaluate as "nan" in strings)
    df = pd.DataFrame([
        ["ColA", np.nan, np.nan, "ColB", np.nan, np.nan],
        [1, None, None, 2, None, None],
        [3, None, None, 4, None, None]
    ])
    
    analysis = {
        "verdict": "ready",
        "header_row": 0,
        "data_start_row": 1,
        "is_split": False
    }
    
    res = process_sheet_with_analysis(df, analysis)
    
    # If "nan" triggered split detection, is_split would be True and it would try to merge blocks.
    # Instead, is_split should remain False, and all columns should stay intact.
    assert not res.empty
    assert list(res.columns) == ["ColA", "ColB"]

def test_process_sheet_with_analysis_split_auto_recovery():
    """Test that split table offsets are calculated automatically if empty or missing."""
    df = pd.DataFrame([
        ["ColA", "ColB", "ColA", "ColB"], # Duplicate headers representing a split table
        [1, 2, 3, 4],
        [5, 6, 7, 8]
    ])
    
    # Marked as split, but split_offsets is empty
    analysis = {
        "verdict": "ready",
        "header_row": 0,
        "data_start_row": 1,
        "is_split": True,
        "split_offsets": []
    }
    
    res = process_sheet_with_analysis(df, analysis)
    
    # The offsets recovery code should automatically calculate offset = 2
    # And stack the two side-by-side blocks vertically
    assert list(res.columns) == ["ColA", "ColB"]
    assert len(res) == 4
    assert list(res["ColA"]) == [1, 5, 3, 7]
    assert list(res["ColB"]) == [2, 6, 4, 8]
