import type { AiTool, Code, FileKey, Lang } from './types'

export const AI_TOOL_URL: Record<AiTool, string> = {
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com/',
}

export const AI_TOOL_NAME: Record<AiTool, string> = {
  gemini: 'Gemini',
  chatgpt: 'ChatGPT',
}

const RULES: Record<Lang, string> = {
  en: `You are helping a student (12–16 years old) build a web page in a classroom editor.

How the editor works:
- The student only writes three files: index.html (only what goes inside <body>), style.css and script.js.
- Tailwind CSS v3 (the Play CDN) and GSAP (with ScrollTrigger already registered) are ALREADY loaded. Never add <script>, <link>, <head>, <html>, <body> or <!doctype> tags, and never import libraries.
- For custom Tailwind colors or fonts, put "tailwind.config = { ... }" at the top of script.js.
- Keep the code simple and readable for a beginner, and add short comments in English.
- Keep everything the student already wrote unless the request asks to change it.

Answer format (very important):
1. One or two short sentences in English explaining what you changed.
2. Then the COMPLETE updated content of each file, in exactly three code blocks labelled html, css and js (in that order). If a file doesn't change, repeat it unchanged. If it is empty, leave the block empty.`,
  es: `Estás ayudando a un estudiante (de 12 a 16 años) a construir una página web en un editor de clase.

Cómo funciona el editor:
- El estudiante solo escribe tres archivos: index.html (solo lo que va dentro de <body>), style.css y script.js.
- Tailwind CSS v3 (el Play CDN) y GSAP (con ScrollTrigger ya registrado) YA están cargados. Nunca agregues etiquetas <script>, <link>, <head>, <html>, <body> ni <!doctype>, y nunca importes librerías.
- Para colores o fuentes personalizados de Tailwind, pon "tailwind.config = { ... }" al inicio de script.js.
- Mantén el código simple y fácil de leer para un principiante, y agrega comentarios cortos en español.
- Conserva todo lo que el estudiante ya escribió, salvo que el pedido diga cambiarlo.

Formato de respuesta (muy importante):
1. Una o dos frases cortas en español explicando qué cambiaste.
2. Luego el contenido COMPLETO actualizado de cada archivo, en exactamente tres bloques de código etiquetados html, css y js (en ese orden). Si un archivo no cambia, repítelo igual. Si está vacío, deja el bloque vacío.`,
}

const LABELS: Record<Lang, { code: string; request: string }> = {
  en: { code: "The student's current code:", request: "The student's request:" },
  es: { code: 'El código actual del estudiante:', request: 'El pedido del estudiante:' },
}

const FENCE = '```'

export function buildPrompt(request: string, code: Code, lang: Lang): string {
  const l = LABELS[lang]
  return [
    RULES[lang],
    '',
    l.code,
    '',
    `${FENCE}html\n${code.html}\n${FENCE}`,
    '',
    `${FENCE}css\n${code.css}\n${FENCE}`,
    '',
    `${FENCE}js\n${code.js}\n${FENCE}`,
    '',
    l.request,
    request.trim(),
  ].join('\n')
}

const LANG_TO_FILE: Record<string, FileKey> = {
  html: 'html',
  xml: 'html',
  css: 'css',
  js: 'js',
  javascript: 'js',
}

/**
 * Extracts html/css/js code blocks from an AI answer. Files without a block keep the current code.
 * Returns null when no usable block was found.
 */
export function parseAnswer(answer: string, current: Code): Code | null {
  const result: Code = { ...current }
  const blocks: Partial<Code> = {}
  const re = /```[ \t]*([a-zA-Z]*)[^\n]*\n([\s\S]*?)```/g
  for (const match of answer.matchAll(re)) {
    const file = LANG_TO_FILE[match[1].toLowerCase()]
    if (file) blocks[file] = match[2].replace(/\s+$/, '')
  }
  if (blocks.html === undefined && blocks.css === undefined && blocks.js === undefined) return null

  if (blocks.css !== undefined) result.css = blocks.css
  if (blocks.js !== undefined) result.js = blocks.js
  if (blocks.html !== undefined) {
    const page = splitFullDocument(blocks.html)
    result.html = page.html
    if (isFullDocument(blocks.html)) {
      // A whole page replaces everything: its <head> styles become style.css and its
      // tailwind.config goes to the top of script.js (plus any separate css/js blocks).
      result.css = joinCode(page.css, blocks.css ?? '')
      result.js = joinCode(page.js, blocks.js ?? '')
    }
  }
  return result
}

function isFullDocument(html: string): boolean {
  return /<html[\s>]|<head[\s>]|<body[\s>]|<!doctype/i.test(html)
}

function joinCode(first: string, second: string): string {
  return [first.trim(), second.trim()].filter(Boolean).join('\n\n')
}

/**
 * If the AI returned a full document anyway: keep only the body, drop library scripts,
 * and pull <style> blocks and the `tailwind.config` script out of the <head>.
 */
export function splitFullDocument(html: string): Code {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const css = [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1].trim()).join('\n\n')
  const js = [...head.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter((code) => code.includes('tailwind.config'))
    .join('\n\n')

  let out = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  out = out.replace(/<!doctype[^>]*>/gi, '')
  out = out.replace(/<script[^>]*src=["'][^"']*(tailwind|gsap|scrolltrigger)[^"']*["'][^>]*>\s*<\/script>/gi, '')
  return { html: out.replace(/^\s*\n/, '').replace(/\s+$/, ''), css, js }
}
