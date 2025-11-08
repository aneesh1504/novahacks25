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
        print(f"[DEBUG] studentRadar OpenRouter API response status: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print(f"[DEBUG] studentRadar OpenRouter API response data: {data}")

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
    # student_interviews = student_interviews or {}
    student_interviews = {}

    for _, row in df.iterrows():
        student_name = str(row.get("Name", "Unknown Student"))
        interview_data = student_interviews.get(student_name, {})

        prompt = f"""
        You are an educational psychologist analyzing a student’s academic data and interview responses.
        Estimate both their academic support needs and their learning preferences.

        Academic Data:
        - Semester 1 Score: {row.get('Semester 1 Score', 'N/A')}
        - Semester 2 Score: {row.get('Semester 2 Score', 'N/A')}
        - Teacher Feedback: {row.get('Feedback', '')}

        Interview Insights:
        {json.dumps(interview_data, indent=2)}

        Tasks:
        1. Summarize the student's learning profile (2–3 sentences).
        2. Rate from 1–10 how much support they need in each area:
        - subject_support_needed
        - patience_needed
        - innovation_needed
        - structure_needed
        - communication_needed
        - special_needs_support
        - engagement_needed
        - behavior_support_needed
        3. Identify their primary learning_style (visual, auditory, kinesthetic, or blended).
        4. Identify the TEACHER PROFILE that would best fit this student 
        (e.g., “patient structured teacher”, “high-energy motivator”, “tech-based creative instructor”)
        5. Return ONLY valid JSON:

        {{
        "student_id": "{student_name}",
        "summary": "<short summary>",
        "scores": {{
            "subject_support_needed": 7,
            "patience_needed": 8,
            "innovation_needed": 5,
            "structure_needed": 9,
            "communication_needed": 6,
            "special_needs_support": 8,
            "engagement_needed": 7,
            "behavior_support_needed": 4
        }},
        "learning_style": "visual",
        "best_teacher_profile": "patient structured teacher",
        "confidence_level": 6
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
