const TITLES: Record<string, string> = {
  '/dashboard':     'Inicio',
  '/inventario':    'Inventario',
  '/compras':       'Compras',
  '/ventas':        'Ventas',
  '/gastos':        'Gastos',
  '/bonos':         'Bonos gasolina',
  '/personas':      'Personas',
  '/clientes':      'Clientes',
  '/proveedores':   'Proveedores',
  '/chat':          'Asistente IA',
  '/api-docs':      'API Docs',
  '/configuracion': 'Configuración',
}

export function getPageTitle(pathname: string): string {
  const base = '/' + pathname.split('/')[1]
  return TITLES[base] ?? 'Agrodelicias'
}
