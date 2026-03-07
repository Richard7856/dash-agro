'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface WeeklyData {
  semana: string
  ventas: number
  compras: number
}

interface WeeklyChartProps {
  data: WeeklyData[]
}

function formatK(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--nm-bg)',
        borderRadius: 'var(--nm-radius-sm)',
        boxShadow: '4px 4px 8px var(--nm-shadow-dark), -4px -4px 8px var(--nm-shadow-light)',
        padding: '10px 14px',
        fontSize: 12,
      }}
    >
      <p style={{ fontWeight: 600, color: 'var(--nm-text)', marginBottom: 4 }}>{label}</p>
      {payload.map((entry: { color: string; name: string; value: number }) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name === 'ventas' ? 'Ventas' : 'Compras'}: ${entry.value.toLocaleString('es-MX')}
        </p>
      ))}
    </div>
  )
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  if (!data.length) return null

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#d4dcd5" vertical={false} />
        <XAxis
          dataKey="semana"
          tick={{ fontSize: 11, fill: '#8aa48e' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 11, fill: '#8aa48e' }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212,220,213,0.4)' }} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 12, color: '#5a7060' }}>
              {value === 'ventas' ? 'Ventas' : 'Compras'}
            </span>
          )}
        />
        <Bar dataKey="ventas" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey="compras" fill="#6b7280" radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
