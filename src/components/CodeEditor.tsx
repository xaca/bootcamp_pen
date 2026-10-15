import type { Extension } from '@codemirror/state'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'
import type { FileKey } from '../shared/types'
import { languageFor } from './languages'

interface Props {
  file: FileKey
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  extraExtensions?: Extension[]
}

export function CodeEditor({ file, value, onChange, readOnly = false, placeholder, extraExtensions }: Props) {
  const extensions = useMemo(() => [languageFor(file), ...(extraExtensions ?? [])], [file, extraExtensions])
  return (
    <CodeMirror
      className="code-editor"
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="dark"
      height="100%"
      readOnly={readOnly}
      editable={!readOnly}
      placeholder={placeholder}
      basicSetup={{ foldGutter: false, highlightActiveLine: !readOnly }}
    />
  )
}
