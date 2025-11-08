import json
import random
import requests
import os
from typing import Dict, List, Any
import re

# -------------------------------
# Utility: OpenRouter API handler
# -------------------------------

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
        print(f"[DEBUG] interview OpenRouter API response status: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print(f"[DEBUG] interview OpenRouter API response data: {data}")

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
    mock = {
        "learning_preferences": "Prefers visual materials and group discussions.",
        "teacher_traits": "Likes teachers who explain clearly and use examples.",
        "motivation": "Feels more engaged when lessons are interactive.",
        "learning_challenges": "Sometimes struggles with time management."
    }
    return json.dumps(mock)

# -------------------------------
# Interview Logic
# -------------------------------

def get_age_appropriate_questions(grade_level: str) -> Dict[str, str]:
    """Return appropriate questions based on grade level"""
    base_questions = {
        "learning_style": "How do you learn best? Do you like to see pictures, hear explanations, or work with your hands?",
        "teacher_preference": "Tell me about a teacher you really liked. What made them special?",
        "challenge_response": "When something is hard to understand, what kind of help do you like?",
        "motivation": "What makes you excited to learn?",
        "classroom_environment": "Do you work better when the classroom is quiet and organized, or when there's more activity?"
    }

    if "middle" in grade_level.lower():
        return base_questions
    else:
        advanced_questions = base_questions.copy()
        advanced_questions.update({
            "future_goals": "What are your academic or career goals?",
            "learning_challenges": "What subjects or skills do you find most challenging?"
        })
        return advanced_questions

def simulate_student_response(question_key: str, student_name: str) -> str:
    """
    Generate simulated responses (for demo/testing without live input).
    You can replace this later with form inputs or actual chat.
    """
    simulated_responses = {
        "learning_style": f"{student_name} prefers visual learning with diagrams.",
        "teacher_preference": f"{student_name} appreciates teachers who are patient and encouraging.",
        "challenge_response": f"{student_name} likes when teachers give step-by-step examples.",
        "motivation": f"{student_name} feels motivated when lessons connect to real life.",
        "classroom_environment": f"{student_name} works best in a calm, organized class.",
        "future_goals": f"{student_name} wants to improve in math and explore engineering careers.",
        "learning_challenges": f"{student_name} sometimes struggles with focusing on long readings."
    }
    return simulated_responses.get(question_key, "No response recorded.")

def extract_interview_insights(conversation_history: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Uses LLM (or fallback) to extract summary insights from the interview responses.
    """
    prompt = f"""
    You are an education specialist analyzing a student's interview transcript.

    Conversation:
    {json.dumps(conversation_history, indent=2)}

    Summarize the key insights as JSON:
    {{
        "learning_preferences": "summary of how they prefer to learn",
        "teacher_traits": "what kind of teachers they thrive under",
        "motivation": "what motivates them to learn",
        "learning_challenges": "any challenges or support needs mentioned"
    }}
    """

    raw_response = call_openrouter_api(prompt)
    try:
        insights = json.loads(raw_response)
    except json.JSONDecodeError:
        print("[WARN] Invalid JSON from LLM, using fallback insights.")
        insights = json.loads(call_openrouter_api("{}"))  # fallback mock
    return insights

def conduct_student_interview(student_name: str, grade_level: str) -> Dict[str, Any]:
    """
    Conduct an AI-simulated student interview and return structured insights.
    Works offline using simulated answers.
    """
    conversation_history = []
    interview_data = {
        "student_name": student_name,
        "responses": {},
        "insights": {}
    }

    questions = get_age_appropriate_questions(grade_level)

    for question_key, question_text in questions.items():
        student_response = simulate_student_response(question_key, student_name)
        conversation_history.append({"question": question_text, "response": student_response})
        interview_data["responses"][question_key] = student_response

    # Extract structured insights from conversation
    interview_data["insights"] = extract_interview_insights(conversation_history)
    return interview_data

# -------------------------------
# Example: quick test run
# -------------------------------
if __name__ == "__main__":
    result = conduct_student_interview("Alice", "High School")
    print(json.dumps(result, indent=2))
