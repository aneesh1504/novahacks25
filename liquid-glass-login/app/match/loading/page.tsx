"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Zap } from "lucide-react"
import { api } from "@/lib/api/endpoints"
import type { TeacherProfile, StudentProfile, MatchResponse } from "@/lib/api/types"
import { getProfiles, getConstraints, setMatches, setProfiles } from "@/lib/state/session"
import { getPendingFiles, clearPendingFiles } from "@/lib/state/pending"
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts"

export default function LoadingMatch() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<TeacherProfile[] | null>(null)
  const [students, setStudents] = useState<StudentProfile[] | null>(null)
  const [activeTeacher, setActiveTeacher] = useState(0)

  // Build a lightweight overlay dataset for animation (student 0 vs rotating teachers)
  const overlayData = useMemo(() => {
    if (!students || !teachers || students.length === 0 || teachers.length === 0) return []
    const s = students[0]
    const t = teachers[Math.max(0, Math.min(activeTeacher, teachers.length - 1))]
    const studentVec = [
      { skill: 'Subject Support Needed', value: s.subject_support_needed },
      { skill: 'Patience Needed', value: s.patience_needed },
      { skill: 'Innovation Needed', value: s.innovation_needed },
      { skill: 'Structure Needed', value: s.structure_needed },
      { skill: 'Communication Needed', value: s.communication_needed },
      { skill: 'Special Needs Support', value: s.special_needs_support },
      { skill: 'Engagement Needed', value: s.engagement_needed },
      { skill: 'Behavior Support Needed', value: s.behavior_support_needed },
    ]
    const teacherVec = [
      { skill: 'Subject Support Needed', value: t.subject_expertise },
      { skill: 'Patience Needed', value: t.patience_level },
      { skill: 'Innovation Needed', value: t.innovation },
      { skill: 'Structure Needed', value: t.structure },
      { skill: 'Communication Needed', value: t.communication },
      { skill: 'Special Needs Support', value: t.special_needs_support },
      { skill: 'Engagement Needed', value: t.student_engagement },
      { skill: 'Behavior Support Needed', value: t.classroom_management },
    ]
    return studentVec.map((row, idx) => ({ skill: row.skill, student: row.value, teacher: teacherVec[idx].value }))
  }, [students, teachers, activeTeacher])

  // Spin animation regardless of data
  useEffect(() => {
    const timer = setInterval(() => setActiveTeacher((i) => i + 1), 900)
    return () => clearInterval(timer)
  }, [])

  // Initialize: either profiles already exist, or we have pending files to process, or redirect back.
  useEffect(() => {
    async function init() {
      const existing = getProfiles()
      if (existing) {
        setTeachers(existing.teachers)
        setStudents(existing.students)
      }

      if (!existing) {
        const pending = getPendingFiles()
        if (pending.teachers && pending.student) {
          try {
            // Show animation while we process
            const teachers = await api.uploadTeachers(pending.teachers)
            const students = await api.uploadStudents(pending.student)
            setProfiles({ teachers, students })
            setTeachers(teachers)
            setStudents(students)
          } finally {
            clearPendingFiles()
          }
        } else {
          // nothing to do
          router.replace("/upload")
          return
        }
      }

      // Run matching
      try {
        const cons = getConstraints() || { max_class_size: 25, min_class_size: 10 }
        const prof = getProfiles()
        if (!prof) return
        const res: MatchResponse = await api.match({ teachers: prof.teachers, students: prof.students, constraints: cons })
        setMatches(res)
        setTimeout(() => router.replace("/match/results"), 600)
      } catch {
        router.replace("/upload")
      }
    }
    init()
  }, [router])

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/gradient-background.jpg')" }}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-2xl" />
      <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-10 z-10">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 flex items-center gap-2"><Sparkles className="h-6 w-6 text-pink-600"/> Analyzing Compatibility</h1>
        <p className="text-sm text-slate-700 mt-1">Comparing student gap vectors with teacher strength vectors...</p>

        <div className="mt-6 rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl shadow-xl p-4">
          <div className="relative h-[440px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={overlayData}>
                <PolarGrid stroke="rgba(0,0,0,0.15)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                <Radar name="Student Needs" dataKey="student" stroke="#db2777" fill="#fb7185" fillOpacity={0.35} strokeWidth={3} />
                <Radar name="Teacher Strength" dataKey="teacher" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.2} strokeWidth={3} />
              </RadarChart>
            </ResponsiveContainer>
            {/* Pulsing rings */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-2 border-pink-500 animate-ping" />
                <div className="absolute inset-3 rounded-full border-2 border-indigo-500 animate-ping [animation-delay:0.25s]" />
              </div>
            </div>
          </div>
          <p className="text-xs flex items-center gap-1 text-slate-600 mt-3"><Zap className="h-4 w-4 text-indigo-600"/> Calculating matched overlay weighting...</p>
        </div>
      </div>
    </div>
  )
}
