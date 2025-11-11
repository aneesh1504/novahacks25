"use client"

import React, { useEffect, useMemo, useState, useRef } from "react"
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
  // Smooth animation state
  const labels = [
    'Subject Support Needed',
    'Patience Needed',
    'Innovation Needed',
    'Structure Needed',
    'Communication Needed',
    'Special Needs Support',
    'Engagement Needed',
    'Behavior Support Needed',
  ]
  const makeVector = () => Array.from({ length: 8 }, () => Math.round(Math.random() * 10))
  const clamp10 = (v: number) => Math.max(0, Math.min(10, v))
  const [currStudent, setCurrStudent] = useState<number[]>(makeVector())
  const [currTeacher, setCurrTeacher] = useState<number[]>(makeVector())
  const targetStudentRef = useRef<number[]>(makeVector())
  const targetTeacherRef = useRef<number[]>(makeVector())
  const [usingRealData, setUsingRealData] = useState(false)
  const rafRef = useRef<number | null>(null)

  // Build overlay from current animated vectors
  const overlayData = useMemo(() => labels.map((skill, i) => ({ skill, student: currStudent[i], teacher: currTeacher[i] })), [labels, currStudent, currTeacher])

  // Spin animation regardless of data
  useEffect(() => {
    const timer = setInterval(() => setActiveTeacher((i) => i + 1), 900)
    return () => clearInterval(timer)
  }, [])

  // RAF tween loop for smooth interpolation
  useEffect(() => {
    const alpha = 0.18 // smoothing factor per frame
    const step = () => {
      setCurrStudent((prev) => prev.map((v, i) => clamp10(v + (targetStudentRef.current[i] - v) * alpha)))
      setCurrTeacher((prev) => prev.map((v, i) => clamp10(v + (targetTeacherRef.current[i] - v) * alpha)))
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // Periodically retarget dummy vectors while waiting for real data
  useEffect(() => {
    if (usingRealData) return
    const interval = setInterval(() => {
      targetStudentRef.current = targetStudentRef.current.map((v) => clamp10(v + (Math.random() * 4 - 2)))
      targetTeacherRef.current = targetTeacherRef.current.map((v) => clamp10(v + (Math.random() * 4 - 2)))
    }, 1400)
    return () => clearInterval(interval)
  }, [usingRealData])

  // Initialize: either profiles already exist, or we have pending files to process, or redirect back.
  useEffect(() => {
    async function init() {
      const existing = getProfiles()
      if (existing) {
        setTeachers(existing.teachers)
        setStudents(existing.students)
        // target first student & teacher
        const s = existing.students[0]
        const t = existing.teachers[0]
        targetStudentRef.current = [
          s.subject_support_needed, s.patience_needed, s.innovation_needed, s.structure_needed,
          s.communication_needed, s.special_needs_support, s.engagement_needed, s.behavior_support_needed,
        ]
        targetTeacherRef.current = [
          t.subject_expertise, t.patience_level, t.innovation, t.structure,
          t.communication, t.special_needs_support, t.student_engagement, t.classroom_management,
        ]
        setUsingRealData(true)
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
            const s0 = students[0]
            const t0 = teachers[0]
            targetStudentRef.current = [
              s0.subject_support_needed, s0.patience_needed, s0.innovation_needed, s0.structure_needed,
              s0.communication_needed, s0.special_needs_support, s0.engagement_needed, s0.behavior_support_needed,
            ]
            targetTeacherRef.current = [
              t0.subject_expertise, t0.patience_level, t0.innovation, t0.structure,
              t0.communication, t0.special_needs_support, t0.student_engagement, t0.classroom_management,
            ]
            setUsingRealData(true)
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

  // On teacher rotation retarget teacher vector smoothly
  useEffect(() => {
    if (!usingRealData || !teachers || teachers.length === 0) return
    const t = teachers[Math.max(0, Math.min(activeTeacher % teachers.length, teachers.length - 1))]
    targetTeacherRef.current = [
      t.subject_expertise, t.patience_level, t.innovation, t.structure,
      t.communication, t.special_needs_support, t.student_engagement, t.classroom_management,
    ]
  }, [activeTeacher, usingRealData, teachers])

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/gradient-background.jpg')" }}>
  <div className="absolute inset-0 bg-white/60 backdrop-blur-2xl" />
      <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-10 z-10">
  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 flex items-center gap-2"><Sparkles className="h-6 w-6 text-indigo-600"/> Analyzing Compatibility</h1>
  <p className="text-sm text-slate-700 mt-1">Comparing student gap vectors with teacher strength vectors...</p>

  <div className="mt-6 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-xl shadow-xl p-4">
          <div className="relative h-[440px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={overlayData}>
                <PolarGrid stroke="rgba(0,0,0,0.15)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                <Radar isAnimationActive={false} name="Student Needs" dataKey="student" stroke="#db2777" fill="#fb7185" fillOpacity={0.35} strokeWidth={3} />
                <Radar isAnimationActive={false} name="Teacher Strength" dataKey="teacher" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.2} strokeWidth={3} />
              </RadarChart>
            </ResponsiveContainer>
            {/* Pulsing rings */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500 animate-ping" />
                <div className="absolute inset-3 rounded-full border-2 border-indigo-700 animate-ping [animation-delay:0.25s]" />
              </div>
            </div>
          </div>
      <p className="text-xs flex items-center gap-1 text-slate-600 mt-3"><Zap className="h-4 w-4 text-indigo-600"/> Calculating matched overlay weighting...</p>
        </div>
      </div>
    </div>
  )
}
