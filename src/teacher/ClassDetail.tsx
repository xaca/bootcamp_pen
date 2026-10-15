import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { CopyButton } from '../components/CopyButton'
import { QrCode } from '../components/QrCode'
import {
  removeStudent,
  unpublish,
  updateClass,
  watchClass,
  watchClassProjects,
  watchStudents,
  type WithId,
} from '../data/db'
import { publishedUrl } from '../shared/files'
import type { AiTool, ClassDoc, Lang, ProjectDoc, StudentDoc } from '../shared/types'
import { MoveWorkModal } from './MoveWorkModal'
import { ACTIVE_MS, lineCounts, timeAgo } from './progress'
import { StudentCodeModal } from './StudentCodeModal'
import { useNow } from './useNow'

type SortBy = 'activity' | 'name'

export interface StudentRow {
  student: WithId<StudentDoc>
  project?: WithId<ProjectDoc>
}

export function ClassDetail({ teacherId }: { teacherId: string }) {
  const { t, i18n } = useTranslation()
  const classId = useParams().classId ?? ''
  const [classDoc, setClassDoc] = useState<WithId<ClassDoc> | null | undefined>(undefined)
  const [students, setStudents] = useState<WithId<StudentDoc>[]>([])
  const [projects, setProjects] = useState<WithId<ProjectDoc>[]>([])
  const [viewing, setViewing] = useState<StudentRow | null>(null)
  const [moving, setMoving] = useState<StudentRow | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('activity')
  const now = useNow(30_000)

  useEffect(() => watchClass(classId, setClassDoc, () => setClassDoc(null)), [classId])
  useEffect(() => watchStudents(classId, setStudents), [classId])
  useEffect(() => watchClassProjects(classId, teacherId, setProjects), [classId, teacherId])

  if (classDoc === undefined) return <main className="page">{t('common.loading')}</main>
  if (classDoc === null || classDoc.teacherId !== teacherId) {
    return (
      <main className="page">
        <p>{t('teacher.classNotFound')}</p>
        <Link to="/teacher">{t('common.back')}</Link>
      </main>
    )
  }

  const joinUrl = `${window.location.origin}/c/${classDoc.id}`
  const savedAt = (row: StudentRow) => row.project?.updatedAt?.toMillis() ?? 0
  const rows: StudentRow[] = students
    .map((student) => ({ student, project: projects.find((p) => p.ownerUid === student.id) }))
    .sort((a, b) =>
      sortBy === 'activity' ? savedAt(b) - savedAt(a) : a.student.displayName.localeCompare(b.student.displayName),
    )
  const activeCount = rows.filter((row) => savedAt(row) && now - savedAt(row) < ACTIVE_MS).length
  const update = (changes: Partial<ClassDoc>) => void updateClass(classDoc.id, changes)

  const confirmRemove = (row: StudentRow) => {
    if (window.confirm(t('teacher.removeConfirm', { name: row.student.displayName }))) {
      void removeStudent(classDoc.id, row.student.id, row.project)
    }
  }

  const confirmUnpublish = (project: WithId<ProjectDoc>) => {
    if (window.confirm(t('teacher.unpublishConfirm', { name: project.studentName }))) void unpublish(project)
  }

  return (
    <main className="page">
      <Link to="/teacher" className="link-button">
        ← {t('teacher.myClasses')}
      </Link>

      <section className="card class-header">
        <div>
          <input
            className="class-header__title"
            defaultValue={classDoc.title}
            maxLength={60}
            aria-label={t('teacher.classTitle')}
            onBlur={(e) => {
              const title = e.target.value.trim()
              if (title && title !== classDoc.title) update({ title })
            }}
          />
          <p className="hint">{t('teacher.joinHint')}</p>
          <div className="join-code mono">{classDoc.id}</div>
          <div className="url-row">
            <input readOnly value={joinUrl} onFocus={(e) => e.target.select()} />
            <CopyButton text={joinUrl} />
            <button className="button" onClick={() => setShowQr((s) => !s)}>
              QR
            </button>
          </div>
          {showQr && <QrCode value={joinUrl} size={240} label={t('teacher.joinQr')} />}
        </div>

        <div className="class-settings">
          <label className="switch">
            <input type="checkbox" checked={classDoc.isOpen} onChange={(e) => update({ isOpen: e.target.checked })} />
            <span>{classDoc.isOpen ? t('teacher.openLabel') : t('teacher.closedLabel')}</span>
          </label>

          <div className="form-grid">
            <label className="field">
              <span>{t('teacher.aiTool')}</span>
              <select value={classDoc.aiTool} onChange={(e) => update({ aiTool: e.target.value as AiTool })}>
                <option value="gemini">Gemini</option>
                <option value="chatgpt">ChatGPT</option>
              </select>
            </label>
            <label className="field">
              <span>{t('teacher.defaultLang')}</span>
              <select value={classDoc.defaultLang} onChange={(e) => update({ defaultLang: e.target.value as Lang })}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="students-header">
          <h2>
            {t('teacher.students')} ({rows.length})
            {activeCount > 0 && <span className="hint"> · {t('teacher.activeCount', { count: activeCount })}</span>}
          </h2>
          <label className="students-header__sort">
            <span className="hint">{t('teacher.sortBy')}</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="activity">{t('teacher.sortActivity')}</option>
              <option value="name">{t('teacher.sortName')}</option>
            </select>
          </label>
        </div>
        {rows.length === 0 && <p className="hint">{t('teacher.noStudents')}</p>}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="students">
              <thead>
                <tr>
                  <th>{t('teacher.student')}</th>
                  <th>{t('teacher.lastSave')}</th>
                  <th>{t('teacher.progress')}</th>
                  <th>{t('teacher.page')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { student, project } = row
                  const saved = project?.updatedAt?.toDate()
                  const active = saved !== undefined && now - saved.getTime() < ACTIVE_MS
                  const lines = project ? lineCounts(project) : null
                  return (
                    <tr key={student.id}>
                      <td>
                        <span
                          className={`activity-dot ${active ? 'activity-dot--active' : ''}`}
                          title={active ? t('teacher.activeNow') : undefined}
                          aria-label={active ? t('teacher.activeNow') : undefined}
                        />
                        <strong>{student.displayName}</strong>
                        {project?.lastChangeSource === 'ai' && <span className="tag">✨ AI</span>}
                      </td>
                      <td title={saved?.toLocaleString(i18n.language)}>{timeAgo(saved, now, i18n.language, t)}</td>
                      <td className="lines">
                        {lines ? (
                          <span title={t('teacher.linesHint')}>
                            HTML {lines.html} · CSS {lines.css} · JS {lines.js}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {project?.publishedSlug ? (
                          <a href={publishedUrl(project.publishedSlug)} target="_blank" rel="noreferrer">
                            {t('teacher.viewPage')} ↗
                          </a>
                        ) : (
                          <span className="hint">—</span>
                        )}
                      </td>
                      <td className="row-actions">
                        {project && (
                          <button className="link-button" onClick={() => setViewing(row)}>
                            {t('teacher.viewCode')}
                          </button>
                        )}
                        {project?.publishedSlug && (
                          <button className="link-button" onClick={() => confirmUnpublish(project)}>
                            {t('teacher.unpublish')}
                          </button>
                        )}
                        {project && rows.length > 1 && (
                          <button className="link-button" onClick={() => setMoving(row)}>
                            {t('teacher.moveWork')}
                          </button>
                        )}
                        <button className="link-button link-button--danger" onClick={() => confirmRemove(row)}>
                          {t('teacher.remove')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewing?.project && (
        <StudentCodeModal
          project={projects.find((p) => p.id === viewing.project?.id) ?? viewing.project}
          onClose={() => setViewing(null)}
        />
      )}
      {moving?.project && (
        <MoveWorkModal classId={classDoc.id} from={moving} rows={rows} onClose={() => setMoving(null)} />
      )}
    </main>
  )
}
