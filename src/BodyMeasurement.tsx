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
  height: '',
  body_fat: '',
  waist: '',
  chest: '',
  arm: '',
  thigh: '',
})

function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null
  const meters = heightCm / 100
  return weightKg / (meters * meters)
}

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'ต่ำกว่าเกณฑ์'
  if (bmi < 23) return 'ปกติ'
  if (bmi < 25) return 'ท้วม'
  if (bmi < 30) return 'อ้วนระดับ 1'
  return 'อ้วนระดับ 2'
}

export default function BodyMeasurementPage({ session }: { session: Session }) {
  const [entries, setEntries] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm())
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .order('measured_at', { ascending: false })
    const rows = (data as BodyMeasurement[]) ?? []
    setEntries(rows)
    // Pre-fill height from the most recent entry that had one — height
    // barely changes for adults, no reason to force retyping it every time.
    const lastHeight = rows.find((r) => r.height != null)?.height
    if (lastHeight) setForm((f) => ({ ...f, height: String(lastHeight) }))
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
      height: toNum(form.height),
      body_fat: toNum(form.body_fat),
      waist: toNum(form.waist),
      chest: toNum(form.chest),
      arm: toNum(form.arm),
      thigh: toNum(form.thigh),
    })
    setForm((f) => ({ ...emptyForm(), height: f.height }))
    load()
  }

  const deleteEntry = async (id: string) => {
    if (!window.confirm('ลบรายการนี้ใช่ไหม?')) return
    await supabase.from('body_measurements').delete().eq('id', id)
    setEntries((e) => e.filter((x) => x.id !== id))
  }

  const analyzeTrend = async () => {
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const { data, error } = await supabase.functions.invoke('analyze-body-trend', {
        body: { entries: chronological },
      })
      if (error) throw error
      setAnalysis(data.analysis || 'วิเคราะห์ไม่ได้ ลองใหม่อีกครั้ง')
    } catch {
      setAnalysis('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setAnalyzing(false)
    }
  }

  const chronological = [...entries].reverse()
  const latest = entries[0]
  const latestBmi = latest ? computeBmi(latest.weight, latest.height) : null

  return (
    <div>
      <h1>Body Measurement</h1>

      <form className="card exercise-form" onSubmit={addEntry}>
        <div className="form-grid">
          <input
            type="number"
            step="0.1"
            placeholder="Height (cm)"
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
          />
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

      {latestBmi != null && (
        <div className="card bmi-card">
          <span className="bmi-value">{latestBmi.toFixed(1)}</span>
          <div>
            <div className="bmi-label-text">BMI ล่าสุด</div>
            <div className="chip">{bmiLabel(latestBmi)}</div>
          </div>
        </div>
      )}

      {entries.length >= 2 && (
        <div className="card body-analysis-card">
          <button className="btn btn-primary" onClick={analyzeTrend} disabled={analyzing}>
            {analyzing ? 'กำลังวิเคราะห์...' : '🤖 ให้ AI วิเคราะห์เทรนด์'}
          </button>
          {analysis && <p className="body-analysis-text">{analysis}</p>}
        </div>
      )}

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
