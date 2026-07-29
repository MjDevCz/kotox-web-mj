---
title: 'Client-Generated IDs in Offline-First Apps: Minting UUIDs Offline'
series: 'Offline-First KMP'
seriesPart: 3
excerpt: "Offline, you can't wait for a server to hand you an id. The client mints it at creation — a random UUID — so a new entity is addressable immediately, referenceable by the very next offline action. That one move deletes temporary ids and a whole class of reference-rewrite bugs."
coverImage: '/assets/blog/post/offline-first-two-writes/cover.jpg'
date: '2026-07-29T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','uuid','architecture']
ogImage:
    url: '/assets/blog/post/offline-first-two-writes/cover.jpg'
ogTitle: "Client-Generated IDs in Offline-First Apps: Minting UUIDs Offline"
---

*Identity is asserted by the client, not granted by the server.*

**TL;DR** Offline, you can't wait for a server to hand you an id. The client mints it at creation (a
random UUID), so a new entity is addressable immediately, referenceable by the very next offline action.
That one move deletes temporary ids and the whole class of reference-rewrite bugs that come with them.

In [Part 2](/posts/offline-first-two-writes) I covered the two-write model: an immutable event you
upload, and a local projection you render. This one is about a smaller question that turns out to gate
everything — what's the *id* of a thing you just created offline?

## Why Offline Apps Can't Wait for a Server-Assigned ID

Picture a cellar hand at the crush pad with no signal. A truck of fruit arrives; they record an intake.
That creates a docket. Now, immediately (same screen, still offline), they assign that docket to a
tank. The assignment has to *refer to the docket that doesn't exist on any server yet*.

In a request/response app you'd never hit this. You POST the docket, the server returns its id, you use
that id for the next call. Identity is something the server hands you.

Offline, that model is gone. There is no server in the loop, and there won't be for hours. The docket
needs an id the instant it's created, minted by the device, and that id has to be good enough to build
on: to reference in the very next action, to store in the local projection, to survive until the
network comes back.

So the rule we landed on is blunt: **the client mints the id. Always. At creation time.**

```kotlin
val docketId = Uuid.random()
```

One line of common Kotlin, so iOS and Android mint ids from one implementation, not two that could
drift. That's it. That's the whole trick. But the objections it raises are the interesting part.

## Why UUID Collisions Aren't a Real Risk

This is the first question everyone asks, and it's the wrong thing to be scared of.

A random UUID (v4) is 122 bits of entropy. The number of ids you'd need to generate before a collision
becomes *plausible* is roughly a quintillion (a billion billion). Our entire userbase, generating dockets
and wines and vessels all day for a century, doesn't get within astronomical distance of that. You are
more likely to lose the database to a meteor.

The instinct to fear client-side ids comes from the world of auto-incrementing integer primary keys,
where two clients both picking "id 47" is a certainty, not a risk. UUIDs exist precisely to kill that
problem. Once you internalize that a random id is *safe to invent anywhere*, offline creation stops
being scary.

One honest note before we move on: those 122 bits are only as safe as the randomness behind them. If a
device's random numbers are predictable — a weak generator, or two devices that happen to start from the
same seed — the ids can collide no matter how large the keyspace is. `Uuid.random()` sidesteps that by
pulling from each platform's *cryptographically secure* random source: the kind hardened for generating
keys and passwords, not the fast-but-predictable kind you'd use to shuffle a playlist (concretely:
`SecureRandom` on Android/JVM, the system secure source on iOS and the server). So the 122 bits of
entropy are real, and the math above actually holds.

## What Happens If Two IDs Collide

Say the cosmic-ray case actually lands: two devices mint the same id for two genuinely different entities.
Nothing merges and nothing corrupts. The id is the primary key, and entities are written with a plain
`INSERT`, not an upsert, so the second create hits the key constraint, rolls back, and the event is
parked: still recorded on the server, still logged for us to see, just never materialized into a row. Two
real things can't silently collapse into one. And because it's parked on the same event-sourced substrate
we use for conflicts, it stays resolvable.

## What the Client-Minted ID Buys You

With the fear out of the way, the positive case is where it gets interesting. The id isn't just a local
convenience — it's the thing that makes the next three problems solvable.

**1. You can reference a thing the moment it exists.** Docket assigned to a vessel in the same offline
session? The assignment event just carries the docketId that was minted a second ago. No "temporary id"
you have to rewrite later when the server responds. No placeholder. The id is real from birth.

**2. Your local projection has a stable primary key.** Remember from
[Part 2](/posts/offline-first-two-writes) that we write a local, provisional copy of every entity for
instant UI. That row needs a primary key *now*, and it needs to be the *same* key the entity will have
forever, including after the server gets involved. Client-minted id gives you exactly that.

**3. References survive offline chains.** Create a wine, split it into three, move one of the children,
add an analysis to another, all offline, all before a single byte reaches the server. Every one of
those actions refers to ids minted moments earlier on the same device. The whole chain is internally
consistent because every id in it is real from the moment it was invented.

## The Temporary-ID Trap We Avoided

The pattern I've seen (and written, years ago, and regretted) is temporary ids: create the entity with
a placeholder like `temp_1`, and when the server responds with the "real" id, walk your local data and
rewrite every reference.

It sounds fine until you have offline chains. Now `temp_1` is referenced by `temp_2` which is referenced
by `temp_3`, the network comes back mid-chain, and you're doing a graph rewrite while new writes are
still landing. Every edge case in that rewrite is a corrupted reference waiting to happen.

There's a harder wall than those edge cases, though. That `temp_1` isn't sitting in a mutable row you can
quietly patch later; it's baked into an event you already recorded, and as
[Part 2](/posts/offline-first-two-writes) covered, events are append-only. Rewriting the id would mean
editing history the log won't let you edit. Temporary ids aren't just risky in an offline chain; in an
append-only log they don't fit at all.

Client-minted ids delete this entire class of bug. There is no "real id" that arrives later to reconcile
against: the id the client minted *is* the real id. The device and the server agree on it because the
device decided it first and the server is told what it is.

*How* the server is told, and how its authoritative version of the entity lands on top of your local
projection without creating a duplicate, is a contract with a couple of genuinely subtle edges, more
than this post needs. So I'll tease the shape and stop. Half of it is easy: the minted id travels *with
the event*, and both sides use it. Part 4 shows the sync mechanic behind the other half — the
authoritative version landing on top without creating a duplicate.

## The Shape to Take Away

**Identity is not something the server grants you: it's something the client asserts.** In an
offline-first app, an entity has to be fully addressable at the instant of creation, using an id good
enough to build a chain of further actions on, before any server has heard of it. Random UUIDs make that
safe. Once you stop treating identity as a server privilege, a whole category of offline bugs (temporary
ids, reference rewrites, "which id is the real one") simply never gets written.

Next up (Part 4): you've got a local row with a client-minted id, and eventually the server sends down
its own authoritative version. How does your provisional row get out of the way, with no cleanup code
of yours? The answer is a PowerSync mechanism that looks, at first, like a bug.