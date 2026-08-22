---
title: 'Your Schema Is Not Your Payload'
series: 'Offline-First KMP'
seriesPart: 6
excerpt: "Your upload path is a **translation layer whether you planned one or not**. What your device stores and what your write endpoint accepts are rarely the same shape, and every difference is work that has to happen somewhere: inlining junction tables, dropping updates that must flow through events, stripping server-owned columns. Treat it as declarative, testable code, and watch which 'cosmetic' schema declarations secretly drive the wire."
coverImage: '/assets/blog/post/offline-first-adapter-layer/cover.jpg'
date: '2026-08-20T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','powersync','sync']
ogImage:
    url: '/assets/blog/post/offline-first-adapter-layer/cover.jpg'
ogTitle: 'Your Schema Is Not Your Payload'
---

*Three mismatches on the upload path, and the day a bottle volume left the phone as the string "770.0".*

**TL;DR** Your upload path is a translation layer whether you planned one or not. What your device stores
and what your write endpoint accepts are rarely the same shape, and every difference is work that has to
happen somewhere: ours inlines junction tables, drops updates that must flow through events, and strips
server-owned columns. Treat it as declarative, testable code, and watch which "cosmetic" schema
declarations secretly drive the wire.

[Part 5](/posts/offline-first-silent-success) was the first war story: a write the server turned away
while everything on the device reported green. This post stays on the upload path and asks the plainer
question underneath it: what, exactly, goes up?

