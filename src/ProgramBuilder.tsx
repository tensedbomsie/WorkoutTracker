import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Exercise, WorkoutProgram, ProgramDay, ProgramExercise } from './types'
import ProgramGenerator from './ProgramGenerator'

export default function ProgramBuilder({ session }: { session: Session }) {
  const [programs, setPrograms] = useState<WorkoutProgram[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [session.user.id])

  const load = async () => {
    setLoading(true)
    const [{ data: progs }, { data: ex }] = await Promise.all([
      supabase.from('workout_programs').select('*').order('created_at', { ascending: false }),
      supabase.from('exercises').select('*').order('name'),
    ])
    setPrograms((progs as WorkoutProgram[]) ?? [])
    setExercises((ex as Exercise[]) ?? [])
    setLoading(false)
  }

  const createProgram = async () => {
    const { data } = await supabase
      .from('workout_programs')
      .insert({ owner: session.user.id, name: 'โปรแกรมใหม่', total_days: 1, current_day_number: 1 })
      .select('*')
      .single()
    if (data) {
      await supabase.from('program_days').insert({ program_id: data.id, day_number: 1, name: 'Day 1' })
      setPrograms((prev) => [data as WorkoutProgram, ...prev])
      setEditingId(data.id)
    }
  }

  const setActive = async (id: string) => {
    await Promise.all(
      programs.map((p) =>
        supabase.from('workout_programs').update({ status: p.id === id ? 'active' : p.status === 'active' ? 'paused' : p.status }).eq('id', p.id),
      ),
    )
    await load()
  }

  const deleteProgram = async (id: string) => {
    await supabase.from('workout_programs').delete().eq('id', id)
    setPrograms((prev) => prev.filter((p) => p.id !== id))
    if (editingId === id) setEditingId(null)
  }

  if (loading) return <p className="empty-state">กำลังโหลด...</p>

  const editing = programs.find((p) => p.id === editingId)

  return (
    <div>
      <div className="page-header">
        <h2>โปรแกรมออกกำลังกาย</h2>
        <div className="program-header-actions">
          <ProgramGenerator session={session} onSaved={load} />
          <button className="btn" onClick={createProgram}>
            + สร้างเอง
          </button>
        </div>
      </div>

      {programs.length === 0 && <p className="empty-state">ยังไม่มีโปรแกรม สร้างอันแรกได้เลย (ให้ AI ช่วยออกแบบ หรือสร้างเองก็ได้)</p>}

      <div className="program-list">
        {programs.map((p) => (
          <div key={p.id} className={`card program-card ${p.status === 'active' ? 'program-active' : ''}`}>
            <div className="program-card-header">
              <span className="program-name">{p.name}</span>
              {p.status === 'active' && <span className="chip chip-active">กำลังใช้งาน</span>}
              {p.ai_generated && <span className="chip">🤖 AI</span>}
            </div>
            {p.goal && <p className="program-goal">{p.goal}</p>}
            <p className="program-meta">
              {p.total_days} วัน · วันที่ {p.current_day_number} {p.repeats ? '(วนซ้ำ)' : ''}
            </p>
            <div className="program-card-actions">
              <button className="btn" onClick={() => setEditingId(p.id)}>
                แก้ไข
              </button>
              {p.status !== 'active' && (
                <button className="btn btn-primary" onClick={() => setActive(p.id)}>
                  ใช้โปรแกรมนี้
                </button>
              )}
              <button className="btn btn-danger" onClick={() => deleteProgram(p.id)}>
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ProgramEditor
          program={editing}
          exercises={exercises}
          onClose={() => setEditingId(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function ProgramEditor({
  program,
  exercises,
  onClose,
  onSaved,
}: {
  program: WorkoutProgram
  exercises: Exercise[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(program.name)
  const [goal, setGoal] = useState(program.goal ?? '')
  const [repeats, setRepeats] = useState(program.repeats)
  const [days, setDays] = useState<ProgramDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadDays()
  }, [program.id])

  const loadDays = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('program_days')
      .select('*, program_exercises(*, exercise:exercises(*))')
      .eq('program_id', program.id)
      .order('day_number')
    const rows = ((data as any[]) ?? []).map((d) => ({
      ...d,
      program_exercises: (d.program_exercises as ProgramExercise[]).sort((a, b) => a.position - b.position),
    })) as ProgramDay[]
    setDays(rows)
    setLoading(false)
  }

  const saveMeta = async () => {
    await supabase
      .from('workout_programs')
      .update({ name, goal: goal || null, total_days: days.length, repeats })
      .eq('id', program.id)
    onSaved()
  }

  const addDay = async () => {
    const nextNum = days.length + 1
    const { data } = await supabase
      .from('program_days')
      .insert({ program_id: program.id, day_number: nextNum, name: `Day ${nextNum}` })
      .select('*')
      .single()
    if (data) setDays((prev) => [...prev, { ...(data as ProgramDay), program_exercises: [] }])
    await supabase.from('workout_programs').update({ total_days: nextNum }).eq('id', program.id)
  }

  const removeDay = async (dayId: string) => {
    await supabase.from('program_days').delete().eq('id', dayId)
    const remaining = days.filter((d) => d.id !== dayId)
    setDays(remaining)
    await supabase.from('workout_programs').update({ total_days: remaining.length }).eq('id', program.id)
  }

  const renameDay = async (dayId: string, dayName: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name: dayName } : d)))
    await supabase.from('program_days').update({ name: dayName }).eq('id', dayId)
  }

  const addExerciseToDay = async (dayId: string, exercise: Exercise) => {
    const day = days.find((d) => d.id === dayId)
    const position = day?.program_exercises?.length ?? 0
    const { data } = await supabase
      .from('program_exercises')
      .insert({ program_day_id: dayId, exercise_id: exercise.id, position, target_sets: 3, target_reps: 10, target_rest_seconds: 60 })
      .select('*, exercise:exercises(*)')
      .single()
    if (data) {
      setDays((prev) =>
        prev.map((d) => (d.id === dayId ? { ...d, program_exercises: [...(d.program_exercises ?? []), data as ProgramExercise] } : d)),
      )
    }
  }

  const updateProgramExercise = async (peId: string, dayId: string, field: 'target_sets' | 'target_reps' | 'target_weight' | 'target_rest_seconds', value: number | null) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, program_exercises: d.program_exercises?.map((pe) => (pe.id === peId ? { ...pe, [field]: value } : pe)) }
          : d,
      ),
    )
    await supabase.from('program_exercises').update({ [field]: value }).eq('id', peId)
  }

  const removeProgramExercise = async (peId: string, dayId: string) => {
    await supabase.from('program_exercises').delete().eq('id', peId)
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, program_exercises: d.program_exercises?.filter((pe) => pe.id !== peId) } : d)),
    )
  }

  if (loading) return <p className="empty-state">กำลังโหลด...</p>

  return (
    <div className="card program-editor">
      <div className="page-header">
        <input className="workout-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อโปรแกรม" />
        <button className="btn" onClick={onClose}>
          ปิด
        </button>
      </div>
      <input className="workout-notes-input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="เป้าหมาย เช่น เพิ่มกล้ามเนื้อ 3 เดือน" />
      <label className="program-repeats-toggle">
        <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
        วนซ้ำโปรแกรมเมื่อครบทุกวันแล้ว
      </label>
      <button className="btn btn-primary" onClick={saveMeta}>
        บันทึกชื่อ/เป้าหมาย
      </button>

      <div className="program-days-list">
        {days.map((day) => (
          <ProgramDayEditor
            key={day.id}
            day={day}
            exercises={exercises}
            onRename={(n) => renameDay(day.id, n)}
            onRemoveDay={() => removeDay(day.id)}
            onAddExercise={(ex) => addExerciseToDay(day.id, ex)}
            onUpdateExercise={(peId, field, value) => updateProgramExercise(peId, day.id, field, value)}
            onRemoveExercise={(peId) => removeProgramExercise(peId, day.id)}
          />
        ))}
      </div>
      <button className="btn" onClick={addDay}>
        + เพิ่มวัน
      </button>
    </div>
  )
}

