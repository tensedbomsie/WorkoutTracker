import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function Dashboard({
  session,
  onGoLog,
}: {
  session: Session
  onGoLog: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [workoutName, setWorkoutName] = useState<string | null>(null)
  const [exerciseNames, setExerciseNames] = useState<string[]>([])
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [totalSets, setTotalSets] = useState(0)
  const [volume, setVolume] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: todaysWorkouts } = await supabase
        .from('workouts')
        .select('id, name, workout_exercises(exercise:exercises(name, category), sets(reps, weight))')
        .gte('performed_at', today.toISOString())

      if (todaysWorkouts && todaysWorkouts.length > 0) {
        const w = todaysWorkouts[0] as any
        setWorkoutName(w.name)
        const names: string[] = []
        const groups = new Set<string>()
        let sets = 0
        let vol = 0
        for (const we of w.workout_exercises ?? []) {
          names.push(we.exercise?.name)
          if (we.exercise?.category) groups.add(we.exercise.category)
          for (const s of we.sets ?? []) {
            sets += 1
            vol += (s.reps ?? 0) * (s.weight ?? 0)
          }
        }
        setExerciseNames(names)
        setMuscleGroups([...groups])
        setTotalSets(sets)
        setVolume(vol)
      } else {
        setWorkoutName(null)
        setExerciseNames([])
        setMuscleGroups([])
        setTotalSets(0)
        setVolume(0)
      }

      const { data: allWorkouts } = await supabase
        .from('workouts')
        .select('performed_at')
        .order('performed_at', { ascending: false })

      const days = new Set((allWorkouts ?? []).map((w) => w.performed_at.slice(0, 10)))
      let streakCount = 0
      const cursor = new Date(today)
      while (days.has(dayKey(cursor))) {
        streakCount += 1
        cursor.setDate(cursor.getDate() - 1)
      }
      setStreak(streakCount)

      setLoading(false)
    }
    load()
  }, [session.user.id])

  if (loading) return <p className="empty-state">กำลังโหลด...</p>

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="stat-grid">
        <div className="stat-tile card">
          <div className="value">{totalSets}</div>
          <div className="label">เซ็ตวันนี้</div>
        </div>
        <div className="stat-tile card">
          <div className="value">{Math.round(volume)}</div>
          <div className="label">Volume วันนี้ (kg)</div>
        </div>
        <div className="stat-tile card">
          <div className="value">{streak}</div>
          <div className="label">🔥 Streak (วัน)</div>
        </div>
        <div className="stat-tile card">
          <div className="value">{exerciseNames.length}</div>
          <div className="label">ท่าวันนี้</div>
        </div>
      </div>

      <div className="today-workout-card card">
        {workoutName ? (
          <>
            <h2 className="section-title" style={{ margin: 0 }}>
              {workoutName}
            </h2>
            {exerciseNames.length > 0 ? (
              <ul className="today-exercise-list">
                {exerciseNames.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">ยังไม่ได้เพิ่มท่าออกกำลังกาย</p>
            )}
            {muscleGroups.length > 0 && (
              <div className="muscle-chip-row">
                {muscleGroups.map((g) => (
                  <span key={g} className="muscle-chip">
                    {g}
                  </span>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={onGoLog}>
              ไปบันทึกต่อ
            </button>
          </>
        ) : (
          <div className="empty-state">
            <p>ยังไม่มี workout วันนี้</p>
            <button className="btn btn-primary" onClick={onGoLog}>
              + เริ่ม Workout วันนี้
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
