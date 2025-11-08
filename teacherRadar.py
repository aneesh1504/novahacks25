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
        print(f"[DEBUG] teacherRadar OpenRouter API response status: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print(f"[DEBUG] teacherRadar OpenRouter API response data: {data}")

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

def extract_teacher_name(text: str, default_name: str) -> str:
    """
    Extract teacher name from text using a pattern like 'Mr. John Smith' or 'Ms. Jane Tan'.
    Matches only up to the last name and ignores trailing words like 'Instructor' or 'Department'.
    """
    # Regex pattern:
    # - Capture titles Mr./Ms./Mrs./Dr.
    # - One first name (capitalized, may include hyphen or apostrophe)
    # - Optional middle initial
    # - One last name (capitalized, may include hyphen or apostrophe)
    pattern = re.compile(
        r"\b(Mr|Ms|Mrs|Dr)\.\s+[A-Z][a-zA-Z'\-]+(?:\s+[A-Z]\.)?\s+[A-Z][a-zA-Z'\-]+\b"
    )

    match = pattern.search(text)
    if match:
        return match.group(0).strip()
    return default_name


def process_teacher_data(teacher_document: Any, teacher_id: str) -> Dict[str, Any]:
    """
    Process a teacher document (PDF/TXT) and produce a standardized JSON vector.
    Uses OpenRouter API (or mock fallback) for analysis.
    """
    text_content = extract_document_text(teacher_document)

    prompt = f"""
    You are analyzing a teacher profile to evaluate teaching effectiveness and student compatibility.

    Teacher Profile:
    {text_content}

    Tasks:
    1. Summarize this teacher’s approach in 2–3 sentences.
    2. Rate on a 1–10 scale (with a 1–2 = very weak, 5 = average, 8–10 = exceptional):
    - subject_expertise
    - patience_level
    - innovation
    - structure
    - communication
    - special_needs_support
    - student_engagement
    - classroom_management
    3. Infer the TEACHER ARCHETYPE (choose one): 
    ["Structured Nurturer", "Creative Motivator", "Tech Innovator", "Special-Needs Specialist", "High-Performance Coach"]
    4. Infer the STUDENT PROFILE(S) that would thrive most with this teacher. 
    (e.g., “gifted self-directed learners”, “students with math anxiety”, “students needing firm structure”)
    5. Return ONLY valid JSON in this format:

    {{
    "teacher_id": "{teacher_id}",
    "summary": "<brief summary>",
    "scores": {{
        "subject_expertise": 8,
        "patience_level": 7,
        "innovation": 6,
        "structure": 9,
        "communication": 8,
        "special_needs_support": 5,
        "student_engagement": 7,
        "classroom_management": 8
    }},
    "teacher_archetype": "Special-Needs Specialist",
    "best_fit_students": ["students with learning disabilities", "those needing structured guidance"],
    "raw_strengths": ["Empathetic", "Organized", "Multi-sensory methods"],
    "raw_weaknesses": ["Slow pace", "Limited adaptability"]
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
