# Working notes, Part 4: The optimistic write you never clean up

Companion to the blog draft [`part-4-blog-write-checkpoints.md`](./part-4-blog-write-checkpoints.md). The
reader-facing text lives there; this file holds only iteration scaffolding. Series-wide rules (spoiler
boundary, concept-ownership map, house style, length cap) live in [`topics.md`](./topics.md).

**Status:** iterating. Done so far: switched running example wine → docket (avoids Part 5 collision);
added TL;DR deck; heading pass (Title Case + keywords); em-dash sweep. Length check done: 1,228 prose
words (1,252 total), ~6 min, within cap, no trim needed.

**Immutability pass (2026-07-19):** added the data-safety beat at the revert paragraph: the sweep
removes the projection, never the event; the durable fact already left up the upload queue (guaranteed by
the gate rule just above), so the revert can't take anything real. Closes the "is deleting my row safe?"
anxiety that "one row out, one row in" (UI continuity) doesn't. References Part 2, no re-derive.

**The idea (the destination):** provisional state should be disposable. If you design your optimistic
writes so the sync layer's normal reconciliation removes them for you, you never write or debug cleanup
code. The trick is to understand the one mechanism your sync engine already uses to reconcile local and
server state, and lean on it deliberately.

**Spoiler boundary:** nothing sensitive: pure PowerSync plumbing. The exact contract that puts the
client's id on the server's row is only *teased* (saved for the talk); Part 4 owns "ids must match for a
clean reconcile," not the contract itself.

## Cover Image (Nano Banana / Gemini)

**At a glance** — *Concept:* incoming server truth is held out by a closed gate until the levels match (your uploads are accounted for), then the gate opens and it comes through. · *Recommended cover:* a closed pair of timber canal-lock gates with the near chamber low and the reach beyond held higher, a laden sailing barge waiting on the high water to come through, in canal-side fog. **(Final — image chosen; see Option A.)**

**Series visual language** (from covers 1–3): fine-art **black-and-white photography**, moody and
atmospheric, a **single old-world / analog subject** as a quiet metaphor, drawn from the **age of
offline navigation and record-keeping** — sailors reading a coast by lighthouse, plotting by dead
reckoning on blank charts, keeping the log by hand (Part 1: a fog-wrapped lighthouse; Part 2: a vintage
typewriter mid-keystroke). Soft natural light, film grain, shallow depth of field or misty negative
space, minimalist, cinematic, **no text, no digital or futuristic elements**. Wide landscape cover crop.

**Core metaphor:** the checkpoint is a *gate*. Server truth — the laden barge waiting on the higher
reach — is held out by the closed gate while the levels differ, i.e. while your local upload queue still
has pending writes ("Could not apply checkpoint due to local data"). Only once the near chamber rises to
match (the queue drains) does the gate open and the barge come through (the checkpoint applies, truth
lands). The closed gate with water seeping through and a barge held on the far side says it in one still
frame: something is waiting to come through, and can't, until the two sides match.

*(The multi-chamber "flight of locks" idea was dropped: image models keep hallucinating the gate/level
logic even when driven directly. The single-gate frame below is the chosen, generated cover.)*

**Proposed slug/path:** `/assets/blog/post/offline-first-write-checkpoints/cover.jpg`

**Option A — The closed lock gate, barge waiting on the higher reach (chosen cover):**
> A fine-art black-and-white photograph, viewed from inside the low near chamber looking straight at a
> closed pair of heavy timber canal-lock gates that meet at a central post. The gates are wet and dark,
> iron-strapped, water seeping through the seams and streaking down the boards; the near chamber water
> sits low and rippling in the foreground while the reach beyond the gates is held clearly higher. On
> that higher water a laden sailing barge — masts and rigging, furled sails, a deck piled with cargo
> sacks, a lit lantern — waits to come through. Behind it, a misty canal-side village: stone houses, a
> lit gas street-lamp, cobbled lockside, trees, all soft in fog. Moody, high-key foggy light, film grain,
> cinematic. Old-world maritime, analog, no text, wide cinematic landscape crop.

**Frontmatter lines (draft):**
```yaml
coverImage: '/assets/blog/post/offline-first-write-checkpoints/cover.jpg'
coverImageAlt: "A closed pair of heavy timber canal-lock gates seen from the low near chamber, water seeping through the wet boards, a laden sailing barge waiting on the higher water beyond to come through, a misty canal-side village behind — black and white"
ogImage:
    url: '/assets/blog/post/offline-first-write-checkpoints/cover.jpg'
ogTitle: "The optimistic write you never clean up"
```
- Alt for **B**: "A three-quarter view of two stepped canal-lock chambers at different levels, a laden barge waiting at a closed gate on the upper reach while a second barge rides low in the lower chamber as the water drains to equalize — black and white"
- Alt for **C**: "A single closed pair of timber lock gates seen side-on with a clear step in the water level across them, a laden barge waiting on the higher far reach until the near chamber rises to match — black and white"
