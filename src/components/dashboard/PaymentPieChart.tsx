'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PaymentEntry {
  name: string
  value: number
}

interface PaymentPieChartProps {
  data: PaymentEntry[]
}

const COLORS = ['#16a34a', '#6b7280', '#a3c4a8', '#bec9bf']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div
      style={{
        background: 'var(--nm-bg)',
        borderRadius: 'var(--nm-radius-sm)',
        boxShadow: '4px 4px 8px var(--nm-shadow-dark), -4px -4px 8px var(--nm-shadow-light)',
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <p style={{ fontWeight: 600, color: 'var(--nm-text)' }}>{item.name}</p>
      <p style={{ color: item.payload.fill }}>
        ${item.value.toLocaleString('es-MX')} ({item.payload.pct}%)
      </p>
    </div>
  )
}

export default function PaymentPieChart({ data }: PaymentPieChartProps) {
  if (data.length < 2) return null

  const total = data.reduce((s, d) => s + d.value, 0)
  const enriched = data.map((d) => ({ ...d, pct: Math.round((d.value / total) * 100) }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={enriched}
          cx="50%"
          cy="50%"
          innerRadius={42}
          outerRadius={68}
          paddingAngle={3}
          dataKey="value"
        >
          {enriched.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 11, color: '#5a7060' }}>{value}</span>
          )}
          iconSize={10}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
