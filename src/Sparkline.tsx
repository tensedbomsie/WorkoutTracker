import { useId } from 'react'

export default function Sparkline({ points }: { points: { x: string; y: number }[] }) {
  const gradId = useId()
  if (points.length < 2) return null
  const w = 560
  const h = 100
  const values = points.map((p) => p.y)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p.y - min) / range) * (h - 16) - 8
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg className="progress-graph" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={`url(#${gradId})`} strokeWidth="3" />
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  )
}
