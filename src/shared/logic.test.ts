import { describe, expect, it } from 'vitest'
import { buildPrompt, parseAnswer } from './aiPrompt'
import { buildDoc } from './buildDoc'
import { guardLoops, LOOP_GUARD_ERROR, LOOP_GUARD_RUNTIME } from './loopGuard'
import { newAccessKey, newJoinCode, newPublishSlug, parseAccessKey, slugify } from './slug'
import type { Code } from './types'

function runGuarded(js: string) {
  const g = globalThis as unknown as { window: unknown }
  g.window = globalThis
  new Function(LOOP_GUARD_RUNTIME)()
  return new Function(guardLoops(js))()
}

describe('guardLoops', () => {
  it('stops infinite loops of every kind', () => {
    for (const js of ['while (true) {}', 'for (;;);', 'do {} while (true)', 'let i = 0; while (true) i++']) {
      expect(() => runGuarded(js), js).toThrow(LOOP_GUARD_ERROR)
    }
  }, 15_000) // each loop is allowed to run for 1.5 s before it is stopped

  it('leaves normal loops working', () => {
    expect(runGuarded('let s = 0; for (let i = 0; i < 1000; i++) s += i; return s')).toBe(499500)
    expect(runGuarded('let out = []; for (const x of [1, 2]) for (const y of [3]) out.push(x * y); return out')).toEqual([3, 6])
  })

  it('keeps line numbers and returns unparseable code unchanged', () => {
    const js = 'const a = 1\nwhile (a < 0) {\n  console.log(a)\n}\n'
    expect(guardLoops(js).split('\n')).toHaveLength(js.split('\n').length)
    expect(guardLoops('if (')).toBe('if (')
  })
})

describe('buildDoc', () => {
  const code: Code = { html: '<h1>Hi</h1>\n<p>x</p>', css: 'h1 {\n  color: red;\n}', js: 'console.log(1)\nfoo()' }

  it('hides the libraries in the wrapper and loads them from our origin', () => {
    const doc = buildDoc(code, { assetOrigin: 'https://example.test' })
    expect(doc).toContain('https://example.test/vendor/tailwind.js')
    expect(doc).toContain('https://example.test/vendor/gsap.min.js')
    expect(doc).not.toContain('__JS_LINE__')
  })

  it('reports the document line where script.js starts', () => {
    const doc = buildDoc(code, { assetOrigin: '', editorBridge: true })
    const jsLine = Number(doc.match(/var L=(\d+),/)?.[1])
    expect(doc.split('\n')[jsLine - 1]).toBe('console.log(1)')
  })

  it('loads every library in the head, before the student HTML', () => {
    const doc = buildDoc(code, { assetOrigin: 'https://example.test' })
    const body = doc.indexOf('<body>')
    for (const lib of ['tailwind.js', 'gsap.min.js', 'ScrollTrigger.min.js']) expect(doc.indexOf(lib)).toBeLessThan(body)
  })

  it('restores the scroll position in the editor preview', () => {
    expect(buildDoc(code, { assetOrigin: '', editorBridge: true, scrollY: 420 })).toContain('Y=420')
  })

  it('restores browser defaults for plain HTML in a Tailwind base layer', () => {
    const doc = buildDoc(code, { assetOrigin: '' })
    expect(doc).toContain('<style type="text/tailwindcss">')
    expect(doc).toContain('h1 { font-size: 2em; font-weight: 700; }')
    expect(doc).toContain('a:not([class]) { color: #2563eb; text-decoration: underline; }')
  })

  it('keeps classes from a pasted <html> and <body>', () => {
    const doc = buildDoc(code, {
      assetOrigin: '',
      splitHtml: (body) => ({ head: '', body, htmlAttributes: 'class="scroll-smooth"', bodyAttributes: 'class="bg-gray-100"' }),
    })
    expect(doc).toContain('<html class="scroll-smooth">')
    expect(doc).toContain('<body class="bg-gray-100">')
  })

  it("doesn't let </script> in student JS break the page", () => {
    const doc = buildDoc({ ...code, js: 'const s = "</script>"' }, { assetOrigin: '' })
    expect(doc).toContain('"<\\/script>"')
  })
})

