import json
import requests
import os
from typing import Dict, Any
from io import BytesIO
from PyPDF2 import PdfReader
import re

# ============================================================
# DOCUMENT TEXT EXTRACTION (PDF / TXT only)
# ============================================================

def extract_document_text(file_path_or_bytes: Any) -> str:
    """
    Extract raw text from .txt or .pdf files.
    Accepts either a file path or a BytesIO object (as from Streamlit uploader).
    """
    text_content = ""

    # Handle file-like object (Streamlit uploader)
    if hasattr(file_path_or_bytes, "read"):
        file_name = getattr(file_path_or_bytes, "name", "uploaded_file.pdf")
        file_bytes = file_path_or_bytes.read()
        file_path_or_bytes.seek(0)
    else:
        file_name = str(file_path_or_bytes)
        with open(file_path_or_bytes, "rb") as f:
            file_bytes = f.read()

    if file_name.endswith(".txt"):
        text_content = file_bytes.decode("utf-8", errors="ignore")

    elif file_name.endswith(".pdf"):
        reader = PdfReader(BytesIO(file_bytes))
        text_content = "\n".join(page.extract_text() or "" for page in reader.pages)

    else:
        text_content = file_bytes.decode("utf-8", errors="ignore")

    return text_content.strip()


# ============================================================
# OPENROUTER API HANDLER (Updated per official docs)
# ============================================================

def call_openrouter_api(prompt: str) -> str:
    """
    Calls OpenRouter API with correct format and cleans JSON responses.
    Handles models that return fenced markdown blocks (```json ... ```).
    Falls back to mock JSON if the request fails.
    """
    url = "https://openrouter.ai/api/v1/chat/completions"
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    if not api_key:
        print("[WARN] Missing OPENROUTER_API_KEY; using fallback.")
        return _mock_fallback()

    payload = {
        "model": "openai/gpt-4o",
        "messages": [{"role": "user", "content": prompt}]
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=60)
        print(f"[DEBUG] OpenRouter API response status: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print(f"[DEBUG] OpenRouter API response data: {data}")

        # Extract text content
        message = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not message:
            raise ValueError("Empty message content")

        # --- Fix: clean markdown code fences like ```json ... ``` ---
        cleaned = _extract_json_text(message)

        # Try to ensure valid JSON string
        json.loads(cleaned)  # validate before returning
        return cleaned

    except Exception as e:
        print(f"[WARN] OpenRouter API failed or invalid response: {e}")
        return _mock_fallback()


def _extract_json_text(text: str) -> str:
    """
    Extract JSON from a model response that may include markdown fences or commentary.
    """
    # Look for fenced code block: ```json ... ```
    match = re.search(r"```(?:json)?(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Otherwise try to find any {...} JSON-like block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group(0).strip()

    # If nothing found, return text as-is
    return text.strip()


def _mock_fallback() -> str:
    """Return mock fallback JSON when API or parse fails."""
    mock = {
        "teacher_id": "T-Demo",
        "subject_expertise": 8,
        "patience_level": 7,
        "innovation": 6,
        "structure": 9,
        "communication": 8,
        "special_needs_support": 5,
        "student_engagement": 7,
        "classroom_management": 8,
        "raw_strengths": ["Empathetic", "Organized"],
        "raw_weaknesses": ["Needs tech training"]
    }
    return json.dumps(mock)


# ============================================================
# TEACHER PROFILE PROCESSOR
# ============================================================

def process_teacher_data(teacher_document: Any, teacher_id: str) -> Dict[str, Any]:
    """
    Process a teacher document (PDF/TXT) and produce a standardized JSON vector.
    Uses OpenRouter API (or mock fallback) for analysis.
    """
    text_content = extract_document_text(teacher_document)

    prompt = f"""
    Analyze this teacher profile and rate them on a scale of 1–10 for each dimension.

    Teacher Profile:
    {text_content}

    Please provide scores for:
    - subject_expertise: Deep knowledge in subject area
    - patience_level: Ability to work with struggling students
    - innovation: Use of creative teaching methods
    - structure: Preference for organized, systematic approach
    - communication: Clear explanation and feedback skills
    - special_needs_support: Experience with learning disabilities
    - student_engagement: Ability to motivate and connect
    - classroom_management: Maintaining productive environment

    Return ONLY valid JSON in this format:
    {{
        "teacher_id": "{teacher_id}",
        "subject_expertise": 8,
        "patience_level": 7,
        "innovation": 6,
        "structure": 9,
        "communication": 8,
        "special_needs_support": 5,
        "student_engagement": 7,
        "classroom_management": 8,
        "raw_strengths": ["strength1", "strength2"],
        "raw_weaknesses": ["weakness1", "weakness2"]
    }}
    """

    raw_response = call_openrouter_api(prompt)

    try:
        teacher_profile = json.loads(raw_response)
    except json.JSONDecodeError:
        print("[WARN] Invalid JSON from model; using fallback values.")
        teacher_profile = {
            "teacher_id": teacher_id,
            "subject_expertise": 8,
            "patience_level": 7,
            "innovation": 6,
            "structure": 9,
            "communication": 8,
            "special_needs_support": 5,
            "student_engagement": 7,
            "classroom_management": 8,
            "raw_strengths": ["Empathetic", "Organized"],
            "raw_weaknesses": ["Needs tech training"]
        }

    teacher_profile["teacher_id"] = teacher_id
    return teacher_profile
