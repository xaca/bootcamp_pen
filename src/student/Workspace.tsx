import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodePanel } from '../components/CodePanel'
import { ConsolePanel } from '../components/ConsolePanel'
import { LangToggle } from '../components/LangToggle'
import { Preview } from '../components/Preview'
import { isQuotaError, saveProject, updateStudentProfile, watchRemoteProjectChanges, type WithId } from '../data/db'
import type { ConsoleMessage } from '../shared/buildDoc'
import { ALL_FILES } from '../shared/files'
import type { ChangeSource, ClassDoc, Code, FileKey, Lang, ProjectDoc, StudentDoc } from '../shared/types'
import { AiPanel } from './AiPanel'
import { PublishModal } from './PublishModal'

const AUTOSAVE_MS = 60_000
const MAX_CONSOLE = 100

type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'quota'

interface Props {
  classDoc: WithId<ClassDoc>
  student: StudentDoc
  uid: string
  project: WithId<ProjectDoc>
  onProjectChange: (project: WithId<ProjectDoc>) => void
}

export function Workspace({ classDoc, student, uid, project, onProjectChange }: Props) {
  const { t } = useTranslation()

  const [code, setCode] = useState<Code>({ html: project.html, css: project.css, js: project.js })
  const [activeFile, setActiveFile] = useState<FileKey>('html')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [running, setRunning] = useState(true)
  const [runId, setRunId] = useState(0)
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([])
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [aiUndo, setAiUndo] = useState<Code | null>(null)
  const [restored, setRestored] = useState(false)

  // Refs give the autosave timer and window listeners the latest values without re-subscribing.
  const codeRef = useRef(code)
  const savedRef = useRef(code)
  const sourceRef = useRef<ChangeSource>(project.lastChangeSource)
  const savingRef = useRef(false)

  const updateCode = (next: Code, source: ChangeSource) => {
    codeRef.current = next
    sourceRef.current = source
    setCode(next)
    setSaveState('unsaved')
  }

  const save = useCallback(async (): Promise<boolean> => {
    const current = codeRef.current
    if (savingRef.current) return false
    savingRef.current = true
    setSaveState('saving')
    try {
      await saveProject(project.id, current, student.displayName, sourceRef.current)
      savedRef.current = current
      setSaveState(codeRef.current === current ? 'saved' : 'unsaved')
      return true
    } catch (err) {
      setSaveState(isQuotaError(err) ? 'quota' : 'error')
      return false
    } finally {
      savingRef.current = false
    }
  }, [project.id, student.displayName, setSaveState])

  const isDirty = () => codeRef.current !== savedRef.current

  // Autosave at most once a minute, and only when something changed (keeps Spark writes low).
  useEffect(() => {
    const timer = setInterval(() => isDirty() && void save(), AUTOSAVE_MS)
    return () => clearInterval(timer)
  }, [save])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && isDirty() && void save()
    const onUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) e.preventDefault()
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('keydown', onKey)
    }
  }, [save])

  // If the teacher moves this student's old work here ("Move work"), show it without a reload.
  const projectRef = useRef(project)
  const onProjectChangeRef = useRef(onProjectChange)
  useEffect(() => {
    projectRef.current = project
    onProjectChangeRef.current = onProjectChange
  })
  useEffect(
    () =>
      watchRemoteProjectChanges(project.id, (remote) => {
        const remoteCode: Code = { html: remote.html, css: remote.css, js: remote.js }
        if (sameCode(remoteCode, savedRef.current) || sameCode(remoteCode, codeRef.current)) return
        codeRef.current = remoteCode
        savedRef.current = remoteCode
        sourceRef.current = remote.lastChangeSource
        setCode(remoteCode)
        setSaveState('saved')
        setAiUndo(null)
        setRestored(true)
        if (remote.publishedSlug !== projectRef.current.publishedSlug) {
          onProjectChangeRef.current({ ...projectRef.current, publishedSlug: remote.publishedSlug })
        }
      }),
    [project.id, setCode, setSaveState, setAiUndo, setRestored],
  )

  const onConsole = useCallback((message: ConsoleMessage | null) => {
    if (!message) return setConsoleMessages([])
    setConsoleMessages((prev) => [...prev.slice(-(MAX_CONSOLE - 1)), message])
    if (message.type === 'error') setConsoleOpen(true)
  }, [setConsoleMessages, setConsoleOpen])

  const changeLang = (lang: Lang) => {
    void updateStudentProfile(classDoc.id, uid, { displayName: student.displayName, lang })
  }

  const applyAi = (next: Code) => {
    setAiUndo(codeRef.current)
    updateCode(next, 'ai')
    setShowAi(false)
  }

  const undoAi = () => {
    if (!aiUndo) return
    updateCode(aiUndo, 'student')
    setAiUndo(null)
  }

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="topbar__left">
          <span className="brand">🪐 Orbit</span>
          <span className="topbar__class">{classDoc.title}</span>
          <span className="topbar__code mono" title={t('workspace.classCode')}>
            {classDoc.id}
          </span>
          <span className="topbar__student">{student.displayName}</span>
        </div>
        <div className="topbar__right">
          <span className={`save-state save-state--${saveState}`} role="status">
            {t(`save.${saveState}`)}
          </span>
          {aiUndo && (
            <button className="button" onClick={undoAi}>
              ↩ {t('ai.undo')}
            </button>
          )}
          <button className="button button--ai" onClick={() => setShowAi(true)}>
            ✨ {t('ai.button')}
          </button>
          <button className="button" onClick={() => void save()} disabled={saveState === 'saving'}>
            {t('save.button')}
          </button>
          <button className="button button--primary" onClick={() => setShowPublish(true)}>
            {t('publish.button')}
          </button>
          <LangToggle onChange={changeLang} />
        </div>
      </header>

      {restored && (
        <div className="notice" role="status">
          {t('workspace.restored')}
          <button className="icon-button" onClick={() => setRestored(false)} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
      )}

      <main className="workspace__main">
        <section className="preview-pane">
          <header className="pane-header">
            <span>{t('preview.title')}</span>
            <div className="pane-header__actions">
              {running && (
                <button className="link-button" onClick={() => setRunId((n) => n + 1)}>
                  ⟳ {t('preview.rerun')}
                </button>
              )}
              <button className="link-button" onClick={() => setRunning((r) => !r)}>
                {running ? `■ ${t('preview.stop')}` : `▶ ${t('preview.run')}`}
              </button>
            </div>
          </header>
          <div className="preview-pane__frame">
            <Preview code={code} running={running} runId={runId} onConsole={onConsole} />
          </div>
          <ConsolePanel
            messages={consoleMessages}
            open={consoleOpen}
            onToggle={() => setConsoleOpen((o) => !o)}
            onClear={() => setConsoleMessages([])}
          />
        </section>

        <CodePanel
          code={code}
          files={ALL_FILES}
          active={activeFile}
          onActiveChange={setActiveFile}
          onChange={(file, value) => updateCode({ ...codeRef.current, [file]: value }, 'student')}
        />
      </main>

      {showAi && (
        <AiPanel
          code={code}
          tool={classDoc.aiTool}
          onApply={applyAi}
          onClose={() => setShowAi(false)}
        />
      )}

      {showPublish && (
        <PublishModal
          classDoc={classDoc}
          project={project}
          code={code}
          studentName={student.displayName}
          lang={student.lang}
          save={save}
          onPublished={(slug) => onProjectChange({ ...project, publishedSlug: slug })}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  )
}

function sameCode(a: Code, b: Code): boolean {
  return a.html === b.html && a.css === b.css && a.js === b.js
}
