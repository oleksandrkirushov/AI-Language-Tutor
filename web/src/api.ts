// Types and calls for the endpoints in server.py

export interface HealthResponse {
  ollama: boolean
}

export interface TranscribeResponse {
  text: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  target?: string
  native?: string
}

export interface ChatResponse {
  reply: string
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
  return (await response.json()) as T
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') {
      return body.detail
    }
  } catch {
    // The body isn't JSON, for example when the proxy can't reach the server
  }
  return `The server responded with status ${response.status}`
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health', { signal })
}

/** Expects a 16 kHz, mono, 16-bit WAV. */
export function transcribeAudio(wav: Blob): Promise<TranscribeResponse> {
  return request<TranscribeResponse>('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: wav,
  })
}

export function sendChat(chatRequest: ChatRequest): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatRequest),
  })
}
