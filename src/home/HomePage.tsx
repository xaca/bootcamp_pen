import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { LangToggle } from '../components/LangToggle'
import { readLastClass } from '../shared/lastClass'

/** Normalizes "k7qm4tzp" or "k7qm-4tzp" to "K7QM-4TZP". */
function normalizeCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : input.trim().toUpperCase()
}

/** Welcome page: what Orbit is, a door for students and one for teachers. */
export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [lastClass] = useState(readLastClass)

  const join = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim()) navigate(`/c/${normalizeCode(code)}`)
  }

  return (
    <div className="home">
      <header className="home__top">
        <span className="brand">🪐 Orbit</span>
        <LangToggle />
      </header>

      <main className="home__main">
        <section className="home__intro">
          <h1>{t('home.title')}</h1>
          <p>{t('home.intro')}</p>
        </section>

        <div className="home__doors">
          <section className="card home__door home__door--student">
            <h2>🎒 {t('home.studentTitle')}</h2>
            {lastClass && (
              <Link to={`/c/${lastClass.code}`} className="button button--primary home__continue">
                ▶ {t('home.continue', { title: lastClass.title })}
              </Link>
            )}
            <ol className="home__steps">
              <li>{t('home.step1')}</li>
              <li>
                <form onSubmit={join} className="home__join">
                  <label className="field">
                    <span>{t('home.step2')}</span>
                    <input
                      className="mono"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="K7QM-4TZP"
                      autoCapitalize="characters"
                      aria-label={t('home.codeLabel')}
                    />
                  </label>
                  <button className={`button ${lastClass ? '' : 'button--primary'}`} disabled={!code.trim()}>
                    {t('home.join')}
                  </button>
                </form>
              </li>
              <li>{t('home.step3')}</li>
            </ol>
            <p className="hint">💡 {t('home.sameComputer')}</p>
          </section>

          <div className="home__side">
            <section className="card home__door">
              <h2>👩‍🏫 {t('home.teacherTitle')}</h2>
              <Link to="/teacher" className="button button--primary">
                {t('home.openDashboard')} →
              </Link>
              <p className="hint">{t('home.teacherFirstTime')}</p>
            </section>
            <section className="card home__door">
              <h2>📘 {t('home.guideTitle')}</h2>
              <p className="hint">{t('home.guideText')}</p>
              <Link to="/guide" className="button">
                {t('home.guide')} →
              </Link>
            </section>
          </div>
        </div>
      </main>

      <footer className="home__footer hint">{t('home.footer')}</footer>
    </div>
  )
}