The stack, for anyone joining here: one Kotlin Multiplatform (KMP) codebase for iOS and Android, with
[PowerSync](https://www.powersync.com) as the sync layer in front of a Postgres backend
([Part 1](/posts/offline-first-kmp) is why we picked it). PowerSync keeps a SQLite database on the
device, streams server changes down into it, and puts every local write into an upload queue. What
drains that queue is a **connector**: our code, not the library's, turning queued rows into calls
against our write endpoint. This one is about the least glamorous layer in the stack, and it opens a run
of posts on how the pipe between device and server actually gets built.

## Why the Local-DB-to-Server Arrow Is a Lie

Every offline-sync tutorial draws the same picture: local DB on the left, server on the right, a tidy
arrow between them labelled "sync." Writes flow right, truth flows left, everyone's happy.

The arrow is a lie. Or rather, the arrow is where a surprising amount of the actual work lives. What your
device writes to its local database and what your server's write endpoint is willing to accept are rarely
the same shape, and wherever they differ, *something* has to translate on every upload. In our stack that
something is the connector's upload path: the one segment of the sync loop PowerSync hands to you rather
than handling itself. It grew a whole small subsystem I never anticipated when I drew my own version of
the tidy arrow.

Here's what forced it into existence.

## Mismatch #1: The Local Shape Isn't the Wire Shape

Take a many-to-many relationship, say a docket's certification record, which can carry several
certification types. Locally, we store that the way SQLite wants it: a junction table, one row per
(certification record, type) pair, so local joins and `GROUP_CONCAT` queries are cheap.

The write endpoint wants none of that. It wants the types *inlined* on the parent as an array
(`certification_type_ids: ["…", "…"]` on the docket-certification PUT), not a pile of separate junction
rows. On top of that, PowerSync needs every synced row to have a single `id` column, and a junction row
keyed by two foreign keys doesn't naturally have one. That second fact gets its own war story on the way
back *down*, later in the series; here it's just one more reason the local shape can't go up as-is.

So the upload path has to reach into the batch, collect the junction rows, fold them into an array on the
parent entry, and drop the junction rows before they go up. That's not a data model decision: it's a
*translation* decision, and it has to happen at upload time, per table.

## Mismatch #2: Some Updates Aren't Allowed to Go Up at All

Remember the event-sourcing rule from [Part 2](/posts/offline-first-two-writes): for a lot of our
entities, *updates flow through events*, not through direct writes. A grower, a packaging type, an
additive definition: you can create one directly offline, but you can't just PATCH its fields and sync
that. Changes to it are supposed to travel as an `operational_event` the server's engine processes.

Except the local app still does a direct PATCH, because we want the optimistic UI to update instantly.
So locally there's a PATCH; but that PATCH must **not** reach the server, or you'd have two competing
update paths (the direct write and the event) racing each other.

So the upload path has to *drop* certain operations for certain tables. The PATCH is real, it drives the
local UI, and it's filtered out of the upload batch. The event carries the actual change.

## Mismatch #3: Some Columns Are the Server's to Write, Not Yours

A few columns are *derived server-side*: computed by the backend from event payloads. An allergen flag
derived from an additive's allergen associations, for instance. The local projection fills those columns
in optimistically (again, instant UI), but if the client's optimistic value went up in a PUT, it would
overwrite the server's authoritative derivation with a guess.

So those columns get *stripped* from the outgoing payload. The device may compute them for display; it is
not allowed to tell the server what they are.

## Three Levers: A Declarative Per-Table Upload Rule Layer

Three different mismatches, all resolved at the same point in the pipeline, all per-table. What started
as "just upload the queue" turned into a small, declarative rule layer: each table that needs special
handling declares what to do to its entries before they go up. It's common Kotlin, so this whole
translation layer is written once for both apps instead of reimplemented per platform. This is exactly
the fiddly per-table code you'd hate to maintain in two places. The levers, roughly:

- **Rewrite the batch:** an escape hatch that sees the whole batch and can fold junction rows into their
  parent (mismatch #1).
- **Drop operations:** e.g. "filter out PATCH for this table" (mismatch #2).
- **Strip columns:** e.g. "remove these server-derived columns from PUTs" (mismatch #3).

The connector applies them in that order: the batch-rewrite pass first, then drop and strip per entry.
Each table's quirks live in one small rule object instead of being smeared through a giant `if` in the
upload function.

And (because this is a codebase that likes to sleep at night) there's a build-time test that fails if
the rules drift out of sync with the set of tables the server accepts. A table that's allowed up but has
no rule to constrain it is a leak; the test catches it before a human has to.

It's not clever. It's just honest about the fact that the wire format has opinions.

## The Bug That Was One Wrong Column Type

Here's how sharp those opinions get. This one cost me an unreasonable amount of time and came down to a
single wrong type in a schema file.

PowerSync's local database stores everything as TEXT internally: it genuinely does not care about your
declared column types for local operation. So a column declared as text instead of a number *works
perfectly locally*. Every screen renders. Every query returns. Nothing is wrong on the device.

But that schema file isn't cosmetic. Our connector derives, from the declared types, how to serialize
each column for upload: text columns ship as JSON strings, everything else gets coerced to a JSON number.
So a numeric column mistakenly declared as text uploaded its value as `"770.0"` (a *string*), and the
server's numeric validation rejected it. On the device: flawless. On the wire: type error. And thanks to
the lesson from [Part 5](/posts/offline-first-silent-success), that rejection was quiet.

The fix was one type in one file. Finding it meant understanding that the same declaration drives two
completely different things: local storage (which ignores it) and upload serialization (which lives and
dies by it).

*(There's a second trap here: that schema file is generated, not hand-authored, so "just edit the type" is
the wrong fix. Part 7 is that story, and what we changed so a regeneration can't re-break it.)*

## The Shape to Take Away

- **The gap between your local schema and your wire format is real work.** Plan for a translation layer
  on the upload path; don't assume the shapes match. Junction tables, filtered operations, and
  server-owned columns are the usual suspects.
- **Make the per-table rules declarative and testable.** One small rule object per table beats a sprawl
  of special cases, and a drift test beats discovering a leak in production.
- **A column type can be a no-op in one place and load-bearing in another.** Ours is ignored by the local
  store and decisive for upload serialization. Know which of your "cosmetic" declarations are secretly
  driving the wire.

That's the plumbing run's first stop. Next up (Part 7): why the one-word fix above didn't stay fixed, and
where a decision has to live so a regeneration can't reach it. Parts 8 and 9 stay down here in the
plumbing too, then the series zooms out to the architecture underneath it all.

## Reference

- PowerSync — [Integrating with your backend](https://docs.powersync.com/installation/client-side-setup/integrating-with-your-backend)
- PowerSync — [Define your schema](https://docs.powersync.com/installation/client-side-setup/define-your-schema)
