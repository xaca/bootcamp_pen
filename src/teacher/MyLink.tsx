import { useTranslation } from 'react-i18next'
import { CopyButton } from '../components/CopyButton'
import { QrCode } from '../components/QrCode'
import { personalLink } from '../shared/slug'

/** The teacher's personal link with one-tap ways to keep it: WhatsApp, email, copy, QR. */
export function MyLink({ accessKey }: { accessKey: string }) {
  const { t } = useTranslation()
  const link = personalLink(accessKey)
  const message = t('myLink.message', { link })
  return (
    <div className="my-link">
      <p>{t('myLink.intro')}</p>
      <div className="button-row">
        <a className="button button--primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          {t('myLink.whatsapp')}
        </a>
        <a
          className="button"
          href={`mailto:?subject=${encodeURIComponent(t('myLink.emailSubject'))}&body=${encodeURIComponent(message)}`}
        >
          {t('myLink.email')}
        </a>
        <CopyButton text={link} label={t('myLink.copy')} />
      </div>
      <details>
        <summary>{t('myLink.showQr')}</summary>
        <QrCode value={link} size={200} label={t('myLink.qr')} />
      </details>
      <p className="warning">{t('myLink.warning')}</p>
    </div>
  )
}
