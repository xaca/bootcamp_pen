import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '../components/CopyButton'
import { currentLang } from '../i18n'
import { AI_TOOL_NAME, AI_TOOL_URL, buildPrompt, parseAnswer } from '../shared/aiPrompt'
import { FILE_NAMES } from '../shared/files'
import type { AiTool, Code, FileKey } from '../shared/types'
import { DiffView } from './DiffView'

interface Props {
  code: Code
  tool: AiTool
  onApply: (code: Code) => void
  onClose: () => void
}

/**
 * AI bridge: the app writes the prompt, the student runs it in the class's free AI chat
 * and pastes the answer back. Nothing changes until the student clicks Apply.
 */
export function AiPanel({ code, tool, onApply, onClose }: Props) {
  const { t } = useTranslation()
  const [request, setRequest] = useState('')
  const [answer, setAnswer] = useState('')
  const [suggestion, setSuggestion] = useState<Code | null>(null)
  const [parseError, setParseError] = useState(false)
  const toolName = AI_TOOL_NAME[tool]

  const prompt = useMemo(() => buildPrompt(request, code, currentLang()), [request, code])
  const changedFiles = suggestion
    ? (['html', 'css', 'js'] as FileKey[]).filter((f) => suggestion[f] !== code[f])
    : []

  const review = () => {
    const parsed = parseAnswer(answer, code)
    setParseError(!parsed)
    setSuggestion(parsed)
  }

  const discard = () => {
    setSuggestion(null)
    setAnswer('')
  }

  return (
    <aside className="ai-panel" aria-label={t('ai.title')}>
      <header className="ai-panel__header">
        <h2>✨ {t('ai.title')}</h2>
        <button className="icon-button" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </header>

      <div className="ai-panel__body">
        <p className="hint">{t('ai.pairsHint', { tool: toolName })}</p>

        <section className="ai-step">
          <h3>1. {t('ai.step1')}</h3>
          <textarea
            rows={3}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t('ai.requestPlaceholder')}
          />
        </section>

        <section className="ai-step" aria-disabled={!request.trim()}>
          <h3>2. {t('ai.step2', { tool: toolName })}</h3>
          <div className="button-row">
            <CopyButton text={prompt} label={t('ai.copyPrompt')} className="button button--primary" />
            <a className="button" href={AI_TOOL_URL[tool]} target="_blank" rel="noreferrer">
              {t('ai.open', { tool: toolName })} ↗
            </a>
          </div>
          <details>
            <summary>{t('ai.seePrompt')}</summary>
            <pre className="ai-panel__prompt">{prompt}</pre>
          </details>
        </section>

        <section className="ai-step">
          <h3>3. {t('ai.step3', { tool: toolName })}</h3>
          <textarea
            rows={5}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setSuggestion(null)
              setParseError(false)
            }}
            placeholder={t('ai.answerPlaceholder')}
          />
          <button className="button" onClick={review} disabled={!answer.trim()}>
            {t('ai.review')}
          </button>
          {parseError && <p className="error">{t('ai.parseError')}</p>}
        </section>

        {suggestion && (
          <section className="ai-step">
            <h3>4. {t('ai.step4')}</h3>
            {changedFiles.length === 0 && <p>{t('ai.noChanges')}</p>}
            {changedFiles.map((file) => (
              <div key={file} className="ai-diff">
                <h4>{FILE_NAMES[file]}</h4>
                <DiffView file={file} original={code[file]} updated={suggestion[file]} />
              </div>
            ))}
            <div className="button-row">
              <button
                className="button button--primary"
                disabled={changedFiles.length === 0}
                onClick={() => onApply(suggestion)}
              >
                {t('ai.apply')}
              </button>
              <button className="button" onClick={discard}>
                {t('ai.discard')}
              </button>
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}
