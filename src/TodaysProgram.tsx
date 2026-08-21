import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { ProgramDay, ProgramExercise, WorkoutProgram } from './types'

type Phase = 'idle' | 'active' | 'confirming' | 'resting' | 'done'

export default function TodaysProgram({ session }: { session: Session }) {
  const [program, setProgram] = useState<WorkoutProgram | null>(null)
  const [day, setDay] = useState<ProgramDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [alreadyDoneToday, setAlreadyDoneToday] = useState(false)

  const [phase, setPhase] = useState<Phase>('idle')
  const [workoutExerciseIds, setWorkoutExerciseIds] = useState<Record<string, string>>({})
  const [exIdx, setExIdx] = useState(0)
  const [setNum, setSetNum] = useState(1)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(0)
  const [restLeft, setRestLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [coachTip, setCoachTip] = useState<string | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachQuestion, setCoachQuestion] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState<string | null>(null)

  useEffect(() => {
    void load()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [session.user.id])

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(null), 4000)
    return () => clearTimeout(t)
  }, [justSaved])

  const load = async () => {
    setLoading(true)
    const { data: prog } = await supabase
      .from('workout_programs')
      .select('*')
      .eq('status', 'active')
      .maybeSingle()
    if (prog) {
      setProgram(prog as WorkoutProgram)

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { data: todaysWorkout } = await supabase
        .from('workouts')
        .select('id')
        .eq('owner', session.user.id)
        .not('program_day_id', 'is', null)
        .gte('performed_at', startOfToday.toISOString())
        .maybeSingle()
      if (todaysWorkout) {
        setAlreadyDoneToday(true)
        setLoading(false)
        return
      }

      const { data: d } = await supabase
        .from('program_days')
        .select('*, program_exercises(*, exercise:exercises(*))')
        .eq('program_id', prog.id)
        .eq('day_number', (prog as WorkoutProgram).current_day_number)
        .maybeSingle()
      if (d) {
        const row = {
          ...(d as any),
          program_exercises: ((d as any).program_exercises as ProgramExercise[]).sort((a, b) => a.position - b.position),
        } as ProgramDay
        setDay(row)
      }
    }
    setLoading(false)
  }

  const currentExercise = day?.program_exercises?.[exIdx]

  const startWorkout = async () => {
    if (!day || !day.program_exercises || day.program_exercises.length === 0) return
    const { data: w } = await supabase
      .from('workouts')
      .insert({ owner: session.user.id, name: day.name, program_day_id: day.id })
      .select('*')
      .single()
    if (!w) return

    const ids: Record<string, string> = {}
    for (const pe of day.program_exercises) {
      const { data: we } = await supabase
        .from('workout_exercises')
        .insert({ workout_id: w.id, exercise_id: pe.exercise_id, position: pe.position })
        .select('*')
        .single()
      if (we) ids[pe.id] = we.id
    }
    setWorkoutExerciseIds(ids)
    setExIdx(0)
    setSetNum(1)
    const first = day.program_exercises[0]
    setReps(first.target_reps)
    setWeight(first.target_weight ?? 0)
    setPhase('active')
  }

  const startRest = (seconds: number) => {
    setRestLeft(seconds)
    setPhase('resting')
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setRestLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          advance()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const skipRest = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    advance()
  }

  const advance = () => {
    if (!day || !day.program_exercises) return
    const ex = day.program_exercises[exIdx]
    if (setNum < ex.target_sets) {
      // Same exercise, next set — keep reps/weight as whatever was just
      // confirmed (not the original plan target), so a weight typed once
      // carries forward instead of resetting every set.
      const nextSet = setNum + 1
      setSetNum(nextSet)
      setPhase('active')
    } else if (exIdx < day.program_exercises.length - 1) {
      const nextIdx = exIdx + 1
      const nextEx = day.program_exercises[nextIdx]
      setExIdx(nextIdx)
      setSetNum(1)
      setReps(nextEx.target_reps)
      setWeight(nextEx.target_weight ?? 0)
      setPhase('active')
    } else {
      void finishWorkout()
    }
  }

  const finishSetPhysically = () => {
    // User just did the reps in real life — now ask them to confirm how many
    // they ACTUALLY got, instead of silently trusting the pre-filled target.
    setPhase('confirming')
  }

  const completeSet = async () => {
    if (!currentExercise) return
    const weId = workoutExerciseIds[currentExercise.id]
    if (!weId) return
    if (!Number.isFinite(reps) || reps < 0 || !Number.isFinite(weight) || weight < 0) return

    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('sets').insert({
      workout_exercise_id: weId,
      set_number: setNum,
      reps,
      weight,
      rest_seconds: currentExercise.target_rest_seconds,
    })
    setSaving(false)
    if (error) {
      setSaveError('บันทึกไม่สำเร็จ เช็คเน็ตแล้วลองอีกครั้ง')
      return
    }

    setJustSaved(`✓ เซต ${setNum} บันทึกแล้ว — ${reps} ครั้ง${weight ? ` @ ${weight}kg` : ''}`)

    const isLastSetOfLastExercise =
      setNum >= currentExercise.target_sets && exIdx >= (day?.program_exercises?.length ?? 1) - 1
    if (isLastSetOfLastExercise) {
      void finishWorkout()
    } else {
      startRest(currentExercise.target_rest_seconds)
      const ratio = currentExercise.target_reps > 0 ? reps / currentExercise.target_reps : 1
      // Only bother the AI when performance meaningfully deviated from plan —
      // no point commenting on every routine, on-target set.
      if (ratio < 0.7 || ratio > 1.3) {
        void askCoach()
      } else {
        setCoachTip(null)
      }
    }
  }

  const askCoach = async (question?: string) => {
    if (!currentExercise) return
    setCoachLoading(true)
    if (!question) setCoachTip(null)
    try {
      const { data, error } = await supabase.functions.invoke('workout-coach-tip', {
        body: {
          context: {
            exercise_name: currentExercise.exercise?.name,
            target_reps: currentExercise.target_reps,
            actual_reps: reps,
            target_weight: currentExercise.target_weight,
            actual_weight: weight,
            set_number: setNum,
            target_sets: currentExercise.target_sets,
            exercises_left: (day?.program_exercises?.length ?? 1) - exIdx - 1,
          },
          question,
        },
      })
      if (error) throw error
      setCoachTip(data.tip || null)
    } catch {
      setCoachTip(null)
    } finally {
      setCoachLoading(false)
    }
  }

  const finishWorkout = async () => {
    setPhase('done')
    if (!program || !day) return
    let nextDayNum = program.current_day_number + 1
    let status: 'active' | 'completed' = 'active'
    if (nextDayNum > program.total_days) {
      nextDayNum = program.repeats ? 1 : program.total_days
      if (!program.repeats) status = 'completed'
    }
    await supabase.from('workout_programs').update({ current_day_number: nextDayNum, status }).eq('id', program.id)
  }

  if (loading) return <p className="empty-state">กำลังโหลด...</p>

  if (alreadyDoneToday) {
    return (
      <div className="card today-program-done">
        <h2>✅ วันนี้เล่นไปแล้ว!</h2>
        <p>เยี่ยมมาก พรุ่งนี้กลับมาต่อวันที่ {program?.current_day_number ?? 1} ได้เลย</p>
      </div>
    )
  }

  if (!program || !day) {
    return (
      <p className="empty-state">
        ยังไม่มีโปรแกรมที่ใช้งานอยู่ — ไปที่แท็บ "โปรแกรม" เพื่อสร้างหรือเลือกโปรแกรมก่อนครับ
      </p>
    )
  }

  if (phase === 'done') {
    return (
      <div className="card today-program-done">
        <h2>🎉 จบโปรแกรมวันนี้แล้ว!</h2>
        <p>เยี่ยมมาก พรุ่งนี้กลับมาต่อวันที่ {program.status === 'completed' ? 'สุดท้าย' : program.current_day_number + 1 > program.total_days ? 1 : program.current_day_number + 1} ได้เลย</p>
      </div>
    )
  }

  if (phase === 'idle') {
    return (
      <div>
        <div className="page-header">
          <h2>🎯 {program.name} — {day.name}</h2>
        </div>
        {program.goal && <p className="program-goal">{program.goal}</p>}
        <div className="today-program-preview">
          {(day.program_exercises ?? []).map((pe, i) => (
            <div key={pe.id} className="card today-program-preview-row">
              <span className="today-preview-num">{i + 1}</span>
              <span className="exercise-name">{pe.exercise?.name}</span>
              <span className="chip">
                {pe.target_sets} เซต × {pe.target_reps} ครั้ง {pe.target_weight ? `@ ${pe.target_weight}kg` : ''}
              </span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary today-start-btn" onClick={startWorkout} disabled={!day.program_exercises?.length}>
          ▶ เริ่มออกกำลังกาย
        </button>
      </div>
    )
  }

  if (phase === 'resting') {
    return (
      <div className="card today-rest-screen">
        {justSaved && <p className="today-saved-flash">{justSaved}</p>}
        <span className="today-rest-label">พัก</span>
        <span className="today-rest-timer">{restLeft}s</span>
        <p>เซตถัดไป: {currentExercise?.exercise?.name} — เซต {setNum < (currentExercise?.target_sets ?? 1) ? setNum + 1 : setNum}</p>

        {coachLoading && <p className="coach-tip coach-tip-loading">🤖 กำลังดู...</p>}
        {coachTip && !coachLoading && <p className="coach-tip">🤖 {coachTip}</p>}

        <div className="coach-ask-row">
          <input
            className="coach-ask-input"
            placeholder="ถามโค้ช..."
            value={coachQuestion}
            onChange={(e) => setCoachQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && coachQuestion.trim()) {
                void askCoach(coachQuestion)
                setCoachQuestion('')
              }
            }}
          />
          <button
            className="btn"
            onClick={() => {
              if (!coachQuestion.trim()) return
              void askCoach(coachQuestion)
              setCoachQuestion('')
            }}
          >
            ถาม
          </button>
        </div>

        <button className="btn" onClick={skipRest}>
          ข้ามการพัก →
        </button>
      </div>
    )
  }

  if (phase === 'confirming') {
    return (
      <div className="card today-active-screen">
        <div className="today-active-progress">
          ท่าที่ {exIdx + 1}/{day.program_exercises?.length} · เซต {setNum}/{currentExercise?.target_sets}
        </div>
        <h2 className="today-active-name">{currentExercise?.exercise?.name}</h2>
        <p className="today-target-hint">
          เป้าหมาย: {currentExercise?.target_reps} ครั้ง{currentExercise?.target_weight ? ` @ ${currentExercise.target_weight}kg` : ''}
        </p>
        <p className="today-confirm-hint">ทำได้จริงกี่ครั้ง/กี่กก. — ใส่ตามที่ทำได้จริงเลย ไม่ต้องตรงกับเป้าก็ได้</p>
        <div className="today-active-inputs">
          <div className="today-input-block">
            <span className="today-input-label">จำนวนครั้งจริง</span>
            <div className="today-input-stepper">
              <button onClick={() => setReps((r) => Math.max(0, (Number.isFinite(r) ? r : 0) - 1))}>−</button>
              <input
                type="number"
                min={0}
                value={Number.isFinite(reps) ? reps : ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? NaN : Number(e.target.value)
                  setReps(v)
                }}
                autoFocus
              />
              <button onClick={() => setReps((r) => (Number.isFinite(r) ? r : 0) + 1)}>+</button>
            </div>
          </div>
          <div className="today-input-block">
            <span className="today-input-label">น้ำหนักจริง (kg)</span>
            <div className="today-input-stepper">
              <button onClick={() => setWeight((w) => Math.max(0, (Number.isFinite(w) ? w : 0) - 2.5))}>−</button>
              <input
                type="number"
                step="0.5"
                min={0}
                value={Number.isFinite(weight) ? weight : ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? NaN : Number(e.target.value)
                  setWeight(v)
                }}
              />
              <button onClick={() => setWeight((w) => (Number.isFinite(w) ? w : 0) + 2.5)}>+</button>
            </div>
          </div>
        </div>
        {saveError && (
          <p className="today-save-error">
            {saveError} <button className="btn" onClick={completeSet}>ลองอีกครั้ง</button>
          </p>
        )}
        <button
          className="btn btn-primary today-complete-btn"
          onClick={completeSet}
          disabled={saving || !Number.isFinite(reps) || reps < 0 || !Number.isFinite(weight) || weight < 0}
        >
          {saving ? 'กำลังบันทึก...' : '✓ ยืนยันจำนวนจริง'}
        </button>
      </div>
    )
  }

  // phase === 'active'
  return (
    <div className="card today-active-screen">
      <div className="today-active-progress">
        ท่าที่ {exIdx + 1}/{day.program_exercises?.length} · เซต {setNum}/{currentExercise?.target_sets}
      </div>
      <h2 className="today-active-name">{currentExercise?.exercise?.name}</h2>
      {currentExercise?.exercise?.thumbnail_url && (
        <img className="today-active-thumb" src={currentExercise.exercise.thumbnail_url} alt="" />
      )}
      <p className="today-target-hint">
        เป้าหมาย: {currentExercise?.target_reps} ครั้ง{currentExercise?.target_weight ? ` @ ${currentExercise.target_weight}kg` : ''}
      </p>
      {saveError && (
        <p className="today-save-error">
          {saveError} <button className="btn" onClick={completeSet}>ลองอีกครั้ง</button>
        </p>
      )}
      <div className="today-active-actions">
        <button className="btn btn-primary today-complete-btn" onClick={finishSetPhysically} disabled={saving}>
          ✓ เล่นเซตนี้เสร็จแล้ว
        </button>
        <button className="btn today-asplanned-btn" onClick={completeSet} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : '✓ ตามเป้า (ไม่ต้องกรอก)'}
        </button>
      </div>
    </div>
  )
}
