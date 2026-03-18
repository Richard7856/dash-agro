'use client'

import { useState, useRef, useEffect } from 'react'

export interface SearchSelectOption {
  id: string
  label: string
}

interface Props {
  options: SearchSelectOption[]
  value: string           // id seleccionado
  onChange: (id: string) => void
  placeholder?: string
  emptyLabel?: string     // texto del ítem "ninguno"
}

export function SearchSelect({ options, value, onChange, placeholder = 'Buscar…', emptyLabel = '— Ninguno —' }: Props) {
  const selected = options.find((o) => o.id === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // cerrar al click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function select(id: string) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected ? selected.label : '')}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={(e) => setQuery(e.target.value)}
          className="nm-input w-full pl-9 pr-8 min-h-[44px] text-[15px] text-[var(--nm-text)] placeholder:text-[var(--nm-text-subtle)]"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setQuery(''); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--nm-text-subtle)] hover:text-red-500"
            tabIndex={-1}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          <button
            type="button"
            onMouseDown={() => select('')}
            className="w-full text-left px-3 py-2 text-sm text-[var(--nm-text-subtle)] hover:bg-gray-50 border-b border-gray-100"
          >
            {emptyLabel}
          </button>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--nm-text-subtle)]">Sin resultados</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={() => select(o.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0 border-gray-100 ${o.id === value ? 'font-semibold text-blue-700 bg-blue-50' : 'text-[var(--nm-text)]'}`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
