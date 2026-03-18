'use client'

import { useState } from 'react'

interface Feature {
  title: string
  description: string
  details?: string[]
}

interface Section {
  icon: string
  label: string
  color: string
  features: Feature[]
}

const sections: Section[] = [
  {
    icon: '📦',
    label: 'Inventario',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    features: [
      {
        title: 'CRUD completo de productos',
        description: 'Alta, edición y eliminación de registros de inventario con control de stock.',
        details: [
          'Nombre, EAN, SKU, lote, fecha de caducidad',
          'Cantidad, unidad de medida, precio de compra',
          'Cajas por tarima, unidades por caja',
          'Fotos de producto',
        ],
      },
      {
        title: 'Escáner de código de barras EAN',
        description: 'Escanea el código EAN con la cámara del dispositivo para buscar o registrar productos rápidamente.',
      },
      {
        title: 'Búsqueda y filtros server-side',
        description: 'Búsqueda en tiempo real por nombre, EAN, SKU o lote con debounce de 400ms. Los filtros se ejecutan en servidor para rendimiento óptimo.',
      },
      {
        title: 'Total de piezas en inventario',
        description: 'Muestra la suma total de unidades en inventario, actualizada con cada búsqueda y filtro.',
      },
    ],
  },
  {
    icon: '🛒',
    label: 'Compras',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    features: [
      {
        title: 'Registro de compras con folio automático',
        description: 'Cada compra genera un folio único (COMP-YYYYMMDD-XXXX) para trazabilidad.',
      },
      {
        title: 'Asociación a proveedor y ubicación',
        description: 'Vincula compras a proveedores y ubicaciones existentes con búsqueda tipo SearchSelect.',
      },
      {
        title: 'Status de pago y vencimiento',
        description: 'Cada compra tiene status de pago (pendiente, parcial, pagado) y fecha de vencimiento para control de cuentas por pagar.',
      },
      {
        title: 'Forma de pago mixta',
        description: 'Al seleccionar "Mixto", se desglosa el monto en efectivo, bonos de gasolina y otro método.',
      },
    ],
  },
  {
    icon: '💰',
    label: 'Ventas',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    features: [
      {
        title: 'Registro de ventas con productos del inventario',
        description: 'Selecciona productos directamente del inventario con barra de búsqueda. Muestra stock disponible y precio de compra como referencia.',
      },
      {
        title: 'Cálculo automático de totales',
        description: 'El monto total se calcula automáticamente sumando cantidad × precio de cada producto seleccionado.',
      },
      {
        title: 'Status de pago y créditos',
        description: 'Soporte para ventas a crédito con status pendiente o parcial, más fecha de vencimiento para seguimiento.',
      },
      {
        title: 'Forma de pago mixta',
        description: 'Desglose de montos por método de pago cuando se selecciona forma mixta.',
      },
      {
        title: 'Generación automática de remisión',
        description: 'Las ventas con status de pago pendiente o parcial generan automáticamente una remisión en el módulo de facturación.',
      },
    ],
  },
  {
    icon: '👥',
    label: 'Personas, Clientes y Proveedores',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    features: [
      {
        title: 'Gestión de personas',
        description: 'Registro de personal con nombre, rol, email, teléfono. Activar/desactivar sin eliminar.',
      },
      {
        title: 'Clientes y proveedores',
        description: 'CRUD independiente para clientes y proveedores con datos fiscales (RFC, régimen fiscal, código postal).',
      },
      {
        title: 'Filtros por estado',
        description: 'Tabs para ver Todos, Activos o Inactivos en cada catálogo.',
      },
    ],
  },
  {
    icon: '📋',
    label: 'Cotizaciones',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    features: [
      {
        title: 'Rondas de cotización',
        description: 'Crea listas de productos a cotizar agrupadas por ronda con nombre, fecha y notas.',
      },
      {
        title: 'Matriz de precios por tienda',
        description: 'Vista en tabla (desktop) o tarjetas (móvil) donde se captura el precio de cada producto en cada tienda.',
        details: [
          'Tiendas configurables: Garis, Anicetos, La pasadita, Promotora del norte, Inspector, Génova, Sahuayo, Scorpion',
          'Precio más bajo por producto resaltado automáticamente',
          'Guardado con upsert (crea o actualiza)',
        ],
      },
      {
        title: 'Tiendas dinámicas',
        description: 'Las tiendas se almacenan en base de datos y pueden agregarse o eliminarse sin cambiar código.',
      },
    ],
  },
  {
    icon: '💳',
    label: 'Gastos',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    features: [
      {
        title: 'Registro de gastos operacionales',
        description: 'Categorías: flete, combustible, personal, arrendamiento, otro.',
      },
      {
        title: 'Filtros avanzados',
        description: 'Chips por categoría, rango de fechas y panel colapsable para filtrar gastos.',
      },
    ],
  },
  {
    icon: '🧾',
    label: 'Remisiones (Facturación interna)',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    features: [
      {
        title: 'CRUD de remisiones',
        description: 'Crear, editar y ver remisiones con partidas. Tipos: ingreso, egreso, nota de crédito, devolución.',
      },
      {
        title: 'Workflow de status',
        description: 'Flujo de estados: borrador → emitida → pagada o cancelada.',
      },
      {
        title: 'Exportar a PDF',
        description: 'Genera un PDF imprimible desde el detalle de cada remisión usando la función nativa del navegador.',
      },
      {
        title: 'Exportar a XML',
        description: 'Descarga un archivo XML con la estructura de la remisión para integración con otros sistemas.',
      },
    ],
  },
  {
    icon: '📊',
    label: 'Finanzas y Reportes',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    features: [
      {
        title: 'Cuentas por Cobrar (CxC)',
        description: 'Vista de ventas pendientes y parciales con aging (antigüedad de la deuda).',
      },
      {
        title: 'Cuentas por Pagar (CxP)',
        description: 'Vista de compras pendientes y parciales con aging.',
      },
      {
        title: 'Reportes administrativos',
        description: 'P&L de los últimos 6 meses, top clientes y top proveedores por volumen.',
      },
    ],
  },
  {
    icon: '🤖',
    label: 'Asistente IA',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    features: [
      {
        title: 'Chat con IA',
        description: 'Asistente conversacional impulsado por Claude que puede consultar y registrar datos del sistema.',
      },
      {
        title: 'Entrada por voz',
        description: 'Transcripción de voz a texto con Groq Whisper, optimizada con vocabulario del dominio agrícola.',
      },
      {
        title: 'Herramientas de consulta y registro',
        description: 'El asistente puede buscar inventario, registrar ventas/compras, consultar saldos y más mediante herramientas integradas.',
      },
    ],
  },
  {
    icon: '🔌',
    label: 'API REST',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    features: [
      {
        title: 'API externa v1',
        description: 'Endpoints GET/POST para inventario, compras, ventas, gastos y cotizaciones.',
        details: [
          'Autenticación por header X-API-Key',
          'Paginación con limit/offset',
          'Filtros por fecha, status y más',
          'Resumen compacto para compartir con LLMs',
        ],
      },
      {
        title: 'Documentación interactiva',
        description: 'Página de API Docs con ejemplos curl copiables, respuestas ejemplo y resumen para LLM.',
      },
    ],
  },
  {
    icon: '📱',
    label: 'PWA y experiencia móvil',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    features: [
      {
        title: 'Instalable como app',
        description: 'Progressive Web App que se puede instalar en Android (prompt nativo) e iOS (instrucciones manuales).',
      },
      {
        title: 'Diseño mobile-first',
        description: 'Navegación inferior en móvil, sidebar lateral en desktop. FAB para acciones rápidas.',
      },
      {
        title: 'Barras de búsqueda en formularios',
        description: 'Todos los campos de referencia (cliente, proveedor, vendedor, ubicación) usan SearchSelect en vez de dropdowns para encontrar opciones más rápido.',
      },
      {
        title: 'Tema blanco minimalista',
        description: 'Interfaz limpia con neumorfismo blanco, acentos azules y tipografía neutra.',
      },
    ],
  },
]

