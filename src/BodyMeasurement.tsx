import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { BodyMeasurement } from './types'
import Sparkline from './Sparkline'

const METRICS: { key: keyof BodyMeasurement; label: string; unit: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'body_fat', label: 'Body Fat', unit: '%' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' },
]

const emptyForm = () => ({
  weight: '',
  body_fat: '',
  waist: '',
  chest: '',
  arm: '',
  thigh: '',
})

export default function BodyMeasurementPage({ session }: { session: Session }) {
  const [entries, setEntries] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm())

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .order('measured_at', { ascending: false })
    setEntries((data as BodyMeasurement[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const toNum = (v: string) => (v === '' ? null : Number(v))
    await supabase.from('body_measurements').insert({
      owner: session.user.id,
      weight: toNum(form.weight),
      body_fat: toNum(form.body_fat),
      waist: toNum(form.waist),
      chest: toNum(form.chest),
      arm: toNum(form.arm),
      thigh: toNum(form.thigh),
    })
    setForm(emptyForm())
    load()
  }

  const deleteEntry = async (id: string) => {
    if (!window.confirm('ลบรายการนี้ใช่ไหม?')) return
    await supabase.from('body_measurements').delete().eq('id', id)
    setEntries((e) => e.filter((x) => x.id !== id))
  }

  const chronological = [...entries].reverse()

  return (
    <div>
      <h1>Body Measurement</h1>

      <form className="card exercise-form" onSubmit={addEntry}>
        <div className="form-grid">
          {METRICS.map((m) => (
            <input
              key={m.key}
              type="number"
              step="0.1"
              placeholder={`${m.label} (${m.unit})`}
              value={form[m.key as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [m.key]: e.target.value })}
            />
          ))}
        </div>
        <button type="submit" className="btn btn-primary">
          + บันทึกวันนี้
        </button>
      </form>

      {loading ? (
        <p className="empty-state">กำลังโหลด...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">ยังไม่มีข้อมูลการวัดร่างกายเลย</p>
      ) : (
        <>
          {METRICS.map((m) => {
            const points = chronological
              .filter((e) => e[m.key] != null)
              .map((e) => ({ x: e.measured_at, y: Number(e[m.key]) }))
            if (points.length < 2) return null
            return (
              <div key={m.key} className="card measurement-graph-card">
                <h2 className="section-title" style={{ margin: 0 }}>
                  {m.label} ({m.unit})
                </h2>
                <Sparkline points={points} />
              </div>
            )
          })}

          <h2 className="section-title">ประวัติการวัด</h2>
          <div className="measurement-list">
            {entries.map((e) => (
              <div key={e.id} className="card measurement-row">
                <span className="measurement-date">
                  {new Date(e.measured_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="measurement-values">
                  {METRICS.map(
                    (m) =>
                      e[m.key] != null && (
                        <span key={m.key} className="chip">
                          {m.label}: {e[m.key]} {m.unit}
                        </span>
                      ),
                  )}
                </div>
                <button className="set-delete" onClick={() => deleteEntry(e.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
