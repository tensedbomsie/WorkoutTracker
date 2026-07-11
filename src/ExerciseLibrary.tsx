import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { CATEGORIES, type Exercise } from './types'
import ExerciseHistoryModal from './ExerciseHistoryModal'

const emptyNewExercise = () => ({
  name: '',
  category: 'Chest',
  subcategory: '',
  muscle_group: '',
  primary_muscle: '',
  secondary_muscle: '',
  equipment: '',
  movement_pattern: '',
  difficulty: '',
  stretch_focus: false,
  notes: '',
})

export default function ExerciseLibrary({ session }: { session: Session }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyNewExercise())
  const [historyFor, setHistoryFor] = useState<Exercise | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('exercises').select('*').order('name')
    setExercises((data as Exercise[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const toggleFavorite = async (ex: Exercise) => {
    await supabase.from('exercises').update({ is_favorite: !ex.is_favorite }).eq('id', ex.id)
    setExercises((exs) =>
      exs.map((e) => (e.id === ex.id ? { ...e, is_favorite: !e.is_favorite } : e)),
    )
  }

  const addExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await supabase.from('exercises').insert({
      owner: session.user.id,
      name: form.name,
      category: form.category,
      subcategory: form.subcategory || null,
      muscle_group: form.muscle_group || null,
      primary_muscle: form.primary_muscle || null,
      secondary_muscle: form.secondary_muscle || null,
      equipment: form.equipment || null,
      movement_pattern: form.movement_pattern || null,
      difficulty: form.difficulty || null,
      stretch_focus: form.stretch_focus,
      notes: form.notes || null,
    })
    setForm(emptyNewExercise())
    setShowForm(false)
    load()
  }

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )
  const groups = CATEGORIES.map((cat) => ({
    category: cat,
    items: filtered.filter((e) => e.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div>
      <div className="page-header">
        <h1>Exercise Library</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'ปิดฟอร์ม' : '+ เพิ่มท่าใหม่'}
        </button>
      </div>

      {showForm && (
        <form className="card exercise-form" onSubmit={addExercise}>
          <div className="form-grid">
            <input
              placeholder="ชื่อท่า *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              placeholder="Subcategory (เช่น Compound, Vertical Pull)"
              value={form.subcategory}
              onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
            />
            <input
              placeholder="Muscle Group"
              value={form.muscle_group}
              onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}
            />
            <input
              placeholder="Primary Muscle"
              value={form.primary_muscle}
              onChange={(e) => setForm({ ...form, primary_muscle: e.target.value })}
            />
            <input
              placeholder="Secondary Muscle"
              value={form.secondary_muscle}
              onChange={(e) => setForm({ ...form, secondary_muscle: e.target.value })}
            />
            <input
              placeholder="Equipment"
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value })}
            />
            <input
              placeholder="Movement Pattern"
              value={form.movement_pattern}
              onChange={(e) => setForm({ ...form, movement_pattern: e.target.value })}
            />
            <input
              placeholder="Difficulty"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.stretch_focus}
                onChange={(e) => setForm({ ...form, stretch_focus: e.target.checked })}
              />
              Stretch Focus
            </label>
          </div>
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button type="submit" className="btn btn-primary">
            บันทึกท่าใหม่
          </button>
        </form>
      )}

      <input
        className="search-input"
        placeholder="ค้นหาท่าออกกำลังกาย..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="empty-state">กำลังโหลด...</p>}

      {groups.map((group) => (
        <div key={group.category}>
          <h2 className="section-title">{group.category}</h2>
          <div className="exercise-grid">
            {group.items.map((ex) => (
              <div key={ex.id} className="card exercise-card" onClick={() => setHistoryFor(ex)}>
                <div className="exercise-card-top">
                  <span className="exercise-name">{ex.name}</span>
                  <button
                    className="fav-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(ex)
                    }}
                  >
                    {ex.is_favorite ? '⭐' : '☆'}
                  </button>
                </div>
                <div className="exercise-tags">
                  {ex.subcategory && <span className="chip">{ex.subcategory}</span>}
                  {ex.equipment && <span className="chip">{ex.equipment}</span>}
                  {ex.difficulty && <span className="chip">{ex.difficulty}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <p className="empty-state">ไม่พบท่าออกกำลังกาย</p>
      )}

      {historyFor && (
        <ExerciseHistoryModal exercise={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  )
}
