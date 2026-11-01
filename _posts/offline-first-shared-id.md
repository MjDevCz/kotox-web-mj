---
title: 'A Shared ID Must Travel'
series: 'Offline-First KMP'
seriesPart: 12
excerpt: "A client-minted id only unifies client and server **if it travels in the payload**. Mint the same id independently on both sides and you get two ids that merely look alike, so anything referencing that entity points at the wrong one. And in an event-sourced system you can't migrate the past: a fix only helps future events, so old and new have to coexist."
coverImage: '/assets/blog/post/offline-first-shared-id/cover.jpg'
date: '2026-11-01T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','event-sourcing','sync','uuid']
ogImage:
    url: '/assets/blog/post/offline-first-shared-id/cover.jpg'
ogTitle: 'A Shared ID Must Travel'
---

*Why the server rejected a wine that plainly existed: the root cause promised in [Part 5](/posts/offline-first-silent-success#nothing-is-lost-at-the-door-either).*

**TL;DR** A client-minted id only unifies client and server if it travels in the payload. Mint the same
id independently on both sides and you get two ids that merely look alike, so anything referencing that
entity points at the wrong one. And in an event-sourced system you can't migrate the past: a fix to your
events only helps future events, so it has to make old and new coexist.

> Part 12 of the **Offline-First KMP** series, and the capstone of its immutability arc: field notes from a
> production winery app built on Kotlin Multiplatform (KMP). It's the war story underneath the "mint the
> ID, and make it travel" section of [Part 11](/posts/offline-first-witness-not-judge#mint-the-id-and-make-it-travel), the map of the
> whole architecture.
>
> [Part 5](/posts/offline-first-silent-success#reading-the-logs-where-the-200-lied) told the surface of this bug, an HTTP 200 that lied and a
> sync connector that silently dropped the failure, and left one thread deliberately unpulled: *why* the
> server rejected a wine that plainly existed. This post pulls it. It builds on the model from Parts 2 to 4:
> an uploaded [event plus a local projection](/posts/offline-first-two-writes#write-1-the-event-what-happened),
> [client-minted ids](/posts/offline-first-minting-ids#what-the-client-minted-id-buys-you), and
> [checkpoints that sweep the provisional rows away](/posts/offline-first-write-checkpoints#what-happens-when-the-checkpoint-gate-opens).

## Where Part 5 Left Off: The Missing Timeline Breadcrumb

A quick recap of [Part 5](/posts/offline-first-silent-success#the-breadcrumb), so this stands on its own.

Some actions create a wine as a *side effect*: assign a docket to a tank, or transfer wine into an
occupied tank, and a new wine comes out. Each time, the processor also emits a marker event,
`CELLAR_WINE_CREATED`, so the wine's timeline can show a "wine created" row. A breadcrumb.

Those rows kept going missing, while the wine itself was fine. The upload logs showed why: the batch
returned HTTP 200, but the breadcrumb inside it had failed validation.

```
POST /v1/powersync/write
  HARVEST_DOCKET_ASSIGN  → 200 {"success":1,"error":0}
  CELLAR_WINE_CREATED    → 200 {"success":0,"error":1}
      results[1].error: "wine_id 159e8928… does not reference an existing wine"
```

The connector logged it and moved on. So why did the server say the wine didn't exist, when it plainly
did?

## The Root Cause: Two Wines, Two IDs

There were **two** wines, and the breadcrumb pointed at the wrong one.

Normally the client mints an entity's id, sends it inside the event, and the server reuses it
([Part 3](/posts/offline-first-minting-ids#what-the-client-minted-id-buys-you)). Back then, the
side-effect wine skipped that step: its id was never in the event payload. Here is what one offline
assign did:

<div class="diagram">
<div class="diagram-head">One offline assign, back then</div>
<div class="diagram-timeline">
<div class="diagram-tick"><div class="diagram-tick-label">Assign on the device</div><div class="diagram-tick-tag">wine A<br>breadcrumb → A</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Upload</div><div class="diagram-tick-tag">assign<br>+ breadcrumb</div></div>
<div class="diagram-window" style="flex-grow: 2">
<div class="diagram-window-ticks">
<div class="diagram-tick is-compare"><div class="diagram-tick-label">Server runs the assign</div><div class="diagram-tick-tag">wine B,<br>no breadcrumb</div></div>
<div class="diagram-tick is-compare"><div class="diagram-tick-label">Server checks the breadcrumb</div><div class="diagram-tick-tag">no wine A:<br>rejected</div></div>
</div>
<div class="diagram-window-label">On the server</div>
</div>
<div class="diagram-tick"><div class="diagram-tick-label">Batch returns 200</div><div class="diagram-tick-tag">failure dropped</div></div>
<div class="diagram-tick is-compare"><div class="diagram-tick-label">Next sync</div><div class="diagram-tick-tag">wine B,<br>row missing</div></div>
</div>
</div>

The result: the wine is there, with the right volume, in the right tank, but its "wine created" row is
missing from the timeline. The 200 that hid the rejection is
[Part 5](/posts/offline-first-silent-success#why-the-connector-let-it-go)'s war story; the sync that swaps
wine A for wine B is [Part 4](/posts/offline-first-write-checkpoints#the-cleanup-code-you-never-write)'s
checkpoint.

That happened on *every* wine-creating event, not now and then. It only looked intermittent because a
missing breadcrumb is cosmetic and the failure was swallowed.

## The Fix: The Wine ID Travels, the Breadcrumb Stays

The fix sorts what the device knows into two piles: what travels to the server, and what stays on the
device.

<div class="diagram">
<div class="diagram-head">One offline assign, today</div>
<div class="diagram-timeline">
<div class="diagram-tick"><div class="diagram-tick-label">Assign on the device</div><div class="diagram-tick-tag">wine A<br>breadcrumb → A</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Upload</div><div class="diagram-tick-tag">assign + wine A's id<br>breadcrumb stays</div></div>
<div class="diagram-window" style="flex-grow: 2">
<div class="diagram-window-ticks">
<div class="diagram-tick"><div class="diagram-tick-label">Server runs the assign</div><div class="diagram-tick-tag">same id:<br>wine A</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Server writes the breadcrumb</div><div class="diagram-tick-tag">breadcrumb → A</div></div>
</div>
<div class="diagram-window-label">On the server</div>
</div>
<div class="diagram-tick"><div class="diagram-tick-label">Batch returns 200</div><div class="diagram-tick-tag">nothing failed</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Next sync</div><div class="diagram-tick-tag">wine A,<br>row present</div></div>
</div>
</div>

**The wine id travels.** The assign event now carries wine A's id, and the server creates the wine with
it instead of minting its own:

```kotlin
// id = the wineId from the event
val wineId = id ?: Uuid.random().toString()
```

One wine, one id, on both sides. That is what the title means: a client-minted id is only shared if it
travels to the server inside the event that creates the entity.

**The breadcrumb stays.** It isn't something the user did; it follows from the assign. So the server
writes its own copy when it processes the assign, and the device's copy is only there for the instant
timeline, like the projection rows in [Part 2](/posts/offline-first-two-writes#the-part-that-feels-wrong).
The checkpoint replaces it with the server's
([Part 4](/posts/offline-first-write-checkpoints#what-happens-when-the-checkpoint-gate-opens)).

The rule behind both: upload what the user did, with the ids of everything it creates. Keep on the device
anything the server will work out for itself.

## The Catch: You Can't Migrate the Past

Look at that line again: `id ?:`. Events recorded by older clients have no wine id, so for them the server
still mints its own. An append-only log can't be edited to add the id: history that can't be corrupted also
can't be corrected. So the fix covers every event from now on, and the old ones stay as they were recorded.
You don't get to migrate the past; you only get to stop growing the problem.

## The Takeaways

- **Upload what the user did, with the ids of everything it creates.** An id minted separately on each
  side isn't shared: it's two ids that happen to look alike.
- **Keep what the server derives on the device.** The server writes its own breadcrumb; the device's
  copy is only for the instant UI.
- **You can't migrate the past.** A change to your events fixes the future and leaves the old events as
  they are. Make old and new coexist; don't try to rewrite history.

The client witnesses, the server judges
([Part 11](/posts/offline-first-witness-not-judge#witness-not-judge)), and the id has to travel for the
two to ever agree.
