import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import WorkoutLog from './WorkoutLog'
import ExerciseLibrary from './ExerciseLibrary'
import './App.css'

type Tab = 'dashboard' | 'log' | 'exercises'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)
  const [tab, setTab] = useState<Tab>('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!checked) return null
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <nav className="top-nav glass">
        <span className="brand">🏋️ Workout Tracker</span>
        <div className="nav-tabs">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
            Dashboard
          </button>
          <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>
            Log Workout
          </button>
          <button className={tab === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}>
            Exercises
          </button>
        </div>
        <span className="spacer" />
        <span className="user-email">{session.user.email}</span>
        <button onClick={() => supabase.auth.signOut()}>ออกจากระบบ</button>
      </nav>
      <main className="app-main">
        {tab === 'dashboard' && <Dashboard session={session} onGoLog={() => setTab('log')} />}
        {tab === 'log' && <WorkoutLog session={session} />}
        {tab === 'exercises' && <ExerciseLibrary session={session} />}
      </main>
    </div>
  )
}

export default App
