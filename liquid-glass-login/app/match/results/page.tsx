"use client"

import React, { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getProfiles, getMatches, clearSession } from "@/lib/state/session"
import type { TeacherProfile, StudentProfile, MatchResponse } from "@/lib/api/types"
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts"
import { Users, GraduationCap, RefreshCcw } from "lucide-react"

function toTeacherVector(t: TeacherProfile) {
  return [
    { skill: 'Subject Support Needed', value: t.subject_expertise },
    { skill: 'Patience Needed', value: t.patience_level },
    { skill: 'Innovation Needed', value: t.innovation },
    { skill: 'Structure Needed', value: t.structure },
    { skill: 'Communication Needed', value: t.communication },
    { skill: 'Special Needs Support', value: t.special_needs_support },
    { skill: 'Engagement Needed', value: t.student_engagement },
    { skill: 'Behavior Support Needed', value: t.classroom_management },
  ]
}

function toStudentVector(s: StudentProfile) {
  return [
    { skill: 'Subject Support Needed', value: s.subject_support_needed },
    { skill: 'Patience Needed', value: s.patience_needed },
    { skill: 'Innovation Needed', value: s.innovation_needed },
    { skill: 'Structure Needed', value: s.structure_needed },
    { skill: 'Communication Needed', value: s.communication_needed },
    { skill: 'Special Needs Support', value: s.special_needs_support },
    { skill: 'Engagement Needed', value: s.engagement_needed },
    { skill: 'Behavior Support Needed', value: s.behavior_support_needed },
  ]
}

function explainPair(t: TeacherProfile, s: StudentProfile) {
  const tv = toTeacherVector(t)
  const sv = toStudentVector(s)
  const scored = sv.map((row, i) => ({ name: row.skill, score: row.value * tv[i].value, need: row.value, strength: tv[i].value }))
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 3).map(r => r.name.replace(" Needed", "").replace("Support", "Support"))
  return `Paired for complementary strengths in ${top.join(", ")}. Teacher scores are well-matched to the student's highest support needs.`
}

export default function MatchResults() {
  const router = useRouter()
  const [profiles, setProfilesState] = useState<{ teachers: TeacherProfile[]; students: StudentProfile[] } | null>(null)
  const [matches, setMatchesState] = useState<MatchResponse | null>(null)
  const [inspect, setInspect] = useState<{ teacher: TeacherProfile; student: StudentProfile } | null>(null)

  useEffect(() => {
    const p = getProfiles()
    const m = getMatches()
    if (!p || !m) {
      router.replace("/upload")
      return
    }
    setProfilesState(p)
    setMatchesState(m)
  }, [router])

  if (!profiles || !matches) return null

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/gradient-background.jpg')" }}>
      <div className="absolute inset-0 bg-white/50 backdrop-blur-2xl" />
      <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-10 z-10 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600">Match Results</h1>
            <p className="text-sm text-slate-700">Expand a teacher to view assigned students with combined overlays. Click a chart for a short rationale.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={()=>router.push('/upload')}><RefreshCcw className="h-4 w-4 mr-1"/>New Upload</Button>
            <Button className="bg-gradient-to-r from-indigo-600 to-pink-600 text-white" onClick={()=>{ clearSession(); router.push('/upload') }}>Reset</Button>
          </div>
        </header>

        <Card className="rounded-xl border border-white/70 bg-white/60 backdrop-blur-lg shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Assignments by Teacher</CardTitle>
            <CardDescription className="text-xs text-slate-600">Click a student’s chart for a short explanation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(matches as Record<string,string[]>).map(([teacherId, studentIds]) => {
                const teacher = profiles.teachers.find(t => t.teacher_id === teacherId)
                if (!teacher) return null
                const tVec = toTeacherVector(teacher)
                return (
                  <AccordionItem key={teacherId} value={teacherId}>
                    <AccordionTrigger className="text-sm font-semibold">{teacher.teacher_id} – {studentIds.length} Students</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        {studentIds.map((sid: string) => {
                          const student = profiles.students.find(s => s.student_id === sid)
                          if (!student) return null
                          const sVec = toStudentVector(student)
                          const combined = sVec.map((row, idx) => ({ skill: row.skill, student: row.value, teacher: tVec[idx].value }))
                          return (
                            <div key={`${teacherId}-${sid}`} className="rounded-lg border border-white/60 bg-white/50 backdrop-blur-xl p-2 cursor-pointer" onClick={()=>setInspect({ teacher, student })}>
                              <p className="text-[11px] text-center mb-1 font-semibold tracking-wide text-slate-700">{sid}</p>
                              <ResponsiveContainer width="100%" height={280}>
                                <RadarChart data={combined}>
                                  <PolarGrid stroke="rgba(0,0,0,0.15)" />
                                  <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10 }} />
                                  <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                                  <Radar name="Student Needs" dataKey="student" stroke="#db2777" fill="#fb7185" fillOpacity={0.35} strokeWidth={2} />
                                  <Radar name="Teacher Strength" dataKey="teacher" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>
      </div>

  <Dialog open={!!inspect} onOpenChange={(o: boolean)=>!o && setInspect(null)}>
        <DialogContent className="max-w-3xl border-white/70 bg-white/80 backdrop-blur-xl text-slate-800">
          {inspect && (
            <div className="space-y-4">
              <DialogTitle className="text-xl font-semibold">Why this pair?</DialogTitle>
              <p className="text-sm text-slate-700">{explainPair(inspect.teacher, inspect.student)}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/60 bg-white/50 p-2">
                  <p className="text-[11px] text-center mb-1 font-semibold tracking-wide text-pink-700">Student Profile</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={toStudentVector(inspect.student)}>
                      <PolarGrid stroke="rgba(0,0,0,0.15)" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                      <Radar dataKey="value" stroke="#db2777" fill="#fb7185" fillOpacity={0.35} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-lg border border-white/60 bg-white/50 p-2">
                  <p className="text-[11px] text-center mb-1 font-semibold tracking-wide text-indigo-700">Teacher Profile</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={toTeacherVector(inspect.teacher)}>
                      <PolarGrid stroke="rgba(0,0,0,0.15)" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                      <Radar dataKey="value" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
