import { useEffect, useRef, useState, useMemo } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function MessageBubble({ role, content, onSpeak, voiceEnabled }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
      <div className={`${isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-100'} max-w-[80%] px-4 py-3 rounded-2xl shadow-md whitespace-pre-wrap relative`}
           style={{ borderTopRightRadius: isUser ? '0.5rem' : '1rem', borderTopLeftRadius: isUser ? '1rem' : '0.5rem' }}>
        {content}
        {!isUser && voiceEnabled && (
          <button aria-label="Speak"
                  onClick={onSpeak}
                  className="absolute -right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
            🔈
          </button>
        )}
      </div>
    </div>
  )
}

function Sidebar({ conversations, activeId, onSelect, onNew }) {
  return (
    <aside className="hidden md:flex md:flex-col w-72 border-r border-slate-800 bg-slate-950/40">
      <div className="p-4 flex items-center gap-2 border-b border-slate-800">
        <span className="text-lg font-semibold">Conversations</span>
        <button onClick={onNew} className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">New</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-slate-500 text-sm">No conversations yet</div>
        ) : (
          <ul className="p-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <button onClick={() => onSelect(c.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/60 ${activeId === c.id ? 'bg-slate-800/80' : ''}`}>
                  <div className="line-clamp-1 text-slate-100 text-sm">{c.title || 'Conversation'}</div>
                  {c.last_message_at && (
                    <div className="text-xs text-slate-500">{new Date(c.last_message_at).toLocaleString()}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default function Chat() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [listening, setListening] = useState(false)
  const [micPermission, setMicPermission] = useState('unknown') // unknown | granted | denied
  const [voiceStatus, setVoiceStatus] = useState('')
  const endRef = useRef(null)
  const recognitionRef = useRef(null)
  const voicesRef = useRef([])

  const recSupported = useMemo(() => typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition), [])
  const synthSupported = useMemo(() => typeof window !== 'undefined' && 'speechSynthesis' in window, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    // Initialize: load conversations, or create a new one
    const init = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversations`)
        const data = await res.json()
        setConversations(data)
        if (data.length > 0) {
          setActiveId(data[0].id)
          await loadMessages(data[0].id)
        } else {
          const created = await createConversation()
          setActiveId(created.id)
          await loadMessages(created.id)
        }
      } catch (e) {
        // fallback to ephemeral single session
        setMessages([{ role: 'assistant', content: "Hi! I'm your AI assistant. How can I help today?" }])
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Preload speech synthesis voices (important for Safari/Chrome)
    if (!synthSupported) return
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [synthSupported])

  useEffect(() => {
    // Check mic permission state where supported
    const checkPermission = async () => {
      try {
        if (navigator?.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'microphone' })
          setMicPermission(status.state)
          status.onchange = () => setMicPermission(status.state)
        }
      } catch {}
    }
    checkPermission()
  }, [])

  const createConversation = async (title) => {
    const res = await fetch(`${BACKEND_URL}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    const data = await res.json()
    // Prepend to list
    setConversations(prev => [{ id: data.id, title: data.title, last_message_at: data.last_message_at }, ...prev])
    return data
  }

  const loadMessages = async (conversationId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${conversationId}/messages`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setMessages(data)
      } else {
        setMessages([{ role: 'assistant', content: "Hi! I'm your AI assistant. How can I help today?" }])
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: "Hi! I'm your AI assistant. How can I help today?" }])
    }
  }

  const selectConversation = async (id) => {
    if (id === activeId) return
    setActiveId(id)
    await loadMessages(id)
  }

  const newConversation = async () => {
    const created = await createConversation()
    setActiveId(created.id)
    setMessages([{ role: 'assistant', content: 'New chat started. What would you like to discuss?' }])
  }

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
        body: JSON.stringify({ message: text, conversation_id: activeId })
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      const reply = { role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, reply])
      // refresh conversation list timestamps
      try {
        const listRes = await fetch(`${BACKEND_URL}/api/conversations`)
        const list = await listRes.json()
        setConversations(list)
      } catch {}
      if (voiceEnabled) speakText(reply.content)
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

  // Voice: Speech Synthesis
  const speakText = (text) => {
    if (!synthSupported) return
    const utter = new SpeechSynthesisUtterance(text)
    // Prefer a fairly natural voice when available
    const preferred = voicesRef.current.find(v => /en-US|en_GB/i.test(v.lang) && /Female|Google|Natural/i.test(v.name)) || voicesRef.current[0]
    if (preferred) utter.voice = preferred
    utter.rate = 1
    utter.pitch = 1
    utter.volume = 1
    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    } catch {}
  }

  // Request explicit mic permission (improves UX in some browsers/iframes)
  const ensureMicPermission = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) return true
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicPermission('granted')
      return true
    } catch (err) {
      setMicPermission('denied')
      setVoiceStatus('Microphone permission blocked. Please allow access in your browser settings.')
      return false
    }
  }

  // Voice: Speech Recognition (browser-provided)
  const toggleListening = async () => {
    if (!recSupported) {
      setVoiceStatus('Speech recognition is not supported in this browser.')
      return
    }

    if (!recognitionRef.current) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      const rec = new SR()
      rec.lang = 'en-US'
      rec.interimResults = true
      rec.continuous = true

      rec.onresult = (event) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setInput(transcript)
      }
      rec.onend = () => {
        setListening(false)
      }
      rec.onerror = (e) => {
        setListening(false)
        setVoiceStatus(e?.error === 'not-allowed' ? 'Microphone permission denied.' : 'Speech recognition error. Try again.')
      }
      recognitionRef.current = rec
    }

    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const ok = await ensureMicPermission()
    if (!ok) return

    try {
      recognitionRef.current.start()
      setVoiceStatus('Listening...')
      setListening(true)
    } catch (e) {
      setListening(false)
      setVoiceStatus('Could not start speech recognition. Make sure only one tab is listening.')
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(59,130,246,0.25),transparent_35%),radial-gradient(circle_at_80%_-10%,rgba(168,85,247,0.25),transparent_35%)]" />

      <div className="relative h-screen flex">
        <Sidebar conversations={conversations} activeId={activeId} onSelect={selectConversation} onNew={newConversation} />

        <div className="flex-1 h-full flex flex-col px-4 sm:px-6 lg:px-8">
          <header className="py-6 flex items-center gap-3">
            <img src="/flame-icon.svg" alt="logo" className="w-8 h-8" />
            <h1 className="text-xl font-semibold tracking-tight">Professional AI Assistant</h1>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
              {recSupported ? (
                <>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
                    Voice
                  </label>
                  <button onClick={toggleListening} className={`px-2 py-1 rounded border ${listening ? 'border-red-400 text-red-300' : 'border-slate-600 hover:border-slate-400'}`}>{listening ? 'Stop' : 'Speak'}</button>
                </>
              ) : (
                <span className="text-slate-500">Voice not supported in this browser</span>
              )}
            </div>
          </header>

          {voiceStatus && (
            <div className="mx-4 sm:mx-6 lg:mx-8 -mt-3 mb-2 text-xs text-amber-300">{voiceStatus}</div>
          )}

          <main className="flex-1 overflow-y-auto space-y-4 pb-32">
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} voiceEnabled={voiceEnabled && synthSupported} onSpeak={() => speakText(m.content)} />
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

          <footer className="fixed bottom-0 left-0 right-0 md:left-72">
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
                  <div className="flex items-center gap-2">
                    {recSupported && (
                      <button onClick={toggleListening} className={`px-3 py-2 rounded-lg border ${listening ? 'border-red-400 text-red-300' : 'border-slate-600 hover:border-slate-400'}`}>{listening ? 'Stop' : '🎙️ Speak'}</button>
                    )}
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
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