function ProgramDayEditor({
  day,
  exercises,
  onRename,
  onRemoveDay,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
}: {
  day: ProgramDay
  exercises: Exercise[]
  onRename: (name: string) => void
  onRemoveDay: () => void
  onAddExercise: (exercise: Exercise) => void
  onUpdateExercise: (peId: string, field: 'target_sets' | 'target_reps' | 'target_weight' | 'target_rest_seconds', value: number | null) => void
  onRemoveExercise: (peId: string) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(
    () => (search.trim() ? exercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6) : []),
    [search, exercises],
  )

  return (
    <div className="card program-day-card">
      <div className="workout-exercise-header">
        <input className="program-day-name-input" value={day.name} onChange={(e) => onRename(e.target.value)} />
        <span className="spacer" />
        <button className="btn btn-danger" onClick={onRemoveDay}>
          ลบวัน
        </button>
      </div>

      {(day.program_exercises ?? []).map((pe) => (
        <div key={pe.id} className="program-exercise-row">
          <span className="exercise-name">{pe.exercise?.name}</span>
          <div className="quick-add-field">
            <span className="field-label">Sets</span>
            <input type="number" value={pe.target_sets} onChange={(e) => onUpdateExercise(pe.id, 'target_sets', Number(e.target.value))} />
          </div>
          <div className="quick-add-field">
            <span className="field-label">Reps</span>
            <input type="number" value={pe.target_reps} onChange={(e) => onUpdateExercise(pe.id, 'target_reps', Number(e.target.value))} />
          </div>
          <div className="quick-add-field">
            <span className="field-label">Weight (kg)</span>
            <input
              type="number"
              value={pe.target_weight ?? ''}
              onChange={(e) => onUpdateExercise(pe.id, 'target_weight', e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
          <div className="quick-add-field">
            <span className="field-label">Rest (s)</span>
            <input type="number" value={pe.target_rest_seconds} onChange={(e) => onUpdateExercise(pe.id, 'target_rest_seconds', Number(e.target.value))} />
          </div>
          <button className="set-delete" onClick={() => onRemoveExercise(pe.id)}>
            ×
          </button>
        </div>
      ))}

      <div className="exercise-search">
        <input placeholder="+ เพิ่มท่าในวันนี้..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {filtered.length > 0 && (
          <div className="exercise-search-dropdown card">
            {filtered.map((ex) => (
              <button
                key={ex.id}
                className="exercise-search-item"
                onClick={() => {
                  onAddExercise(ex)
                  setSearch('')
                }}
              >
                <span>{ex.name}</span>
                <span className="chip">{ex.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
