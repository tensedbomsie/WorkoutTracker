import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Row = {
  reps: number
  weight: number
  workout_exercise: {
    exercise: { id: string; name: string; is_favorite: boolean } | null
    workout: { performed_at: string } | null
  } | null
}

type PR = {
  exerciseId: string
  name: string
  isFavorite: boolean
  maxWeight: number
  lastDate: string
  totalSets: number
}

const CLASSIC_LIFTS = ['bench', 'squat', 'deadlift', 'pull-up', 'pullup', 'push-up', 'pushup', 'dip']

export default function PRTracker({ session: _session }: { session: Session }) {
  const [prs, setPrs] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('sets')
        .select(
          'reps, weight, workout_exercise:workout_exercises(exercise:exercises(id, name, is_favorite), workout:workouts(performed_at))',
        )

      const byExercise = new Map<string, PR>()
      for (const row of (data as unknown as Row[]) ?? []) {
        const ex = row.workout_exercise?.exercise
        const performedAt = row.workout_exercise?.workout?.performed_at
        if (!ex || !performedAt) continue
        const isClassic = CLASSIC_LIFTS.some((k) => ex.name.toLowerCase().includes(k))
        if (!ex.is_favorite && !isClassic) continue

        const existing = byExercise.get(ex.id)
        if (existing) {
          existing.maxWeight = Math.max(existing.maxWeight, row.weight)
          existing.totalSets += 1
          if (new Date(performedAt) > new Date(existing.lastDate)) existing.lastDate = performedAt
        } else {
          byExercise.set(ex.id, {
            exerciseId: ex.id,
            name: ex.name,
            isFavorite: ex.is_favorite,
            maxWeight: row.weight,
            lastDate: performedAt,
            totalSets: 1,
          })
        }
      }

      setPrs([...byExercise.values()].sort((a, b) => b.maxWeight - a.maxWeight))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <h1>PR Tracker</h1>
      <p className="modal-sub">ท่าที่ปักหมุด ⭐ และท่ายกหลักๆ (Bench/Squat/Deadlift/Pull-up/Push-up/Dip)</p>

      {loading ? (
        <p className="empty-state">กำลังโหลด...</p>
      ) : prs.length === 0 ? (
        <p className="empty-state">
          ยังไม่มี PR — ลอง favorite ⭐ ท่าที่เล่นประจำในหน้า Exercises แล้วบันทึกเซ็ตดู
        </p>
      ) : (
        <div className="pr-grid">
          {prs.map((pr) => (
            <div key={pr.exerciseId} className="card pr-card">
              <div className="pr-card-top">
                <span className="exercise-name">{pr.name}</span>
                {pr.isFavorite && <span>⭐</span>}
              </div>
              <div className="pr-value">{pr.maxWeight} kg</div>
              <div className="modal-sub" style={{ margin: 0 }}>
                {pr.totalSets} เซ็ตทั้งหมด · ล่าสุด{' '}
                {new Date(pr.lastDate).toLocaleDateString('th-TH', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