describe('AI bridge', () => {
  const current: Code = { html: '<h1>Old</h1>', css: 'h1 { color: red; }', js: '' }

  it('builds a prompt in the requested language with the current code', () => {
    const prompt = buildPrompt('make it blue', current, 'es')
    expect(prompt).toContain('El pedido del estudiante')
    expect(prompt).toContain('<h1>Old</h1>')
    expect(prompt).toContain('make it blue')
  })

  it('extracts code blocks and keeps files the answer omits', () => {
    const answer = 'I made it blue.\n\n```html\n<h1>New</h1>\n```\n\n```css\nh1 { color: blue; }\n```\n'
    expect(parseAnswer(answer, current)).toEqual({ html: '<h1>New</h1>', css: 'h1 { color: blue; }', js: '' })
  })

  it('accepts javascript labels and strips full documents and library scripts', () => {
    const answer = [
      '```html',
      '<!DOCTYPE html><html><head></head><body>',
      '<h1>Hi</h1>',
      '<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>',
      '</body></html>',
      '```',
      '```javascript',
      "gsap.from('h1', { opacity: 0 })",
      '```',
    ].join('\n')
    const parsed = parseAnswer(answer, current)
    expect(parsed?.html).toBe('<h1>Hi</h1>')
    expect(parsed?.js).toBe("gsap.from('h1', { opacity: 0 })")
  })

  it('keeps tailwind.config and <style> from a full AI document', () => {
    const answer = [
      '```html',
      '<!DOCTYPE html><html><head>',
      '<script src="https://cdn.tailwindcss.com"></script>',
      "<script>tailwind.config = { theme: { extend: { colors: { primary: '#ff5722' } } } }</script>",
      '<style>body { margin: 0; }</style>',
      '</head><body>',
      '<header class="bg-primary">Orbit</header>',
      '</body></html>',
      '```',
    ].join('\n')
    const parsed = parseAnswer(answer, current)
    expect(parsed?.html).toBe('<header class="bg-primary">Orbit</header>')
    expect(parsed?.js).toContain("tailwind.config = { theme: { extend: { colors: { primary: '#ff5722' } } } }")
    expect(parsed?.css).toBe('body { margin: 0; }')
  })

  it('returns null when there is no code', () => {
    expect(parseAnswer('Sorry, I cannot help.', current)).toBeNull()
  })
})

describe('slugs', () => {
  it('strips accents and symbols', () => {
    expect(slugify('José Pérez!')).toBe('jose-perez')
    expect(newPublishSlug('Orbit Club', 'Ana y Luis')).toMatch(/^orbit-club-ana-y-luis-[a-z0-9]{3}$/)
  })

  it('creates join codes that match the security rules', () => {
    expect(newJoinCode()).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })

  it('creates access keys that match the security rules', () => {
    const key = newAccessKey()
    expect(key).toMatch(/^[A-Z0-9]{20}$/)
    expect(newAccessKey()).not.toBe(key)
  })

  it('reads an access key from a pasted personal link or the bare key', () => {
    const key = 'K7QM4TZP9XR2VB8NW3CY'
    expect(parseAccessKey(`https://editorweb-29040.web.app/t/${key}`)).toBe(key)
    expect(parseAccessKey(` https://editorweb-29040.web.app/t/${key.toLowerCase()}/ `)).toBe(key)
    expect(parseAccessKey(key)).toBe(key)
    expect(parseAccessKey('https://editorweb-29040.web.app/teacher')).toBeNull()
    expect(parseAccessKey('MARIA-7K2Q9P')).toBeNull()
  })
})
