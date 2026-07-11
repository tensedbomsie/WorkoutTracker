import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from './lib/supabase'
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from './types'

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function WorkoutLog({ session }: { session: Session }) {
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [items, setItems] = useState<WorkoutExercise[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: exList } = await supabase.from('exercises').select('*').order('name')
      setExercises((exList as Exercise[]) ?? [])

      const { data: existing } = await supabase
        .from('workouts')
        .select('*')
        .gte('performed_at', todayStart().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let w = existing as Workout | null
      if (!w) {
        const { data: created } = await supabase
          .from('workouts')
          .insert({ owner: session.user.id, name: 'Workout' })
          .select('*')
          .single()
        w = created as Workout
      }
      setWorkout(w)
      await loadItems(w.id)
      setLoading(false)
    }
    init()
  }, [session.user.id])

  const loadItems = async (workoutId: string) => {
    const { data } = await supabase
      .from('workout_exercises')
      .select('*, exercise:exercises(*), sets(*)')
      .eq('workout_id', workoutId)
      .order('position')
    const rows = ((data as any[]) ?? []).map((r) => ({
      ...r,
      sets: (r.sets as WorkoutSet[]).sort((a, b) => a.set_number - b.set_number),
    })) as WorkoutExercise[]
    setItems(rows)
  }

  const renameWorkout = async (name: string) => {
    if (!workout) return
    setWorkout({ ...workout, name })
    await supabase.from('workouts').update({ name }).eq('id', workout.id)
  }

  const notesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateNotes = (notes: string) => {
    if (!workout) return
    setWorkout({ ...workout, notes })
    if (notesTimeout.current) clearTimeout(notesTimeout.current)
    notesTimeout.current = setTimeout(async () => {
      await supabase.from('workouts').update({ notes }).eq('id', workout.id)
    }, 600)
  }

  const addExercise = async (exercise: Exercise) => {
    if (!workout) return
    const { data } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workout.id, exercise_id: exercise.id, position: items.length })
      .select('*, exercise:exercises(*), sets(*)')
      .single()
    setItems((prev) => [...prev, { ...(data as any), sets: [] }])
    setSearch('')
  }

  const removeExercise = async (workoutExerciseId: string) => {
    await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId)
    setItems((prev) => prev.filter((i) => i.id !== workoutExerciseId))
  }

  const addSet = async (
    workoutExerciseId: string,
    reps: number,
    weight: number,
    rpe: number | null,
  ) => {
    const item = items.find((i) => i.id === workoutExerciseId)
    const nextNum = (item?.sets?.length ?? 0) + 1
    const { data } = await supabase
      .from('sets')
      .insert({ workout_exercise_id: workoutExerciseId, set_number: nextNum, reps, weight, rpe })
      .select('*')
      .single()
    setItems((prev) =>
      prev.map((i) =>
        i.id === workoutExerciseId ? { ...i, sets: [...(i.sets ?? []), data as WorkoutSet] } : i,
      ),
    )
  }

  const deleteSet = async (workoutExerciseId: string, setId: string) => {
    await supabase.from('sets').delete().eq('id', setId)
    setItems((prev) =>
      prev.map((i) =>
        i.id === workoutExerciseId
          ? { ...i, sets: (i.sets ?? []).filter((s) => s.id !== setId) }
          : i,
      ),
    )
  }

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    await Promise.all(
      reordered.map((item, idx) =>
        supabase.from('workout_exercises').update({ position: idx }).eq('id', item.id),
      ),
    )
  }

  const filteredExercises = useMemo(
    () =>
      search.trim()
        ? exercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
        : [],
    [search, exercises],
  )

  if (loading) return <p className="empty-state">กำลังโหลด...</p>

  return (
    <div>
      <div className="page-header">
        <input
          className="workout-name-input"
          value={workout?.name ?? ''}
          onChange={(e) => renameWorkout(e.target.value)}
          placeholder="ชื่อ Workout เช่น Upper A"
        />
      </div>

      <textarea
        className="workout-notes-input"
        placeholder="📝 บันทึกความรู้สึกวันนี้..."
        value={workout?.notes ?? ''}
        onChange={(e) => updateNotes(e.target.value)}
      />

      <div className="exercise-search">
        <input
          placeholder="+ เพิ่มท่าออกกำลังกาย..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filteredExercises.length > 0 && (
          <div className="exercise-search-dropdown card">
            {filteredExercises.map((ex) => (
              <button key={ex.id} className="exercise-search-item" onClick={() => addExercise(ex)}>
                <span>{ex.name}</span>
                <span className="chip">{ex.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableExerciseRow
              key={item.id}
              item={item}
              onAddSet={addSet}
              onDeleteSet={deleteSet}
              onRemove={removeExercise}
            />
          ))}
        </SortableContext>
      </DndContext>

      {items.length === 0 && <p className="empty-state">เพิ่มท่าออกกำลังกายเพื่อเริ่มบันทึกได้เลย</p>}
    </div>
  )
}

function SortableExerciseRow({
  item,
  onAddSet,
  onDeleteSet,
  onRemove,
}: {
  item: WorkoutExercise
  onAddSet: (workoutExerciseId: string, reps: number, weight: number, rpe: number | null) => void
  onDeleteSet: (workoutExerciseId: string, setId: string) => void
  onRemove: (workoutExerciseId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const lastSet = item.sets?.[item.sets.length - 1]
  const [reps, setReps] = useState(lastSet?.reps ?? 10)
  const [weight, setWeight] = useState(lastSet?.weight ?? 20)
  const [rpe, setRpe] = useState<number | ''>('')

  const confirmSet = () => {
    onAddSet(item.id, reps, weight, rpe === '' ? null : rpe)
  }

  return (
    <div ref={setNodeRef} style={style} className="card workout-exercise-card">
      <div className="workout-exercise-header">
        <span className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </span>
        <span className="exercise-name">{item.exercise?.name}</span>
        <span className="spacer" />
        <button className="btn btn-danger" onClick={() => onRemove(item.id)}>
          ลบท่า
        </button>
      </div>

      {item.sets && item.sets.length > 0 && (
        <div className="set-list">
          {item.sets.map((s) => (
            <div key={s.id} className="set-row">
              <span className="set-num">#{s.set_number}</span>
              <span>{s.reps} reps</span>
              <span>{s.weight} kg</span>
              {s.rpe != null && <span>RPE {s.rpe}</span>}
              <button className="set-delete" onClick={() => onDeleteSet(item.id, s.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="quick-add-row">
        <div className="quick-add-field">
          <span className="field-label">Reps</span>
          <div className="stepper">
            <button onClick={() => setReps((r) => Math.max(0, r - 1))}>−</button>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && confirmSet()}
            />
            <button onClick={() => setReps((r) => r + 1)}>+</button>
          </div>
        </div>
        <div className="quick-add-field">
          <span className="field-label">Weight (kg)</span>
          <div className="stepper">
            <button onClick={() => setWeight((w) => Math.max(0, w - 2.5))}>−</button>
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && confirmSet()}
            />
            <button onClick={() => setWeight((w) => w + 2.5)}>+</button>
          </div>
        </div>
        <div className="quick-add-field">
          <span className="field-label">RPE</span>
          <input
            className="rpe-input"
            type="number"
            placeholder="-"
            value={rpe}
            onChange={(e) => setRpe(e.target.value === '' ? '' : Number(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && confirmSet()}
          />
        </div>
        <button className="btn btn-primary confirm-set-btn" onClick={confirmSet}>
          + เซ็ต
        </button>
      </div>
    </div>
  )
}
