"use client"

import type { TeacherProfile, StudentProfile, MatchResponse } from "@/lib/api/types"

const KEYS = {
  profiles: "eduMatch.profiles.v1",
  matches: "eduMatch.matches.v1",
  constraints: "eduMatch.constraints.v1",
} as const

export type Profiles = { teachers: TeacherProfile[]; students: StudentProfile[] }

function parse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export function setProfiles(p: Profiles) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEYS.profiles, JSON.stringify(p))
}
export function getProfiles(): Profiles | null {
  if (typeof window === 'undefined') return null
  return parse<Profiles>(localStorage.getItem(KEYS.profiles))
}

export function setMatches(m: MatchResponse) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEYS.matches, JSON.stringify(m))
}
export function getMatches(): MatchResponse | null {
  if (typeof window === 'undefined') return null
  return parse<MatchResponse>(localStorage.getItem(KEYS.matches))
}

export function setConstraints(c: { max_class_size: number; min_class_size: number }) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEYS.constraints, JSON.stringify(c))
}
export function getConstraints(): { max_class_size: number; min_class_size: number } | null {
  if (typeof window === 'undefined') return null
  return parse(localStorage.getItem(KEYS.constraints))
}

export function clearSession() {
  if (typeof window === 'undefined') return
  Object.values(KEYS).forEach(k => localStorage.removeItem(k))
}
