import type { ReactNode } from 'react'
import { type ServerStatus, useServerStatus } from './hooks/useServerStatus.ts'
import Conversation from './components/Conversation.tsx'

const STATUS_TEXT: Record<ServerStatus, { title: string; hint: ReactNode }> = {
  checking: {
    title: 'Checking the server…',
    hint: null,
  },
  ready: {
    title: 'Ready',
    hint: 'The server and Ollama are both running.',
  },
  'ollama-down': {
    title: 'Ollama isn’t running',
    hint: (
      <>
        Open the Ollama app or run <code>ollama serve</code>.
      </>
    ),
  },
  'server-down': {
    title: 'The server isn’t running',
    hint: (
      <>
        Run <code>python server.py</code> in the project folder.
      </>
    ),
  },
}

function App() {
  const status = useServerStatus()
  const { title, hint } = STATUS_TEXT[status]

  return (
    <main>
      <h1>Voice Language Tutor</h1>
      <div className="status" data-status={status} role="status">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <p className="status-title">{title}</p>
          {hint && <p className="status-hint">{hint}</p>}
        </div>
      </div>
      <Conversation />
    </main>
  )
}

export default App
