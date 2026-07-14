import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Workout, WorkoutExercise, WorkoutSet } from './types'

const dayKey = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const buildWorkoutExportText = (workout: Workout, items: WorkoutExercise[]) => {
  const lines: string[] = [
    `# Workout: ${workout.name}`,
    new Date(workout.performed_at).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }),
    '',
  ]
  if (workout.notes) lines.push(`โน้ต: ${workout.notes}`, '')
  for (const item of items) {
    lines.push(`## ${item.exercise?.name ?? ''}`)
    for (const s of item.sets ?? []) {
      const rest = s.rest_seconds != null ? ` | พัก ${s.rest_seconds}s` : ''
      lines.push(`- #${s.set_number} ${s.reps} reps, ${s.weight} kg${rest}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export default function CalendarView({ session: _session }: { session: Session }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [workoutDays, setWorkoutDays] = useState<Record<string, Workout>>({})
  const [selected, setSelected] = useState<Workout | null>(null)
  const [selectedItems, setSelectedItems] = useState<WorkoutExercise[]>([])
  const [exportText, setExportText] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      const { data } = await supabase
        .from('workouts')
        .select('*')
        .gte('performed_at', start.toISOString())
        .lt('performed_at', end.toISOString())
      const map: Record<string, Workout> = {}
      for (const w of (data as Workout[]) ?? []) {
        map[dayKey(new Date(w.performed_at))] = w
      }
      setWorkoutDays(map)
    }
    load()
  }, [cursor])

  const openDay = async (workout: Workout) => {
    setSelected(workout)
    setExportText(null)
    setCopyStatus(null)
    const { data } = await supabase
      .from('workout_exercises')
      .select('*, exercise:exercises(*), sets(*)')
      .eq('workout_id', workout.id)
      .order('position')
    const rows = ((data as any[]) ?? []).map((r) => ({
      ...r,
      sets: (r.sets as WorkoutSet[]).sort((a, b) => a.set_number - b.set_number),
    })) as WorkoutExercise[]
    setSelectedItems(rows)
  }

  const grid = useMemo(() => {
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const startOffset = firstDay.getDay()
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    }
    return cells
  }, [cursor])

  const monthLabel = cursor.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
  const todayKey = dayKey(new Date())

  return (
    <div>
      <div className="page-header">
        <h1>Calendar</h1>
        <div className="calendar-nav">
          <button
            className="btn"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <span className="calendar-month-label">{monthLabel}</span>
          <button
            className="btn"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar-grid card">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
        {grid.map((date, i) => {
          if (!date) return <div key={i} className="calendar-cell empty" />
          const key = dayKey(date)
          const workout = workoutDays[key]
          return (
            <div
              key={i}
              className={`calendar-cell${workout ? ' has-workout' : ''}${key === todayKey ? ' today' : ''}`}
              onClick={() => workout && openDay(workout)}
            >
              <span>{date.getDate()}</span>
              {workout && <span className="calendar-dot" />}
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h2>{selected.name}</h2>
            <p className="modal-sub">
              {new Date(selected.performed_at).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
            {selected.notes && <p className="calendar-notes">📝 {selected.notes}</p>}
            {selectedItems.length === 0 ? (
              <p className="empty-state">ไม่มีท่าออกกำลังกายบันทึกไว้</p>
            ) : (
              selectedItems.map((item) => (
                <div key={item.id} className="calendar-exercise-block">
                  <span className="exercise-name">{item.exercise?.name}</span>
                  <div className="set-list">
                    {(item.sets ?? []).map((s) => (
                      <div key={s.id} className="set-row">
                        <span className="set-num">#{s.set_number}</span>
                        <span>{s.reps} reps</span>
                        <span>{s.weight} kg</span>
                        {s.rest_seconds != null && <span>พัก {s.rest_seconds}s</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            {exportText !== null && (
              <>
                <textarea
                  readOnly
                  className="workout-notes-input"
                  style={{ minHeight: 160, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.8rem' }}
                  value={exportText}
                  onFocus={(e) => e.target.select()}
                />
                {copyStatus && <p className="modal-sub">{copyStatus}</p>}
              </>
            )}
            <div className="modal-actions">
              {selectedItems.length > 0 && (
                <button
                  className="btn"
                  style={{ marginRight: 'auto' }}
                  onClick={async () => {
                    const text = buildWorkoutExportText(selected, selectedItems)
                    setExportText(text)
                    try {
                      await navigator.clipboard.writeText(text)
                      setCopyStatus('คัดลอกแล้ว!')
                    } catch {
                      setCopyStatus('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความแล้วกด Ctrl+C เอง')
                    }
                  }}
                >
                  Export
                </button>
              )}
              <button className="btn" onClick={() => setSelected(null)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
