import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodePanel } from '../components/CodePanel'
import { Modal } from '../components/Modal'
import { Preview } from '../components/Preview'
import type { WithId } from '../data/db'
import { ALL_FILES } from '../shared/files'
import type { FileKey, ProjectDoc } from '../shared/types'

/** Read-only view of a student's latest saved code, updated live. */
export function StudentCodeModal({ project, onClose }: { project: WithId<ProjectDoc>; onClose: () => void }) {
  const { t } = useTranslation()
  const [active, setActive] = useState<FileKey>('html')
  const { html, css, js } = project
  const code = useMemo(() => ({ html, css, js }), [html, css, js])
  return (
    <Modal title={t('teacher.codeOf', { name: project.studentName })} onClose={onClose} wide>
      <div className="code-viewer">
        <div className="code-viewer__preview">
          <Preview code={code} />
        </div>
        <CodePanel code={code} files={ALL_FILES} active={active} onActiveChange={setActive} readOnly />
      </div>
    </Modal>
  )
}
