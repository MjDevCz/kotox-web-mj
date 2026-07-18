/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this project. Without this, Next infers the root
  // from the nearest lockfile and can pick up a stray ~/package-lock.json,
  // which misroots Turbopack's file watching (new _posts files not detected).
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig