'use client'

import { useState, useMemo } from 'react'

/* ─── data ─────────────────────────────────────────────────────────────────── */

interface Feature {
  title: string
  what: string      // qué es
  how: string       // cómo se usa
  why: string       // para qué sirve
  extra?: string[]  // detalles adicionales
}

interface Section {
  icon: string
  module: string
  tagline: string
  color: string
  features: Feature[]
}

const sections: Section[] = [
  {
    icon: '📦',
    module: 'Inventario',
    tagline: 'Control de todos los productos y su stock en tiempo real',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    features: [
      {
        title: 'Registro de productos',
        what: 'Formulario para dar de alta cualquier producto al inventario.',
        how: 'Ve a Inventario → toca el botón "+". Llena nombre, cantidad, precio de compra, unidad de medida y guarda.',
        why: 'Tener un catálogo centralizado de todos los productos con sus datos completos.',
        extra: [
          'Campos disponibles: nombre, EAN (código de barras), SKU, número de lote, fecha de caducidad',
          'Cantidad, unidad de medida (kg, litro, pieza, caja, tarima, etc.)',
          'Precio de compra unitario y total',
          'Cajas por tarima y unidades por caja',
          'Fotos del producto',
        ],
      },
      {
        title: 'Escáner de código de barras',
        what: 'Usa la cámara del celular para leer códigos EAN/UPC de los productos.',
        how: 'En Inventario, toca el ícono de cámara junto a la barra de búsqueda. Apunta al código de barras y se buscará automáticamente.',
        why: 'Encontrar o registrar productos sin escribir el código a mano.',
      },
      {
        title: 'Búsqueda inteligente',
        what: 'Barra de búsqueda que filtra productos por nombre, EAN, SKU o lote.',
        how: 'Escribe en la barra de búsqueda en la lista de inventario. Los resultados se actualizan mientras escribes.',
        why: 'Encontrar rápidamente un producto entre cientos sin tener que buscar manualmente.',
      },
      {
        title: 'Total de piezas',
        what: 'Contador que muestra la suma total de unidades en inventario.',
        how: 'Aparece automáticamente debajo del encabezado de Inventario. Se actualiza con cada búsqueda o filtro.',
        why: 'Saber de un vistazo cuántas unidades totales hay en stock.',
      },
    ],
  },
  {
    icon: '🛒',
    module: 'Compras',
    tagline: 'Registro de todas las compras realizadas a proveedores',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    features: [
      {
        title: 'Registro de compras',
        what: 'Formulario para registrar cada compra con folio automático.',
        how: 'Ve a Compras → "+". Selecciona proveedor, ubicación, agrega productos y montos. El folio se genera solo (ej: COMP-20260318-A1B2).',
        why: 'Tener historial completo de todas las compras con trazabilidad por folio.',
      },
      {
        title: 'Búsqueda de proveedor y ubicación',
        what: 'Campos de búsqueda en vez de listas desplegables para seleccionar proveedor y ubicación.',
        how: 'En el formulario de compra, escribe el nombre del proveedor o ubicación y selecciona de los resultados.',
        why: 'Es más fácil y rápido que buscar en una lista desplegable larga.',
      },
      {
        title: 'Status de pago',
        what: 'Cada compra puede estar como pagada, pendiente o parcial.',
        how: 'Al crear o editar la compra, selecciona el status. Si es pendiente o parcial, puedes poner fecha de vencimiento.',
        why: 'Controlar qué compras ya se pagaron y cuáles se deben todavía.',
      },
      {
        title: 'Forma de pago mixta',
        what: 'Cuando se paga con varios métodos, puedes desglosar cuánto fue en efectivo, cuánto en bonos y cuánto por otro medio.',
        how: 'Selecciona "Mixto" en forma de pago. Aparecen 3 campos: efectivo, bonos de gasolina y otro. Llena cada uno.',
        why: 'Saber exactamente cómo se pagó cada compra cuando se usan varios métodos.',
      },
    ],
  },
  {
    icon: '💰',
    module: 'Ventas',
    tagline: 'Registro de ventas con productos del inventario y generación de remisiones',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    features: [
      {
        title: 'Venta con productos del inventario',
        what: 'Al crear una venta, buscas productos que ya existen en el inventario y los agregas a la venta.',
        how: 'En el formulario de venta, usa la barra "Buscar producto por nombre, EAN, SKU..." para encontrar y agregar productos.',
        why: 'Vincular cada venta con productos reales del inventario para control de stock.',
      },
      {
        title: 'Referencia de stock y costo',
        what: 'Al agregar un producto a la venta, se muestra cuántas unidades hay disponibles y a qué precio se compró.',
        how: 'Automático: cuando agregas un producto, aparece "Stock: 110 unidad · Costo: $18.50" debajo del nombre.',
        why: 'Saber si hay suficiente stock y a qué precio se compró antes de poner el precio de venta.',
      },
      {
        title: 'Cálculo automático de totales',
        what: 'El monto total de la venta se calcula solo sumando cantidad × precio de cada producto.',
        how: 'Automático: al cambiar cantidad o precio de cualquier producto, el total se recalcula.',
        why: 'Evitar errores de cálculo manual.',
      },
      {
        title: 'Ventas a crédito',
        what: 'Puedes registrar ventas que aún no se han pagado (pendiente) o que se pagaron parcialmente.',
        how: 'Selecciona status "Pendiente" o "Parcial". Opcionalmente pon fecha de vencimiento.',
        why: 'Llevar control de quién te debe y cuándo vence el pago.',
      },
      {
        title: 'Forma de pago mixta',
        what: 'Igual que en compras: desglosar el pago en efectivo, bonos y otro cuando se usa más de un método.',
        how: 'Selecciona "Mixto" en forma de pago y llena los campos de desglose.',
        why: 'Saber exactamente cómo pagó el cliente.',
      },
      {
        title: 'Remisión automática',
        what: 'Cuando una venta se registra como pendiente o parcial, se crea automáticamente una remisión en Facturación.',
        how: 'Automático: al guardar la venta con status pendiente o parcial, aparece un aviso "Remisión generada" con el folio.',
        why: 'No tener que crear la remisión a mano. Queda registro automático para cobro.',
      },
    ],
  },
  {
    icon: '👥',
    module: 'Personas, Clientes y Proveedores',
    tagline: 'Gestión del personal y los socios comerciales de la empresa',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    features: [
      {
        title: 'Registro de personas',
        what: 'Lista del personal de la empresa con sus datos de contacto y rol.',
        how: 'Ve a Personas → "+". Llena nombre, rol, email, teléfono.',
        why: 'Tener un directorio del personal y poder asignarlos a compras, ventas y gastos.',
      },
      {
        title: 'Activar y desactivar',
        what: 'En vez de eliminar, puedes desactivar personas, clientes o proveedores para que no aparezcan en búsquedas.',
        how: 'En la lista, toca "Desactivar" en la persona que ya no trabaja. Si regresa, la activas de nuevo.',
        why: 'No perder el historial de operaciones asociadas a esa persona.',
      },
      {
        title: 'Clientes y proveedores',
        what: 'Catálogos separados para clientes y proveedores con datos fiscales.',
        how: 'Ve a Clientes o Proveedores → "+". Llena nombre, RFC, régimen fiscal, código postal, email, teléfono.',
        why: 'Tener los datos fiscales listos para remisiones y control de cuentas.',
      },
      {
        title: 'Filtros por estado',
        what: 'Tabs para ver Todos, Activos o Inactivos.',
        how: 'En la lista de personas/clientes/proveedores, toca los tabs "Todos", "Activos" o "Inactivos".',
        why: 'Ver rápidamente quién está activo y quién no.',
      },
    ],
  },
  {
    icon: '📋',
    module: 'Cotizaciones',
    tagline: 'Comparar precios de productos en diferentes tiendas',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    features: [
      {
        title: 'Rondas de cotización',
        what: 'Una "ronda" es una lista de productos que se van a cotizar. Se crea con nombre, fecha y los productos a buscar.',
        how: 'Ve a Cotizaciones → "Nueva ronda". Escribe el nombre de cada producto y toca "+" o Enter para agregarlo. Guarda la ronda.',
        why: 'Organizar qué productos se necesitan cotizar antes de salir a las tiendas.',
      },
      {
        title: 'Captura de precios por tienda',
        what: 'Al abrir una ronda, se muestra una tabla con los productos en filas y las tiendas en columnas. En cada celda se escribe el precio.',
        how: 'Toca una ronda → se abre la tabla. Escribe el precio de cada producto en cada tienda. En celular se ven como tarjetas.',
        why: 'Registrar todos los precios para después comparar y elegir la mejor opción.',
        extra: [
          'Tiendas actuales: Garis, Anicetos, La pasadita, Promotora del norte, Inspector, Génova, Sahuayo, Scorpion',
          'Se pueden agregar más tiendas desde la base de datos',
          'El precio más bajo de cada producto se resalta en azul automáticamente',
        ],
      },
      {
        title: 'Mejor precio automático',
        what: 'El sistema resalta en azul el precio más bajo de cada producto entre todas las tiendas.',
        how: 'Automático: al escribir los precios, el más bajo de cada fila se marca solo.',
        why: 'Ver de un vistazo dónde conviene más comprar cada producto.',
      },
    ],
  },
  {
    icon: '💳',
    module: 'Gastos',
    tagline: 'Control de gastos operacionales por categoría',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    features: [
      {
        title: 'Registro de gastos',
        what: 'Formulario para registrar gastos con categoría, monto, persona responsable y notas.',
        how: 'Ve a Gastos → "+". Selecciona categoría (flete, combustible, personal, arrendamiento, otro), monto y persona.',
        why: 'Llevar registro de en qué se gasta para el P&L y control financiero.',
      },
      {
        title: 'Filtros por categoría y fecha',
        what: 'Chips de categoría y rango de fechas para encontrar gastos específicos.',
        how: 'Toca "Filtros" → selecciona categoría o rango de fechas → los gastos se filtran automáticamente.',
        why: 'Encontrar gastos de un período o tipo específico sin buscar uno por uno.',
      },
    ],
  },
  {
    icon: '🧾',
    module: 'Remisiones',
    tagline: 'Documentos de entrega y facturación interna (sin timbrado SAT)',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    features: [
      {
        title: 'Crear remisiones',
        what: 'Documento interno que detalla productos entregados, cantidades y precios. Similar a una factura pero sin timbrado fiscal.',
        how: 'Ve a Remisiones → "+". Selecciona tipo (ingreso, egreso, nota de crédito, devolución), cliente/proveedor, y agrega las partidas.',
        why: 'Tener comprobante de entrega de mercancía, especialmente para ventas a crédito.',
      },
      {
        title: 'Flujo de estados',
        what: 'Cada remisión pasa por estados: Borrador → Emitida → Pagada o Cancelada.',
        how: 'Al crear se queda en borrador. Cuando se entrega, cambias a emitida. Cuando se cobra, a pagada.',
        why: 'Saber en qué etapa está cada remisión.',
      },
      {
        title: 'Generación automática desde ventas',
        what: 'Las ventas a crédito (pendiente/parcial) generan una remisión automáticamente.',
        how: 'Automático: al guardar una venta con status pendiente o parcial, se crea la remisión sola.',
        why: 'No tener que duplicar el trabajo creando la remisión a mano.',
      },
      {
        title: 'Exportar PDF y XML',
        what: 'Descargar la remisión como PDF para imprimir o como XML para integración con otros sistemas.',
        how: 'Abre el detalle de una remisión → toca "PDF" para imprimir o "XML" para descargar el archivo.',
        why: 'Tener un documento imprimible para el cliente y un formato digital estándar.',
      },
    ],
  },
  {
    icon: '📊',
    module: 'Finanzas y Reportes',
    tagline: 'Cuentas por cobrar, por pagar, y reportes financieros',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    features: [
      {
        title: 'Cuentas por Cobrar (CxC)',
        what: 'Lista de todas las ventas que tienen pago pendiente o parcial, con antigüedad de la deuda.',
        how: 'Ve a Cuentas por Cobrar. Se muestran las ventas no pagadas ordenadas por antigüedad (días vencidos).',
        why: 'Saber cuánto te deben, quién te debe y desde cuándo.',
      },
      {
        title: 'Cuentas por Pagar (CxP)',
        what: 'Lista de todas las compras que tienen pago pendiente o parcial.',
        how: 'Ve a Cuentas por Pagar. Se muestran las compras no pagadas con aging.',
        why: 'Saber cuánto debes a proveedores y qué pagos están por vencer.',
      },
      {
        title: 'Reportes P&L',
        what: 'Estado de resultados (Profit & Loss) de los últimos 6 meses.',
        how: 'Ve a Reportes. Se muestra automáticamente ingresos, egresos y utilidad por mes.',
        why: 'Ver si la empresa está ganando o perdiendo dinero cada mes.',
      },
      {
        title: 'Top clientes y proveedores',
        what: 'Ranking de los clientes que más compran y los proveedores a los que más se les compra.',
        how: 'En Reportes, desplázate abajo para ver los rankings.',
        why: 'Identificar los socios comerciales más importantes.',
      },
    ],
  },
  {
    icon: '🤖',
    module: 'Asistente IA',
    tagline: 'Asistente inteligente que habla y entiende tu negocio',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    features: [
      {
        title: 'Chat con IA',
        what: 'Un chat donde puedes escribir preguntas o instrucciones en español y el asistente te responde usando datos reales del sistema.',
        how: 'Ve a Asistente IA. Escribe tu pregunta o instrucción. Ejemplos: "¿Cuánto tenemos de leche?", "Registra una venta de 5 cajas de mango".',
        why: 'Consultar o registrar datos sin navegar por los menús.',
      },
      {
        title: 'Entrada por voz',
        what: 'Puedes hablar en vez de escribir. El sistema transcribe tu voz a texto automáticamente.',
        how: 'Toca el ícono de micrófono en el chat, habla tu instrucción y suelta. Se transcribe y se envía.',
        why: 'Más rápido que escribir, especialmente en campo con las manos ocupadas.',
      },
      {
        title: 'Herramientas del asistente',
        what: 'El asistente puede buscar inventario, registrar ventas y compras, consultar saldos de CxC/CxP.',
        how: 'Solo pídelo en lenguaje natural. El asistente decide qué herramienta usar.',
        why: 'Hacer operaciones completas desde el chat sin salir de la conversación.',
      },
    ],
  },
  {
    icon: '🔌',
    module: 'API REST',
    tagline: 'Endpoints para conectar con otros sistemas o automatizaciones',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    features: [
      {
        title: 'API externa v1',
        what: 'Endpoints para que sistemas externos puedan leer y escribir datos en Agrodelicias.',
        how: 'Envía peticiones HTTP a los endpoints con el header X-API-Key. Ve a API Docs para ver los endpoints y ejemplos.',
        why: 'Conectar con n8n, Zapier, Excel, u otros sistemas de la empresa.',
        extra: [
          'GET/POST /api/v1/inventario — productos y stock',
          'GET/POST /api/v1/compras — historial de compras',
          'GET/POST /api/v1/ventas — historial de ventas',
          'GET/POST /api/v1/gastos — gastos operacionales',
          'GET/POST /api/v1/cotizaciones — rondas de cotización',
          'GET/PUT /api/v1/cotizaciones/:id — detalle y precios por tienda',
        ],
      },
      {
        title: 'Documentación con ejemplos',
        what: 'Página interactiva con todos los endpoints, ejemplos de curl copiables y resumen para compartir con IA.',
        how: 'Ve a API Docs en el menú. Cada endpoint tiene ejemplo curl que puedes copiar y pegar.',
        why: 'Que cualquier desarrollador o IA pueda entender y usar la API sin preguntar.',
      },
    ],
  },
  {
    icon: '📱',
    module: 'Experiencia de uso',
    tagline: 'Diseño pensado para usar desde el celular en campo',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    features: [
      {
        title: 'Instalable como app',
        what: 'Se puede instalar en el celular como una app normal, sin Play Store ni App Store.',
        how: 'Android: aparece un botón "Instalar" en la app. iOS: en Safari toca Compartir → "Agregar a pantalla de inicio".',
        why: 'Acceso rápido desde el escritorio del celular, funciona sin necesidad de abrir el navegador.',
      },
      {
        title: 'Diseño para celular',
        what: 'La app está diseñada primero para celular: navegación en la parte de abajo, botones grandes, formularios de una columna.',
        how: 'Solo úsala normalmente. En tablet o computadora se adapta automáticamente con menú lateral.',
        why: 'Funciona bien en el campo con una sola mano.',
      },
      {
        title: 'Barras de búsqueda en formularios',
        what: 'Los campos donde seleccionas cliente, proveedor, vendedor o ubicación son barras de búsqueda, no listas desplegables.',
        how: 'Escribe las primeras letras del nombre y selecciona de los resultados.',
        why: 'Es mucho más rápido encontrar a alguien escribiendo su nombre que buscando en una lista larga.',
      },
      {
        title: 'Tema blanco minimalista',
        what: 'Interfaz limpia y clara con fondo blanco, sin colores distractores.',
        how: 'Automático: toda la app usa este estilo.',
        why: 'Se lee mejor al sol y reduce la fatiga visual en uso prolongado.',
      },
    ],
  },
]

/* ─── component ────────────────────────────────────────────────────────────── */

function FeatureItem({ feature }: { feature: Feature }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="py-4 border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 flex-1">{feature.title}</h3>
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{feature.what}</p>
      </button>

      {open && (
        <div className="mt-3 ml-0 space-y-2.5">
          <div className="flex gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0 mt-px">
              Cómo
            </span>
            <p className="text-xs text-gray-600 leading-relaxed">{feature.how}</p>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded shrink-0 mt-px">
              Para qué
            </span>
            <p className="text-xs text-gray-600 leading-relaxed">{feature.why}</p>
          </div>
          {feature.extra && (
            <div className="mt-2 bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Detalles</p>
              <ul className="space-y-1">
                {feature.extra.map((d, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── page ─────────────────────────────────────────────────────────────────── */

export default function ChangelogPage() {
  const [busqueda, setBusqueda] = useState('')

  const totalFeatures = sections.reduce((acc, s) => acc + s.features.length, 0)

  const filtered = useMemo(() => {
    if (!busqueda.trim()) return sections
    const q = busqueda.toLowerCase()
    return sections
      .map((s) => ({
        ...s,
        features: s.features.filter(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            f.what.toLowerCase().includes(q) ||
            f.how.toLowerCase().includes(q) ||
            f.why.toLowerCase().includes(q) ||
            (f.extra ?? []).some((e) => e.toLowerCase().includes(q))
        ),
      }))
      .filter((s) => s.features.length > 0)
  }, [busqueda])

  const filteredCount = filtered.reduce((acc, s) => acc + s.features.length, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Funciones del sistema</h1>
        <p className="text-sm text-gray-500 mt-1">
          Todo lo que puedes hacer en Agrodelicias, explicado paso a paso.
          Toca cualquier función para ver cómo usarla y para qué sirve.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar función… ej: remisión, código de barras, crédito"
          className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="nm-card p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{sections.length}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Módulos</p>
        </div>
        <div className="nm-card p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{totalFeatures}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Funciones</p>
        </div>
        <div className="nm-card p-3 text-center">
          <p className="text-lg font-bold text-gray-900">6</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">APIs REST</p>
        </div>
      </div>

      {busqueda && (
        <p className="text-xs text-gray-500 mb-3">
          {filteredCount === 0
            ? `No se encontraron funciones para "${busqueda}"`
            : `${filteredCount} función${filteredCount !== 1 ? 'es' : ''} encontrada${filteredCount !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Sections */}
      <div className="flex flex-col gap-4">
        {filtered.map((section) => (
          <div key={section.module} className="nm-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-lg">{section.icon}</span>
                <div className="flex-1">
                  <h2 className="font-semibold text-sm text-gray-900">{section.module}</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">{section.tagline}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${section.color}`}>
                  {section.features.length}
                </span>
              </div>
            </div>
            <div className="px-4">
              {section.features.map((f) => (
                <FeatureItem key={f.title} feature={f} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        Agrodelicias — CRM/ERP para operaciones agrícolas
      </div>
    </div>
  )
}
