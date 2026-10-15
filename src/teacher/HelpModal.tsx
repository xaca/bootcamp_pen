import { useTranslation } from 'react-i18next'
import { Modal } from '../components/Modal'

const SECTIONS = ['progress', 'reopenStudent', 'moveWork', 'reopenTeacher', 'tips'] as const

/** In-app version of the guides in PLAN.md 4.3 / 4.4. */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal title={t('help.title')} onClose={onClose}>
      <div className="help">
        {SECTIONS.map((section) => (
          <section key={section}>
            <h3>{t(`help.${section}.title`)}</h3>
            <ol>
              {(t(`help.${section}.steps`, { returnObjects: true }) as string[]).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Modal>
  )
}
