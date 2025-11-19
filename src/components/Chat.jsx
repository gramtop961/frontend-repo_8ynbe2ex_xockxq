import { useEffect, useRef, useState } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}> 
      <div className={`${isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-100'} max-w-[80%] px-4 py-3 rounded-2xl shadow-md whitespace-pre-wrap`}
           style={{ borderTopRightRadius: isUser ? '0.5rem' : '1rem', borderTopLeftRadius: isUser ? '1rem' : '0.5rem' }}>
        {content}
      </div>
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your AI assistant. How can I help today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I ran into an issue reaching the brain. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(59,130,246,0.25),transparent_35%),radial-gradient(circle_at_80%_-10%,rgba(168,85,247,0.25),transparent_35%)]" />

      <div className="relative max-w-4xl mx-auto h-screen flex flex-col px-4 sm:px-6 lg:px-8">
        <header className="py-6 flex items-center gap-3">
          <img src="/flame-icon.svg" alt="logo" className="w-8 h-8" />
          <h1 className="text-xl font-semibold tracking-tight">Professional AI Assistant</h1>
          <div className="ml-auto text-sm text-slate-400">Connected to backend</div>
        </header>

        <main className="flex-1 overflow-y-auto space-y-4 pb-32">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {loading && (
            <div className="flex gap-2 items-center text-slate-400">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <div ref={endRef} />
        </main>

        <footer className="fixed bottom-0 left-0 right-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
            <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-2xl p-3 shadow-xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                placeholder="Ask anything..."
                className="w-full resize-none bg-transparent outline-none text-slate-100 placeholder-slate-500 p-3"
              />
              <div className="flex justify-between items-center px-2 pb-1">
                <div className="text-xs text-slate-500">Shift+Enter for new line</div>
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
