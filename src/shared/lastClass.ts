/** The last class this browser joined, so the home page can offer "Continue in <class>". */
export interface LastClass {
  code: string
  title: string
}

const KEY = 'orbit.lastClass'

export function readLastClass(): LastClass | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as LastClass | null
    return value?.code ? value : null
  } catch {
    return null
  }
}

export function rememberLastClass(value: LastClass | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value))
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: the student uses the class link or code instead
  }
}
