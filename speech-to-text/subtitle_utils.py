"""
Shared subtitle utilities for Smallest AI Speech-to-Text applications.

This module provides reusable functions for generating SRT and VTT subtitle
formats with proper timestamp formatting.
"""

from typing import List, Dict, Callable, Optional


def format_timestamp_srt(seconds: float) -> str:
    """
    Format seconds to SRT timestamp format: HH:MM:SS,mmm
    
    Args:
        seconds: Time in seconds (can be float)
        
    Returns:
        Formatted timestamp string in SRT format
        
    Example:
        >>> format_timestamp_srt(65.123)
        '00:01:05,123'
    """
    ms = int(seconds * 1000)
    hours, ms = divmod(ms, 3600 * 1000)
    minutes, ms = divmod(ms, 60 * 1000)
    secs, ms = divmod(ms, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    """
    Format seconds to VTT timestamp format: HH:MM:SS.mmm
    
    Args:
        seconds: Time in seconds (can be float)
        
    Returns:
        Formatted timestamp string in VTT format
        
    Example:
        >>> format_timestamp_vtt(65.123)
        '00:01:05.123'
    """
    ms = int(seconds * 1000)
    hours, ms = divmod(ms, 3600 * 1000)
    minutes, ms = divmod(ms, 60 * 1000)
    secs, ms = divmod(ms, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def generate_srt(
    entries: List[Dict],
    text_key: str = "text",
    start_key: str = "start",
    end_key: str = "end",
    format_func: Optional[Callable[[float], str]] = None
) -> str:
    """
    Generate SRT format subtitles from a list of entries.
    
    Args:
        entries: List of dictionaries containing subtitle data
        text_key: Key name for the text content in each entry
        start_key: Key name for the start timestamp in each entry
        end_key: Key name for the end timestamp in each entry
        format_func: Optional custom timestamp formatting function.
                    Defaults to format_timestamp_srt.
    
    Returns:
        Complete SRT subtitle string
        
    Example:
        >>> entries = [
        ...     {"text": "Hello", "start": 0.0, "end": 1.5},
        ...     {"text": "World", "start": 1.5, "end": 3.0}
        ... ]
        >>> print(generate_srt(entries))
        1
        00:00:00,000 --> 00:00:01,500
        Hello
        
        2
        00:00:01,500 --> 00:00:03,000
        World
    """
    if format_func is None:
        format_func = format_timestamp_srt
    
    lines = []
    for idx, entry in enumerate(entries, start=1):
        start = format_func(entry[start_key])
        end = format_func(entry[end_key])
        lines.append(str(idx))
        lines.append(f"{start} --> {end}")
        lines.append(entry[text_key])
        lines.append("")
    
    return "\n".join(lines).strip()


def generate_vtt(
    entries: List[Dict],
    text_key: str = "text",
    start_key: str = "start",
    end_key: str = "end",
    format_func: Optional[Callable[[float], str]] = None
) -> str:
    """
    Generate WebVTT format subtitles from a list of entries.
    
    Args:
        entries: List of dictionaries containing subtitle data
        text_key: Key name for the text content in each entry
        start_key: Key name for the start timestamp in each entry
        end_key: Key name for the end timestamp in each entry
        format_func: Optional custom timestamp formatting function.
                    Defaults to format_timestamp_vtt.
    
    Returns:
        Complete WebVTT subtitle string
        
    Example:
        >>> entries = [
        ...     {"text": "Hello", "start": 0.0, "end": 1.5},
        ...     {"text": "World", "start": 1.5, "end": 3.0}
        ... ]
        >>> print(generate_vtt(entries))
        WEBVTT
        
        1
        00:00:00.000 --> 00:00:01.500
        Hello
        
        2
        00:00:01.500 --> 00:00:03.000
        World
    """
    if format_func is None:
        format_func = format_timestamp_vtt
    
    lines = ["WEBVTT", ""]
    for idx, entry in enumerate(entries, start=1):
        start = format_func(entry[start_key])
        end = format_func(entry[end_key])
        lines.append(str(idx))
        lines.append(f"{start} --> {end}")
        lines.append(entry[text_key])
        lines.append("")
    
    return "\n".join(lines).strip()
