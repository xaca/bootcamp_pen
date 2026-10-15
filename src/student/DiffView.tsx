import { unifiedMergeView } from '@codemirror/merge'
import { useMemo } from 'react'
import { CodeEditor } from '../components/CodeEditor'
import type { FileKey } from '../shared/types'

/** Read-only view of the new code with removed/added lines highlighted against the original. */
export function DiffView({ file, original, updated }: { file: FileKey; original: string; updated: string }) {
  const extensions = useMemo(() => [unifiedMergeView({ original, mergeControls: false })], [original])
  return (
    <div className="diff-view">
      <CodeEditor file={file} value={updated} readOnly extraExtensions={extensions} />
    </div>
  )
}
