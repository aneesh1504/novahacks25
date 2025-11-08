import { apiClient } from './client'
import type { MatchRequest, MatchResponse, StudentProfile, TeacherProfile } from './types'

// Backend routes served by FastAPI
export const endpoints = {
  health: '/api/health',
  teachersProcess: '/api/teachers/process',
  studentsProcess: '/api/students/process',
  match: '/api/match',
}

export const api = {
  health: () => apiClient.get<{ ok: boolean }>(endpoints.health),
  match: (payload: MatchRequest) => apiClient.post<MatchResponse, MatchRequest>(endpoints.match, payload),
  uploadTeachers: async (files: File[]): Promise<TeacherProfile[]> => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return apiClient.post<TeacherProfile[], FormData>(endpoints.teachersProcess, fd)
  },
  uploadStudents: async (file: File): Promise<StudentProfile[]> => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post<StudentProfile[], FormData>(endpoints.studentsProcess, fd)
  },
}
