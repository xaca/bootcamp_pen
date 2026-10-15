// Security rules tests. Run with `npm run test:rules` (starts the Firestore emulator; requires Java).
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const CLASS = 'ABCD-EFGH'
const REGISTRATION = 'ORBIT-BOOTCAMP-2026'
// Teacher spaces: internal id, the access key in their personal link, and a browser that opened it.
const MARIA = { id: 'teacherMaria', key: 'MARIAKEY7K2Q9PXR2VB8', uid: 'maria-browser' }
const JUAN = { id: 'teacherJuan', key: 'JUANKEY4TZP8MW3CYQ5N', uid: 'juan-browser' }
const ANA = 'ana-uid'
const LUIS = 'luis-uid'

const code = { html: '<h1>Hi</h1>', css: '', js: '' }
const classData = { teacherId: MARIA.id, title: 'Orbit Club', isOpen: true, defaultLang: 'es', aiTool: 'gemini' }
const project = (uid: string) => ({
  ...code,
  classId: CLASS,
  ownerUid: uid,
  teacherId: MARIA.id,
  studentName: uid,
  publishedSlug: null,
  lastChangeSource: 'student',
})

let env: RulesTestEnvironment

// Everyone is anonymous; a teacher is a uid with a session in a teacher space.
const user = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
const teacher = (t = MARIA) => user(t.uid)
const student = user
const visitor = () => env.unauthenticatedContext().firestore()

async function seed(data: Record<string, object>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [path, value] of Object.entries(data)) await setDoc(doc(ctx.firestore(), path), value)
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-orbit',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  const space = (t: typeof MARIA, name: string) => ({
    [`teacherKeys/${t.key}`]: { teacherId: t.id, name },
    [`teacherInvites/${t.key}`]: { registrationCode: REGISTRATION },
    [`teachers/${t.id}`]: { name },
    [`teachers/${t.id}/sessions/${t.uid}`]: { accessKey: t.key },
  })
  await seed({
    'config/registration': { code: REGISTRATION },
    ...space(MARIA, 'María'),
    ...space(JUAN, 'Juan'),
    [`classes/${CLASS}`]: classData,
    [`classes/${CLASS}/students/${ANA}`]: { displayName: 'Ana', lang: 'es' },
    [`projects/${CLASS}_${ANA}`]: project(ANA),
  })
})

describe('teacher spaces', () => {
  const ROSA_KEY = 'ROSAKEYAB12CD34EF56G'
  const newSpace = (db: ReturnType<typeof user>, uid: string, registrationCode: string) => {
    const batch = writeBatch(db)
    batch.set(doc(db, `teacherKeys/${ROSA_KEY}`), { teacherId: 'teacherRosa', name: 'Rosa' })
    batch.set(doc(db, `teacherInvites/${ROSA_KEY}`), { registrationCode })
    batch.set(doc(db, 'teachers/teacherRosa'), { name: 'Rosa' })
    batch.set(doc(db, `teachers/teacherRosa/sessions/${uid}`), { accessKey: ROSA_KEY })
    return batch.commit()
  }

  it('creating a teacher space needs the invite link’s registration code', async () => {
    await assertFails(newSpace(user('rosa-browser'), 'rosa-browser', 'wrong-code'))
    await assertSucceeds(newSpace(user('rosa-browser'), 'rosa-browser', REGISTRATION))
  })

  it('nobody can read the registration code or list access keys', async () => {
    await assertFails(getDoc(doc(teacher(), `teacherInvites/${MARIA.key}`)))
    await assertFails(getDoc(doc(teacher(), 'config/registration')))
    await assertFails(getDocs(collection(user('anyone'), 'teacherKeys')))
  })

  it('opening the personal link signs a new browser in; a wrong key does not', async () => {
    const path = `teachers/${MARIA.id}/sessions/new-browser`
    await assertFails(setDoc(doc(user('new-browser'), path), { accessKey: 'WRONGKEY000000000000' }))
    await assertFails(setDoc(doc(user('new-browser'), path), { accessKey: JUAN.key }))
    await assertSucceeds(setDoc(doc(user('new-browser'), path), { accessKey: MARIA.key }))
  })

  it('a new key cannot be pointed at an existing teacher space', async () => {
    const db = user('intruder')
    const batch = writeBatch(db)
    batch.set(doc(db, 'teacherKeys/EVILKEYAB12CD34EF56G'), { teacherId: MARIA.id, name: 'Evil' })
    batch.set(doc(db, 'teacherInvites/EVILKEYAB12CD34EF56G'), { registrationCode: REGISTRATION })
    await assertFails(batch.commit())
  })
})

