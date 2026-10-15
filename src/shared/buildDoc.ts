import type { Code } from './types'
import { guardLoops, LOOP_GUARD_RUNTIME } from './loopGuard'

/** Messages posted from the sandboxed page to the editor (console output, ready, scroll). */
export type FrameMessage =
  | { __orbit: true; kind: 'console'; type: 'log' | 'info' | 'warn' | 'error'; args: string[]; line?: number }
  | { __orbit: true; kind: 'ready' }
  | { __orbit: true; kind: 'scroll'; y: number }

export type ConsoleMessage = Extract<FrameMessage, { kind: 'console' }>

// Editor bridge, injected first in the head:
// - forwards console output and errors (`__JS_LINE__` = document line where script.js starts,
//   so error lines are relative to script.js); Tailwind's "not for production" warning is hidden
// - restores the previous scroll position (`__SCROLL__`) and reports scrolling
// - says "ready" once the page has loaded and painted, so the editor can swap it in without a flash
const EDITOR_BRIDGE = `(function(){var L=__JS_LINE__,Y=__SCROLL__;function post(m){m.__orbit=true;try{parent.postMessage(m,"*")}catch(e){}}function f(a){if(a instanceof Error)return a.message;if(a&&typeof a==="object"){try{return JSON.stringify(a)}catch(e){}}return String(a)}function send(t,a,ln){post({kind:"console",type:t,args:a.map(f),line:ln})}["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){var a=[].slice.call(arguments);if(k==="warn"&&String(a[0]).indexOf("cdn.tailwindcss.com")>-1)return;send(k,a);o.apply(console,arguments)}});window.addEventListener("error",function(e){var ln=e.lineno&&e.lineno>=L?e.lineno-L+1:undefined;send("error",[e.message],ln)});window.addEventListener("unhandledrejection",function(e){var r=e.reason;send("error",[r&&r.message?r.message:String(r)])});var t=0;window.addEventListener("scroll",function(){if(t)return;t=requestAnimationFrame(function(){t=0;post({kind:"scroll",y:window.scrollY})})});window.addEventListener("load",function(){if(Y)window.scrollTo(0,Y);requestAnimationFrame(function(){requestAnimationFrame(function(){post({kind:"ready"})})})})})();`

/** Student HTML split into what goes in <head> and <body> (see normalizeHtml). */
export interface HtmlParts {
  head: string
  body: string
  /** Attributes from a pasted full document, e.g. `class="scroll-smooth"` / `class="bg-gray-100"`. */
  htmlAttributes?: string
  bodyAttributes?: string
}

/**
 * Tailwind's reset (Preflight) makes plain HTML look broken to beginners: <h1> is normal text,
 * links aren't blue, lists have no bullets, buttons look like text. This restores the browser's
 * usual look in Tailwind's lowest layer, so any Tailwind class still wins:
 * - headings always get their usual size and weight;
 * - spacing, link, list and button styles only apply to elements WITHOUT a class, so pages built
 *   with Tailwind (e.g. by AI: `<ul class="flex">`, `<a class="text-white">`) keep Tailwind's look.
 */
