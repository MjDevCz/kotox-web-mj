---
ogDescription: "When offline is the standard, not the edge case, picking a sync layer is the easy part — the hard part is everything after. Field notes from a KMP app."
# Parts announced but not yet published. The /series page lists them as "Coming soon" with an anchor
# (`#part-N`), so a post can link a mention of an unpublished part to `/series/offline-first-kmp#part-N`.
# An entry hides itself once a post with that `seriesPart` exists; then point those links at the post.
planned:
  - part: 12
    title: 'A Shared ID Must Travel'
    teaser: 'Why the server rejected a wine that plainly existed: the root cause promised in Part 5.'
  - part: 13
    title: 'A Version Bump Is Not a Conflict'
    teaser: 'Auto-resolve fits in one clean line. Here is everything that clean line hides.'
  - part: 14
    title: 'Not Everything Deserves a Ledger'
    teaser: 'We event-source the entities whose history is the product. The interesting category is the one in between.'
  - part: 15
    title: 'Shared Logic Is Not Free'
    teaser: '"One module, three runtimes" is true for the rules. It is not free at the type boundary.'
  - part: 16
    title: 'Make Drift a Compile Error'
    teaser: 'Auto-resolve trusts a hand-written list of what each event changes. Hand-written lists rot.'
  - part: 17
    title: 'Events Read More Than They Write'
    teaser: 'Our conflict resolver got archived entities right for a reason nobody designed, and wrong everywhere else.'
  - part: 18
    title: 'Blocked Is Not Ignored'
    teaser: 'We wrote the missing rule, put it in the right layer, and still got it wrong the first time.'
  - part: 19
    title: 'Unsent Is Not Saved'
    teaser: 'Every promise an offline-first architecture makes about your data begins when the server has it.'
---

When your mobile app must work without internet as a standard, not an edge case, the sync layer is just
the first decision. What comes after — preserving user intent offline, trusting a "success" your server
never actually confirmed, resolving conflicts as a human decision — is where offline-first actually gets
hard. Field notes from a production KMP winery app.
