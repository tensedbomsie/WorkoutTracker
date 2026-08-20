import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Exercise } from './types'

type ChatPart = { text?: string; functionCall?: unknown; functionResponse?: unknown }
type ChatTurn = { role: 'user' | 'model'; parts: ChatPart[] }

type ProposedExercise = {
  exercise_name: string
  target_sets: number
  target_reps: number
  target_weight?: number
  target_rest_seconds: number
}
type ProposedDay = { day_number: number; name: string; exercises: ProposedExercise[] }
type ProposedProgram = {
  name: string
  goal?: string
  repeats: boolean
  reasoning?: string
  days: ProposedDay[]
}

export default function ProgramGenerator({ session, onSaved }: { session: Session; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [reply, setReply] = useState<string | null>(null)
  const [pending, setPending] = useState<ProposedProgram | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const send = async () => {
    if (!input.trim()) return
    setLoading(true)
    setPending(null)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('generate-workout-program', {
        body: { message: input, history },
      })
      if (error) throw error
      setHistory(data.history ?? [])
      setReply(data.reply ?? null)
      if (data.pendingAction?.kind === 'propose_generate_workout_program') {
        setPending(data.pendingAction.args as ProposedProgram)
      }
      setInput('')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const confirmProgram = async () => {
    if (!pending) return
    setSaving(true)
    const { data: exList } = await supabase.from('exercises').select('id, name')
    const byName = new Map(((exList as Exercise[]) ?? []).map((e) => [e.name.toLowerCase().trim(), e.id]))

    const { data: prog } = await supabase
      .from('workout_programs')
      .insert({
        owner: session.user.id,
        name: pending.name,
        goal: pending.goal ?? null,
        total_days: pending.days.length,
        current_day_number: 1,
        repeats: pending.repeats,
        status: 'active',
        ai_generated: true,
      })
      .select('*')
      .single()

    if (prog) {
      for (const day of pending.days) {
        const { data: d } = await supabase
          .from('program_days')
          .insert({ program_id: prog.id, day_number: day.day_number, name: day.name })
          .select('*')
          .single()
        if (!d) continue
        let position = 0
        for (const pe of day.exercises) {
          const exerciseId = byName.get(pe.exercise_name.toLowerCase().trim())
          if (!exerciseId) continue // AI named something not in the DB — skip rather than crash
          await supabase.from('program_exercises').insert({
            program_day_id: d.id,
            exercise_id: exerciseId,
            position: position++,
            target_sets: pe.target_sets,
            target_reps: pe.target_reps,
            target_weight: pe.target_weight ?? null,
            target_rest_seconds: pe.target_rest_seconds,
          })
        }
      }
      // this new program becomes the active one — pause any other active program
      await supabase
        .from('workout_programs')
        .update({ status: 'paused' })
        .neq('id', prog.id)
        .eq('owner', session.user.id)
        .eq('status', 'active')
      await supabase.from('workout_programs').update({ status: 'active' }).eq('id', prog.id)
    }

    setSaving(false)
    setPending(null)
    setReply(null)
    setHistory([])
    setOpen(false)
    onSaved()
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        🤖 ให้ AI ออกแบบโปรแกรมให้
      </button>
    )
  }

  return (
    <div className="card program-generator">
      <div className="workout-exercise-header">
        <span className="exercise-name">🤖 AI สร้างโปรแกรม</span>
        <span className="spacer" />
        <button className="btn" onClick={() => setOpen(false)}>
          ปิด
        </button>
      </div>

      {errorMsg && <p className="login-error">⚠️ {errorMsg}</p>}
      {loading && <p className="program-generator-reply">กำลังคิดโปรแกรมให้... (อาจใช้เวลาสักครู่)</p>}
      {reply && !pending && !loading && <p className="program-generator-reply">{reply}</p>}

      {pending && (
        <div className="program-generator-preview">
          <h3>{pending.name}</h3>
          {pending.goal && <p className="program-goal">{pending.goal}</p>}
          {pending.reasoning && <p className="program-generator-reasoning">💡 {pending.reasoning}</p>}
          {pending.days.map((day) => (
            <div key={day.day_number} className="card program-day-card">
              <strong>{day.name}</strong>
              {day.exercises.map((ex, i) => (
                <div key={i} className="today-program-preview-row program-generator-ex-row">
                  <span>{ex.exercise_name}</span>
                  <span className="chip">
                    {ex.target_sets}×{ex.target_reps} {ex.target_weight ? `@${ex.target_weight}kg` : ''} พัก{ex.target_rest_seconds}s
                  </span>
                </div>
              ))}
            </div>
          ))}
          <button className="btn btn-primary today-start-btn" onClick={confirmProgram} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '✓ ยืนยันบันทึกโปรแกรมนี้'}
          </button>
        </div>
      )}

      <div className="program-generator-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && send()}
          placeholder="เช่น อยากเพิ่มกล้ามเนื้อ เล่นได้ 4 วัน/สัปดาห์ มีดัมเบลกับบาร์เบล"
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
          {loading ? '...' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}
