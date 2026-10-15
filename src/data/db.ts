import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import { newAccessKey, newJoinCode, newPublishSlug } from '../shared/slug'
import {
  EMPTY_CODE,
  type ChangeSource,
  type ClassDoc,
  type Code,
  type Lang,
  type ProjectDoc,
  type PublishedDoc,
  type StudentDoc,
  type TeacherSession,
} from '../shared/types'

export type WithId<T> = T & { id: string }

const classRef = (classId: string) => doc(db, 'classes', classId)
const studentRef = (classId: string, uid: string) => doc(db, 'classes', classId, 'students', uid)
export const projectId = (classId: string, uid: string) => `${classId}_${uid}`
const projectRef = (id: string) => doc(db, 'projects', id)
const publishedRef = (slug: string) => doc(db, 'published', slug)

/** True when Spark's free daily quota is used up. */
export function isQuotaError(error: unknown): boolean {
  return (error as FirestoreError)?.code === 'resource-exhausted'
}

// ---------- teachers ----------

const teacherRef = (teacherId: string) => doc(db, 'teachers', teacherId)
const sessionRef = (teacherId: string, uid: string) => doc(db, 'teachers', teacherId, 'sessions', uid)
const SESSION_KEY = 'orbit.teacher'

export class InvalidLinkError extends Error {}
export class WrongInviteError extends Error {}

function rememberSession(session: TeacherSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // storage unavailable: the teacher opens their personal link again next time
  }
}

/** The teacher space this browser entered before, if its session still exists. */
export async function restoreTeacherSession(uid: string): Promise<TeacherSession | null> {
  let saved: TeacherSession | null
  try {
    saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
  // Sessions from the old code + PIN access have no accessKey: ask for the personal link.
  if (!saved?.teacherId || !saved.accessKey) return null
  try {
    const snap = await getDoc(sessionRef(saved.teacherId, uid))
    if (snap.exists()) return saved
  } catch {
    // fall through: treat as signed out
  }
  rememberSession(null)
  return null
}

/**
 * Creates a teacher space from the organizer's invite link (one batch). The rules accept it only
 * with the right registration code; the first session signs this browser in.
 */
export async function createTeacher(uid: string, name: string, registrationCode: string): Promise<TeacherSession> {
  const accessKey = newAccessKey()
  const teacherId = doc(collection(db, 'teachers')).id
  const batch = writeBatch(db)
  batch.set(doc(db, 'teacherKeys', accessKey), { teacherId, name })
  batch.set(doc(db, 'teacherInvites', accessKey), { registrationCode })
  batch.set(teacherRef(teacherId), { name, createdAt: serverTimestamp() })
  batch.set(sessionRef(teacherId, uid), { accessKey, createdAt: serverTimestamp() })
  try {
    await batch.commit()
  } catch (err) {
    if ((err as FirestoreError).code === 'permission-denied') throw new WrongInviteError()
    throw err
  }
  const session = { teacherId, accessKey, name }
  rememberSession(session)
  return session
}

/** Personal link → a session for this browser's anonymous uid. */
export async function enterTeacher(uid: string, accessKey: string): Promise<TeacherSession> {
  const keySnap = await getDoc(doc(db, 'teacherKeys', accessKey))
  if (!keySnap.exists()) throw new InvalidLinkError()
  const { teacherId, name } = keySnap.data() as { teacherId: string; name: string }
  await setDoc(sessionRef(teacherId, uid), { accessKey, createdAt: serverTimestamp() })
  const session = { teacherId, accessKey, name }
  rememberSession(session)
  return session
}

/** "Exit": this browser is no longer signed in to that teacher space. */
export async function exitTeacher(session: TeacherSession, uid: string) {
  rememberSession(null)
  await deleteDoc(sessionRef(session.teacherId, uid)).catch(() => undefined)
}

// ---------- classes ----------

export function watchClass(classId: string, cb: (c: WithId<ClassDoc> | null) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    classRef(classId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...(snap.data() as ClassDoc) } : null),
    onError,
  )
}

export function watchTeacherClasses(teacherId: string, cb: (classes: WithId<ClassDoc>[]) => void): Unsubscribe {
  const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId))
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ClassDoc) }))
    list.sort((a, b) => (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity))
    cb(list)
  })
}

export async function createClass(
  teacherId: string,
  settings: Pick<ClassDoc, 'title' | 'defaultLang' | 'aiTool'>,
): Promise<string> {
  // Join codes are random; retry in the unlikely case one already exists.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newJoinCode()
    if ((await getDoc(classRef(id))).exists()) continue
    await setDoc(classRef(id), {
      ...settings,
      teacherId,
      isOpen: true,
      createdAt: serverTimestamp(),
    })
    return id
  }
  throw new Error('Could not create a unique join code')
}

export function updateClass(classId: string, changes: Partial<Pick<ClassDoc, 'title' | 'isOpen' | 'defaultLang' | 'aiTool'>>) {
  return updateDoc(classRef(classId), changes)
}

// ---------- students ----------

