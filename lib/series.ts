// Turn a series name into a URL-friendly slug, e.g. 'Offline-First KMP' ->
// 'offline-first-kmp'. Kept free of server-only imports (no `fs`) so it can be
// used from client components as well as the build-time API in `lib/api.ts`.
export function seriesSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
