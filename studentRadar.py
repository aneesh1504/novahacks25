import pandas as pd
import json
import requests
import os
from typing import Dict, List, Any
import re

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
    """Return mock fallback JSON when API fails."""
    mock = {
        "student_id": "S-Demo",
        "subject_support_needed": 6,
        "patience_needed": 8,
        "innovation_needed": 5,
        "structure_needed": 7,
        "communication_needed": 6,
        "special_needs_support": 3,
        "engagement_needed": 8,
        "behavior_support_needed": 4,
        "learning_style": "visual",
        "confidence_level": 6
    }
    return json.dumps(mock)

def process_student_data(csv_file: Any, student_interviews: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """
    Process student CSV data combined with optional interview insights.
    
    Parameters
    ----------
    csv_file : Uploaded file or path-like object
        The student CSV file containing academic data.
    student_interviews : dict, optional
        Optional dictionary of interview insights keyed by student name.
    
    Returns
    -------
    List[Dict[str, Any]]
        Each student's standardized "radar" vector in JSON form.
    """

    df = pd.read_csv(csv_file)
    results = []
    student_interviews = student_interviews or {}

    for _, row in df.iterrows():
        student_name = str(row.get("Name", "Unknown Student"))
        interview_data = student_interviews.get(student_name, {})

        # Combine academic + qualitative data for prompt
        prompt = f"""
        You are an educational data analyst. Based on the student's grades,
        feedback, and interview insights, assign numerical scores (1–10) for
        how much support this student *needs* in each area.

        The higher the score, the more support they need from teachers.

        Academic Data:
        - Sem 1 Score: {row.get('Sem 1 Score', 'N/A')}
        - Sem 1 Feedback: {row.get('Sem 1 Feedback', '')}
        - Sem 2 Score: {row.get('Sem 2 Score', 'N/A')}
        - Sem 2 Feedback: {row.get('Sem 2 Feedback', '')}

        Interview Insights: {json.dumps(interview_data)}

        Return ONLY valid JSON in this format:
        {{
            "student_id": "{student_name}",
            "subject_support_needed": 0,
            "patience_needed": 0,
            "innovation_needed": 0,
            "structure_needed": 0,
            "communication_needed": 0,
            "special_needs_support": 0,
            "engagement_needed": 0,
            "behavior_support_needed": 0,
            "learning_style": "visual/auditory/kinesthetic",
            "confidence_level": 0
        }}
        """

        raw_response = call_openrouter_api(prompt)

        try:
            student_profile = json.loads(raw_response)
        except json.JSONDecodeError:
            print(f"[WARN] Invalid JSON for student '{student_name}', using fallback.")
            student_profile = {
                "student_id": student_name,
                "subject_support_needed": 6,
                "patience_needed": 8,
                "innovation_needed": 5,
                "structure_needed": 7,
                "communication_needed": 6,
                "special_needs_support": 3,
                "engagement_needed": 8,
                "behavior_support_needed": 4,
                "learning_style": "visual",
                "confidence_level": 6
            }

        # Ensure required field
        student_profile["student_id"] = student_name
        results.append(student_profile)

    return results
