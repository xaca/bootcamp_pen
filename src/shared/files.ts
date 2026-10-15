import type { FileKey } from './types'

export const FILE_NAMES: Record<FileKey, string> = { html: 'index.html', css: 'style.css', js: 'script.js' }

/** Every student always sees the three files. */
export const ALL_FILES: FileKey[] = ['html', 'css', 'js']

export function publishedUrl(slug: string): string {
  return `${window.location.origin}/p/${slug}`
}
