import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Exercise } from './types'

type HistorySet = {
  reps: number
  weight: number
  rpe: number | null
  performed_at: string
}

export default function ExerciseHistoryModal({
  exercise,
  onClose,
}: {
  exercise: Exercise
  onClose: () => void
}) {
  const [sets, setSets] = useState<HistorySet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('sets')
        .select(
          'reps, weight, rpe, workout_exercise:workout_exercises!inner(exercise_id, workout:workouts!inner(performed_at))',
        )
        .eq('workout_exercise.exercise_id', exercise.id)

      const rows: HistorySet[] = ((data as any[]) ?? []).map((row) => ({
        reps: row.reps,
        weight: row.weight,
        rpe: row.rpe,
        performed_at: row.workout_exercise.workout.performed_at,
      }))
      rows.sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime())
      setSets(rows)
      setLoading(false)
    }
    load()
  }, [exercise.id])

  const lastDate = sets.length ? sets[sets.length - 1].performed_at : null
  const pr = sets.reduce((max, s) => Math.max(max, s.weight), 0)
  const totalReps = sets.reduce((sum, s) => sum + s.reps, 0)
  const totalVolume = sets.reduce((sum, s) => sum + s.reps * s.weight, 0)

  const byDay = sets.reduce<Record<string, number>>((acc, s) => {
    const day = s.performed_at.slice(0, 10)
    acc[day] = Math.max(acc[day] ?? 0, s.weight)
    return acc
  }, {})
  const points = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))

  const graphW = 560
  const graphH = 140
  const maxWeight = Math.max(...points.map(([, w]) => w), 1)
  const path = points
    .map(([, w], i) => {
      const x = points.length > 1 ? (i / (points.length - 1)) * graphW : graphW / 2
      const y = graphH - (w / maxWeight) * (graphH - 20) - 10
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>{exercise.name}</h2>
        <p className="modal-sub">
          {exercise.category}
          {exercise.subcategory ? ` · ${exercise.subcategory}` : ''}
        </p>

        {loading ? (
          <p className="empty-state">กำลังโหลด...</p>
        ) : sets.length === 0 ? (
          <p className="empty-state">ยังไม่เคยเล่นท่านี้เลย</p>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-tile card">
                <div className="value">{pr}</div>
                <div className="label">PR (kg)</div>
              </div>
              <div className="stat-tile card">
                <div className="value">{sets.length}</div>
                <div className="label">เซ็ตทั้งหมด</div>
              </div>
              <div className="stat-tile card">
                <div className="value">{totalReps}</div>
                <div className="label">Reps รวม</div>
              </div>
              <div className="stat-tile card">
                <div className="value">{Math.round(totalVolume)}</div>
                <div className="label">Volume รวม</div>
              </div>
            </div>
            <p className="modal-sub">
              เล่นล่าสุด:{' '}
              {lastDate &&
                new Date(lastDate).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
            </p>
            {points.length > 1 && (
              <svg
                className="progress-graph"
                viewBox={`0 0 ${graphW} ${graphH}`}
                preserveAspectRatio="none"
              >
                <path d={path} fill="none" stroke="url(#grad)" strokeWidth="3" />
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
