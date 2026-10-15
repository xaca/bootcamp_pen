import { useTranslation } from 'react-i18next'
import { FILE_NAMES } from '../shared/files'
import type { Code, FileKey } from '../shared/types'
import { CodeEditor } from './CodeEditor'

const FILE_ICONS: Record<FileKey, string> = { html: '<>', css: '#', js: 'JS' }

interface Props {
  code: Code
  files: FileKey[]
  active: FileKey
  onActiveChange: (file: FileKey) => void
  onChange?: (file: FileKey, value: string) => void
  readOnly?: boolean
}

/** Dark editor panel with file tabs, like a mini code editor. */
export function CodePanel({ code, files, active, onActiveChange, onChange, readOnly = false }: Props) {
  const { t } = useTranslation()
  return (
    <section className="code-panel">
      <div className="code-panel__tabs" role="tablist">
        {files.map((file) => (
          <button
            key={file}
            role="tab"
            aria-selected={file === active}
            className={`code-panel__tab code-panel__tab--${file}`}
            onClick={() => onActiveChange(file)}
          >
            <span className="code-panel__icon">{FILE_ICONS[file]}</span>
            {FILE_NAMES[file]}
          </button>
        ))}
      </div>
      <div className="code-panel__body">
        {/* All editors stay mounted so each file keeps its own undo history. */}
        {files.map((file) => (
          <div key={file} className="code-panel__editor" data-active={file === active} role="tabpanel">
            <CodeEditor
              file={file}
              value={code[file]}
              onChange={onChange ? (value) => onChange(file, value) : undefined}
              readOnly={readOnly}
              placeholder={readOnly ? undefined : t(`editor.placeholder.${file}`)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
