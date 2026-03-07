'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isVoice?: boolean
}

// Simple markdown-to-text renderer (bullets, bold)
function renderText(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>
      }
      return part
    })
    return (
      <span key={i} className={line.startsWith('•') || line.startsWith('-') ? 'block pl-2' : 'block'}>
        {parts}
        {i < lines.length - 1 && !line.trim() && <br />}
      </span>
    )
  })
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy el asistente de Agrodelicias 🌿\n\nPuedo ayudarte a:\n• Consultar ventas, compras, inventario y gastos\n• Registrar ventas, compras, inventario y gastos\n• Ver el resumen del día\n\nPuedes escribirme o mandarme un audio.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Convert messages state to API format
  function toApiMessages(msgs: Message[]) {
    return msgs
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))
  }

  async function getToken(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  async function sendMessage(text: string, isVoice = false) {
    if (!text.trim() || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      isVoice,
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const token = await getToken()
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: toApiMessages(updatedMessages) }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply ?? 'Error al obtener respuesta.',
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Ocurrió un error. Por favor intenta de nuevo.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ─── Voice recording ──────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Prefer webm/opus (best Groq compatibility), fallback to mp4 on iOS/Safari
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
        ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      alert('No se pudo acceder al micrófono. Verifica los permisos.')
    }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    setRecording(false)
    setTranscribing(true)

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
    })

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
    const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([blob], `audio.${ext}`, { type: recorder.mimeType })

    const form = new FormData()
    form.append('audio', file)

    try {
      const token = await getToken()
      const res = await fetch('/api/chat/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = res.status === 503
          ? 'Transcripción no configurada en el servidor. Contacta al administrador.'
          : `Error del servidor (${data.groqStatus ?? res.status}). Intenta de nuevo.`
        console.error('[chat] transcribe error:', data)
        setTranscribing(false)
        alert(msg)
        return
      }
      if (data.text?.trim()) {
        setTranscribing(false)
        await sendMessage(data.text.trim(), true)
      } else {
        setTranscribing(false)
        alert('Audio recibido pero sin texto. Habla más cerca del micrófono.')
      }
    } catch {
      setTranscribing(false)
      alert('Error de red al transcribir el audio.')
    }
  }

  const micBusy = recording || transcribing

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--nm-bg-inset)] bg-[var(--nm-bg)] shrink-0">
        <h1 className="text-base font-bold text-[var(--nm-text)]">Asistente Agrodelicias</h1>
        <p className="text-xs text-[var(--nm-text-subtle)]">Consultas y registros por voz o texto</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="nm-inset w-7 h-7 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">🌿</div>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'nm-card-green text-green-900 rounded-[var(--nm-radius)] rounded-tr-sm'
                  : 'nm-card-sm text-[var(--nm-text)] rounded-[var(--nm-radius-sm)] rounded-tl-none'
              }`}
            >
              {msg.isVoice && msg.role === 'user' && (
                <div className="flex items-center gap-1.5 mb-1 opacity-80">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
                  </svg>
                  <span className="text-xs">Audio transcrito</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {msg.role === 'assistant' ? renderText(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Loading / transcribing indicator */}
        {(loading || transcribing) && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">🌿</div>
            <div className="nm-card-sm rounded-[var(--nm-radius-sm)] rounded-tl-none px-4 py-3">
              <div className="flex items-center gap-1.5">
                {transcribing ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-[var(--nm-text-muted)]">Transcribiendo audio...</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[var(--nm-bg-inset)] bg-[var(--nm-bg)] px-3 py-3">
        <div className="flex items-end gap-2">
          {/* Mic button */}
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={recording ? stopRecording : undefined}
            disabled={loading || transcribing}
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              recording
                ? 'bg-red-500 text-white scale-110 shadow-lg'
                : micBusy
                ? 'nm-inset text-[var(--nm-text-subtle)]'
                : 'nm-btn text-[var(--nm-text-muted)] hover:text-[var(--nm-accent)]'
            }`}
            aria-label={recording ? 'Grabando... suelta para enviar' : 'Mantén para grabar'}
          >
            {recording ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
              </svg>
            )}
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={recording ? '🔴 Grabando... suelta para enviar' : 'Escribe un mensaje...'}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              disabled={loading || micBusy}
              className="nm-input w-full px-3 py-2.5 text-sm text-[var(--nm-text)] placeholder:text-[var(--nm-text-subtle)] resize-none overflow-hidden disabled:opacity-50"
            />
          </div>

          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading || micBusy}
            className="shrink-0 w-11 h-11 nm-btn-primary rounded-full text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            aria-label="Enviar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>

        {recording && (
          <p className="text-center text-xs text-red-500 mt-2 animate-pulse">🔴 Grabando... suelta el botón para transcribir y enviar</p>
        )}
      </div>
    </div>
  )
}
