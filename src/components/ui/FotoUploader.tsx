'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface FotoUploaderProps {
  /** Array of public URLs already saved */
  fotos: string[]
  /** Called when the list changes (add or remove) */
  onChange: (fotos: string[]) => void
  /** Bucket folder prefix: 'inventario' | 'ventas' | 'compras' */
  tabla: string
  /** Maximum number of photos allowed (default 5) */
  maxFotos?: number
  /** Whether the uploader is read-only */
  readOnly?: boolean
}

// Extract storage path from a public URL
// URL format: .../storage/v1/object/public/evidencias/<path>
function pathFromUrl(url: string): string {
  const marker = '/object/public/evidencias/'
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : url
}

export function FotoUploader({
  fotos,
  onChange,
  tabla,
  maxFotos = 5,
  readOnly = false,
}: FotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (fotos.length + files.length > maxFotos) {
      setUploadError(`Máximo ${maxFotos} fotos`)
      return
    }
    setUploadError('')
    setUploading(true)

    const newUrls: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${tabla}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage
        .from('evidencias')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) {
        setUploadError(`Error subiendo ${file.name}: ${error.message}`)
        continue
      }
      const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(path)
      newUrls.push(urlData.publicUrl)
    }

    onChange([...fotos, ...newUrls])
    setUploading(false)
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleRemove(url: string) {
    if (!confirm('¿Eliminar esta foto?')) return
    const path = pathFromUrl(url)
    await supabase.storage.from('evidencias').remove([path])
    onChange(fotos.filter((f) => f !== url))
  }

  const canAdd = !readOnly && fotos.length < maxFotos

  return (
    <div>
      {/* Thumbnail grid */}
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {fotos.map((url) => (
            <div key={url} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Evidencia"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightbox(url)}
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(url)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  aria-label="Eliminar foto"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 text-sm text-[var(--nm-primary)] font-medium py-1.5 px-3 rounded-lg border border-dashed border-[var(--nm-primary)] bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-[var(--nm-primary)] border-t-transparent rounded-full animate-spin" />
              Subiendo…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {fotos.length === 0 ? 'Agregar foto' : `Agregar otra (${fotos.length}/${maxFotos})`}
            </>
          )}
        </button>
      )}

      {/* Hidden file input — accept images, capture camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {uploadError && (
        <p className="text-xs text-red-600 mt-1">{uploadError}</p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Evidencia"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center text-lg"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
