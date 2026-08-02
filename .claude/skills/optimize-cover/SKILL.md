---
name: optimize-cover
description: Convert a blog post cover image (PNG/large JPG) into an optimized JPG that matches the other covers in this repo — ~1920px wide, ~200–290KB. Use whenever the user asks to optimize, compress, or convert a cover image under public/assets/blog/post/, or invokes /optimize-cover.
---

# Optimize Cover Image

Convert an oversized or PNG cover into an optimized JPG consistent with the existing covers
in `public/assets/blog/post/<slug>/cover.jpg`.

## Target spec (match the other covers)

- **Format:** JPG (`cover.jpg`)
- **Width:** 1920px (height scales proportionally)
- **Weight:** ~200–290 KB. Peers range ~180–260 KB.
- **Quality:** start at JPEG quality **65** via `sips`. Bump up/down only if the file lands
  well outside the ~200–290 KB band.

## Steps

1. **Locate the source.** Default target folder: `public/assets/blog/post/<slug>/`. If the user
   names a post or points at a file, use that. Confirm the current dimensions and size:
   ```
   sips -g pixelWidth -g pixelHeight <source>
   ```

2. **Convert + resize** to `cover.jpg` in the same folder:
   ```
   sips -s format jpeg -s formatOptions 65 --resampleWidth 1920 <source> --out cover.jpg
   ```
   If the source is already `cover.jpg`, write to a temp name and swap, or resize in place.

3. **Check the result** — dimensions and file size:
   ```
   sips -g pixelWidth -g pixelHeight cover.jpg && ls -la cover.jpg
   ```
   If size is far above ~290 KB, drop quality (e.g. 55); if it looks under-compressed/soft
   and well under ~180 KB, raise it (e.g. 75).

4. **Remove the original** if it was a different file (e.g. the source `cover.png`). Use
   `/bin/rm -f <source>` — the shell aliases `rm` to interactive mode, which stalls on a prompt.

5. **Check the frontmatter.** If the extension changed (`.png` → `.jpg`), verify the post's
   `coverImage:` in `_posts/<slug>.md` (and any inline `![](...)` references) point to
   `cover.jpg`. Update if needed.

6. **Report** the before/after: format, size, and dimensions.

## Notes

- `sips` is built into macOS — no extra tooling needed.
- Keep the filename `cover.jpg` (per repo convention in `public/assets/blog/post/<folder>/`).