import os
import json
import streamlit as st
import chromadb
from chromadb.config import Settings
import numpy as np
import requests

# ============================================================
# CONFIG
# ============================================================

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
EMBED_MODEL = "qwen/qwen3-embedding-0.6b"
CHAT_MODEL = "openai/gpt-4o-mini"
CHROMA_PATH = "./vector_store"

headers = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "HTTP-Referer": "https://chat.openai.com",
    "X-Title": "Education Matching Chat"
}

# ============================================================
# EMBEDDING + CHROMA SETUP
# ============================================================

def embed_texts(texts):
    """Call OpenRouter embedding API."""
    r = requests.post(
        "https://openrouter.ai/api/v1/embeddings",
        headers=headers,
        json={"model": EMBED_MODEL, "input": texts}
    )
    r.raise_for_status()
    data = r.json()
    return [d["embedding"] for d in data["data"]]


def init_vector_db():
    """Initialize or load a Chroma DB collection."""
    client = chromadb.Client(Settings(persist_directory=CHROMA_PATH))
    try:
        collection = client.get_collection("edu_profiles")
    except Exception:
        collection = client.create_collection("edu_profiles")
    return collection

def index_profiles(teacher_data, student_data):
    """Rebuild the Chroma index from teacher and student JSON."""
    client = chromadb.Client(Settings(persist_directory=CHROMA_PATH))

    # Delete existing collection if it exists
    if "edu_profiles" in [c.name for c in client.list_collections()]:
        client.delete_collection("edu_profiles")

    # Create new collection
    collection = client.create_collection("edu_profiles")

    all_docs, all_ids, all_meta = [], [], []

    # Add teachers
    for t in teacher_data:
        doc = f"Teacher {t['teacher_id']}: {t.get('summary','')} | Archetype: {t.get('teacher_archetype','')}"
        all_docs.append(doc)
        all_ids.append(f"teacher_{t['teacher_id']}")
        all_meta.append({"type": "teacher", **t.get("scores", {})})

    # Add students
    for s in student_data:
        doc = f"Student {s['student_id']}: {s.get('summary','')} | Learning style: {s.get('learning_style','')}"
        all_docs.append(doc)
        all_ids.append(f"student_{s['student_id']}")
        all_meta.append({"type": "student", **s.get("scores", {})})

    # Embed and add to Chroma
    vectors = embed_texts(all_docs)
    collection.add(
        documents=all_docs,
        embeddings=vectors,
        ids=all_ids,
        metadatas=all_meta
    )

    # No client.persist() needed anymore
    return collection

# ============================================================
# QUERY HANDLER
# ============================================================

def retrieve_context(query, top_k=5):
    """Return top_k relevant documents for a query."""
    collection = init_vector_db()
    q_vec = embed_texts([query])[0]
    results = collection.query(query_embeddings=[q_vec], n_results=top_k)
    docs = results["documents"][0]
    meta = results["metadatas"][0]
    return docs, meta

def generate_response(query, context):
    """Generate grounded, data-driven response using OpenRouter."""
    system_prompt = """
You are an AI education insights assistant.
You have access to summarized profiles of teachers and students from a school database.
Each teacher profile includes strengths, archetypes, and teaching focus.
Each student profile includes learning needs, confidence levels, and learning styles.

When answering, rely ONLY on the information provided in the context.
Use reasoning to synthesize insights (e.g., which teachers fit certain students, which profiles are weak, etc.),
but DO NOT ask the user for more data — assume the context *is* your dataset.
If relevant, give specific teacher or student names and their traits.
"""

    formatted_context = "\n\n".join([f"- {c}" for c in context.split("\n") if c.strip()])
    prompt = f"### Context\n{formatted_context}\n\n### User Question\n{query}\n\n### Your Response"

    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json={
            "model": CHAT_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": prompt.strip()}
            ],
            "temperature": 0.3
        }
    )
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    print("[DEBUG] Chat response data:", json.dumps(data, indent=2))
    return content

# ============================================================
# STREAMLIT CHAT INTERFACE
# ============================================================

def render_chat_interface():
    st.divider()
    st.header("💬 Ask the Education AI Advisor")

    if "teacher_data" not in st.session_state or "student_data" not in st.session_state:
        st.warning("Please process teacher and student data first.")
        return

    # Index data if needed
    if st.button("🔁 Re-index Profiles"):
        with st.spinner("Building vector index..."):
            index_profiles(st.session_state.teacher_data, st.session_state.student_data)
        st.success("✅ Profiles indexed successfully!")

    query = st.chat_input("Ask about teachers, students, or hiring needs...")
    if not query:
        return

    with st.spinner("Thinking..."):
        docs, meta = retrieve_context(query, top_k=6)
        context = "\n\n".join(docs[:6])[:3000]  # avoid overloading model
        answer = generate_response(query, context)

    st.markdown("### Retrieved Context")
    for i, d in enumerate(docs):
        st.markdown(f"**Result {i+1}:** {d[:350]}{'...' if len(d) > 350 else ''}")

    st.divider()
    st.markdown("### AI Advisor Response")
    st.markdown(answer)
