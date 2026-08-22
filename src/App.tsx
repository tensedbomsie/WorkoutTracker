import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import WorkoutLog from './WorkoutLog'
import ExerciseLibrary from './ExerciseLibrary'
import MuscleVolume from './MuscleVolume'
import CalendarView from './Calendar'
import ProgressPhotos from './ProgressPhotos'
import BodyMeasurementPage from './BodyMeasurement'
import PRTracker from './PRTracker'
import Statistics from './Statistics'
import AppSwitcher from './AppSwitcher'
import TodaysProgram from './TodaysProgram'
import ProgramBuilder from './ProgramBuilder'
import OverallCoach from './OverallCoach'
import './App.css'

type Tab =
  | 'dashboard'
  | 'today'
  | 'programs'
  | 'coach'
  | 'log'
  | 'exercises'
  | 'volume'
  | 'calendar'
  | 'photos'
  | 'measurements'
  | 'pr'
  | 'stats'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'today', label: '🎯 วันนี้' },
  { id: 'programs', label: 'โปรแกรม' },
  { id: 'coach', label: '🧑‍⚕️ โค้ช' },
  { id: 'log', label: 'Log Workout' },
  { id: 'exercises', label: 'Exercises' },
  { id: 'volume', label: 'Volume' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'photos', label: 'Photos' },
  { id: 'measurements', label: 'Measurements' },
  { id: 'pr', label: 'PR Tracker' },
  { id: 'stats', label: 'Stats' },
]

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

    // When embedded in the Satoru HUB overlay, the Hub hands off its own
    // (same Supabase project) session so this app doesn't ask to log in again.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source === 'satoru-hub' && e.data?.type === 'session' && e.data.session) {
        supabase.auth.setSession({
          access_token: e.data.session.access_token,
          refresh_token: e.data.session.refresh_token,
        })
      }
    }
    window.addEventListener('message', onMessage)

    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener('message', onMessage)
    }
  }, [])

  if (!checked) return null
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <nav className="top-nav glass">
        <a className="hub-link" href="https://tensedbomsie.github.io/SatoruHUB/" title="กลับไป Satoru HUB">
          🏠
        </a>
        <AppSwitcher current="Workout Tracker" />
        <span className="brand">🏋️ Workout Tracker</span>
        <div className="nav-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <span className="user-email">{session.user.email}</span>
        <button onClick={() => supabase.auth.signOut()}>ออกจากระบบ</button>
      </nav>
      <main className="app-main fade-in" key={tab}>
        {tab === 'dashboard' && <Dashboard session={session} onGoLog={() => setTab('log')} />}
        {tab === 'today' && <TodaysProgram session={session} />}
        {tab === 'programs' && <ProgramBuilder session={session} />}
        {tab === 'coach' && <OverallCoach />}
        {tab === 'log' && <WorkoutLog session={session} />}
        {tab === 'exercises' && <ExerciseLibrary session={session} />}
        {tab === 'volume' && <MuscleVolume session={session} />}
        {tab === 'calendar' && <CalendarView session={session} />}
        {tab === 'photos' && <ProgressPhotos session={session} />}
        {tab === 'measurements' && <BodyMeasurementPage session={session} />}
        {tab === 'pr' && <PRTracker session={session} />}
        {tab === 'stats' && <Statistics session={session} />}
      </main>
    </div>
  )
}

export default App
