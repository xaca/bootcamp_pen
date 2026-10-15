import type { TFunction } from 'i18next'
import { LOOP_GUARD_ERROR } from './loopGuard'

const PATTERNS: { re: RegExp; key: string }[] = [
  { re: new RegExp(LOOP_GUARD_ERROR), key: 'errors.infiniteLoop' },
  { re: /(\S+) is not defined/, key: 'errors.notDefined' },
  { re: /Cannot read propert(?:y|ies) of (null|undefined)/, key: 'errors.nullProperty' },
  { re: /Cannot set propert(?:y|ies) of (null|undefined)/, key: 'errors.nullProperty' },
  { re: /(\S+) is not a function/, key: 'errors.notFunction' },
  { re: /Assignment to constant variable/, key: 'errors.constAssign' },
  { re: /Identifier '(\S+)' has already been declared/, key: 'errors.alreadyDeclared' },
  { re: /Unexpected end of input|missing \) after|Unexpected token|Invalid or unexpected token|Unterminated/, key: 'errors.syntax' },
]

/** Returns a kid-friendly explanation for a JS error message, or null if we don't know it. */
export function friendlyError(message: string, t: TFunction): string | null {
  for (const { re, key } of PATTERNS) {
    const match = message.match(re)
    if (match) return t(key, { name: match[1] ?? '' })
  }
  return null
}

export function isLoopGuardError(message: string): boolean {
  return message.includes(LOOP_GUARD_ERROR)
}
