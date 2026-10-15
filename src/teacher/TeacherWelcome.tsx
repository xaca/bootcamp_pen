import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { parseAccessKey } from '../shared/slug'
import { GateCard } from './GateCard'

/** Shown at /teacher when this browser isn't signed in: open (or paste) your personal link. */
export function TeacherWelcome({ onLink, linkError }: { onLink: (accessKey: string) => void; linkError: boolean }) {
  const { t } = useTranslation()
  const [pasted, setPasted] = useState('')
  const [invalid, setInvalid] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const key = parseAccessKey(pasted)
    setInvalid(!key)
    if (key) onLink(key)
  }

  return (
    <GateCard title={t('teacher.title')}>
      <ol className="welcome-steps">
        <li>{t('teacherAccess.howToEnter')}</li>
        <li>{t('teacherAccess.firstTime')}</li>
      </ol>
      {linkError && <p className="error">{t('teacherAccess.invalidLink')}</p>}
      <form className="join__form" onSubmit={submit}>
        <label className="field">
          <span>{t('teacherAccess.pasteLabel')}</span>
          <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="https://…/t/…" autoComplete="off" />
        </label>
        {invalid && <p className="error">{t('teacherAccess.notALink')}</p>}
        <button className="button button--primary" disabled={!pasted.trim()}>
          {t('teacherAccess.enter')}
        </button>
      </form>
    </GateCard>
  )
}
