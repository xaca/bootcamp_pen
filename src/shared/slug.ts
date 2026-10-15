const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomChars(length: number, alphabet = ALPHABET): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Join code used as the class document id, e.g. "K7QM-4TZP". */
export function newJoinCode(): string {
  return `${randomChars(4)}-${randomChars(4)}`
}

/** "José Pérez" → "jose-perez" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

/** "Orbit Club" + "José" → "orbit-club-jose-7k2" */
export function newPublishSlug(classTitle: string, studentName: string): string {
  const parts = [slugify(classTitle), slugify(studentName)].filter(Boolean)
  parts.push(randomChars(3, 'abcdefghjkmnpqrstuvwxyz23456789'))
  return parts.join('-')
}

/** Secret in a teacher's personal link: 20 chars × 32 symbols ≈ 100 bits (pattern in firestore.rules). */
export function newAccessKey(): string {
  return randomChars(20)
}

const ACCESS_KEY = /^[A-Z0-9]{20}$/

/** Accepts a pasted personal link (".../t/KEY") or just the key. Returns null if it isn't one. */
export function parseAccessKey(input: string): string | null {
  const text = input.trim()
  const fromLink = text.match(/\/t\/([A-Za-z0-9]{20})(?:[/?#]|$)/)?.[1]
  const key = (fromLink ?? text).toUpperCase()
  return ACCESS_KEY.test(key) ? key : null
}

export function personalLink(accessKey: string): string {
  return `${window.location.origin}/t/${accessKey}`
}

export function inviteLink(registrationCode: string): string {
  return `${window.location.origin}/teacher/join/${encodeURIComponent(registrationCode)}`
}
