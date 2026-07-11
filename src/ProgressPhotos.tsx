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
        <label className="btn btn-primary upload-label">
          {uploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูป'}
          <input type="file" accept="image/*" hidden onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

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
              {dayPhotos.map((p) => (
                <div key={p.id} className="photo-card card">
                  <img src={p.image_url} alt={p.angle} />
                  <div className="photo-card-footer">
                    <span className="chip">{p.angle}</span>
                    <button className="set-delete" onClick={() => deletePhoto(p.id)}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
