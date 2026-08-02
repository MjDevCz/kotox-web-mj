---
title: 'The Write You Never Clean Up'
series: 'Offline-First KMP'
seriesPart: 4
excerpt: "Your optimistic local row gets replaced by the server's authoritative one with no cleanup code of yours. PowerSync **write checkpoints hold incoming server state until your uploads are accounted for**, then reconcile the local database to match — sweeping away any row the server never knew about."
coverImage: '/assets/blog/post/offline-first-write-checkpoints/cover.jpg'
date: '2026-08-03T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','powersync','architecture']
ogImage:
    url: '/assets/blog/post/offline-first-write-checkpoints/cover.jpg'
ogTitle: "The Write You Never Clean Up"
---

*Provisional state should be disposable: let the sync layer reconcile it, don't write cleanup.*

**TL;DR** In an offline-first app you can write throwaway optimistic rows and never clean them up.
PowerSync's **write checkpoints hold incoming server state until your uploads are accounted for**,
then reconcile the local database to match, sweeping away any local row the server never knew about. You
lean on that one mechanism instead of writing reconciliation code by hand.

[Part 2](/posts/offline-first-two-writes) established the two-write model (an uploaded event plus a
local-only projection) and made a promise I didn't cash: your provisional local row gets replaced by the
server's authoritative one *with no cleanup code of yours*. This post is where that promise gets paid,
and it's the one I most misunderstood when I first read the logs.

## The Cleanup Code You Never Write

Here's that two-write model again, on a fresh example. You perform an action offline, such as
recording a fruit intake. The client writes a local, provisional copy of the resulting entity, a
`docket` row, so the UI updates instantly. That row is never uploaded. Eventually the event syncs and the
server processes it. The server writes its authoritative version of that docket, reusing the very id the
client already minted for it ([Part 3](/posts/offline-first-minting-ids)), and syncs it back down.

Two rows now describe the same docket: your local guess and the server's truth. The claim is that they
resolve to one, the server's, and **you write no code to make that happen.** No diffing. No "if the
server row arrived, delete my local one." Nothing.

The first time someone tells you this, it sounds like hand-waving. It isn't. It's a specific PowerSync
mechanism called **write checkpoints**, and understanding it is the difference between trusting the
architecture and quietly wondering whether those provisional rows ever really get cleaned up, or are
just silently piling up in your database.

## Why "Could Not Apply Checkpoint" Is Not an Error

When I first watched the sync logs, I saw this and panicked:

```
Could not apply checkpoint due to local data. Will retry at completed upload or next checkpoint.
```

I read "could not apply" as an error. It looks like one. It's not. It's the mechanism working exactly
as designed. To see why, you have to know what a checkpoint *is*.

## The Upload Queue and the Checkpoint Gate

PowerSync keeps a local upload queue: every local change you make that's meant to sync gets an entry in
it. Uploading drains the queue by handing those changes to your connector, which POSTs them to your
backend.

Downloading is separate. The server periodically publishes a **checkpoint**, a consistent snapshot of
what your buckets of data should contain. When the client receives one, it reconciles the local database
to match it.

Now the crucial rule, the one that makes everything work:

> **PowerSync will not apply a downloaded checkpoint while your local upload queue still has pending
> changes.**

Think about why that has to be true. If the client applied server state on top of local un-uploaded
edits, it would clobber writes the user made offline that the server hasn't even seen yet. So PowerSync
gates: pending local writes hold the checkpoint, and it retries once the queue is drained. That log line
I panicked over is the gate doing its job.

## What Happens When the Checkpoint Gate Opens

So the sequence for one of our offline actions is:

1. You act. The client writes the event (queued for upload) **and** the local-only projection row.
2. Upload runs. The connector (common Kotlin, one copy for both apps) sends the event. The projection
   row is local-only, so the connector filters it out of the batch. Critically, it still marks the whole
   batch complete. As far as PowerSync is concerned, your local writes are accounted for and the queue
   drains.
3. With the queue empty, the gate opens. The next checkpoint applies.

And here's the payoff. When the checkpoint applies, PowerSync reconciles the local database to *exactly*
what the server says your buckets contain. Your provisional projection row is **not** in any server
bucket, because you never uploaded it. So PowerSync removes it. In the same reconcile, the server's
authoritative docket row (which *is* in a bucket now, because the server processed your event and created
it) lands. One row out, one row in.

```
Validated and applied checkpoint
```

That's the sibling log line to the one that scared me. Gate closed, then gate opened. From your code's
perspective: you wrote a row, and later it was quietly replaced by the real one. You wrote nothing to
make that happen.

PowerSync's own docs describe this exact behavior for a local change that never gets persisted upstream:
it "will effectively seem as if [it] was reverted on the server." That's precisely what we're
*deliberately* leaning on. The revert isn't a failure mode we tolerate; it's the cleanup we designed
around.

Leaning on a revert only feels reckless if you picture the reverted row as something you can't get back.
It isn't. What reverts is the projection, never the event: the event is the immutable record the
two-write model uploads, and it left the device via the upload queue before the sweep ever runs. The
sweep removes a disposable guess; the durable fact was never stored in that row to begin with.

## Why the Client-Minted ID Has to Match

This is where the client-minted id pays off. If your local projection and the server's authoritative
row had *different* ids, the reconcile wouldn't be "one row out, one row in": it'd be your row removed
and a *different-looking* row added, and for a flicker the UI would lose the entity entirely, or worse,
briefly show two.

Because the client mints the id and the server uses that same id, the two rows are the *same* row by
primary key. The reconcile is seamless: same id, new (authoritative) contents. The entity never
disappears from the user's view; its data just firms up from "my guess" to "confirmed."

The exact contract that gets the client's id onto the server's row has a subtle edge or two, enough to
fill a later war story in this series. For this post, the thing that matters is only that the ids match,
and we've already covered why minting that id on the client is safe.

## The Shape to Take Away

The whole local-only-projection model (instant UI, no cleanup code) rests on a single mechanism:
**PowerSync gates downloaded checkpoints behind a drained upload queue, then reconciles the local database
to server truth, dropping any local row that isn't in a server bucket.**

Once you see that, the scary log line becomes reassuring. "Could not apply checkpoint due to local data"
means: *your offline writes are safe, I'm holding server state until they're accounted for.* And
"Validated and applied checkpoint" means: *they're accounted for now, here's the real world.* Your
throwaway rows aren't piling up somewhere waiting to bite you. They're swept, exactly once, by the same
sweep that brings you the truth.

That's the mechanism under the "no cleanup code of ours" promise. Later in the series I'll switch from
mechanics to war stories, starting with the time this exact model dropped an event on the floor and
reported success while doing it.

## Reference

- PowerSync — [Consistency](https://docs.powersync.com/architecture/consistency)