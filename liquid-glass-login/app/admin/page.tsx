"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'
import { Users, GraduationCap, CheckCircle, Sparkles, Zap, Layers, Upload, FileSpreadsheet, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/endpoints'
import type { TeacherProfile, StudentProfile, MatchResponse } from '@/lib/api/types'

/**
 * ADMIN MATCHING DASHBOARD (Liquid Glass Styled)
 * -------------------------------------------------
 * Ported from legacy `admin_page.ts` while preserving:
 *  - Matching algorithm
 *  - Student & Teacher mock data structures
 *  - Dual radar visualization (needs vs strengths)
 *  - Animated matching overlay
 *
 * Enhancements:
 *  - Integrated into Next.js app as /admin route
 *  - Uses shadcn/ui components (Card, Button, Dialog, Tabs, ScrollArea)
 *  - Glassmorphism accents (backdrop-filter, subtle borders, layered glow)
 *  - Reduced color noise; aligned with existing Liquid Glass design language
 *  - Non-destructive (original file left untouched for rollback)
 */

// ---------------------------------------------------------------------------
// Data Definitions
// ---------------------------------------------------------------------------

const skills = [
  'Critical Thinking',
  'Problem Solving',
  'Reading Comprehension',
  'Memory & Recall',
  'Curiosity',
  'Responsibility',
  'Emotional Regulation',
  'Cooperation',
  'Communication',
  'Organization'
]

// Feature flag for backend usage
const ENV_USE_BACKEND = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'

interface FrontendStudent {
  id: string
  grade?: string
  specialNeeds?: string
  data: { skill: string; value: number }[]
  raw?: StudentProfile
}

interface FrontendTeacher {
  id: string
  name: string
  subject?: string
  specialization?: string
  data: { skill: string; value: number; displayValue: number }[]
  raw?: TeacherProfile
}

// ---------------------------------------------------------------------------
// Matching Logic
// ---------------------------------------------------------------------------

interface MatchDetail {
  skill: string
  studentNeed: number
  teacherStrength: number
  matchScore: number
}

interface TeacherMatchResult {
  teacher: FrontendTeacher
  score: number
  details: MatchDetail[]
}

// Inputs are 0–10. For each skill, product(studentNeed, teacherStrength) gives 0–100.
// Overall score is the average of these percentages.
const calculateMatchScore = (student: FrontendStudent, teacher: FrontendTeacher): TeacherMatchResult => {
  let totalProduct = 0
  const details: MatchDetail[] = []
  student.data.forEach((studentSkill, index) => {
    const teacherSkill = teacher.data[index]
    const tVal = teacherSkill?.value ?? 0
    const sVal = studentSkill.value ?? 0
    const matchContribution = sVal * tVal // 0-100
    totalProduct += matchContribution
    details.push({
      skill: studentSkill.skill,
      studentNeed: sVal,
      teacherStrength: tVal,
      matchScore: matchContribution
    })
  })
  const avgPercent = totalProduct / (student.data.length || 1)
  return {
    teacher,
    score: Math.round(avgPercent),
    details: details.sort((a, b) => b.matchScore - a.matchScore)
  }
}

// ---------------------------------------------------------------------------
// Glass Utility Styles
// ---------------------------------------------------------------------------
const glassPanel = (
  'relative rounded-xl border border-white/30 bg-white/20 '+
  'backdrop-blur-xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]'
)

const subtleHeading = 'tracking-wide font-semibold text-sm uppercase text-white/80'

// Accent gradient for outlines & focus rings
const accentGradient = 'from-indigo-500 via-purple-500 to-pink-500'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminMatchingDashboard() {
  const [students, setStudents] = useState<FrontendStudent[]>([])
  const [teachers, setTeachers] = useState<FrontendTeacher[]>([])
  const [selectedStudent, setSelectedStudent] = useState<FrontendStudent | null>(null)
  const [allTeacherScores, setAllTeacherScores] = useState<TeacherMatchResult[]>([])
  const [matchedTeacher, setMatchedTeacher] = useState<TeacherMatchResult | null>(null)
  const [isMatching, setIsMatching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [activeTab, setActiveTab] = useState('students')
  const [teacherFiles, setTeacherFiles] = useState<File[]>([])
  const [studentFile, setStudentFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [constraints, setConstraints] = useState({ max_class_size: 25, min_class_size: 10 })
  const [useBackend, setUseBackend] = useState<boolean>(ENV_USE_BACKEND)
  const [matchMap, setMatchMap] = useState<Record<string, string[]> | null>(null)

  // Build a combined dataset for the overlay chart so multiple Radars share the same data source
  const overlayData = useMemo(() => {
    if (!selectedStudent) return []
    return (selectedStudent.data || []).map((row, idx) => {
      const entry: any = { skill: row.skill, student: row.value ?? 0 }
      teachers.forEach((t) => {
        entry[`t${t.id}`] = t.data[idx]?.value ?? 0
      })
      return entry
    })
  }, [selectedStudent, teachers])

  // Detect backend availability (health) and enable backend mode automatically
  useEffect(() => {
    let cancelled = false
    async function probe() {
      try {
        const res = await api.health()
        if (!cancelled && res?.ok) setUseBackend(true)
      } catch {
        // leave as-is (fallback to mock if flag not set)
      }
    }
    // Only probe if env flag not already explicitly true
    if (!ENV_USE_BACKEND) probe()
    return () => { cancelled = true }
  }, [])

  // Initiate matching process
  const handleFindMatch = async () => {
    if (!selectedStudent || teachers.length === 0) return
    setIsMatching(true)
    setShowResults(false)
    setMatchedTeacher(null)
    try {
      if (useBackend) {
        // backend match expects raw profiles
        const payload = {
          teachers: teachers.map(t => t.raw),
          students: students.map(s => s.raw),
          constraints
        }
        const mapRes: MatchResponse = await api.match(payload)
        setMatchMap(mapRes)
        // Compute local scores for ranking visualization
        const teacherScores = teachers.map(t => calculateMatchScore(selectedStudent, t))
        const sorted = teacherScores.sort((a, b) => b.score - a.score)
        setAllTeacherScores(sorted)
        setMatchedTeacher(sorted[0] || null)
      } else {
        const scores = teachers.map(t => calculateMatchScore(selectedStudent, t)).sort((a, b) => b.score - a.score)
        setAllTeacherScores(scores)
        setMatchedTeacher(scores[0])
        setMatchMap(null)
      }
    } catch (e: any) {
      setBackendError(e?.message || 'Matching failed')
    } finally {
      setIsMatching(false)
      setTimeout(() => setShowResults(true), 400)
    }
  }

  // Re-randomize on tab switch (optional future behavior) disabled for stability
  useEffect(() => {
  if (!useBackend && students.length === 0 && teachers.length === 0) {
      // Seed mock data using 0–10 scale to match backend
      const mockStudents: FrontendStudent[] = Array.from({ length: 6 }).map((_, i) => {
        const names = ['Sarah Martinez','James Chen','Emily Johnson','Marcus Williams','Aisha Patel','Diego Rodriguez']
        const specials = ['Dyslexia','None','ADHD','None','Anxiety','None']
        return {
          id: names[i],
          specialNeeds: specials[i],
          data: skills.map(skill => ({ skill, value: Math.floor(Math.random()*11) })),
        }
      })
      const mockTeachers: FrontendTeacher[] = Array.from({ length: 4 }).map((_, i) => {
        const names = ['Ms. Johnson','Mr. Rodriguez','Dr. Patel','Ms. Thompson']
        const subjects = ['Mathematics','Science','English','History']
        const specs = ['Special Ed Certified','STEM Focus','Literacy Specialist','Social-Emotional Learning']
        return {
          id: names[i],
            name: names[i],
            subject: subjects[i],
            specialization: specs[i],
            data: skills.map(skill => { const v = 5 + Math.floor(Math.random()*6); return { skill, value: v, displayValue: v } })
        }
      })
      setStudents(mockStudents)
      setTeachers(mockTeachers)
      setSelectedStudent(mockStudents[0])
    }
  }, [useBackend, students.length, teachers.length])

  const mapTeacherProfile = (tp: TeacherProfile): FrontendTeacher => {
    // Use values directly on 0–10 scale; no inversion
    const data = [
      { skill: 'Subject Expertise', value: tp.subject_expertise, displayValue: tp.subject_expertise },
      { skill: 'Patience Level', value: tp.patience_level, displayValue: tp.patience_level },
      { skill: 'Innovation', value: tp.innovation, displayValue: tp.innovation },
      { skill: 'Structure', value: tp.structure, displayValue: tp.structure },
      { skill: 'Communication', value: tp.communication, displayValue: tp.communication },
      { skill: 'Special Needs Support', value: tp.special_needs_support, displayValue: tp.special_needs_support },
      { skill: 'Student Engagement', value: tp.student_engagement, displayValue: tp.student_engagement },
      { skill: 'Classroom Management', value: tp.classroom_management, displayValue: tp.classroom_management },
    ]
    return { id: tp.teacher_id, name: tp.teacher_id, data, raw: tp }
  }

  const mapStudentProfile = (sp: StudentProfile): FrontendStudent => {
    const data = [
      { skill: 'Subject Support Needed', value: sp.subject_support_needed },
      { skill: 'Patience Needed', value: sp.patience_needed },
      { skill: 'Innovation Needed', value: sp.innovation_needed },
      { skill: 'Structure Needed', value: sp.structure_needed },
      { skill: 'Communication Needed', value: sp.communication_needed },
      { skill: 'Special Needs Support', value: sp.special_needs_support },
      { skill: 'Engagement Needed', value: sp.engagement_needed },
      { skill: 'Behavior Support Needed', value: sp.behavior_support_needed },
    ]
    return { id: sp.student_id, data, raw: sp }
  }

  const handleProcessData = async () => {
    if (!useBackend) return
    setProcessing(true)
    setBackendError(null)
    try {
      if (teacherFiles.length === 0 || !studentFile) {
        setBackendError('Please select teacher documents and a student CSV file.')
        return
      }
      const teacherProfiles = await api.uploadTeachers(teacherFiles)
      const studentProfiles = await api.uploadStudents(studentFile)
      const mappedTeachers = teacherProfiles.map(mapTeacherProfile)
      const mappedStudents = studentProfiles.map(mapStudentProfile)
      setTeachers(mappedTeachers)
      setStudents(mappedStudents)
      setSelectedStudent(mappedStudents[0] || null)
      setMatchMap(null)
    } catch (e: any) {
      setBackendError(e?.message || 'Processing failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div
      className={cn(
        'min-h-screen w-full px-4 py-10 md:py-14 relative text-slate-800',
        'bg-cover bg-center bg-no-repeat'
      )}
      style={{
        backgroundImage: "url('/images/gradient-background.jpg')"
      }}
    >
      {/* Light overlay for readability */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        <header className="flex flex-col gap-2 md:gap-3">
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600">
            Student ↔ Teacher Compatibility
          </h1>
          <p className="text-sm md:text-base text-slate-700 max-w-2xl font-medium">
            Match individual student learning gaps with teacher strengths using a complementary vector overlay.
          </p>
        </header>

        {/* Upload + Controls Panel (backend mode) */}
        {useBackend && (
          <Card className="border border-white/70 bg-white/60 backdrop-blur-lg shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><Upload className="h-4 w-4 text-pink-600" /> Data Ingestion</CardTitle>
              <CardDescription className="text-xs text-slate-600">Upload teacher documents & student CSV then process vectors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-2">
                  <label className="font-semibold flex items-center gap-1"><Users className="h-3 w-3 text-indigo-600" /> Teacher Files</label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.docx"
                    onChange={(e) => setTeacherFiles(Array.from(e.target.files || []))}
                    className="text-[10px]"
                  />
                  <p className="text-[10px] text-slate-600">{teacherFiles.length} selected</p>
                </div>
                <div className="space-y-2">
                  <label className="font-semibold flex items-center gap-1"><FileSpreadsheet className="h-3 w-3 text-pink-600" /> Student CSV</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setStudentFile(e.target.files?.[0] || null)}
                    className="text-[10px]"
                  />
                  <p className="text-[10px] text-slate-600">{studentFile ? studentFile.name : 'None selected'}</p>
                </div>
                <div className="space-y-2">
                  <label className="font-semibold flex items-center gap-1"><RefreshCcw className="h-3 w-3 text-purple-600" /> Constraints</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={constraints.max_class_size}
                      min={1}
                      onChange={(e) => setConstraints(c => ({ ...c, max_class_size: parseInt(e.target.value)||1 }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-[11px]"
                      aria-label="Max class size"
                    />
                    <input
                      type="number"
                      value={constraints.min_class_size}
                      min={1}
                      onChange={(e) => setConstraints(c => ({ ...c, min_class_size: parseInt(e.target.value)||1 }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-[11px]"
                      aria-label="Min class size"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600">Max / Min class sizes</p>
                </div>
              </div>
              {backendError && <p className="text-[11px] text-red-600">{backendError}</p>}
              <Button
                onClick={handleProcessData}
                disabled={processing}
                className="w-full py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500"
              >
                {processing ? 'Processing Data...' : 'Process Data'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Show a small hint if backend mode is off */}
        {!useBackend && (
          <div className="text-xs text-slate-600 bg-white/60 border border-white/70 rounded-md p-3">
            Backend mode is off. Set NEXT_PUBLIC_USE_BACKEND=true in <code>.env.local</code> and restart the dev server to enable file uploads,
            or ensure the API is reachable at NEXT_PUBLIC_API_BASE_URL.
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn('w-fit backdrop-blur-md bg-white/50 border border-white/60 shadow-sm')}> 
            <TabsTrigger value="students" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-slate-700">Students</TabsTrigger>
            <TabsTrigger value="match" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-slate-700">Match Result</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Student selection & radar */}
              <Card className={cn('overflow-hidden', 'rounded-xl border border-white/70 bg-white/60 backdrop-blur-lg shadow-lg')}> 
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-pink-600" />
                    <CardTitle className="text-lg font-semibold text-slate-900">Select Student</CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-600">Higher values represent greater support needs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-64 rounded-md border border-white/50 bg-white/40">
                    <div className="grid md:grid-cols-2 grid-cols-1 gap-3 p-3">
                      {students.map(st => (
                        <Button
                          key={st.id}
                          variant={selectedStudent?.id === st.id ? 'secondary' : 'outline'}
                          className={cn('text-xs justify-start flex-col items-start h-auto py-3 px-3 rounded-lg border transition-colors',
                            selectedStudent?.id === st.id
                              ? 'bg-gradient-to-br from-pink-500/70 to-purple-500/70 text-white border-pink-500'
                              : 'bg-white/70 text-slate-800 hover:bg-white')}
                          onClick={() => {
                            setSelectedStudent(st)
                            setMatchedTeacher(null)
                            setShowResults(false)
                          }}
                        >
                          <span className="font-semibold leading-tight" aria-label={`Student ${st.id}`}>{st.id}</span>
                          {st.specialNeeds && <span className="text-[10px] text-slate-600">{st.specialNeeds}</span>}
                          {st.specialNeeds && st.specialNeeds !== 'None' && (
                            <span className="text-[10px] mt-1 bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full">{st.specialNeeds}</span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="h-80 rounded-lg border border-white/60 bg-white/50 backdrop-blur-xl p-2">
                    <p className="text-[11px] text-center mb-1 font-semibold tracking-wide text-pink-700">Skill Gap Profile</p>
                    <ResponsiveContainer width="100%" height="95%">
                      <RadarChart data={selectedStudent?.data || []}>
                        <PolarGrid stroke="rgba(0,0,0,0.15)" />
                        <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                        <Radar dataKey="value" stroke="#db2777" fill="#fb7185" fillOpacity={0.4} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <Button
                    onClick={handleFindMatch}
                    disabled={isMatching}
                    className={cn('w-full py-4 font-semibold text-sm shadow-lg transition-all rounded-md', 'bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white')}
                  >
                    {isMatching ? 'Analyzing Compatibility...' : 'Find Best Teacher Match'}
                  </Button>
                </CardContent>
              </Card>

              {/* Live / Result teacher view */}
              <Card className="rounded-xl border border-white/70 bg-white/60 backdrop-blur-lg shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <CardTitle className="text-lg font-semibold text-slate-900">Best Teacher Match</CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-600">Shows teacher strengths for selected student.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!matchedTeacher && !isMatching && (
                    <div className="h-80 flex items-center justify-center text-slate-500 flex-col">
                      <Users className="h-14 w-14 mb-3 opacity-50" />
                      <p className="text-sm font-medium">No match calculated yet</p>
                      <p className="text-[11px]">Run matching to populate results</p>
                    </div>
                  )}
                  {matchedTeacher && (
                    <>
                      <div className="flex items-start justify-between rounded-lg border border-white/60 bg-white/70 p-3">
                        <div>
                          <h3 className="font-semibold flex items-center gap-1 text-sm">
                            {matchedTeacher.teacher.name}
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </h3>
                          <p className="text-[11px] text-slate-600">{matchedTeacher.teacher.subject}</p>
                          <p className="text-[11px] mt-1 text-pink-700 font-medium">{matchedTeacher.teacher.specialization}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">{matchedTeacher.score}%</p>
                          <p className="text-[10px] text-slate-600 tracking-wide">Match Score</p>
                        </div>
                      </div>
                      <div className="h-80 rounded-lg border border-white/60 bg-white/50 backdrop-blur-xl p-2">
                        <p className="text-[11px] text-center mb-1 font-semibold tracking-wide text-indigo-700">Teacher Strength Profile</p>
                        <ResponsiveContainer width="100%" height="95%">
                          <RadarChart data={matchedTeacher.teacher.data}>
                            <PolarGrid stroke="rgba(0,0,0,0.15)" />
                            <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10 }} />
                            <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                            <Radar dataKey="value" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.4} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="match">
            <MatchAnalysisPanel matchedTeacher={matchedTeacher} allTeacherScores={allTeacherScores} showResults={showResults} />

            {useBackend && matchMap && (
              <Card className={cn('mt-6 rounded-xl border border-white/70 bg-white/60 backdrop-blur-lg shadow-lg')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Matches by Teacher</CardTitle>
                  <CardDescription className="text-xs text-slate-600">Expand each teacher to view assigned students with combined radar overlays.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(matchMap).map(([teacherId, studentIds]) => {
                      const teacher = teachers.find(t => t.id === teacherId)
                      if (!teacher) return null
                      return (
                        <AccordionItem key={teacherId} value={teacherId}>
                          <AccordionTrigger className="text-sm font-semibold">{teacher.name} – {studentIds.length} Students</AccordionTrigger>
                          <AccordionContent>
                            <div className="grid md:grid-cols-2 gap-4">
                              {studentIds.map((sid) => {
                                const student = students.find(s => s.id === sid)
                                if (!student) return null
                                // Build combined dataset for this pair (student vs teacher)
                                const combined = (student.data || []).map((row, idx) => ({
                                  skill: row.skill,
                                  student: row.value ?? 0,
                                  teacher: teacher.data[idx]?.value ?? 0,
                                }))
                                return (
                                  <div key={`${teacherId}-${sid}`} className="rounded-lg border border-white/60 bg-white/50 backdrop-blur-xl p-2">
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
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Matching process overlay - non blocking UI using Dialog */}
      <Dialog open={isMatching}>
        <DialogContent className={cn('max-w-3xl border-white/70 bg-white/80 backdrop-blur-xl text-slate-800')}>          
          <div className="space-y-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900"><Sparkles className="h-5 w-5 text-pink-600" /> Analyzing Compatibility</DialogTitle>
            <p className="text-sm text-slate-700" aria-live="polite">{selectedStudent ? (<span>Comparing <span className="font-medium">{selectedStudent.id}</span>'s gap vector with teacher strength vectors...</span>) : 'No student selected'}</p>
            <div className="relative h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={overlayData}>
                  <PolarGrid stroke="rgba(0,0,0,0.15)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: '#334155', fontSize: 10, fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0,10]} tick={{ fill: '#475569', fontSize: 9 }} stroke="rgba(0,0,0,0.25)" />
                  <Radar name="Student Gaps" dataKey="student" stroke="#db2777" fill="#fb7185" fillOpacity={0.45} strokeWidth={3} />
                  {teachers.map((t, i) => (
                    <Radar
                      key={t.id}
                      name={t.name}
                      dataKey={`t${t.id}`}
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      style={{ opacity: 0.55, animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-pink-500 animate-ping" />
                  <div className="absolute inset-4 rounded-full border-2 border-indigo-500 animate-ping [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
            <p className="text-xs flex items-center gap-1 text-slate-600"><Zap className="h-4 w-4 text-indigo-600" /> Calculating matched overlay weighting...</p>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes pulse {0%{transform:scale(1)}50%{transform:scale(1.02)}100%{transform:scale(1)}}
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Match Analysis Panel Component
// ---------------------------------------------------------------------------
function MatchAnalysisPanel({ matchedTeacher, allTeacherScores, showResults }: { matchedTeacher: TeacherMatchResult | null, allTeacherScores: TeacherMatchResult[], showResults: boolean }) {
  if (!matchedTeacher || !showResults) {
    return (
      <div className={cn('min-h-[300px] flex items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl')}> 
        <div className="text-center space-y-2">
          <Layers className="h-10 w-10 mx-auto text-white/30" />
          <p className="text-sm font-medium text-white/70">No detailed analysis yet</p>
          <p className="text-xs text-white/40">Run a match to populate ranking & skill contribution breakdown.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className={cn(glassPanel)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Match Ranking</CardTitle>
          <CardDescription className="text-xs text-white/50">Top compatible teachers for current student.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {allTeacherScores.slice(0,3).map((res, idx) => (
              <div key={res.teacher.id} className={cn('rounded-lg border p-3 backdrop-blur-sm', idx === 0 ? 'border-green-300/40 bg-green-300/10' : 'border-white/20 bg-white/10')}> 
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">#{idx+1} {res.teacher.name}</span>
                  {idx === 0 && <CheckCircle className="h-4 w-4 text-green-400" />}
                </div>
                <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-pink-300">{res.score}%</p>
                <p className="text-[10px] mt-1 opacity-60">{res.teacher.specialization}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(glassPanel)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Key Skill Contributions</CardTitle>
          <CardDescription className="text-xs text-white/50">Top areas where the teacher compensates student gaps.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {matchedTeacher.details.slice(0,5).map((d, i) => (
            <div key={i} className="rounded-lg border border-white/15 bg-white/10 p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-pink-100">{d.skill}</span>
                <span className="text-[10px] font-mono text-indigo-200">{Math.round(d.matchScore)}/100</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-pink-200/80">Need:</span> <span className="font-semibold">{d.studentNeed}/10</span></div>
                <div><span className="text-indigo-200/80">Strength:</span> <span className="font-semibold">{d.teacherStrength}/10</span></div>
              </div>
              <div className="h-1.5 rounded bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500" style={{ width: `${Math.min(100, d.matchScore)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Decorative background component (kept subtle to avoid performance issues)
// ---------------------------------------------------------------------------
function GlassBackgroundDecor() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500/30 to-pink-500/40 blur-3xl opacity-40" />
      <div className="absolute top-1/2 -right-32 w-[28rem] h-[28rem] rounded-full bg-gradient-to-tr from-purple-600/30 to-indigo-500/30 blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-gradient-to-b from-pink-500/20 to-transparent blur-2xl opacity-50" />
    </div>
  )
}
