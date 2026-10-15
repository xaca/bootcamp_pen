// Lightweight entry for /p/:slug — no React, no editor, just the published page.
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { doc, getDoc, getFirestore } from 'firebase/firestore/lite'
import { firebaseConfig } from '../firebaseConfig'
import { buildDoc, IFRAME_SANDBOX } from '../shared/buildDoc'
import { normalizeHtml } from '../shared/normalizeHtml'
import type { PublishedDoc } from '../shared/types'

const TEXT = {
  en: { notFound: 'This page does not exist or was unpublished.', error: 'The page could not be loaded. Try again later.', madeBy: 'Made by' },
  es: { notFound: 'Esta página no existe o fue despublicada.', error: 'No se pudo cargar la página. Inténtalo más tarde.', madeBy: 'Hecho por' },
}

const browserLang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'

function showMessage(text: string) {
  const div = document.createElement('div')
  div.className = 'message'
  div.textContent = text
  document.body.append(div)
}

async function main() {
  const slug = decodeURIComponent(location.pathname.replace(/^\/p\//, '').replace(/\/$/, ''))
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return showMessage(TEXT[browserLang].notFound)

  const app = initializeApp(firebaseConfig)
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
  if (recaptchaKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaKey) })
  const db = getFirestore(app)
  let page: PublishedDoc
  try {
    const snap = await getDoc(doc(db, 'published', slug))
    if (!snap.exists()) return showMessage(TEXT[browserLang].notFound)
    page = snap.data() as PublishedDoc
  } catch {
    return showMessage(TEXT[browserLang].error)
  }

  const text = TEXT[page.lang] ?? TEXT.en
  document.title = `${page.studentName} · ${page.classTitle}`
  document.documentElement.lang = page.lang

  const iframe = document.createElement('iframe')
  iframe.title = document.title
  iframe.setAttribute('sandbox', IFRAME_SANDBOX)
  iframe.srcdoc = buildDoc(page, { assetOrigin: location.origin, splitHtml: normalizeHtml })

  const badge = document.createElement('div')
  badge.className = 'badge'
  badge.textContent = `${text.madeBy} ${page.studentName} · ${page.classTitle}`

  document.body.append(iframe, badge)
}

void main()
