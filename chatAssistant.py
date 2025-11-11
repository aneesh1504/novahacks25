import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import chromadb
from chromadb.config import Settings
import requests

# ============================================================
# CONFIG
# ============================================================

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
EMBED_MODEL = "qwen/qwen3-embedding-0.6b"
CHAT_MODEL = "openai/gpt-4o-mini"
CHROMA_PATH = Path("./vector_store")
COLLECTION_NAME = "edu_profiles"
MAX_HISTORY_MESSAGES = 10  # roughly 5 user questions + assistant replies

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "HTTP-Referer": "https://novahacks25.local",
    "X-Title": "Education Matching Chat",
}

CHROMA_PATH.mkdir(parents=True, exist_ok=True)


# ============================================================
# VECTOR STORE PRIMITIVES
# ============================================================

def _vector_client() -> chromadb.Client:
    """Return a client pointing at the persistent Chroma directory."""
    return chromadb.Client(Settings(persist_directory=str(CHROMA_PATH)))


def embed_texts(texts: Sequence[str]) -> List[List[float]]:
    """Call OpenRouter embedding API for a batch of texts."""
    payload = {"model": EMBED_MODEL, "input": list(texts)}
    response = requests.post("https://openrouter.ai/api/v1/embeddings", headers=HEADERS, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return [entry["embedding"] for entry in data.get("data", [])]


def _get_collection(client: chromadb.Client):
    try:
        return client.get_collection(COLLECTION_NAME)
    except Exception:
        return client.create_collection(COLLECTION_NAME)


def _format_teacher_doc(profile: Dict[str, Any]) -> str:
    strengths = ", ".join(profile.get("raw_strengths", [])[:4]) or "general instructional support"
    weaknesses = ", ".join(profile.get("raw_weaknesses", [])[:3])
    metrics = [
        f"subject expertise {profile.get('subject_expertise', 'n/a')}",
        f"patience {profile.get('patience_level', 'n/a')}",
        f"innovation {profile.get('innovation', 'n/a')}",
        f"structure {profile.get('structure', 'n/a')}",
        f"communication {profile.get('communication', 'n/a')}",
        f"special needs support {profile.get('special_needs_support', 'n/a')}",
        f"engagement {profile.get('student_engagement', 'n/a')}",
        f"classroom management {profile.get('classroom_management', 'n/a')}",
    ]
    summary = f"Teacher {profile.get('teacher_id', 'Unknown')} focuses on {strengths}."
    if weaknesses:
        summary += f" Growth areas include {weaknesses}."
    summary += " Key scores: " + ", ".join(str(m) for m in metrics)
    return summary


def _format_student_doc(profile: Dict[str, Any]) -> str:
    metrics = [
        f"subject support need {profile.get('subject_support_needed', 'n/a')}",
        f"patience need {profile.get('patience_needed', 'n/a')}",
        f"innovation need {profile.get('innovation_needed', 'n/a')}",
        f"structure need {profile.get('structure_needed', 'n/a')}",
        f"communication need {profile.get('communication_needed', 'n/a')}",
        f"special needs support {profile.get('special_needs_support', 'n/a')}",
        f"engagement need {profile.get('engagement_needed', 'n/a')}",
        f"behavior support need {profile.get('behavior_support_needed', 'n/a')}",
    ]
    style = profile.get("learning_style", "blended")
    confidence = profile.get("confidence_level", "n/a")
    summary = (
        f"Student {profile.get('student_id', 'Unknown')} learns best via {style} approaches "
        f"with confidence level {confidence}. Needs snapshot: "
        + ", ".join(metrics)
    )
    return summary


def index_profiles(teacher_data: Iterable[Dict[str, Any]], student_data: Iterable[Dict[str, Any]]) -> Dict[str, int]:
    """
    Rebuild the vector store from raw teacher and student JSON payloads.
    Returns counts that were indexed.
    """
    teachers = list(teacher_data or [])
    students = list(student_data or [])
    client = _vector_client()

    # Drop and recreate the collection for a clean index.
    if COLLECTION_NAME in [c.name for c in client.list_collections()]:
        client.delete_collection(COLLECTION_NAME)
    collection = client.create_collection(COLLECTION_NAME)

    documents: List[str] = []
    ids: List[str] = []
    metadatas: List[Dict[str, Any]] = []

    for teacher in teachers:
        documents.append(_format_teacher_doc(teacher))
        ids.append(f"teacher_{teacher.get('teacher_id', len(ids))}")
        metadatas.append({"type": "teacher", "teacher_id": teacher.get("teacher_id")})

    for student in students:
        documents.append(_format_student_doc(student))
        ids.append(f"student_{student.get('student_id', len(ids))}")
        metadatas.append({"type": "student", "student_id": student.get("student_id")})

    if documents:
        embeddings = embed_texts(documents)
        collection.add(documents=documents, embeddings=embeddings, ids=ids, metadatas=metadatas)

    return {"teachers": len(teachers), "students": len(students)}


def retrieve_context(query: str, top_k: int = 5) -> List[str]:
    """Return textual documents that are most relevant to the query."""
    query = (query or "").strip()
    if not query:
        return []

    client = _vector_client()
    try:
        collection = client.get_collection(COLLECTION_NAME)
    except Exception:
        return []

    if collection.count() == 0:
        return []

    query_embedding = embed_texts([query])[0]
    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)
    docs = results.get("documents") or []
    return docs[0] if docs else []


def _sanitize_history(history: Sequence[Dict[str, str]]) -> List[Dict[str, str]]:
    trimmed = (history or [])[-MAX_HISTORY_MESSAGES:]
    cleaned: List[Dict[str, str]] = []
    for msg in trimmed:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        content = str(msg.get("content", "")).strip()
        if content:
            cleaned.append({"role": role, "content": content})
    return cleaned


def generate_response(query: str, context_docs: Sequence[str], history: Sequence[Dict[str, str]] | None = None) -> str:
    """Generate the final chat response grounded in Chroma context."""
    sanitized_history = _sanitize_history(history or [])

    system_prompt = (
        "You are an education strategist that connects teacher strengths with student needs. "
        "Ground every insight in the provided context, cite teacher or student names when possible, "
        "and highlight concrete next steps or matches. "
        "If no context is available, kindly ask the user to upload teacher and student data first."
    )

    context_section = "\n".join(f"{idx+1}. {doc}" for idx, doc in enumerate(context_docs)) if context_docs else "No context."
    user_message = (
        f"Context:\n{context_section}\n\n"
        f"Question:\n{query.strip()}\n\n"
        "Answer with actionable insights only using the context above."
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(sanitized_history)
    messages.append({"role": "user", "content": user_message})

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=HEADERS,
        json={"model": CHAT_MODEL, "messages": messages, "temperature": 0.2},
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    choice = (data.get("choices") or [{}])[0]
    content = choice.get("message", {}).get("content", "").strip()
    return content or "I could not generate a response. Please try again after re-indexing the data."
