import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function CopyButton({ text, label, className = 'button' }: { text: string; label?: string; className?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className={className} onClick={copy}>
      {copied ? t('common.copied') : (label ?? t('common.copy'))}
    </button>
  )
}
