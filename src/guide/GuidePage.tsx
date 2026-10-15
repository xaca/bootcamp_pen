import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LangToggle } from '../components/LangToggle'

/**
 * Soft lock so students don't wander into the staff instructions. It is NOT security: the
 * password is in the app's code. Never put secrets (like the teacher invite link) in this guide.
 */
const GUIDE_PASSWORD = '1041'
const UNLOCK_KEY = 'orbit.guide'

const MENTOR_SECTIONS = ['enter', 'createClass', 'duringClass', 'studentFaq', 'endOfClass'] as const
const ADMIN_SECTIONS = ['beforeBootcamp', 'duringBootcamp', 'afterBootcamp'] as const

function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

/** /guide — instructions for teacher mentors and the bootcamp admin (EN/ES). */
export function GuidePage() {
  const { t } = useTranslation()
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password.trim() !== GUIDE_PASSWORD) return setWrong(true)
    try {
      sessionStorage.setItem(UNLOCK_KEY, '1')
    } catch {
      // stays unlocked until the page is closed
    }
    setUnlocked(true)
  }

  if (!unlocked) {
    return (
      <main className="centered">
        <form className="card join" onSubmit={submit}>
          <div className="join__top">
            <Link to="/" className="brand">
              🪐 Orbit
            </Link>
            <LangToggle />
          </div>
          <h1>{t('guide.title')}</h1>
          <p className="hint">{t('guide.lockedIntro')}</p>
          <label className="field">
            <span>{t('guide.password')}</span>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setWrong(false)
              }}
            />
          </label>
          {wrong && <p className="error">{t('guide.wrongPassword')}</p>}
          <button className="button button--primary" disabled={!password.trim()}>
            {t('guide.open')}
          </button>
        </form>
      </main>
    )
  }

  const renderSection = (group: 'mentors' | 'admin', section: string) => (
    <section key={section} className="card guide__section">
      <h3>{t(`guide.${group}.${section}.title`)}</h3>
      <ol>
        {(t(`guide.${group}.${section}.steps`, { returnObjects: true }) as string[]).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  )

  return (
    <div className="guide">
      <header className="topbar">
        <div className="topbar__left">
          <Link to="/" className="brand">
            🪐 Orbit
          </Link>
          <span className="topbar__class">{t('guide.title')}</span>
        </div>
        <div className="topbar__right">
          <Link to="/teacher" className="button button--primary">
            {t('guide.openDashboard')}
          </Link>
          <LangToggle />
        </div>
      </header>
      <main className="page">
        <p className="hint">{t('guide.intro')}</p>
        <h2>👩‍🏫 {t('guide.mentorsTitle')}</h2>
        {MENTOR_SECTIONS.map((s) => renderSection('mentors', s))}
        <h2>🛠️ {t('guide.adminTitle')}</h2>
        {ADMIN_SECTIONS.map((s) => renderSection('admin', s))}
      </main>
    </div>
  )
}
