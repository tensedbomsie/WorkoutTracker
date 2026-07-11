import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Sparkline from './Sparkline'

type Row = {
  reps: number
  weight: number
  workout_exercise: {
    exercise: { category: string } | null
    workout: { performed_at: string } | null
  } | null
}

function weekKey(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Statistics({ session: _session }: { session: Session }) {
  const [loading, setLoading] = useState(true)
  const [totalSessions, setTotalSessions] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [totalVolume, setTotalVolume] = useState(0)
  const [muscleBalance, setMuscleBalance] = useState<Record<string, number>>({})
  const [weeklyVolume, setWeeklyVolume] = useState<{ x: string; y: number }[]>([])
  const [monthlyVolume, setMonthlyVolume] = useState<{ x: string; y: number }[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data: workouts } = await supabase.from('workouts').select('duration_minutes')
      setTotalSessions(workouts?.length ?? 0)
      setTotalMinutes(
        (workouts ?? []).reduce((sum, w) => sum + (Number(w.duration_minutes) || 0), 0),
      )

      const { data } = await supabase
        .from('sets')
        .select(
          'reps, weight, workout_exercise:workout_exercises(exercise:exercises(category), workout:workouts(performed_at))',
        )
      const rows = (data as unknown as Row[]) ?? []

      let volume = 0
      const balance: Record<string, number> = {}
      const weekly: Record<string, number> = {}
      const monthly: Record<string, number> = {}

      for (const row of rows) {
        const performedAt = row.workout_exercise?.workout?.performed_at
        const category = row.workout_exercise?.exercise?.category
        const setVolume = (row.reps ?? 0) * (row.weight ?? 0)
        volume += setVolume
        if (category) balance[category] = (balance[category] ?? 0) + 1
        if (performedAt) {
          const d = new Date(performedAt)
          const wk = weekKey(d)
          const mk = monthKey(d)
          weekly[wk] = (weekly[wk] ?? 0) + setVolume
          monthly[mk] = (monthly[mk] ?? 0) + setVolume
        }
      }

      setTotalVolume(volume)
      setMuscleBalance(balance)
      setWeeklyVolume(
        Object.entries(weekly)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([x, y]) => ({ x, y })),
      )
      setMonthlyVolume(
        Object.entries(monthly)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([x, y]) => ({ x, y })),
      )
      setLoading(false)
    }
    load()
  }, [])

  const balanceEntries = Object.entries(muscleBalance).sort(([, a], [, b]) => b - a)
  const balanceMax = Math.max(...balanceEntries.map(([, c]) => c), 1)

  if (loading) return <p className="empty-state">กำลังโหลด...</p>

  return (
    <div>
      <h1>Statistics</h1>
      <div className="stat-grid">
        <div className="stat-tile card">
          <div className="value">{totalSessions}</div>
          <div className="label">ครั้งที่ออกกำลังกาย</div>
        </div>
        <div className="stat-tile card">
          <div className="value">{totalMinutes || '–'}</div>
          <div className="label">เวลารวม (นาที)</div>
        </div>
        <div className="stat-tile card">
          <div className="value">{Math.round(totalVolume).toLocaleString()}</div>
          <div className="label">Total Volume (kg)</div>
        </div>
      </div>

      <h2 className="section-title">Muscle Balance (ตลอดเวลา)</h2>
      {balanceEntries.length === 0 ? (
        <p className="empty-state">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="volume-bars card">
          {balanceEntries.map(([category, count]) => (
            <div key={category} className="volume-bar-row">
              <span className="volume-bar-label">{category}</span>
              <div className="volume-bar-track">
                <div
                  className="volume-bar-fill"
                  style={{ width: `${(count / balanceMax) * 100}%` }}
                />
              </div>
              <span className="volume-bar-count">{count} sets</span>
            </div>
          ))}
        </div>
      )}

      {weeklyVolume.length > 1 && (
        <div className="card measurement-graph-card">
          <h2 className="section-title" style={{ margin: 0 }}>
            Weekly Volume Progress
          </h2>
          <Sparkline points={weeklyVolume} />
        </div>
      )}

      {monthlyVolume.length > 1 && (
        <div className="card measurement-graph-card">
          <h2 className="section-title" style={{ margin: 0 }}>
            Monthly Volume Progress
          </h2>
          <Sparkline points={monthlyVolume} />
        </div>
      )}
    </div>
  )
}
