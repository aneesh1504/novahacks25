"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Users, FileSpreadsheet, RefreshCcw } from "lucide-react"
import { api } from "@/lib/api/endpoints"
import type { TeacherProfile, StudentProfile } from "@/lib/api/types"
import { setProfiles, setConstraints } from "@/lib/state/session"
import { setPendingFiles } from "@/lib/state/pending"

export default function UploadLanding() {
  const router = useRouter()
  const [teacherFiles, setTeacherFiles] = useState<File[]>([])
  const [studentFile, setStudentFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [constraints, setC] = useState({ max_class_size: 25, min_class_size: 10 })

  const ready = teacherFiles.length > 0 && !!studentFile

  async function handleProcess() {
    if (!ready) return
    setProcessing(true)
    setError(null)
    // Hand off raw files to loading page to show animation during processing
    if (studentFile) setPendingFiles(teacherFiles, studentFile, constraints)
    setConstraints(constraints)
    router.push("/match/loading")
  }

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/gradient-background.jpg')" }}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-2xl" />
      <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-10 z-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">Student ↔ Teacher Compatibility</h1>
        <p className="mt-3 text-lg text-slate-700 max-w-3xl">Start by uploading teacher documents and the student CSV. We’ll analyze vectors and generate optimal matches.</p>

        <div className="mt-10 rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl shadow-xl p-6 md:p-8">
          <div className="flex items-center gap-2 text-xl font-semibold text-slate-900"><Upload className="h-5 w-5 text-indigo-600"/> Data Ingestion</div>
          <p className="text-sm text-slate-600 mt-1">Upload teacher documents & student CSV, then click Process Data.</p>

          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="flex items-center gap-2 font-semibold text-slate-900"><Users className="h-4 w-4 text-indigo-600"/> Teacher Files</label>
              <div className="mt-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/70 p-4">
                <input id="teacher-input" type="file" multiple accept=".pdf,.txt,.docx" onChange={(e)=>setTeacherFiles(Array.from(e.target.files||[]))} className="hidden"/>
                <button onClick={()=>document.getElementById("teacher-input")?.click()} className="w-full py-2 rounded-lg bg-white text-slate-900 border border-slate-200 font-semibold shadow hover:bg-slate-50">Choose Teacher Files</button>
                <p className="mt-2 text-xs text-slate-600">{teacherFiles.length} selected</p>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 font-semibold text-slate-900"><FileSpreadsheet className="h-4 w-4 text-indigo-600"/> Student CSV</label>
              <div className="mt-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/70 p-4">
                <input id="student-input" type="file" accept=".csv" onChange={(e)=>setStudentFile(e.target.files?.[0]||null)} className="hidden"/>
                <button onClick={()=>document.getElementById("student-input")?.click()} className="w-full py-2 rounded-lg bg-white text-slate-900 border border-slate-200 font-semibold shadow hover:bg-slate-50">Choose Student CSV</button>
                <p className="mt-2 text-xs text-slate-600">{studentFile ? studentFile.name : "None selected"}</p>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 font-semibold text-slate-900"><RefreshCcw className="h-4 w-4 text-indigo-600"/> Constraints</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="number" value={constraints.max_class_size} min={1} onChange={(e)=>setC(c=>({...c, max_class_size: parseInt(e.target.value)||1}))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Max"/>
                <input type="number" value={constraints.min_class_size} min={1} onChange={(e)=>setC(c=>({...c, min_class_size: parseInt(e.target.value)||1}))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Min"/>
              </div>
              <p className="text-xs text-slate-600 mt-2">Max / Min class sizes</p>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button onClick={handleProcess} disabled={!ready || processing} className={`mt-8 w-full py-4 rounded-2xl font-semibold shadow-lg transition ${ready && !processing ? "bg-indigo-800 hover:bg-indigo-700 text-white" : "bg-slate-200 text-slate-500"}`}>
            {processing ? "Processing..." : "Process Data"}
          </button>
        </div>
      </div>
    </div>
  )
}
