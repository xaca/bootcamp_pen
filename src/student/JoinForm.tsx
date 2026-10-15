import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LangToggle } from '../components/LangToggle'
import { isQuotaError, joinClass, type WithId } from '../data/db'
import { currentLang } from '../i18n'
import type { ClassDoc } from '../shared/types'

export function JoinForm({ classDoc, uid }: { classDoc: WithId<ClassDoc>; uid: string }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const displayName = name.trim().slice(0, 40)
    if (!displayName) return
    setBusy(true)
    setError(null)
    try {
      await joinClass(classDoc.id, classDoc.teacherId, uid, displayName, currentLang())
    } catch (err) {
      setError(isQuotaError(err) ? t('errors.quota') : t('errors.join'))
      setBusy(false)
    }
  }

  return (
    <main className="centered">
      <form className="card join" onSubmit={submit}>
        <div className="join__top">
          <span className="brand">🪐 Orbit</span>
          <LangToggle />
        </div>
        <h1>{classDoc.title}</h1>
        <label className="field">
          <span>{t('join.nameLabel')}</span>
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('join.namePlaceholder')}
          />
        </label>
        <p className="hint">{t('join.pairsHint')}</p>
        <p className="hint">{t('join.returningHint')}</p>
        {error && <p className="error">{error}</p>}
        <button className="button button--primary" disabled={busy || !name.trim()}>
          {busy ? t('common.loading') : t('join.start')}
        </button>
      </form>
    </main>
  )
}
