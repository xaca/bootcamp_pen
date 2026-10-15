import { parse, type Node } from 'acorn'
import { simple } from 'acorn-walk'

export const LOOP_GUARD_ERROR = '__ORBIT_INFINITE_LOOP__'

/**
 * Defines window.__orbitGuard. A loop whose iterations keep running back-to-back
 * for more than 1.5 s is stopped, so a `while (true)` can't freeze the browser tab.
 */
export const LOOP_GUARD_RUNTIME = `(function(){var s={};window.__orbitGuard=function(id){var n=performance.now(),g=s[id];if(!g||n-g.l>50){g=s[id]={t:n,l:n}}g.l=n;if(n-g.t>1500){delete s[id];throw new Error("${LOOP_GUARD_ERROR}")}}})();`

type LoopNode = Node & { body: Node }

/**
 * Inserts `__orbitGuard(id);` at the start of every loop body.
 * Insertions never add line breaks, so error line numbers still match the student's code.
 * If the code doesn't parse, it is returned unchanged and the browser reports the syntax error.
 */
export function guardLoops(js: string): string {
  if (!js.trim()) return js
  let ast: Node
  try {
    ast = parse(js, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: true })
  } catch {
    return js
  }

  const inserts: { pos: number; text: string }[] = []
  let id = 0
  const visit = (node: Node) => {
    const body = (node as LoopNode).body
    const guard = `__orbitGuard(${id++});`
    if (body.type === 'BlockStatement') {
      inserts.push({ pos: body.start + 1, text: guard })
    } else {
      inserts.push({ pos: body.start, text: `{${guard}` }, { pos: body.end, text: '}' })
    }
  }
  simple(ast, {
    ForStatement: visit,
    ForInStatement: visit,
    ForOfStatement: visit,
    WhileStatement: visit,
    DoWhileStatement: visit,
  })

  let out = js
  for (const { pos, text } of inserts.sort((a, b) => b.pos - a.pos)) {
    out = out.slice(0, pos) + text + out.slice(pos)
  }
  return out
}
