'use client'

import { useEffect, useRef } from 'react'

interface EanScannerProps {
  onScan: (ean: string) => void
  onClose: () => void
}

const SCANNER_ID = 'ean-scanner-container'

export function EanScanner({ onScan, onClose }: EanScannerProps) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const scannedRef = useRef(false)

  useEffect(() => {
    let stopped = false

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 130 } },
          (decoded: string) => {
            if (!scannedRef.current) {
              scannedRef.current = true
              scanner.stop().catch(() => {})
              onScan(decoded)
            }
          },
          () => {}
        )
      } catch {
        if (!stopped) onClose()
      }
    }

    start()

    return () => {
      stopped = true
      scannerRef.current?.stop().catch(() => {})
    }
  }, [onScan, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Escanear código EAN</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-800 text-xl leading-none"
            aria-label="Cerrar scanner"
          >
            ✕
          </button>
        </div>
        <div id={SCANNER_ID} className="w-full" />
        <p className="text-center text-sm text-gray-400 py-3 px-4">
          Apunta la cámara trasera al código de barras del producto
        </p>
      </div>
    </div>
  )
}
