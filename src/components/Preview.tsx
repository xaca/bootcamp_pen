import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildDoc, IFRAME_SANDBOX, isEmptyCode, type ConsoleMessage, type FrameMessage } from '../shared/buildDoc'
import { normalizeHtml } from '../shared/normalizeHtml'
import type { Code } from '../shared/types'

interface Props {
  code: Code
  running?: boolean
  /** Changing this re-runs the page even if the code is the same. */
  runId?: number
  /** Receives console output; also called with null when a new version of the page starts. */
  onConsole?: (message: ConsoleMessage | null) => void
}

interface Frame {
  key: number
  srcDoc: string
}

const DEBOUNCE_MS = 400
/** Swap in the new page even if it never says "ready" (e.g. an alert() is open). */
const READY_TIMEOUT_MS = 1500

/**
 * Live preview. Each change renders into a hidden frame that replaces the visible one once it
 * has loaded and painted (with the scroll position restored), so typing never flashes or jumps.
 */
export function Preview({ code, running = true, runId = 0, onConsole }: Props) {
  const { t } = useTranslation()
  const [frames, setFrames] = useState<Frame[]>([])
  const [activeKey, setActiveKey] = useState(0)
  const nextKey = useRef(1)
  const scrollY = useRef(0)
  const iframes = useRef(new Map<number, HTMLIFrameElement>())
  const onConsoleRef = useRef(onConsole)
  const activeKeyRef = useRef(activeKey)
  useEffect(() => {
    onConsoleRef.current = onConsole
    activeKeyRef.current = activeKey
  })

  const latestKey = frames.at(-1)?.key ?? 0

  /** Shows a frame and drops the older ones. */
  const activate = (key: number) => {
    setActiveKey(key)
    setFrames((prev) => prev.filter((f) => f.key >= key))
  }

  // Build the next version of the page (debounced while typing).
  useEffect(() => {
    if (!running || isEmptyCode(code)) return
    const timer = setTimeout(() => {
      const key = nextKey.current++
      const srcDoc = buildDoc(code, {
        assetOrigin: window.location.origin,
        editorBridge: true,
        scrollY: scrollY.current,
        splitHtml: normalizeHtml,
      })
      onConsoleRef.current?.(null)
      // Keep the visible frame; replace any frame that was still loading.
      setFrames((prev) => [...prev.filter((f) => f.key === activeKeyRef.current), { key, srcDoc }])
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [code, running, runId])

  // Fallback: show the newest frame even if it never reports "ready".
  useEffect(() => {
    if (!latestKey || latestKey === activeKey) return
    const timer = setTimeout(() => activate(latestKey), READY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [latestKey, activeKey])

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data as FrameMessage | undefined
      if (!data?.__orbit) return
      const key = [...iframes.current].find(([, el]) => el.contentWindow === event.source)?.[0]
      if (key === undefined) return
      if (data.kind === 'ready' && key === latestKey) activate(key)
      else if (data.kind === 'scroll' && (key === activeKey || key === latestKey)) scrollY.current = data.y
      else if (data.kind === 'console' && key === latestKey) onConsoleRef.current?.(data)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [latestKey, activeKey])

  if (!running) {
    return <div className="preview preview--empty">{t('preview.stopped')}</div>
  }
  if (isEmptyCode(code)) {
    return (
      <div className="preview preview--empty">
        <span className="preview__rocket" aria-hidden="true">🚀</span>
        {t('preview.empty')}
      </div>
    )
  }
  return (
    <div className="preview-stack">
      {frames.map((frame) => (
        <iframe
          key={frame.key}
          ref={(el) => {
            if (el) iframes.current.set(frame.key, el)
            else iframes.current.delete(frame.key)
          }}
          className="preview"
          data-visible={frame.key === activeKey}
          title={t('preview.title')}
          sandbox={IFRAME_SANDBOX}
          srcDoc={frame.srcDoc}
        />
      ))}
    </div>
  )
}
