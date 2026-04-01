'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DemoStep {
  title: string
  subtitle: string
  description: string
  badge?: string
  badgeColor?: string
  mockup: React.ReactNode
  action?: { label: string; href: string }
}

// ─── Mini mockup components ───────────────────────────────────────────────────

function MockupCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 mt-4 text-[11px] font-mono overflow-hidden">
      {children}
    </div>
  )
}

function MockupRow({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function MockupBadge({ label, color }: { label: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{label}</span>
}

function MockupBtn({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${primary ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
      {label}
    </span>
  )
}

function ArrowDown() {
  return (
    <div className="flex justify-center my-2">
      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

// ─── Flow definitions ─────────────────────────────────────────────────────────

const flujoVentas: DemoStep[] = [
  {
    title: 'Cotización',
    subtitle: 'Compara precios antes de comprar',
    description: 'Crea una ronda de cotización con los productos que necesitas. Ve a cada tienda, escribe los precios y el sistema resalta el más barato automáticamente.',
    badge: 'Módulo existente',
    badgeColor: 'bg-gray-100 text-gray-600',
    action: { label: 'Ir a Cotizaciones', href: '/cotizaciones' },
    mockup: (
      <MockupCard>
        <div className="text-gray-500 mb-2 text-[10px] uppercase font-bold tracking-wider">Ronda: Frutas y verduras · 5 productos</div>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left pb-1">Producto</th>
              <th className="text-right pb-1">Garis</th>
              <th className="text-right pb-1">Anicetos</th>
              <th className="text-right pb-1">Génova</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="py-0.5 text-gray-700">Mango kg</td><td className="text-right text-gray-400">$28</td><td className="text-right font-bold text-blue-700 bg-blue-50 rounded px-1">$22</td><td className="text-right text-gray-400">$25</td></tr>
            <tr><td className="py-0.5 text-gray-700">Papaya kg</td><td className="text-right font-bold text-blue-700 bg-blue-50 rounded px-1">$15</td><td className="text-right text-gray-400">$18</td><td className="text-right text-gray-400">$17</td></tr>
          </tbody>
        </table>
        <p className="text-blue-600 mt-2 text-[9px]">● Precio más bajo resaltado en azul automáticamente</p>
      </MockupCard>
    ),
  },
  {
    title: 'Pedido (Orden de Venta)',
    subtitle: 'Registra el compromiso con el cliente',
    description: 'Antes de surtir, crea un pedido con lo que el cliente quiere. Queda en borrador hasta que se confirma. Al confirmar se compromete sin afectar el inventario todavía.',
    badge: 'Nuevo',
    badgeColor: 'bg-blue-100 text-blue-700',
    action: { label: 'Ir a Pedidos', href: '/pedidos' },
    mockup: (
      <MockupCard>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-700">OV-20260401-A1B2</span>
          <MockupBadge label="Confirmado" color="bg-blue-50 text-blue-700" />
        </div>
        <MockupRow label="Cliente" value="Frutas El Sol" />
        <MockupRow label="Fecha entrega" value="05 abr 2026" />
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-gray-500"><span>• Mango 50 kg × $22</span><span>$1,100</span></div>
          <div className="flex justify-between text-gray-500"><span>• Papaya 30 kg × $15</span><span>$450</span></div>
        </div>
        <div className="flex justify-between font-bold text-gray-900 mt-2 pt-2 border-t border-gray-200">
          <span>Total</span><span>$1,798</span>
        </div>
        <div className="flex gap-2 mt-3">
          <MockupBtn label="Editar" />
          <MockupBtn label="Convertir a venta" primary />
        </div>
      </MockupCard>
    ),
  },
  {
    title: 'Venta + Remisión',
    subtitle: 'Un toque convierte el pedido en venta',
    description: 'Al tocar "Convertir a venta" se crea automáticamente: una venta con todos los productos, una remisión para el cliente, y el pedido queda como Surtido.',
    badge: 'Automático',
    badgeColor: 'bg-green-100 text-green-700',
    action: { label: 'Ir a Ventas', href: '/ventas' },
    mockup: (
      <MockupCard>
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-600 font-bold text-[10px]">✓ VENTA CREADA</span>
            </div>
            <MockupRow label="Folio" value="VTA-20260401-X9Y8" />
            <MockupRow label="Status pago" value="Pendiente" color="text-amber-600" />
            <MockupRow label="Total" value="$1,798" color="text-gray-900" />
          </div>
          <ArrowDown />
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-indigo-600 font-bold text-[10px]">✓ REMISIÓN GENERADA</span>
            </div>
            <MockupRow label="Folio" value="FAC-20260401-Z1W2" />
            <MockupRow label="Status" value="Emitida" color="text-blue-600" />
          </div>
        </div>
        <p className="text-gray-400 mt-2 text-[9px]">● Pedido OV-20260401-A1B2 → Surtido</p>
      </MockupCard>
    ),
  },
  {
    title: 'Límite de crédito',
    subtitle: 'El sistema avisa si el cliente excede su crédito',
    description: 'Si el cliente tiene límite de crédito configurado y ya tiene deuda, el sistema calcula el saldo real y avisa si la nueva venta excede el límite.',
    badge: 'Nuevo',
    badgeColor: 'bg-blue-100 text-blue-700',
    action: { label: 'Ver clientes', href: '/clientes' },
    mockup: (
      <MockupCard>
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5">
          <p className="font-bold text-amber-700 text-[11px] mb-1">⚠ Límite de crédito excedido</p>
          <div className="space-y-0.5">
            <MockupRow label="Límite del cliente" value="$5,000" />
            <MockupRow label="Saldo actual" value="$3,800" color="text-amber-600" />
            <MockupRow label="Esta venta" value="$1,798" />
            <MockupRow label="Exceso" value="$598" color="text-red-600" />
          </div>
          <p className="text-amber-600 mt-2 text-[9px]">¿Continuar de todas formas?</p>
          <div className="flex gap-2 mt-2">
            <MockupBtn label="Cancelar" />
            <MockupBtn label="Sí, continuar" primary />
          </div>
        </div>
      </MockupCard>
    ),
  },
  {
    title: 'Expediente del cliente',
    subtitle: 'Vista completa de su situación comercial',
    description: 'En el perfil de cada cliente hay una pestaña Expediente con: barra de crédito usado, pedidos activos y últimas ventas. Consulta antes de vender.',
    badge: 'Nuevo',
    badgeColor: 'bg-blue-100 text-blue-700',
    action: { label: 'Ver clientes', href: '/clientes' },
    mockup: (
      <MockupCard>
        <div className="font-bold text-gray-700 mb-2">Frutas El Sol — Expediente</div>
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Crédito usado: $3,800 / $5,000</span>
            <span className="text-amber-600 font-bold">76%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-amber-500 h-2 rounded-full" style={{ width: '76%' }} />
          </div>
        </div>
        <div className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wider">Pedidos activos</div>
        <div className="flex justify-between text-gray-600 mb-2">
          <span>OV-20260401-A1B2</span>
          <MockupBadge label="Confirmado" color="bg-blue-50 text-blue-700" />
        </div>
        <div className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wider">Últimas ventas</div>
        <MockupRow label="VTA-20260320" value="$2,100" />
        <MockupRow label="VTA-20260310" value="$1,700" color="text-green-600" />
      </MockupCard>
    ),
  },
]

const flujoCompras: DemoStep[] = [
  {
    title: 'Orden de Compra',
    subtitle: 'Documenta lo que le pides al proveedor',
    description: 'Crea una orden con los productos que necesitas. Se puede guardar como borrador o marcar como enviada al proveedor. El inventario no cambia todavía.',
    badge: 'Nuevo',
    badgeColor: 'bg-blue-100 text-blue-700',
    action: { label: 'Ir a Órdenes Compra', href: '/ordenes-compra' },
    mockup: (
      <MockupCard>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-700">OC-20260401-C3D4</span>
          <MockupBadge label="Enviada" color="bg-blue-50 text-blue-700" />
        </div>
        <MockupRow label="Proveedor" value="Frutas del Campo SA" />
        <MockupRow label="Entrega esperada" value="08 abr 2026" />
        <div className="mt-2 space-y-1 text-gray-500">
          <div className="flex justify-between"><span>• Mango 200 kg</span><span>× $18</span></div>
          <div className="flex justify-between"><span>• Papaya 100 kg</span><span>× $12</span></div>
        </div>
        <div className="flex justify-between font-bold text-gray-900 mt-2 pt-2 border-t border-gray-200">
          <span>Total</span><span>$4,800</span>
        </div>
        <div className="flex gap-2 mt-3">
          <MockupBtn label="Recepción parcial" />
          <MockupBtn label="Recibir completo" primary />
        </div>
      </MockupCard>
    ),
  },
  {
    title: 'Recibir mercancía',
    subtitle: 'Genera la compra al recibir el pedido',
    description: 'Al llegar la mercancía, toca "Recibir completo" o "Recepción parcial". Se crea automáticamente el registro de compra y la orden queda como recibida.',
    badge: 'Automático',
    badgeColor: 'bg-green-100 text-green-700',
    action: { label: 'Ir a Compras', href: '/compras' },
    mockup: (
      <MockupCard>
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2">
          <span className="text-green-700 font-bold text-[10px]">✓ COMPRA REGISTRADA</span>
          <MockupRow label="Folio" value="COMP-20260401-E5F6" />
          <MockupRow label="Status pago" value="Pendiente" color="text-amber-600" />
          <MockupRow label="Total" value="$4,800" color="text-gray-900" />
        </div>
        <p className="text-gray-400 text-[9px]">● Orden OC-20260401-C3D4 → Recibida</p>
      </MockupCard>
    ),
  },
  {
    title: 'Costo aterrizado',
    subtitle: 'El costo real incluye flete y otros gastos',
    description: 'Al registrar la compra, agrega el costo de flete y otros gastos. El sistema calcula el costo aterrizado por unidad: (compra + flete + otros) ÷ unidades.',
    badge: 'Nuevo',
    badgeColor: 'bg-blue-100 text-blue-700',
    action: { label: 'Ir a Compras', href: '/compras' },
    mockup: (
      <MockupCard>
        <div className="font-bold text-gray-600 mb-2 text-[10px] uppercase tracking-wider">Costos adicionales</div>
        <MockupRow label="Subtotal compra" value="$4,800" />
        <MockupRow label="+ Flete / Envío" value="$350" color="text-amber-600" />
        <MockupRow label="+ Otros costos" value="$80" color="text-amber-600" />
        <div className="mt-2 pt-2 border-t border-gray-200 bg-blue-50 rounded-lg p-2">
          <div className="flex justify-between">
            <span className="text-blue-700 font-bold">Costo aterrizado</span>
            <span className="text-blue-700 font-bold">$17.65 / kg</span>
          </div>
          <p className="text-blue-500 text-[9px] mt-1">(4,800 + 350 + 80) / 300 kg = $17.65</p>
        </div>
      </MockupCard>
    ),
  },
  {
    title: 'Alertas de lotes',
    subtitle: 'El dashboard avisa qué va a caducar',
    description: 'Si tienes lotes con fecha de caducidad, el dashboard muestra automáticamente los que caducan en los próximos 30 días para que puedas actuar a tiempo.',
    badge: 'Nuevo',
    badgeColor: 'bg-blue-100 text-blue-700',
    action: { label: 'Ver Dashboard', href: '/dashboard' },
    mockup: (
      <MockupCard>
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
          <p className="font-bold text-red-700 text-[11px] mb-2">🏷 Lotes por caducar · 3 lotes</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-700">Lote #L2026-031</p>
                <p className="text-gray-400 text-[9px]">Mango · 85 kg disponibles</p>
              </div>
              <span className="text-red-600 font-bold">06 abr</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-700">Lote #L2026-028</p>
                <p className="text-gray-400 text-[9px]">Papaya · 40 kg disponibles</p>
              </div>
              <span className="text-amber-600 font-bold">12 abr</span>
            </div>
          </div>
        </div>
      </MockupCard>
    ),
  },
]

// ─── Stepper component ────────────────────────────────────────────────────────

function FlowDemo({ steps }: { steps: DemoStep[] }) {
  const [current, setCurrent] = useState(0)
  const step = steps[current]

  return (
    <div>
      {/* Step dots */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
              i === current
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
              i < current ? 'bg-green-500 text-white' : i === current ? 'bg-white text-blue-600' : 'bg-gray-300 text-gray-500'
            }`}>
              {i < current ? '✓' : i + 1}
            </span>
            <span className="hidden sm:inline">{s.title}</span>
          </button>
        ))}
      </div>

      {/* Step card */}
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.07)] p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-gray-900 text-base">{step.title}</h3>
              {step.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step.badgeColor}`}>
                  {step.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-blue-600 font-medium">{step.subtitle}</p>
          </div>
          <span className="text-2xl text-gray-200 font-bold shrink-0">{current + 1}/{steps.length}</span>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mt-2">{step.description}</p>

        {step.mockup}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={() => setCurrent(i => Math.max(0, i - 1))}
            disabled={current === 0}
            className="px-4 py-2 text-sm font-medium text-gray-500 disabled:opacity-30 hover:text-gray-700"
          >
            ← Anterior
          </button>

          <div className="flex gap-2">
            {step.action && (
              <Link
                href={step.action.href}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                {step.action.label} →
              </Link>
            )}
          </div>

          <button
            onClick={() => setCurrent(i => Math.min(steps.length - 1, i + 1))}
            disabled={current === steps.length - 1}
            className="px-4 py-2 text-sm font-medium text-blue-600 disabled:opacity-30 hover:text-blue-700 font-semibold"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'ventas' | 'compras'

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>('ventas')

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full uppercase tracking-wider">
            Demo interactivo
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Flujo SAE — Cómo funciona</h1>
        <p className="text-sm text-gray-500 mt-1">
          Recorrido visual de los nuevos módulos. Cada paso muestra qué pasa, cómo se ve y a dónde ir en el sistema real.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_6px_rgba(0,0,0,0.05)] p-3">
          <p className="text-lg font-bold text-gray-900">5 pasos</p>
          <p className="text-xs text-gray-500">Flujo de ventas</p>
          <p className="text-[10px] text-blue-600 mt-1">Cotización → Pedido → Venta</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_6px_rgba(0,0,0,0.05)] p-3">
          <p className="text-lg font-bold text-gray-900">4 pasos</p>
          <p className="text-xs text-gray-500">Flujo de compras</p>
          <p className="text-[10px] text-blue-600 mt-1">Orden → Recepción → Compra</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl">
        {([
          { id: 'ventas', label: '💰 Flujo Ventas', count: `${flujoVentas.length} pasos` },
          { id: 'compras', label: '🏭 Flujo Compras', count: `${flujoCompras.length} pasos` },
        ] as { id: Tab; label: string; count: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="block">{t.label}</span>
            <span className="text-[10px] font-normal opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Demo */}
      {tab === 'ventas' ? (
        <FlowDemo key="ventas" steps={flujoVentas} />
      ) : (
        <FlowDemo key="compras" steps={flujoCompras} />
      )}

      {/* Footer links */}
      <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Accesos directos</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Pedidos', href: '/pedidos', icon: '📑' },
            { label: 'Órdenes Compra', href: '/ordenes-compra', icon: '🏭' },
            { label: 'Ventas', href: '/ventas', icon: '💰' },
            { label: 'Compras', href: '/compras', icon: '🛒' },
            { label: 'Clientes', href: '/clientes', icon: '👥' },
            { label: 'Ver todas las funciones', href: '/changelog', icon: '📖' },
          ].map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-100 transition-colors"
            >
              <span>{l.icon}</span>
              <span className="text-xs font-medium">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
