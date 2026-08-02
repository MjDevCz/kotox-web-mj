---
name: optimize-cover
description: Convert a blog post cover image (PNG/large JPG) into an optimized JPG that matches the other covers in this repo — ~1920px wide, ~200–290KB. Use whenever the user asks to optimize, compress, or convert a cover image under public/assets/blog/post/, or invokes /optimize-cover.
---

# Optimize Cover Image

Convert an oversized or PNG cover into an optimized JPG consistent with the existing covers
in `public/assets/blog/post/<slug>/`.

## Target spec (match the other covers)

- **Format:** JPG
- **Width:** 1920px (height scales proportionally)
- **Weight:** ~200–290 KB. Peers range ~180–260 KB.
- **Quality:** start at JPEG quality **65** via `sips`. Bump up/down only if the file lands
  well outside the ~200–290 KB band.

## Steps

1. **Pick the source image.** If the user named a post, file, or folder, use it. Otherwise
   list the candidate images so the choice is explicit:
   ```
   ls -la public/assets/blog/post/<slug>/
   ```
   If more than one image could be the source (e.g. `cover.png` and `cover2.png`), **ask the
   user which one to optimize** rather than guessing. Confirm its dimensions and size:
   ```
   sips -g pixelWidth -g pixelHeight <source>
   ```

2. **Decide the output name — never overwrite by default.** The default output name is the
   **same basename as the source, with the suffix changed to `.jpg`** (e.g. `cover2.png` →
   `cover.jpg`, `hero.png` → `hero.jpg`). Do **not** default to `cover.jpg`.
   - If a different name is wanted (e.g. promoting the source to the post's real `cover.jpg`),
     **ask the user** for the target name.
   - Before writing, check whether the target name already exists. If it does and it isn't the
     source itself, **ask the user** before overwriting — don't clobber an existing cover silently.

3. **Convert + resize** to the chosen output name in the same folder:
   ```
   sips -s format jpeg -s formatOptions 65 --resampleWidth 1920 <source> --out <target>.jpg
   ```
   If the source and target are the same file (resizing a `.jpg` in place), write to a temp
   name first and swap.

4. **Check the result** — dimensions and file size:
   ```
   sips -g pixelWidth -g pixelHeight <target>.jpg && ls -la <target>.jpg
   ```
   If size is far above ~290 KB, drop quality (e.g. 55); if it looks under-compressed/soft
   and well under ~180 KB, raise it (e.g. 75).

5. **Remove the source** only if it's a different file from the target (e.g. the `.png` source
   after producing the `.jpg`), and only once the user's intent is clear that the source is no
   longer needed. Use `/bin/rm -f <source>` — the shell aliases `rm` to interactive mode, which
   stalls on a prompt. When in doubt, leave the source in place and mention it.

6. **Check the frontmatter.** If the post should point at the new file (extension or name
   changed), verify the post's `coverImage:` in `_posts/<slug>.md` (and any inline `![](...)`
   references) point to the right filename. Update if needed.

7. **Report** the before/after: source → target name, format, size, and dimensions.

## Notes

- `sips` is built into macOS — no extra tooling needed.
- Repo convention is a `cover.jpg` per post folder in `public/assets/blog/post/<folder>/`, but
  producing an alternate name (e.g. `cover.jpg`) is fine — promoting it to `cover.jpg` is a
  separate, explicit step the user must confirm.