describe('classes', () => {
  it('a teacher can create a class in their own space only; a student cannot', async () => {
    await assertSucceeds(setDoc(doc(teacher(JUAN), 'classes/WXYZ-2345'), { ...classData, teacherId: JUAN.id }))
    await assertFails(setDoc(doc(teacher(JUAN), 'classes/WXYZ-3456'), classData))
    await assertFails(setDoc(doc(student(LUIS), 'classes/WXYZ-6789'), { ...classData, teacherId: LUIS }))
  })

  it('rejects join codes that do not match the format', async () => {
    await assertFails(setDoc(doc(teacher(), 'classes/short'), classData))
  })

  it('students can read a class but cannot change its settings', async () => {
    await assertSucceeds(getDoc(doc(student(ANA), `classes/${CLASS}`)))
    await assertFails(updateDoc(doc(student(ANA), `classes/${CLASS}`), { aiTool: 'chatgpt' }))
    await assertSucceeds(updateDoc(doc(teacher(), `classes/${CLASS}`), { aiTool: 'chatgpt' }))
  })

  it('teachers only see their own classes (simultaneous bootcamps)', async () => {
    await assertSucceeds(getDocs(query(collection(teacher(), 'classes'), where('teacherId', '==', MARIA.id))))
    await assertFails(getDocs(query(collection(teacher(JUAN), 'classes'), where('teacherId', '==', MARIA.id))))
    await assertFails(updateDoc(doc(teacher(JUAN), `classes/${CLASS}`), { isOpen: false }))
  })
})

describe('students', () => {
  it('a student can join an open class only as themselves', async () => {
    await assertSucceeds(setDoc(doc(student(LUIS), `classes/${CLASS}/students/${LUIS}`), { displayName: 'Luis', lang: 'es' }))
    await assertFails(setDoc(doc(student(LUIS), `classes/${CLASS}/students/someone-else`), { displayName: 'X', lang: 'es' }))
  })

  it('nobody can join a closed class', async () => {
    await seed({ [`classes/${CLASS}`]: { ...classData, isOpen: false } })
    await assertFails(setDoc(doc(student(LUIS), `classes/${CLASS}/students/${LUIS}`), { displayName: 'Luis', lang: 'es' }))
  })

  it('a student can change their own name and language, but not someone else’s', async () => {
    await assertSucceeds(updateDoc(doc(student(ANA), `classes/${CLASS}/students/${ANA}`), { lang: 'en' }))
    await assertFails(updateDoc(doc(student(LUIS), `classes/${CLASS}/students/${ANA}`), { displayName: 'X' }))
  })
})

describe('projects', () => {
  it('a joined student creates and saves only their own project', async () => {
    await seed({ [`classes/${CLASS}/students/${LUIS}`]: { displayName: 'Luis', lang: 'es' } })
    await assertSucceeds(setDoc(doc(student(LUIS), `projects/${CLASS}_${LUIS}`), project(LUIS)))
    await assertSucceeds(updateDoc(doc(student(LUIS), `projects/${CLASS}_${LUIS}`), { html: '<p>new</p>' }))
    await assertFails(updateDoc(doc(student(LUIS), `projects/${CLASS}_${ANA}`), { html: 'hacked' }))
  })

  it('students cannot read each other’s code; the teacher can list the class', async () => {
    await assertFails(getDoc(doc(student(LUIS), `projects/${CLASS}_${ANA}`)))
    await assertSucceeds(
      getDocs(query(collection(teacher(), 'projects'), where('teacherId', '==', MARIA.id), where('classId', '==', CLASS))),
    )
    await assertFails(
      getDocs(query(collection(teacher(JUAN), 'projects'), where('teacherId', '==', MARIA.id), where('classId', '==', CLASS))),
    )
  })

  it('rejects files over 100 KB and changes to ownership', async () => {
    await assertFails(updateDoc(doc(student(ANA), `projects/${CLASS}_${ANA}`), { css: 'x'.repeat(100_001) }))
    await assertFails(updateDoc(doc(student(ANA), `projects/${CLASS}_${ANA}`), { ownerUid: LUIS }))
  })
})

describe('published pages', () => {
  const page = { ...code, classId: CLASS, ownerUid: ANA, teacherId: MARIA.id, studentName: 'Ana', classTitle: 'Orbit Club', lang: 'es' }

  it('the owner publishes; anyone can read the page', async () => {
    await assertSucceeds(setDoc(doc(student(ANA), 'published/orbit-club-ana-7k2'), page))
    await assertSucceeds(getDoc(doc(visitor(), 'published/orbit-club-ana-7k2')))
  })

  it('nobody can take over an existing page', async () => {
    await seed({ 'published/orbit-club-ana-7k2': page, [`classes/${CLASS}/students/${LUIS}`]: { displayName: 'Luis', lang: 'es' } })
    await assertFails(setDoc(doc(student(LUIS), 'published/orbit-club-ana-7k2'), { ...page, ownerUid: LUIS }))
    await assertFails(updateDoc(doc(student(LUIS), 'published/orbit-club-ana-7k2'), { html: 'hacked' }))
  })

  it('publishing is frozen when the class is closed', async () => {
    await seed({ [`classes/${CLASS}`]: { ...classData, isOpen: false } })
    await assertFails(setDoc(doc(student(ANA), 'published/orbit-club-ana-7k2'), page))
  })

  it('the teacher can unpublish; visitors cannot list pages', async () => {
    await seed({ 'published/orbit-club-ana-7k2': page })
    await assertFails(getDocs(collection(visitor(), 'published')))
    await assertSucceeds(deleteDoc(doc(teacher(), 'published/orbit-club-ana-7k2')))
  })
})
