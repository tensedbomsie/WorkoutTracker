import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Row = {
  reps: number
  workout_exercise: {
    exercise: { category: string } | null
    workout: { performed_at: string } | null
  } | null
}

export default function MuscleVolume({ session: _session }: { session: Session }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('sets')
        .select(
          'reps, workout_exercise:workout_exercises(exercise:exercises(category), workout:workouts(performed_at))',
        )

      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const tally: Record<string, number> = {}
      for (const row of (data as unknown as Row[]) ?? []) {
        const performedAt = row.workout_exercise?.workout?.performed_at
        const category = row.workout_exercise?.exercise?.category
        if (!performedAt || !category) continue
        if (new Date(performedAt) < weekAgo) continue
        tally[category] = (tally[category] ?? 0) + 1
      }
      setCounts(tally)
      setLoading(false)
    }
    load()
  }, [])

  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a)
  const max = Math.max(...entries.map(([, c]) => c), 1)

  return (
    <div>
      <h1>Muscle Volume</h1>
      <p className="modal-sub">จำนวนเซ็ตแยกตามกล้ามเนื้อ ใน 7 วันที่ผ่านมา</p>

      {loading ? (
        <p className="empty-state">กำลังโหลด...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">ยังไม่มีข้อมูลใน 7 วันที่ผ่านมา</p>
      ) : (
        <div className="volume-bars card">
          {entries.map(([category, count]) => (
            <div key={category} className="volume-bar-row">
              <span className="volume-bar-label">{category}</span>
              <div className="volume-bar-track">
                <div
                  className="volume-bar-fill"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="volume-bar-count">{count} sets</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
