---
title: 'A Refusal Nobody Sees'
series: 'Offline-First KMP'
seriesPart: 18
excerpt: "The rule that an archived tank may not be edited belongs in the one server step every event passes through before it touches the database. That part was easy. The mistake was what happened when a rule like it fired: the event ended in `VALIDATION_FAILED`, a state no screen showed, so the user's work disappeared and nobody told them. The fix was not a different verdict, it was a screen. A refusal is fine. **A refusal nobody sees is data loss.**"
coverImage: '/assets/blog/post/offline-first-refusal-nobody-sees/cover.jpg'
date: '2026-11-22T02:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','validation','conflict-resolution','sync']
ogImage:
    url: '/assets/blog/post/offline-first-refusal-nobody-sees/cover.jpg'
ogTitle: 'A Refusal Nobody Sees'
---

*Finding the layer for the rule was the easy part. The hard part is what the server does when it says no.*

**TL;DR** The rule belongs in the one server step every event passes through before it touches the
database. That part was easy. The mistake was in what happened when a rule like it fired: the event went
into `VALIDATION_FAILED`, a state no screen showed, so the user's work disappeared and nobody told them.
The fix was not a different verdict. It was a screen. A refusal is fine. A refusal nobody sees is data loss.

> Part 18 of the **Offline-First KMP** series: field notes from a production winery app built on Kotlin
> Multiplatform (KMP). It finishes what [Part 17](/posts/offline-first-no-collision-permission) started.
> That post found a rule our system had never written down: an archived tank may not be edited. This one
> writes it. The architecture around both is mapped in [Part 11](/posts/offline-first-witness-not-judge).

## Where a State Rule Goes

The rule: an event that changes an archived docket, tank, wine or bottle run must not be applied. We had
four places to put it.

<div class="diagram">
<div class="diagram-head">Where "no edits to an archived tank" can live</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Client UI: disable the edit button</span><span class="diagram-tag">a hint: offline, the phone can't know</span></div>
<div class="diagram-row"><span class="diagram-row-name">Payload validation</span><span class="diagram-tag">reads no state: can't see the archive</span></div>
<div class="diagram-row"><span class="diagram-row-name">Conflict classification on the device</span><span class="diagram-tag">too late: may already be applied</span></div>
<div class="diagram-row"><span class="diagram-row-name"><strong>The server's apply step</strong></span><span class="diagram-tag">reads current state at write time</span></div>
</div>
</div>

The client keeps its disabled button, but only as a hint: offline, the phone does not know a colleague
archived the tank. Payload validation checks the event's shape and reads no database state. Conflict
classification runs when someone opens the conflict list, and by then the auto-resolver may already have
applied the event.

The apply step wins on coverage. An event reaches it three ways: a normal upload, a person retrying a
conflict, and the auto-resolver applying an edit it judged harmless. One check there covers all three.
In our code that is a single function, `processEventMutationsOnly`. Anywhere else covers one path and
leaves you believing you covered them all.

## The Mistake: A Rule With No Screen

We had already written one rule of this kind. A bottle run cannot be adjusted or decanted unless it is
open, checked in that same apply step. Right layer.

When the check fired, it threw, and the server marked the event `VALIDATION_FAILED`, a terminal state:
the event stops there for good. Then I searched both clients for a screen that reads that state, and
there was none. So the user recorded an adjustment, their phone showed it, the server refused it, and the
next sync quietly removed it from their device. Nobody was told.

That is the exact failure this architecture exists to prevent: work that disappears without a word. We
had engineered it out of the sync layer and put it straight back in the layer meant to protect
correctness.

It was also inconsistent. If a colleague happened to change the bottle run first, the version check
caught the mismatch, the event parked as a conflict, and the user saw it on the conflict screen. If
nobody had, the event went straight to the apply step and vanished. Same action, same rule, and whether
you found out depended on timing.

## The Fix: Same Verdict, Now Visible on a Screen

The archive rule went into the same apply step with the same verdict: a violation ends in
`VALIDATION_FAILED`. What changed is that the state now has a screen. Recovery lists each person's own
refused events: what the change was and which record it was aimed at. It does not say which rule fired,
and you cannot replay from it yet; that is [Part 19](/posts/offline-first-unsent-not-saved).

Both timings now end on a screen:

<div class="diagram">
<div class="diagram-head">One rule, two timings, two screens</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">The tank was already archived</div>
<div class="diagram-branch-rule">the edit arrives after the archive</div>
<div class="diagram-line">the apply step refuses it</div>
<div class="diagram-line">ends in <span class="diagram-key">VALIDATION_FAILED</span></div>
<div class="diagram-verdict is-ok">Recovery: the refused change, read-only.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">The archive lands while the edit is offline</div>
<div class="diagram-branch-rule">version mismatch on upload</div>
<div class="diagram-line">auto-resolver tries, the rule refuses</div>
<div class="diagram-line">the event is handed to a person</div>
<div class="diagram-verdict is-ok">Conflict screen: Discard, or Unarchive and Retry when a person did the archiving.</div>
</div>
</div>
</div>

The timing difference is still there. It stopped mattering, because neither ending is silent. Most of
our design discussion went into picking a verdict, rejection or conflict. That was the wrong question.
Either is fine, as long as the person whose work it was can see it.

## Refusing to Apply Is Not Refusing to Record

One objection kept this rule unwritten for a long time. Our first principle is that the app never stops
anyone from recording real work. That is why the event log has no foreign keys and the client
[mints its own ids](/posts/offline-first-minting-ids). Refusing an edit because a colleague archived the tank sounded like a violation.

It is not, because recording and applying are separate steps. The refused event stays in the log exactly
as recorded, with its author and its time. What the server refuses is applying it to an entity whose
state changed after the user last saw it. The principle forbids losing the record. It never forbade
refusing to apply it, as long as the person is told.

## The Takeaways

- **Put state rules where every path passes.** For "not allowed in state Y" that is the step that reads
  current state at write time. Earlier cannot see the state; the client can only hint.
- **A refusal needs a screen.** A terminal state no UI reads is silent data loss, whatever you call it.
- **Check every ending of a race.** The same rule can end in two different states depending on timing.
  Each one needs a screen.
- **Recording and applying are different steps.** Keep every record, refuse the apply, and tell the person.
