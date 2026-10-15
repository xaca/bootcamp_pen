import type { Timestamp } from 'firebase/firestore'

export type Lang = 'en' | 'es'
export type AiTool = 'gemini' | 'chatgpt'
export type ChangeSource = 'student' | 'ai'
export type FileKey = 'html' | 'css' | 'js'

export interface Code {
  html: string
  css: string
  js: string
}

export const EMPTY_CODE: Code = { html: '', css: '', js: '' }

export interface ClassDoc {
  teacherId: string
  title: string
  isOpen: boolean
  defaultLang: Lang
  aiTool: AiTool
  createdAt?: Timestamp
}

export interface StudentDoc {
  displayName: string
  lang: Lang
  joinedAt?: Timestamp
}

export interface ProjectDoc extends Code {
  classId: string
  ownerUid: string
  teacherId: string
  studentName: string
  publishedSlug: string | null
  lastChangeSource: ChangeSource
  updatedAt?: Timestamp
}

export interface PublishedDoc extends Code {
  classId: string
  ownerUid: string
  teacherId: string
  studentName: string
  classTitle: string
  lang: Lang
  publishedAt?: Timestamp
}

export const MAX_FILE_CHARS = 100_000

/** A browser signed in to a teacher space through the teacher's personal link. */
export interface TeacherSession {
  teacherId: string
  accessKey: string
  name: string
}
