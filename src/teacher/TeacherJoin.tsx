import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createTeacher, isQuotaError, WrongInviteError } from '../data/db'
import type { TeacherSession } from '../shared/types'
import { GateCard } from './GateCard'
import { MyLink } from './MyLink'

interface Props {
  uid: string
  registrationCode: string
  /** Someone already signed in on this computer. */
  current: TeacherSession | null
  onUseCurrent: () => void
  onSwitchUser: () => Promise<void>
  onDone: (session: TeacherSession) => void
}

/** Organizer's invite link: the teacher only types their name. */
export function TeacherJoin({ uid, registrationCode, current, onUseCurrent, onSwitchUser, onDone }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<TeacherSession | null>(null)

  if (created) {
    return (
      <GateCard title={t('teacherAccess.keepTitle', { name: created.name })}>
        <MyLink accessKey={created.accessKey} />
        <button className="button button--primary" onClick={() => onDone(created)}>
          {t('teacherAccess.continue')}
        </button>
      </GateCard>
    )
  }

  if (current) {
    return (
      <GateCard title={t('teacherAccess.joinTitle')}>
        <p>{t('teacherAccess.alreadyIn', { name: current.name })}</p>
        <button className="button button--primary" onClick={onUseCurrent}>
          {t('teacherAccess.goToDashboard', { name: current.name })}
        </button>
        <button className="button" onClick={() => void onSwitchUser()}>
          {t('teacherAccess.someoneElse')}
        </button>
      </GateCard>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const teacherName = name.trim().slice(0, 40)
    if (!teacherName) return
    setBusy(true)
    setError(null)
    try {
      setCreated(await createTeacher(uid, teacherName, registrationCode))
    } catch (err) {
      setError(
        err instanceof WrongInviteError ? t('teacherAccess.wrongInvite') : isQuotaError(err) ? t('errors.quota') : t('teacherAccess.error'),
      )
      setBusy(false)
    }
  }

  return (
    <GateCard title={t('teacherAccess.joinTitle')}>
      <form className="join__form" onSubmit={submit}>
        <label className="field">
          <span>{t('teacherAccess.name')}</span>
          <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="María" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button button--primary" disabled={busy || !name.trim()}>
          {busy ? t('common.loading') : t('teacherAccess.start')}
        </button>
      </form>
    </GateCard>
  )
}
