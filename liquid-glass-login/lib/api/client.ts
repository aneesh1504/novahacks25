import { ApiError, Fetcher } from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''
const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json'
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw <ApiError>{
      status: res.status,
      message: text || res.statusText || 'Request failed'
    }
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const fetchJson: Fetcher<any, unknown> = async (path, body, init) => {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const method = body ? 'POST' : 'GET'
  let fetchInit: RequestInit = { method, ...init }

  // If FormData passed, skip JSON encoding & headers
  if (body instanceof FormData) {
    fetchInit.body = body
    fetchInit.headers = { ...(init?.headers || {}) }
  } else {
    fetchInit.body = body ? JSON.stringify(body) : undefined
    fetchInit.headers = { ...DEFAULT_HEADERS, ...(init?.headers || {}) }
  }

  const res = await fetch(url, fetchInit)
  return handleResponse(res)
}

// Helper to create a typed client later
export function createApiClient(baseUrl = BASE_URL) {
  return {
    get: <T>(path: string, init?: RequestInit) => fetchJson(path.startsWith('http') ? path : `${baseUrl}${path}`, undefined, init) as Promise<T>,
    post: <T, B = unknown>(path: string, body: B, init?: RequestInit) => fetchJson(path.startsWith('http') ? path : `${baseUrl}${path}`, body, init) as Promise<T>
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

export const apiClient = createApiClient()
