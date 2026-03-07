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
  const [hint, setHint] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pcmChunksRef = useRef<Float32Array[]>([])
  const sampleRateRef = useRef(16000)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recordingStartRef = useRef<number>(0)

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

  // ─── WAV encoding from raw PCM samples ──────────────────────────────────

  function encodePcmToWav(samples: Float32Array, sampleRate: number): Blob {
    const pcm16 = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)))
    }
    const wavBuf = new ArrayBuffer(44 + pcm16.byteLength)
    const v = new DataView(wavBuf)
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm16.byteLength, true); w(8, 'WAVE')
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
    v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true)
    v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true)
    v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm16.byteLength, true)
    new Int16Array(wavBuf, 44).set(pcm16)
    return new Blob([wavBuf], { type: 'audio/wav' })
  }

  // ─── Voice recording (raw PCM via ScriptProcessorNode — no WebM) ───────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      // eslint-disable-next-line deprecation/deprecation
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)

      pcmChunksRef.current = []
      sampleRateRef.current = audioCtx.sampleRate

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0)
        pcmChunksRef.current.push(new Float32Array(data))
      }

      // Connect through silent gain to ensure onaudioprocess fires on all browsers
      const silentGain = audioCtx.createGain()
      silentGain.gain.value = 0
      source.connect(processor)
      processor.connect(silentGain)
      silentGain.connect(audioCtx.destination)

      audioCtxRef.current = audioCtx
      streamRef.current = stream
      recordingStartRef.current = Date.now()
      setRecording(true)
    } catch {
      alert('No se pudo acceder al micrófono. Verifica los permisos.')
    }
  }

  async function stopRecording() {
    const audioCtx = audioCtxRef.current
    const stream = streamRef.current
    if (!audioCtx || !stream) return

    const duration = Date.now() - recordingStartRef.current
    setRecording(false)

    // Stop capture
    stream.getTracks().forEach((t) => t.stop())
    await audioCtx.close()
    audioCtxRef.current = null
    streamRef.current = null

    // Ignore accidental taps shorter than 600ms
    if (duration < 600) {
      setHint('Mantén presionado mientras hablas')
      setTimeout(() => setHint(''), 2500)
      return
    }

    setTranscribing(true)

    if (pcmChunksRef.current.length === 0) {
      setTranscribing(false)
      setHint('No se capturó audio. Intenta de nuevo')
      setTimeout(() => setHint(''), 2500)
      return
    }

    // Concatenate PCM chunks into a single Float32Array
    const totalLen = pcmChunksRef.current.reduce((a, c) => a + c.length, 0)
    const pcm = new Float32Array(totalLen)
    let offset = 0
    for (const chunk of pcmChunksRef.current) {
      pcm.set(chunk, offset)
      offset += chunk.length
    }

    // Encode as WAV — raw PCM, universally compatible with Groq
    const wavBlob = encodePcmToWav(pcm, sampleRateRef.current)
    const file = new File([wavBlob], 'audio.wav', { type: 'audio/wav' })

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
      <div className="shrink-0 border-t border-[var(--nm-bg-inset)] bg-[var(--nm-bg)] px-3 pt-2 pb-3">
        {/* Status hint — fixed height, never shifts the button row */}
        <div className="h-5 flex items-center justify-center mb-1">
          {recording ? (
            <span className="text-xs text-red-500 animate-pulse">🔴 Grabando… suelta para enviar</span>
          ) : hint ? (
            <span className="text-xs text-[var(--nm-text-subtle)]">{hint}</span>
          ) : null}
        </div>
        <div className="flex items-end gap-2">
          {/* Mic button */}
          <button
            onPointerDown={(e) => { e.preventDefault(); startRecording() }}
            onPointerUp={stopRecording}
            onPointerLeave={recording ? stopRecording : undefined}
            onContextMenu={(e) => e.preventDefault()}
            disabled={loading || transcribing}
            style={{ userSelect: 'none', touchAction: 'none' }}
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

      </div>
    </div>
  )
}
