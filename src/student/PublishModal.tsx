import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '../components/CopyButton'
import { Modal } from '../components/Modal'
import { QrCode } from '../components/QrCode'
import { isQuotaError, publishProject, type WithId } from '../data/db'
import { isEmptyCode } from '../shared/buildDoc'
import { publishedUrl } from '../shared/files'
import type { ClassDoc, Code, Lang, ProjectDoc } from '../shared/types'

interface Props {
  classDoc: WithId<ClassDoc>
  project: WithId<ProjectDoc>
  code: Code
  studentName: string
  lang: Lang
  save: () => Promise<boolean>
  onPublished: (slug: string) => void
  onClose: () => void
}

type State = { kind: 'working' } | { kind: 'done'; url: string } | { kind: 'error'; message: string }

/** Saves, then publishes a frozen copy of the code and shows the shareable URL. */
export function PublishModal({ classDoc, project, code, studentName, lang, save, onPublished, onClose }: Props) {
  const { t } = useTranslation()
  const [state, setState] = useState<State>(() => {
    if (!classDoc.isOpen) return { kind: 'error', message: t('publish.closed') }
    if (isEmptyCode(code)) return { kind: 'error', message: t('publish.empty') }
    return { kind: 'working' }
  })
  const started = useRef(false)

  useEffect(() => {
    if (started.current || state.kind !== 'working') return
    started.current = true
    ;(async () => {
      try {
        await save()
        const slug = await publishProject(project, code, studentName, classDoc.title, lang)
        onPublished(slug)
        setState({ kind: 'done', url: publishedUrl(slug) })
      } catch (err) {
        setState({ kind: 'error', message: isQuotaError(err) ? t('errors.quota') : t('publish.error') })
      }
    })()
  }, [state.kind, classDoc, project, code, studentName, lang, save, onPublished, t])

  return (
    <Modal title={t('publish.title')} onClose={onClose}>
      {state.kind === 'working' && <p>{t('publish.working')}</p>}
      {state.kind === 'error' && <p className="error">{state.message}</p>}
      {state.kind === 'done' && (
        <div className="publish">
          <p>🎉 {t('publish.done')}</p>
          <div className="url-row">
            <input readOnly value={state.url} onFocus={(e) => e.target.select()} />
            <CopyButton text={state.url} />
            <a className="button" href={state.url} target="_blank" rel="noreferrer">
              {t('common.open')}
            </a>
          </div>
          <QrCode value={state.url} label={t('publish.qr')} />
          <p className="hint">{t('publish.republishHint')}</p>
        </div>
      )}
    </Modal>
  )
}
