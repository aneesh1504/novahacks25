"use client"

// In-memory handoff for File objects between routes (same-tab only)
let _teachers: File[] | null = null
let _student: File | null = null
let _constraints: { max_class_size: number; min_class_size: number } | null = null

export function setPendingFiles(
  teachers: File[],
  student: File,
  constraints: { max_class_size: number; min_class_size: number }
) {
  _teachers = teachers
  _student = student
  _constraints = constraints
}

export function getPendingFiles(): {
  teachers: File[] | null
  student: File | null
  constraints: { max_class_size: number; min_class_size: number } | null
} {
  return { teachers: _teachers, student: _student, constraints: _constraints }
}

export function clearPendingFiles() {
  _teachers = null
  _student = null
  _constraints = null
}