export function watchStudent(classId: string, uid: string, cb: (s: StudentDoc | null) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(studentRef(classId, uid), (snap) => cb(snap.exists() ? (snap.data() as StudentDoc) : null), onError)
}

export function watchStudents(classId: string, cb: (students: WithId<StudentDoc>[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'classes', classId, 'students'), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as StudentDoc) }))
    list.sort((a, b) => a.displayName.localeCompare(b.displayName))
    cb(list)
  })
}

export async function joinClass(classId: string, teacherId: string, uid: string, displayName: string, lang: Lang) {
  await setDoc(studentRef(classId, uid), { displayName, lang, joinedAt: serverTimestamp() })
  await ensureProject(classId, teacherId, uid, displayName)
}

export function updateStudentProfile(classId: string, uid: string, changes: Pick<StudentDoc, 'displayName' | 'lang'>) {
  return updateDoc(studentRef(classId, uid), changes)
}

// ---------- projects ----------

/** Loads the student's project, creating an empty one (blank page) the first time. */
export async function ensureProject(classId: string, teacherId: string, uid: string, studentName: string): Promise<WithId<ProjectDoc>> {
  const id = projectId(classId, uid)
  const snap = await getDoc(projectRef(id))
  if (snap.exists()) return { id, ...(snap.data() as ProjectDoc) }

  const project: ProjectDoc = {
    ...EMPTY_CODE,
    classId,
    ownerUid: uid,
    teacherId,
    studentName,
    publishedSlug: null,
    lastChangeSource: 'student',
  }
  await setDoc(projectRef(id), { ...project, updatedAt: serverTimestamp() })
  return { id, ...project }
}

/**
 * Changes made somewhere else (e.g. the teacher moved work into this project).
 * The student's own saves are skipped: they arrive with pending writes and don't trigger again.
 */
export function watchRemoteProjectChanges(id: string, cb: (project: WithId<ProjectDoc>) => void): Unsubscribe {
  return onSnapshot(projectRef(id), (snap) => {
    if (snap.exists() && !snap.metadata.hasPendingWrites) cb({ id, ...(snap.data() as ProjectDoc) })
  })
}

export function saveProject(id: string, code: Code, studentName: string, lastChangeSource: ChangeSource) {
  return updateDoc(projectRef(id), { ...code, studentName, lastChangeSource, updatedAt: serverTimestamp() })
}

export function watchClassProjects(classId: string, teacherId: string, cb: (projects: WithId<ProjectDoc>[]) => void): Unsubscribe {
  const q = query(collection(db, 'projects'), where('teacherId', '==', teacherId), where('classId', '==', classId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProjectDoc) }))))
}

// ---------- publishing ----------

export async function publishProject(
  project: WithId<ProjectDoc>,
  code: Code,
  studentName: string,
  classTitle: string,
  lang: Lang,
): Promise<string> {
  const data = { ...code, studentName, lang, publishedAt: serverTimestamp() }

  if (project.publishedSlug) {
    await updateDoc(publishedRef(project.publishedSlug), data)
    return project.publishedSlug
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newPublishSlug(classTitle, studentName)
    if ((await getDoc(publishedRef(slug))).exists()) continue
    const published: Omit<PublishedDoc, 'publishedAt'> = {
      ...code,
      classId: project.classId,
      ownerUid: project.ownerUid,
      teacherId: project.teacherId,
      studentName,
      classTitle,
      lang,
    }
    await setDoc(publishedRef(slug), { ...published, publishedAt: serverTimestamp() })
    await updateDoc(projectRef(project.id), { publishedSlug: slug })
    return slug
  }
  throw new Error('Could not create a unique page address')
}

/** Teacher removes a published page. */
export async function unpublish(project: WithId<ProjectDoc>) {
  if (!project.publishedSlug) return
  const batch = writeBatch(db)
  batch.delete(publishedRef(project.publishedSlug))
  batch.update(projectRef(project.id), { publishedSlug: null })
  await batch.commit()
}

/**
 * Teacher moves a student's work to their new anonymous uid (e.g. after the browser was cleared):
 * copies the code into the new project, hands over the published page, and removes the old entry.
 */
export async function moveWork(classId: string, from: WithId<ProjectDoc>, toUid: string) {
  const toId = projectId(classId, toUid)
  const batch = writeBatch(db)
  batch.update(projectRef(toId), {
    html: from.html,
    css: from.css,
    js: from.js,
    publishedSlug: from.publishedSlug,
    lastChangeSource: from.lastChangeSource,
    updatedAt: serverTimestamp(),
  })
  if (from.publishedSlug) batch.update(publishedRef(from.publishedSlug), { ownerUid: toUid })
  batch.delete(projectRef(from.id))
  batch.delete(studentRef(classId, from.ownerUid))
  await batch.commit()
}

export function removeStudent(classId: string, uid: string, project?: WithId<ProjectDoc>) {
  const batch = writeBatch(db)
  if (project?.publishedSlug) batch.delete(publishedRef(project.publishedSlug))
  if (project) batch.delete(projectRef(project.id))
  batch.delete(studentRef(classId, uid))
  return batch.commit()
}

