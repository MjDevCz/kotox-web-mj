---
title: 'No Collision Is Not Permission'
series: 'Offline-First KMP'
seriesPart: 17
excerpt: "An offline rename landed on a tank a colleague had just archived, and nobody was asked. Our conflict check asks *do these two edits write the same column?* The question that matters is *does this edit still make sense, given what changed under it?* Archiving writes one flag, so it almost never overlaps anything, even though it invalidates everything. CRDTs share the blind spot: **convergence is not validity**, and a green drift guard cannot find a rule nobody wrote."
coverImage: '/assets/blog/post/offline-first-no-collision-permission/cover.jpg'
date: '2026-11-22T01:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','conflict-resolution','crdt','sync']
ogImage:
    url: '/assets/blog/post/offline-first-no-collision-permission/cover.jpg'
ogTitle: 'No Collision Is Not Permission'
---

*Our auto-resolver applied an edit to a tank that had been archived. Every check passed, because every check
answered a different question than the one that mattered.*

**TL;DR** What happened: an offline edit landed on a tank a colleague had just archived, and nobody was
asked. Why: our conflict check only asks *do these two edits write the same column?* The real question is
*does this edit still make sense, given what changed under it?* Archiving writes one flag, so it almost never
overlaps anything, even though it invalidates everything. No test noticed, because nothing was broken: a
rule was missing. [Part 18](/posts/offline-first-refusal-nobody-sees) writes that rule.

> Part 17 of the **Offline-First KMP** series: field notes from a production winery app built on Kotlin
> Multiplatform (KMP). [Part 13](/posts/offline-first-auto-resolve) covered three bugs in our
> disjoint-column auto-resolver. This is not a fourth bug. It is the place where the idea itself runs out.
> The architecture around it is mapped in [Part 11](/posts/offline-first-witness-not-judge#conflict-as-a-decision).

## The Edit That Should Not Have Landed

When two offline edits hit the same entity, our server compares the columns each one writes. Different
columns: nobody disagreed, apply it silently. Same column, different values: ask a person.

Somebody renamed a tank offline. Meanwhile a colleague archived that tank for repair.

<div class="diagram">
<div class="diagram-head">Two edits, one tank</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Rename tank</span><span class="diagram-tag">writes name</span></div>
<div class="diagram-row"><span class="diagram-row-name">Archive tank</span><span class="diagram-tag">writes status_id</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">Columns overlap? No.</span><span class="diagram-tag">disjoint, applied</span></div>
</div>
</div>

The archived tank got a new name, and nobody was asked. The resolver was right that the two edits do not
overwrite each other. It just answered the wrong question.

## Disjoint Writes Are Not the Question

Every event rests on a premise it never writes down. A rename assumes *this is a tank you can still edit*.
The archive destroyed that premise, and no column says so.

The version snapshot sent with each event does record what the user was looking at, but only per entity:
"the tank was at version 12". The resolver uses it to decide whether to look closer, and then decides on
columns alone. So the snapshot knows the tank changed, and the column check concludes the change did not
matter.

Lifecycle events make this worst. Archiving invalidates every concurrent edit on the entity, yet it writes
one flag plus its own bookkeeping, columns nobody else touches. **The event that should conflict with
everything is the one least likely to conflict with anything.**

## Why CRDTs Have the Same Blind Spot

This is not a quirk of our rule. A [conflict-free replicated data type (CRDT)](https://crdt.tech) merge
function guarantees every replica converges, which is real and useful. But nothing in an OR-Set or an
LWW-Register can tell that your rename was about a tank archived while you were offline, because the write
set never carried it. Convergence and validity are different properties, and a check built on writes only
ever proves the first.

## Green Tests Cannot See a Missing Rule

We do have a guard for declarations drifting from code: the contract test from
[Part 16](/posts/offline-first-drift-compile-error#check-the-list-against-the-code)
runs every event and fails the build if it writes a column it did not declare. It stayed green, and it was
right to: every declaration matched what the code wrote.

That is its limit: **a drift guard proves your metadata matches your code. It cannot prove your code matches
your domain.** Nowhere in our codebase did anything say *an archived tank may not be edited*. A rule that was
never written is not drift, and nothing that measures drift will find it.

So the resolver was never wrong. It answered the question about columns correctly every time. Nothing in the
system had ever been asked the question that mattered. Where that rule has to live, and what a server should
do when it refuses, is [Part 18](/posts/offline-first-refusal-nobody-sees).

## The Takeaways

- **Disjoint writes prove the edits do not collide, not that they still make sense.** Every event carries
  premises its write set does not show.
- **State stored as a plain column is invisible to column checks.** The transition that invalidates the most
  writes the least.
- **A green drift guard cannot find a missing rule.** It proves your metadata matches your code, never that
  your code matches your domain.
