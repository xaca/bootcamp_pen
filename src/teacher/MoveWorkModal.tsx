import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../components/Modal'
import { moveWork } from '../data/db'
import type { StudentRow } from './ClassDetail'

interface Props {
  classId: string
  from: StudentRow
  rows: StudentRow[]
  onClose: () => void
}

/**
 * For students who lost their anonymous uid (cleared browser, other computer):
 * they join again, then the teacher moves the old work to the new entry.
 */
export function MoveWorkModal({ classId, from, rows, onClose }: Props) {
  const { t } = useTranslation()
  const targets = rows.filter((r) => r.student.id !== from.student.id && r.project)
  const [targetUid, setTargetUid] = useState(targets[0]?.student.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const move = async () => {
    if (!from.project || !targetUid) return
    setBusy(true)
    try {
      await moveWork(classId, from.project, targetUid)
      onClose()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <Modal title={t('move.title', { name: from.student.displayName })} onClose={onClose}>
      <p>{t('move.explain')}</p>
      <label className="field">
        <span>{t('move.target')}</span>
        <select value={targetUid} onChange={(e) => setTargetUid(e.target.value)}>
          {targets.map((r) => (
            <option key={r.student.id} value={r.student.id}>
              {r.student.displayName}
            </option>
          ))}
        </select>
      </label>
      <p className="warning">{t('move.warning', { from: from.student.displayName })}</p>
      {error && <p className="error">{t('move.error')}</p>}
      <div className="button-row">
        <button className="button button--primary" disabled={busy || !targetUid} onClick={move}>
          {t('move.confirm')}
        </button>
        <button className="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </Modal>
  )
}
