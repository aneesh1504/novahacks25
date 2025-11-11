// Shared API type definitions for integrating the frontend with the backend.
// These are intentionally minimal and can be extended once backend contracts are finalized.

export interface RadarDimension {
  name: string;          // e.g. "Critical Thinking"
  value: number;         // normalized 0-100
}

export interface TeacherProfile {
  id: string;
  name: string;
  subject?: string;
  specialization?: string;
  radar: RadarDimension[]; // strengths vector
}

export interface StudentProfile {
  id: string;
  name: string;
  grade?: string;
  needs?: string;          // e.g. 'ADHD', 'Dyslexia'
  radar: RadarDimension[]; // needs vector
}

export interface MatchRequest {
  students: StudentProfile[];  // one or many
  teachers: TeacherProfile[];  // candidate set
  constraints?: {
    maxClassSize?: number;
    minMatchScore?: number;    // optional filtering threshold
  };
}

export interface SkillContribution {
  dimension: string;
  studentNeed: number;
  teacherStrength: number;
  contributionScore: number; // raw or normalized piece of final score
}

export interface TeacherMatchEntry {
  teacherId: string;
  score: number; // 0-100
  topContributions?: SkillContribution[];
}

export interface StudentMatchResult {
  studentId: string;
  ranked: TeacherMatchEntry[]; // sorted descending by score
  best?: TeacherMatchEntry;    // convenience pointer to ranked[0]
}

export interface MatchResponse {
  generatedAt: string;  // ISO timestamp
  results: StudentMatchResult[];
  meta?: Record<string, unknown>;
}

export interface ChatMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface ChatIndexResponse {
  ok: boolean;
  teachers: number;
  students: number;
}

export interface ChatQueryResponse {
  answer: string;
  contextUsed: number;
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export type Fetcher<TData, TBody = unknown> = (path: string, body?: TBody, init?: RequestInit) => Promise<TData>;
