---
title: 'A Version Bump Is Not a Conflict'
series: 'Offline-First KMP'
seriesPart: 13
excerpt: "When two people edit the same entity offline, the server tries to **auto-resolve** first: disjoint columns mean no real disagreement. Simple on paper. In production it broke three times, on the intervening window, equal values and concurrency, and each break taught the same lesson: a version mismatch is not yet a conflict, and when unsure, **fail closed** and ask a human."
coverImage: '/assets/blog/post/offline-first-auto-resolve/cover.jpg'
date: '2026-11-01T01:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','event-sourcing','conflict-resolution','sync']
ogImage:
    url: '/assets/blog/post/offline-first-auto-resolve/cover.jpg'
ogTitle: 'A Version Bump Is Not a Conflict'
---

*[Part 11](/posts/offline-first-witness-not-judge#conflict-as-a-decision) showed you auto-resolve in one clean line. Here's everything that clean line hides.*

**TL;DR** When two people edit the same entity offline, our server tries to auto-resolve before bothering
anyone: if their edits touched *disjoint* columns, there is no real disagreement, so it applies both. Simple
on paper. In production the idea broke three times, and each break taught the same lesson: a version
mismatch is not yet a conflict, and when you are unsure whether it is one, you ask a human rather than guess.

> Part 13 of the **Offline-First KMP** series: field notes from a production winery app built on Kotlin
> Multiplatform (KMP). [Part 11](/posts/offline-first-witness-not-judge#conflict-as-a-decision) sums up
> conflict auto-resolution in one line: *disjoint columns resolve themselves, real overlaps go to a
> human.* That line is true, but not the whole story. This post covers the three things that broke it in
> production, and why the safe answer is to fail closed.

## The Clean Version: Version Snapshots and Disjoint Columns

Every event our client records carries a **version snapshot**: the version of each entity the user was
looking at when they acted. Two cellar hands edit the same docket offline, both at v3. The first edit lands
and makes v4. The second arrives still claiming v3: a mismatch, but only a *suspicion*. So the server
compares the columns the two edits wrote:

<div class="diagram">
<div class="diagram-head">Second edit arrives: v3 ≠ v4</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">Disjoint columns</div>
<div class="diagram-branch-rule">one renamed, the other changed the date</div>
<div class="diagram-line"><span class="diagram-key">first</span> wrote <code>name</code></div>
<div class="diagram-line"><span class="diagram-key">second</span> wrote <code>date</code></div>
<div class="diagram-verdict is-ok">No disagreement: both apply.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">Same column, different values</div>
<div class="diagram-branch-rule">both renamed the docket</div>
<div class="diagram-line"><span class="diagram-key">first</span> wrote <code>name</code></div>
<div class="diagram-line"><span class="diagram-key">second</span> wrote <code>name</code></div>
<div class="diagram-verdict is-bad">A real conflict: a human decides.</div>
</div>
</div>
</div>

That is the clean version. Here is what it leaves out.

## Break One: Only Edits You Haven't Seen Can Conflict

**The point: compare an event only against the edits its user hadn't seen yet.** Anything older is already
part of the version they acted on, so it can't disagree with them.

Our first query got this wrong. It loaded the entity's whole history, not just the edits made after the
user's snapshot:

<div class="diagram">
<div class="diagram-head">One docket, two windows</div>
<div class="diagram-timeline">
<div class="diagram-window">
<div class="diagram-window-ticks">
<div class="diagram-tick is-compare"><div class="diagram-tick-label">Someone renames the docket</div><div class="diagram-tick-tag">makes v3<br>same column: clash</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">You rename it again, offline</div><div class="diagram-tick-tag">you saw v3</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Another user changes the date</div><div class="diagram-tick-tag">makes v4<br>other column: fine</div></div>
</div>
<div class="diagram-window-label">First query: whole history</div>
</div>
<div class="diagram-tick is-compare"><div class="diagram-tick-label">Your rename is checked</div><div class="diagram-tick-tag">v3 ≠ v4<br>false conflict</div></div>
</div>
<div class="diagram-timeline">
<div class="diagram-tick is-skip"><div class="diagram-tick-label">Someone renames the docket</div><div class="diagram-tick-tag">makes v3<br>already seen</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">You rename it again, offline</div><div class="diagram-tick-tag">you saw v3</div></div>
<div class="diagram-window" style="flex-grow: 1">
<div class="diagram-window-ticks">
<div class="diagram-tick"><div class="diagram-tick-label">Another user changes the date</div><div class="diagram-tick-tag">makes v4<br>other column: fine</div></div>
</div>
<div class="diagram-window-label">Fix: since you looked</div>
</div>
<div class="diagram-tick"><div class="diagram-tick-label">Your rename is checked</div><div class="diagram-tick-tag">v3 ≠ v4<br>auto-resolves</div></div>
</div>
</div>

The first rename made v3, the version you were looking at, so it can't have raced you. The fix drops every
event your snapshot already contains; what is left is the *intervening window*. When the server can't prove
an event is already in your snapshot, it keeps it: at worst, a human gets asked.

The check also trusts each event's own list of the columns it writes, and hand-written lists rot;
[Part 16](/series/offline-first-kmp#part-16) is how we stop that from happening quietly.

## Break Two: The Same Value Is Not a Disagreement

The check assumes two writes to the same column clash. They don't if the values match. Two devices mark the
same docket as received offline, both writing `status` = received. The columns overlap, so the naive check
asks a human to settle a disagreement that doesn't exist.

Now an overlap with an *identical* value is a no-op: recorded as resolved, nothing applied, nobody asked. A
conflict requires a difference, not just a collision.

## Break Three: Row Locks So the Check Survives Concurrency

Everything above assumes a stable history. On our server, several batches process events for the same
workspace in parallel, so another batch could change a docket while the auto-resolver is reading it. So the
whole check runs in one transaction that locks every entity in the snapshot first:

<div class="diagram">
<div class="diagram-head">One auto-resolve, start to finish</div>
<div class="diagram-timeline">
<div class="diagram-tick"><div class="diagram-tick-label">Mismatch found</div><div class="diagram-tick-tag">v3 ≠ v4</div></div>
<div class="diagram-window" style="flex-grow: 4">
<div class="diagram-window-ticks">
<div class="diagram-tick is-compare"><div class="diagram-tick-label">Lock the rows</div><div class="diagram-tick-tag">in id order</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Re-check the snapshot</div><div class="diagram-tick-tag">versions moved?</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Scan the window</div><div class="diagram-tick-tag">now stable</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Apply, or ask a human</div><div class="diagram-tick-tag">disjoint or not</div></div>
</div>
<div class="diagram-window-label">Rows locked: other batches wait</div>
</div>
<div class="diagram-tick"><div class="diagram-tick-label">Commit</div><div class="diagram-tick-tag">locks released</div></div>
</div>
</div>

The lock is one statement:

```sql
SELECT 1 FROM <table> WHERE id IN (...) ORDER BY id FOR UPDATE
```

`ORDER BY id` makes every transaction take its locks in the same order, so two of them can't deadlock. The
re-check catches a version that moved just before the lock; versions only go up, so it can only find more
conflicts, never fewer.

Locking is **strict by default**: if the database adapter can't take row locks, auto-resolve doesn't run at
all. A loud failure beats concurrent batches silently skipping conflict detection.

## Fail Closed: When Unsure, Ask a Human

**The point: auto-resolve may only apply an edit when it is sure. Everything else goes to a human.**

Three breaks in one small feature taught us not to trust it to be clever. So every case it can't be sure
about ends the same way, as a conflict for a person:

- more than ten intervening events on the entity
- an event type it doesn't know, or a payload it can't decode
- an entity that no longer exists

Ten is a number we picked: today's cellars never come close, and if real use does, we raise it. The point is
that a limit exists, and crossing it falls toward a person.

That makes its mistakes one-sided:

<div class="diagram">
<div class="diagram-head">The two ways auto-resolve can be wrong</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">Too careful</div>
<div class="diagram-branch-rule">asks when it didn't need to</div>
<div class="diagram-line">a person reviews a false conflict</div>
<div class="diagram-verdict is-ok">Allowed: an annoyance.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">Too confident</div>
<div class="diagram-branch-rule">applies when it shouldn't have</div>
<div class="diagram-line">a real conflict is written silently</div>
<div class="diagram-verdict is-bad">Never: it corrupts data.</div>
</div>
</div>
</div>

When the machine is not certain two humans agreed, it asks them.

One caveat: everything above makes the auto-resolver's mistakes harmless; none of it proves the column
comparison asks the right question. Two edits can touch different columns and still not make sense together;
[Part 17](/series/offline-first-kmp#part-17) is where that bites.

## The Takeaways

- **A version mismatch is a question, not an answer.** Disjoint columns are the easy part. The window,
  equal values and concurrency are where the correctness lives.
- **Only edits the user hadn't seen can conflict.** Compare against what changed since their snapshot,
  not against the entity's whole history.
- **Fail closed, loudly.** An auto-resolver that over-asks is an annoyance. One that under-asks corrupts
  data silently.