function FeatureCard({ feature, isLast }: { feature: Feature; isLast: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <button
        type="button"
        onClick={() => feature.details && setOpen((v) => !v)}
        className={`w-full text-left ${feature.details ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{feature.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{feature.description}</p>
          </div>
          {feature.details && (
            <svg
              className={`w-4 h-4 text-gray-400 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>
      {open && feature.details && (
        <ul className="mt-2 ml-1 flex flex-col gap-1">
          {feature.details.map((d, i) => (
            <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
              <span className="text-gray-300 mt-px">•</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--nm-text)]">Funciones del sistema</h1>
        <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">
          Resumen de todas las funciones y mejoras implementadas en Agrodelicias
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="nm-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--nm-text)]">{sections.length}</p>
          <p className="text-[10px] text-[var(--nm-text-muted)] uppercase tracking-wide">Módulos</p>
        </div>
        <div className="nm-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--nm-text)]">
            {sections.reduce((acc, s) => acc + s.features.length, 0)}
          </p>
          <p className="text-[10px] text-[var(--nm-text-muted)] uppercase tracking-wide">Funciones</p>
        </div>
        <div className="nm-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--nm-text)]">6</p>
          <p className="text-[10px] text-[var(--nm-text-muted)] uppercase tracking-wide">APIs REST</p>
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.label} className="nm-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <span className="text-lg">{section.icon}</span>
              <h2 className="font-semibold text-sm text-[var(--nm-text)]">{section.label}</h2>
              <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border ${section.color}`}>
                {section.features.length} funciones
              </span>
            </div>
            <div className="px-4">
              {section.features.map((f, i) => (
                <FeatureCard
                  key={f.title}
                  feature={f}
                  isLast={i === section.features.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-xs text-[var(--nm-text-subtle)]">
        Agrodelicias — CRM/ERP para operaciones agrícolas
      </div>
    </div>
  )
}
