import { useEffect } from 'react'
import { useConversation } from '../hooks/useConversation.ts'

function Conversation() {
  const { micState, appState, messages, notice, error, enableMicrophone, toggleRecording } =
    useConversation()
  const isThinking = appState === 'thinking'

  // Keep the newest message in view, just above the controls
  useEffect(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
  }, [messages, isThinking])

  return (
    <section className="conversation">
      {(messages.length > 0 || isThinking) && (
        <ol className="messages" aria-live="polite">
          {messages.map((message, index) => (
            <li key={index} className="message" data-role={message.role}>
              <p className="message-author">{message.role === 'user' ? 'You' : 'Tutor'}</p>
              <p className="message-text">{message.content}</p>
            </li>
          ))}
          {isThinking && (
            <li className="message" data-role="assistant">
              <p className="message-author">Tutor</p>
              <p className="message-pending">Thinking…</p>
            </li>
          )}
        </ol>
      )}

      <div className="controls">
        {micState === 'on' ? (
          <div className="controls-row">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={appState !== 'idle' && appState !== 'recording'}
            >
              {appState === 'recording' ? 'Finish' : 'Start speaking'}
            </button>
            <p role="status" data-state={appState}>
              {appState === 'idle' && 'Press Space and speak.'}
              {appState === 'recording' && 'Listening… Pause or press Space to finish.'}
              {appState === 'transcribing' && 'Recognizing…'}
            </p>
          </div>
        ) : (
          <div className="controls-row">
            <button type="button" onClick={enableMicrophone} disabled={micState !== 'off'}>
              {micState === 'off' ? 'Turn on microphone' : 'Turning on…'}
            </button>
            <p role="status">
              {micState === 'calibrating' &&
                'Measuring background noise, stay quiet for half a second…'}
            </p>
          </div>
        )}

        {notice && <p>{notice}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

export default Conversation
