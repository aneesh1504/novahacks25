from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import io
import tempfile
from dotenv import load_dotenv

# Load environment variables from a local .env file (if present)
load_dotenv()

from teacherRadar import process_teacher_data, extract_teacher_name, extract_document_text
from studentRadar import process_student_data
from matchingAlgo import run_matching_algorithm
from chatAssistant import index_profiles, retrieve_context, generate_response


app = FastAPI(title="Education Matching API", version="0.1.0")

# CORS for local Next.js dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.post("/api/teachers/process")
async def process_teachers(files: List[UploadFile] = File(...)) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for idx, f in enumerate(files):
        content = await f.read()
        bio = io.BytesIO(content)
        bio.name = f.filename

        # Extract preview text to infer a better teacher_id (name)
        text_preview = extract_document_text(bio)
        teacher_name = extract_teacher_name(text_preview, f"Teacher_{idx+1}")
        bio.seek(0)

        profile = process_teacher_data(bio, teacher_name)
        results.append(profile)
    return results


@app.post("/api/students/process")
async def process_students(file: UploadFile = File(...)) -> List[Dict[str, Any]]:
    # Pandas prefers a real file path; write to a temp file
    with tempfile.NamedTemporaryFile(delete=True) as tmp:
        tmp.write(await file.read())
        tmp.flush()
        with open(tmp.name, "rb") as fh:
            profiles = process_student_data(fh)
    return profiles


@app.post("/api/match")
async def match(payload: Dict[str, Any]) -> Dict[str, List[str]]:
    teachers = payload.get("teachers", [])
    students = payload.get("students", [])
    constraints = payload.get("constraints", {})
    matches = run_matching_algorithm(teachers, students, constraints)
    return matches


@app.post("/api/chat/index")
async def chat_index(payload: Dict[str, Any]) -> Dict[str, Any]:
    teachers = payload.get("teachers") or []
    students = payload.get("students") or []
    if not teachers and not students:
        raise HTTPException(status_code=400, detail="Provide at least one teacher or student profile to index.")

    counts = index_profiles(teachers, students)
    return {"ok": True, **counts}


@app.post("/api/chat/query")
async def chat_query(payload: Dict[str, Any]) -> Dict[str, Any]:
    question = (payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question text is required.")

    history = payload.get("history") or []
    docs = retrieve_context(question, top_k=6)
    answer = generate_response(question, docs, history)
    return {"answer": answer, "contextUsed": len(docs)}


# Convenience: run with `uvicorn api_server:app --reload --port 8000`
