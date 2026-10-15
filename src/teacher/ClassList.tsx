import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { createClass, isQuotaError, watchTeacherClasses, type WithId } from '../data/db'
import { currentLang } from '../i18n'
import type { AiTool, ClassDoc, Lang } from '../shared/types'

export function ClassList({ teacherId }: { teacherId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [classes, setClasses] = useState<WithId<ClassDoc>[] | null>(null)
  const [title, setTitle] = useState('')
  const [defaultLang, setDefaultLang] = useState<Lang>(currentLang())
  const [aiTool, setAiTool] = useState<AiTool>('gemini')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => watchTeacherClasses(teacherId, setClasses), [teacherId])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const id = await createClass(teacherId, { title: title.trim().slice(0, 60), defaultLang, aiTool })
      navigate(`/teacher/${id}`)
    } catch (err) {
      setError(isQuotaError(err) ? t('errors.quota') : t('teacher.createError'))
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h2>{t('teacher.newClass')}</h2>
        <form className="form-grid" onSubmit={create}>
          <label className="field">
            <span>{t('teacher.classTitle')}</span>
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Orbit Club" />
          </label>
          <label className="field">
            <span>{t('teacher.defaultLang')}</span>
            <select value={defaultLang} onChange={(e) => setDefaultLang(e.target.value as Lang)}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="field">
            <span>{t('teacher.aiTool')}</span>
            <select value={aiTool} onChange={(e) => setAiTool(e.target.value as AiTool)}>
              <option value="gemini">Gemini</option>
              <option value="chatgpt">ChatGPT</option>
            </select>
          </label>
          <button className="button button--primary" disabled={busy || !title.trim()}>
            {t('teacher.create')}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section>
        <h2>{t('teacher.myClasses')}</h2>
        {classes === null && <p>{t('common.loading')}</p>}
        {classes?.length === 0 && <p className="hint">{t('teacher.noClasses')}</p>}
        <ul className="class-list">
          {classes?.map((c) => (
            <li key={c.id}>
              <Link to={`/teacher/${c.id}`} className="card class-card">
                <strong>{c.title}</strong>
                <span className="mono">{c.id}</span>
                <span className="hint">
                  {c.isOpen ? t('teacher.open') : t('teacher.closed')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
