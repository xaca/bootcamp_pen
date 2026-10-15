import { useTranslation } from 'react-i18next'
import type { Lang } from '../shared/types'

interface Props {
  onChange?: (lang: Lang) => void
}

export function LangToggle({ onChange }: Props) {
  const { i18n, t } = useTranslation()
  const select = (lang: Lang) => {
    void i18n.changeLanguage(lang)
    onChange?.(lang)
  }
  return (
    <div className="lang-toggle" role="group" aria-label={t('common.language')}>
      {(['es', 'en'] as const).map((lang) => (
        <button key={lang} aria-pressed={i18n.language === lang} onClick={() => select(lang)}>
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
