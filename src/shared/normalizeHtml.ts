import type { HtmlParts } from './buildDoc'

const LIBRARY_SRC = /tailwind|gsap|scrolltrigger/i

/**
 * Lets the browser's HTML parser tidy up what the student typed, so a half-typed tag,
 * an unclosed comment or an unclosed <style> can't swallow the rest of the page.
 * Also accepts a full document: its <head> content (styles, tailwind.config…) goes to the head,
 * and classes on <html>/<body> are kept.
 * Library scripts the editor already preloads (Tailwind, GSAP) are removed.
 * Browser only (uses DOMParser).
 */
export function normalizeHtml(html: string): HtmlParts {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const script of doc.querySelectorAll('script[src]')) {
    if (LIBRARY_SRC.test(script.getAttribute('src') ?? '')) script.remove()
  }
  for (const meta of doc.head.querySelectorAll('meta[charset], meta[name="viewport"]')) meta.remove()
  return {
    head: doc.head.innerHTML,
    body: doc.body.innerHTML,
    htmlAttributes: serializeAttributes(doc.documentElement),
    bodyAttributes: serializeAttributes(doc.body),
  }
}

function serializeAttributes(element: Element): string {
  return Array.from(element.attributes)
    .map(({ name, value }) => `${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join(' ')
}
