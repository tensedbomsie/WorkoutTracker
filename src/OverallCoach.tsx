import { useState } from 'react'
import { supabase } from './lib/supabase'

type ChatPart = { text?: string; functionCall?: unknown; functionResponse?: unknown }
type ChatTurn = { role: 'user' | 'model'; parts: ChatPart[] }
type Message = { role: 'user' | 'model'; text: string }

const SUGGESTIONS = ['ตอนนี้ไปได้ดีมั้ย', 'มีอะไรที่ควรปรับบ้าง', 'เทียบกับเป้าหมายไปถึงไหนแล้ว']

export default function OverallCoach() {
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const send = async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || loading) return
    setMessages((m) => [...m, { role: 'user', text: userText }])
    setInput('')
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('overall-coach', {
        body: { message: userText, history },
      })
      if (error) throw error
      setHistory(data.history ?? [])
      setMessages((m) => [...m, { role: 'model', text: data.reply ?? '' }])
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>🧑‍⚕️ โค้ชส่วนตัว</h1>
      </div>
      <div className="card coach-chat-panel">
        {messages.length === 0 ? (
          <div className="coach-chat-empty">
            <p className="empty-state">
              ถามอะไรก็ได้เกี่ยวกับความคืบหน้าของคุณ — โค้ชมองเห็นโปรแกรมที่ทำอยู่ ประวัติเทรนจริง เทรนด์น้ำหนัก/BMI
              และผลเทียบรูปก่อน-หลังล่าสุดพร้อมกันทั้งหมด
            </p>
            <div className="coach-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn chip-btn" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="coach-chat-log">
            {messages.map((m, i) => (
              <div key={i} className={`coach-chat-msg coach-chat-msg-${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="coach-chat-msg coach-chat-msg-model coach-chat-loading">กำลังดูข้อมูล...</div>
            )}
          </div>
        )}

        {errorMsg && <p className="login-error">⚠️ {errorMsg}</p>}

        <div className="program-generator-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="ถามโค้ชได้เลย..."
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()}>
            {loading ? '...' : 'ส่ง'}
          </button>
        </div>
      </div>
    </div>
  )
}
