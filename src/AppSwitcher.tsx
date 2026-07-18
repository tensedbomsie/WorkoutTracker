import { useState } from 'react'

const APPS = [
  { name: 'Storyboard', icon: '🕸️', url: 'https://tensedbomsie.github.io/Storyboard/' },
  { name: 'Food Diary', icon: '🍽️', url: 'https://tensedbomsie.github.io/FoodDiary/' },
  { name: 'Workout Tracker', icon: '🏋️', url: 'https://tensedbomsie.github.io/WorkoutTracker/' },
  { name: 'Movie Hub', icon: '🎬', url: 'https://tensedbomsie.github.io/MovieHub/' },
  { name: 'Money Diary', icon: '💰', url: 'https://tensedbomsie.github.io/MoneyDiary/' },
]

export default function AppSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="menu-toggle" title="สลับไปฮับอื่น" onClick={() => setOpen(true)}>
        ☰
      </button>
      {open && (
        <div className="sidebar-backdrop" onClick={() => setOpen(false)}>
          <div className="sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <span>สลับไปฮับอื่น</span>
              <button className="sidebar-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <a className="sidebar-item" href="https://tensedbomsie.github.io/SatoruHUB/">
              <span className="sidebar-item-icon">🏠</span>
              <span>Satoru HUB</span>
            </a>
            {APPS.map((app) => (
              <a
                key={app.name}
                className={`sidebar-item${app.name === current ? ' active' : ''}`}
                href={app.url}
              >
                <span className="sidebar-item-icon">{app.icon}</span>
                <span>{app.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
