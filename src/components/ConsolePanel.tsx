import { useTranslation } from 'react-i18next'
import type { ConsoleMessage } from '../shared/buildDoc'
import { friendlyError, isLoopGuardError } from '../shared/friendlyErrors'

interface Props {
  messages: ConsoleMessage[]
  open: boolean
  onToggle: () => void
  onClear: () => void
}

export function ConsolePanel({ messages, open, onToggle, onClear }: Props) {
  const { t } = useTranslation()
  const errors = messages.filter((m) => m.type === 'error').length

  return (
    <section className={`console ${open ? 'console--open' : ''}`}>
      <header className="console__header">
        <button className="console__toggle" onClick={onToggle} aria-expanded={open}>
          {open ? '▾' : '▸'} {t('console.title')}
          {errors > 0 && <span className="console__badge">{errors}</span>}
        </button>
        {open && messages.length > 0 && (
          <button className="link-button" onClick={onClear}>
            {t('console.clear')}
          </button>
        )}
      </header>
      {open && (
        <ol className="console__list">
          {messages.length === 0 && <li className="console__empty">{t('console.empty')}</li>}
          {messages.map((m, i) => {
            const text = m.args.join(' ')
            const friendly = m.type === 'error' ? friendlyError(text, t) : null
            return (
              <li key={i} className={`console__item console__item--${m.type}`}>
                {friendly ? (
                  <>
                    <strong>
                      {m.line ? t('console.line', { line: m.line }) : ''}
                      {friendly}
                    </strong>
                    {!isLoopGuardError(text) && <code className="console__original">{text}</code>}
                  </>
                ) : (
                  <code>
                    {m.line ? t('console.line', { line: m.line }) : ''}
                    {text}
                  </code>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
