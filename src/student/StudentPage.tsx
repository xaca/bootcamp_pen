import { signInAnonymously } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ensureProject, watchClass, watchStudent, type WithId } from '../data/db'
import { CenteredMessage } from '../components/CenteredMessage'
import { useAuthUser } from '../data/useAuthUser'
import { auth } from '../firebase'
import i18n from '../i18n'
import { readLastClass, rememberLastClass } from '../shared/lastClass'
import type { ClassDoc, ProjectDoc, StudentDoc } from '../shared/types'
import { JoinForm } from './JoinForm'
import { Workspace } from './Workspace'

/** /c/:classId — signs the student in anonymously, then shows the join form or the editor. */
export function StudentPage() {
  const { t } = useTranslation()
  const classId = (useParams().classId ?? '').toUpperCase()
  const user = useAuthUser()
  const [classDoc, setClassDoc] = useState<WithId<ClassDoc> | null | undefined>(undefined)
  const [student, setStudent] = useState<StudentDoc | null | undefined>(undefined)
  const [project, setProject] = useState<WithId<ProjectDoc> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Students never create accounts: the anonymous uid is their identity.
  useEffect(() => {
    if (user === null) signInAnonymously(auth).catch(() => setError(t('errors.signIn')))
  }, [user, t])

  const uid = user?.uid
  useEffect(() => {
    if (!uid) return
    return watchClass(classId, setClassDoc, () => setClassDoc(null))
  }, [uid, classId])

  useEffect(() => {
    if (!uid || !classDoc) return
    return watchStudent(classId, uid, setStudent, () => setError(t('errors.load')))
    // re-subscribe only when the class appears, not on every class change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, classId, Boolean(classDoc)])

  // Language: the student's choice, or the class default before joining.
  const lang = student?.lang ?? classDoc?.defaultLang
  useEffect(() => {
    if (lang && i18n.language !== lang) void i18n.changeLanguage(lang)
  }, [lang])

  const teacherId = classDoc?.teacherId
  const displayName = student?.displayName
  useEffect(() => {
    if (!uid || !teacherId || !displayName || project) return
    ensureProject(classId, teacherId, uid, displayName)
      .then(setProject)
      .catch(() => setError(t('errors.load')))
  }, [uid, teacherId, displayName, classId, project, t])

  // Remember this class for the home page's "Continue in <class>" (and forget it if it was deleted).
  const classTitle = classDoc?.title
  const joined = Boolean(student)
  useEffect(() => {
    if (classTitle && joined) rememberLastClass({ code: classId, title: classTitle })
    if (classDoc === null && readLastClass()?.code === classId) rememberLastClass(null)
  }, [classTitle, joined, classDoc, classId])

  if (error) return <CenteredMessage>{error}</CenteredMessage>
  if (!user || classDoc === undefined) return <CenteredMessage>{t('common.loading')}</CenteredMessage>
  if (classDoc === null) {
    return (
      <CenteredMessage>
        <p>{t('join.notFound', { code: classId })}</p>
        <Link to="/">{t('common.backHome')}</Link>
      </CenteredMessage>
    )
  }
  if (student === undefined) return <CenteredMessage>{t('common.loading')}</CenteredMessage>
  if (student === null) {
    if (!classDoc.isOpen) return <CenteredMessage>{t('join.closed')}</CenteredMessage>
    return <JoinForm classDoc={classDoc} uid={user.uid} />
  }
  if (!project) return <CenteredMessage>{t('common.loading')}</CenteredMessage>

  return (
    <Workspace
      key={project.id}
      classDoc={classDoc}
      student={student}
      uid={user.uid}
      project={project}
      onProjectChange={setProject}
    />
  )
}

