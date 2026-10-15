import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import type { Extension } from '@codemirror/state'
import type { FileKey } from '../shared/types'

export function languageFor(file: FileKey): Extension {
  if (file === 'html') return html()
  if (file === 'css') return css()
  return javascript()
}
