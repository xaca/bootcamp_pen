import { signInAnonymously } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, matchPath, Route, Routes, useLocation, useNavigate } from 'react-router'
import { CenteredMessage } from '../components/CenteredMessage'
import { LangToggle } from '../components/LangToggle'
import { Modal } from '../components/Modal'
import { enterTeacher, exitTeacher, restoreTeacherSession } from '../data/db'
import { useAuthUser } from '../data/useAuthUser'
import { auth } from '../firebase'
import type { TeacherSession } from '../shared/types'
import { ClassDetail } from './ClassDetail'
import { ClassList } from './ClassList'
import { HelpModal } from './HelpModal'
import { MyLink } from './MyLink'
import { TeacherJoin } from './TeacherJoin'
import { TeacherWelcome } from './TeacherWelcome'

/**
 * /teacher/* — no passwords. A browser becomes a teacher by opening the teacher's personal link
 * (/t/:key, which redirects here with the key in router state) or the organizer's invite link
 * (/teacher/join/:code). After that the browser stays signed in.
 */
export function TeacherPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthUser()
  const [session, setSession] = useState<TeacherSession | null | undefined>(undefined)
  const [linkKey, setLinkKey] = useState<string | null>(() => (location.state as { accessKey?: string } | null)?.accessKey ?? null)
  const [linkError, setLinkError] = useState(false)
  const [error, setError] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const inviteCode = matchPath('/teacher/join/:code', location.pathname)?.params.code

  useEffect(() => {
    if (user === null) signInAnonymously(auth).catch(() => setError(true))
  }, [user])

  const uid = user?.uid
  useEffect(() => {
    if (!uid) return
    if (linkKey) {
      // Opened from a personal link: sign in, then forget the key (it never stays in the address bar).
      enterTeacher(uid, linkKey)
        .then(setSession)
        .catch(() => {
          setLinkError(true)
          setSession(null)
        })
        .finally(() => {
          setLinkKey(null)
          navigate('/teacher', { replace: true, state: null })
        })
    } else {
      void restoreTeacherSession(uid).then(setSession)
    }
    // linkKey is consumed once; re-running when it's cleared would only restore the same session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  if (error) return <CenteredMessage>{t('errors.signIn')}</CenteredMessage>
  if (!user || session === undefined) return <CenteredMessage>{t('teacherAccess.opening')}</CenteredMessage>

  const exit = async () => {
    if (session) await exitTeacher(session, user.uid)
    setSession(null)
  }

  if (inviteCode) {
    return (
      <TeacherJoin
        uid={user.uid}
        registrationCode={decodeURIComponent(inviteCode)}
        current={session}
        onUseCurrent={() => navigate('/teacher', { replace: true })}
        onSwitchUser={exit}
        onDone={(created) => {
          setSession(created)
          navigate('/teacher', { replace: true })
        }}
      />
    )
  }

  if (!session) {
    return (
      <TeacherWelcome
        linkError={linkError}
        onLink={(key) =>
          enterTeacher(user.uid, key)
            .then((s) => {
              setLinkError(false)
              setSession(s)
            })
            .catch(() => setLinkError(true))
        }
      />
    )
  }

  return (
    <div className="teacher">
      <header className="topbar">
        <div className="topbar__left">
          <Link to="/teacher" className="brand">
            🪐 Orbit
          </Link>
          <span className="topbar__class">{t('teacher.title')}</span>
        </div>
        <div className="topbar__right">
          <span className="topbar__student">{session.name}</span>
          <button className="link-button" onClick={() => setShowLink(true)}>
            🔗 {t('myLink.button')}
          </button>
          <button className="link-button" onClick={() => setShowHelp(true)}>
            ? {t('help.button')}
          </button>
          <button className="link-button" onClick={() => void exit()}>
            {t('teacher.exit')}
          </button>
          <LangToggle />
        </div>
      </header>
      <Routes>
        <Route index element={<ClassList teacherId={session.teacherId} />} />
        <Route path=":classId" element={<ClassDetail teacherId={session.teacherId} />} />
      </Routes>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showLink && (
        <Modal title={t('myLink.title')} onClose={() => setShowLink(false)}>
          <MyLink accessKey={session.accessKey} />
        </Modal>
      )}
    </div>
  )
}