export const BEGINNER_BASE_CSS = `@layer base {
  h1 { font-size: 2em; font-weight: 700; }
  h2 { font-size: 1.5em; font-weight: 700; }
  h3 { font-size: 1.17em; font-weight: 700; }
  h4 { font-size: 1em; font-weight: 700; }
  h5 { font-size: 0.83em; font-weight: 700; }
  h6 { font-size: 0.67em; font-weight: 700; }
  h1:not([class]) { margin: 0.67em 0; }
  h2:not([class]) { margin: 0.83em 0; }
  h3:not([class]) { margin: 1em 0; }
  h4:not([class]) { margin: 1.33em 0; }
  h5:not([class]) { margin: 1.67em 0; }
  h6:not([class]) { margin: 2.33em 0; }
  p:not([class]), blockquote:not([class]), figure:not([class]), pre:not([class]), dl:not([class]) { margin: 1em 0; }
  blockquote:not([class]), figure:not([class]) { margin-inline: 40px; }
  ul:not([class]), ol:not([class]) { margin: 1em 0; padding-left: 40px; }
  ul:not([class]) { list-style: disc; }
  ol:not([class]) { list-style: decimal; }
  ul:not([class]) ul:not([class]) { list-style: circle; margin: 0; }
  a:not([class]) { color: #2563eb; text-decoration: underline; }
  a:not([class]):hover { color: #1d4ed8; }
  button:not([class]), input:not([class]), select:not([class]), textarea:not([class]) {
    border: 1px solid #9ca3af; border-radius: 4px; padding: 0.25em 0.5em; background: #fff;
  }
  button:not([class]) { background: #f3f4f6; padding: 0.3em 0.9em; cursor: pointer; }
  button:not([class]):hover { background: #e5e7eb; }
  table:not([class]) td, table:not([class]) th { border: 1px solid #d1d5db; padding: 0.3em 0.6em; }
  th { font-weight: 700; }
}`

interface BuildOptions {
  /** Origin that serves /vendor (the sandboxed page has an opaque origin, so URLs must be absolute). */
  assetOrigin: string
  /** Editor preview only: console forwarding, ready signal and scroll restore. */
  editorBridge?: boolean
  /** Scroll position to restore after reload (editor preview). */
  scrollY?: number
  /** Splits/tidies the student's HTML. Browsers pass normalizeHtml; defaults to "all in body". */
  splitHtml?: (html: string) => HtmlParts
}

/**
 * Wraps the student's code in the hidden page: doctype, head, Tailwind (v3 Play CDN), GSAP.
 * Students can set `tailwind.config = {...}` in script.js; Tailwind v3 rebuilds when it changes.
 * Libraries load in the head, before the student's HTML, so nothing the student types can block them.
 * Used by both the editor preview and the published page so they always match.
 */
export function buildDoc(
  { html, css, js }: Code,
  { assetOrigin, editorBridge = false, scrollY = 0, splitHtml = (body) => ({ head: '', body }) }: BuildOptions,
): string {
  const vendor = `${assetOrigin}/vendor`
  const parts = splitHtml(html)
  const top = [
    '<!doctype html>',
    `<html${parts.htmlAttributes ? ` ${parts.htmlAttributes}` : ''}><head>`,
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    editorBridge ? `<script>${EDITOR_BRIDGE}</script>` : '',
    `<script>${LOOP_GUARD_RUNTIME}</script>`,
    `<script src="${vendor}/tailwind.js"></script>`,
    `<script src="${vendor}/gsap.min.js"></script>`,
    `<script src="${vendor}/ScrollTrigger.min.js"></script>`,
    '<script>gsap.registerPlugin(ScrollTrigger);</script>',
    `<style type="text/tailwindcss">\n${BEGINNER_BASE_CSS}\n</style>`,
    parts.head,
    `<style>\n${css}\n</style>`,
    `</head><body${parts.bodyAttributes ? ` ${parts.bodyAttributes}` : ''}>`,
    parts.body,
    '<script>',
  ].join('\n')

  const jsStartLine = top.split('\n').length + 1
  const head = editorBridge
    ? top.replace('__JS_LINE__', String(jsStartLine)).replace('__SCROLL__', String(Math.round(scrollY)))
    : top
  return `${head}\n${guardLoops(escapeScriptEnd(js))}\n</script>\n</body></html>`
}

// A literal "</script>" inside a JS string would end the inline script early.
function escapeScriptEnd(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script')
}

export function isEmptyCode({ html, css, js }: Code): boolean {
  return !html.trim() && !css.trim() && !js.trim()
}

/** Sandbox for every iframe that runs student code. Never add allow-same-origin. */
export const IFRAME_SANDBOX = 'allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox'
