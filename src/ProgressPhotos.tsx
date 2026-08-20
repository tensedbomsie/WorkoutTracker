import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { PhotoAngle, ProgressPhoto } from './types'

const ANGLES: PhotoAngle[] = ['Front', 'Side', 'Back']

export default function ProgressPhotos({ session }: { session: Session }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [angle, setAngle] = useState<PhotoAngle>('Front')
  const [filter, setFilter] = useState<PhotoAngle | 'All'>('All')

  const [compareMode, setCompareMode] = useState(false)
  const [beforePhoto, setBeforePhoto] = useState<ProgressPhoto | null>(null)
  const [afterPhoto, setAfterPhoto] = useState<ProgressPhoto | null>(null)
  const [goal, setGoal] = useState('')
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const pickForCompare = (p: ProgressPhoto) => {
    if (beforePhoto?.id === p.id) return setBeforePhoto(null)
    if (afterPhoto?.id === p.id) return setAfterPhoto(null)
    if (!beforePhoto) return setBeforePhoto(p)
    if (!afterPhoto) return setAfterPhoto(p)
    // both slots full — restart selection with this photo as the new "before"
    setBeforePhoto(p)
    setAfterPhoto(null)
  }

  const runComparison = async () => {
    if (!beforePhoto || !afterPhoto) return
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const { data, error } = await supabase.functions.invoke('analyze-progress-photos', {
        body: { before_url: beforePhoto.image_url, after_url: afterPhoto.image_url, goal: goal || undefined },
      })
      if (error) throw error
      setAnalysis(data.analysis || 'วิเคราะห์ไม่ได้ ลองใหม่อีกครั้ง')
      if (data.analysis) {
        await supabase.from('progress_photo_analyses').insert({
          owner: session.user.id,
          before_photo_id: beforePhoto.id,
          after_photo_id: afterPhoto.id,
          goal: goal || null,
          analysis: data.analysis,
        })
      }
    } catch {
      setAnalysis('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setAnalyzing(false)
    }
  }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .order('taken_at', { ascending: false })
    setPhotos((data as ProgressPhoto[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const path = `${session.user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('progress-photos').upload(path, file)
    if (!error) {
      const { data: pub } = supabase.storage.from('progress-photos').getPublicUrl(path)
      await supabase.from('progress_photos').insert({
        owner: session.user.id,
        angle,
        image_url: pub.publicUrl,
      })
      load()
    }
    setUploading(false)
  }

  const deletePhoto = async (id: string) => {
    if (!window.confirm('ลบรูปนี้ใช่ไหม?')) return
    await supabase.from('progress_photos').delete().eq('id', id)
    setPhotos((p) => p.filter((x) => x.id !== id))
  }

  const filtered = filter === 'All' ? photos : photos.filter((p) => p.angle === filter)
  const groups = filtered.reduce<Record<string, ProgressPhoto[]>>((acc, p) => {
    const day = new Date(p.taken_at).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    acc[day] = acc[day] ?? []
    acc[day].push(p)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <h1>Progress Photos</h1>
        <div className="program-header-actions">
          <button
            className={`btn${compareMode ? ' btn-primary' : ''}`}
            onClick={() => {
              setCompareMode((v) => !v)
              setBeforePhoto(null)
              setAfterPhoto(null)
              setAnalysis(null)
            }}
          >
            🤖 เปรียบเทียบรูป
          </button>
          <label className="btn btn-primary upload-label">
            {uploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูป'}
            <input type="file" accept="image/*" hidden onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {compareMode && (
        <div className="card photo-compare-panel">
          <p className="photo-compare-hint">
            คลิกรูปด้านล่าง: รูปแรกที่กด = "ก่อน", รูปที่สอง = "ตอนนี้"
          </p>
          <div className="photo-compare-slots">
            <div className="photo-compare-slot">
              <span className="today-input-label">ก่อน</span>
              {beforePhoto ? <img src={beforePhoto.image_url} alt="before" /> : <div className="photo-compare-empty">ยังไม่เลือก</div>}
            </div>
            <div className="photo-compare-slot">
              <span className="today-input-label">ตอนนี้</span>
              {afterPhoto ? <img src={afterPhoto.image_url} alt="after" /> : <div className="photo-compare-empty">ยังไม่เลือก</div>}
            </div>
          </div>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="เป้าหมาย (ไม่บังคับ) เช่น อยากกลับไปให้เหมือนก่อนหน้า"
          />
          <button
            className="btn btn-primary today-start-btn"
            onClick={runComparison}
            disabled={!beforePhoto || !afterPhoto || analyzing}
          >
            {analyzing ? 'กำลังวิเคราะห์...' : '🤖 วิเคราะห์การเปลี่ยนแปลง'}
          </button>
          {analysis && <p className="body-analysis-text">{analysis}</p>}
        </div>
      )}

      <div className="filter-bar">
        <select value={angle} onChange={(e) => setAngle(e.target.value as PhotoAngle)}>
          {ANGLES.map((a) => (
            <option key={a} value={a}>
              มุม: {a}
            </option>
          ))}
        </select>
        <span className="spacer" />
        {(['All', ...ANGLES] as const).map((a) => (
          <button
            key={a}
            className={`btn filter-toggle${filter === a ? ' active' : ''}`}
            onClick={() => setFilter(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty-state">กำลังโหลด...</p>
      ) : Object.keys(groups).length === 0 ? (
        <p className="empty-state">ยังไม่มีรูป Progress เลย</p>
      ) : (
        Object.entries(groups).map(([day, dayPhotos]) => (
          <div key={day}>
            <h2 className="section-title">{day}</h2>
            <div className="photo-grid">
              {dayPhotos.map((p) => {
                const pickedLabel = beforePhoto?.id === p.id ? 'ก่อน' : afterPhoto?.id === p.id ? 'ตอนนี้' : null
                return (
                  <div
                    key={p.id}
                    className={`photo-card card${pickedLabel ? ' photo-card-picked' : ''}`}
                    onClick={compareMode ? () => pickForCompare(p) : undefined}
                    style={compareMode ? { cursor: 'pointer' } : undefined}
                  >
                    <img src={p.image_url} alt={p.angle} />
                    {pickedLabel && <span className="chip photo-picked-badge">{pickedLabel}</span>}
                    <div className="photo-card-footer">
                      <span className="chip">{p.angle}</span>
                      {!compareMode && (
                        <button className="set-delete" onClick={() => deletePhoto(p.id)}>
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
