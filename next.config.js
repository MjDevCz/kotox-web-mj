/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server (.next/standalone) with only the traced
  // dependencies, so the deploy ships tens of MB instead of all node_modules.
  output: 'standalone',
  // The tracer copies sharp but misses its native libvips package (loaded via a
  // binary rpath, not a require), which 500s every page that imports sharp.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/@img/sharp-libvips-*/**'],
  },
  // Pin the workspace root to this project. Without this, Next infers the root
  // from the nearest lockfile and can pick up a stray ~/package-lock.json,
  // which misroots Turbopack's file watching (new _posts files not detected).
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig