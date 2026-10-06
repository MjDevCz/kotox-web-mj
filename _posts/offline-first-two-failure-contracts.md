---
title: 'HTTP 500 Is Not a Retry'
series: 'Offline-First KMP'
seriesPart: 10
excerpt: "A batch write endpoint that reports some failures per operation and others as a status code **does not have a contract, it has two**. A status code cannot tell the client whether you refused its data or broke while processing it, and a batch verdict is a verdict on every operation at once. The only channel that can carry a per-operation failure is the body. Get it wrong and the client does not retry slowly, it stops."
coverImage: '/assets/blog/post/offline-first-two-failure-contracts/cover.jpg'
date: '2026-10-06T02:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','powersync','sync','api-design']
ogImage:
    url: '/assets/blog/post/offline-first-two-failure-contracts/cover.jpg'
ogTitle: 'HTTP 500 Is Not a Retry'
---

*The same endpoint, two failure contracts, and the one that was never wired.*

**TL;DR** A batch write endpoint that reports some outcomes per operation and others as a batch status
code does not have a contract, it has two. A status code cannot tell the client whether you refused its
data or broke while processing it, and no better status code fixes that: a batch verdict is a verdict on
all fifty operations at once. The only channel that can carry a per-operation failure is the body. Get it
wrong and the client does not retry slowly, it stops.

This is the last field note from down in the pipes, before the series zooms out to the architecture
underneath it all. **Dropping in here?** The stack: one Kotlin Multiplatform (KMP) codebase for iOS and
Android, with [PowerSync](https://www.powersync.com) as the sync layer in front of a Postgres backend
([Part 1](/posts/offline-first-kmp) is why we picked it). PowerSync keeps a SQLite database on the device
and puts every local write into an upload queue. What drains that queue is a **connector**, our code, which
posts batches of queued rows to our write endpoint.

[Part 5](/posts/offline-first-silent-success) told you that HTTP 200 is not success. This is the other
half, and it points the opposite way.

## The Error That Was Not the Error

A user assigned part of a harvest docket into a tank. The wine appeared on their device and never
confirmed. Here is what our logs said, in order:

```
AWS batch upload response [500 Internal Server Error]:
  {"code":"INTERNAL_SERVER_ERROR","message":"Failed to apply PowerSync write batch operation"}

AWS batch upload transient failure (500 Internal Server Error), will retry.
AWS upload backing off 2000ms (transient failure #1)

Dropped PUT operational_event/e9e2… [HTTP 200, CONFLICT]:
  Write conflict on operational_event/e9e2…: operational_event is append-only;
  PUT is allowed only for new rows
```

Read that last line the way anyone would. It is specific, it names a table, it states a rule, and it
sounds like a diagnosis. A write conflict on an append-only table means something tried to overwrite a row
that already existed.

Nothing overwrote anything. There was no conflict. That message describes a duplicate write which only
happened because of the retry above it, and the retry only happened because of the 500 above that. The
most confident-sounding line in the log was the furthest from the cause.

The actual failure was a not-null constraint. Deep inside processing the event, the server tried to write
a row with a required column left empty, Postgres refused, and the transaction rolled back. That sentence
appears nowhere in anything the client could see.

## Two Failure Contracts, One Endpoint

Once we knew where to look, the shape of the problem was obvious, and it was not really a bug in any one
place. Our write endpoint has two entirely different ways of saying no, depending on where in its own
pipeline the failure happens.

<div class="diagram">
<div class="diagram-head">One endpoint, two ways of saying no</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">Refused at the door</div>
<div class="diagram-branch-rule">before the row is stored</div>
<div class="diagram-line"><span class="diagram-key">200</span> with a per-operation error in <code>results[]</code></div>
<div class="diagram-line">client: terminal, report it, drain the queue</div>
<div class="diagram-verdict is-ok">Correct.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">Fails while processing</div>
<div class="diagram-branch-rule">after the row is committed</div>
<div class="diagram-line"><span class="diagram-key">500</span> batch level, no per-operation detail</div>
<div class="diagram-line">client: transient, back off, retry the batch</div>
<div class="diagram-verdict is-bad">Wrong.</div>
</div>
</div>
</div>

Part 5 was about the left branch: the endpoint tells you an operation failed, inside a response that says
200, and if you only check the status code you never hear it. The fix was to read the body.

This is the right branch, and reading the body does not help. The body says `INTERNAL_SERVER_ERROR`. The
status says 500. Both are honest, and both describe a transport problem that did not occur.

A status code is a statement about the request. It cannot express "your data was fine and our processor
broke", which is a completely different instruction to the client than "your data was refused". One says
try again later, the other says never send this again. They arrive looking identical.

## Why the Client Believed the 500

Our connector classifies terminal statuses explicitly:

```kotlin
val TERMINAL_STATUSES = setOf(BadRequest, Conflict, UnprocessableEntity)
```

Everything else is treated as transient: back off, keep the batch, let PowerSync retry. That is the right
default. A 500 usually means the server had a bad moment, and giving up on the user's data because a
container restarted would be much worse than waiting.

So the client did exactly what it should have done with the information it was given. It was given the
wrong information. No amount of care on the client fixes this, because the distinction it needs was never
transmitted.

There is also no status code that fixes it, which is the part that took us longest to see. A batch carries
up to fifty operations, so any verdict on the status line is a verdict on all of them at once. Our
connector treats `400`, `409` and `422` as terminal for the *entire batch*, dropping every operation in it
from the queue, so switching the server to a tidy `422` would have taken forty-nine good writes down with
the one bad one. The failures are per operation, so the channel has to be per operation too, and the only
per-operation channel in an HTTP response is the body.

## The Upload Queue Stall Nobody Sees

Here is the part that turns an annoying log line into a user-visible outage.

[Part 4](/posts/offline-first-write-checkpoints) covered the write-checkpoint gate: PowerSync will not
apply a downloaded checkpoint while your upload queue still has pending local writes. That post frames the
scary log line as reassuring, and it is. It is the mechanism that stops a half-synced database.

```
Could not apply checkpoint due to local data. Will retry at completed upload or next checkpoint.
```

Now hold that gate open with a write that can never succeed. The queue does not drain, so the gate does
not lift, so nothing comes down either. The device stops sending and stops receiving, at the same time,
for the same reason. Throughout all of it the sync status cheerfully reports `connected: true`, because it
is connected. It is just not moving.

The backoff doubled from two seconds toward a five-minute ceiling, and the failure counter lived on the
connector rather than on the operation, so an unrelated failure inherited the previous one's delay.
Reproducing this a few times in a row walked the delay up through two, four, eight, sixteen and thirty-two
seconds, with the client frozen in both directions for every one of them.

The same gate, unchanged, correct, and doing its job. What changed is that the thing it waits for stopped
being able to happen.

## The Bug That Holds It Upright

One more turn, and it is the part I would want somebody to notice before they tidy anything.

There was no permanent deadlock. The retry did eventually terminate, the queue did eventually drain, and
the only reason is an accident of ordering. The server commits the event row **before** it runs the
processing step. So when the client retries, the row is already there, the append-only guard fires, and
that guard returns a proper per-operation error, which the client correctly treats as terminal.

The misleading error message is what saves us from the deadlock. They are the same mechanism.

Which means the obvious cleanup, wrapping the insert and the processing in one transaction so a failed
event does not leave a committed row behind, quietly removes the escape hatch. The retry would then
reproduce the same 500 forever, and the client would sit frozen at a five-minute heartbeat with no signal
at all. A reviewer would ask for that change. It reads like a straightforward correctness fix. It would
turn a confusing log line into a stuck app.

Nothing tests for this. No comment says "this ordering is load-bearing". The system is being held upright
by a property nobody chose.

## What Was Never Actually Lost

Worth saying plainly, because the failure sounds worse than it is: the event itself is fine. It reached
the server, it was stored, and it carries a stored `processing_state` recording exactly how it ended. That
state syncs back down to the device within seconds. Nothing was silently eaten.

Which is the sharpest version of the lesson. We had a complete, durable, queryable record of the failure,
sitting in the database, before the client even finished retrying. And we still told the client nothing
useful, because storing a failure and reporting one are different capabilities, and we had built only the
first. A system can be perfectly accountable after the fact and completely mute in the moment.

## The Takeaways

- **One endpoint, one failure contract, and it has to be the granular one.** If any outcome is reported
  per operation, all of them must be. You cannot unify upward onto the status line, because a batch verdict
  is a verdict on every operation in the batch. You can only unify downward.
- **A status code cannot carry a business verdict.** "We refused your data" and "we broke processing it"
  demand opposite client behaviour and look identical over the wire. Decide where that distinction lives
  and make it explicit.
- **Check what your queue blocks when it cannot drain.** An upload gate that also holds downloads turns one
  poison write into a device that is silently frozen in both directions while reporting itself healthy.
- **Storing a failure is not reporting one.** Durable failure state is worth having and does not, on its
  own, tell anybody anything.
- **Look for the accidents holding your system up.** The most dangerous ones look like defects, so the fix
  arrives as a tidy-up in an unrelated pull request.

Next up (Part 11): the series stops looking at pipes and starts looking at what all of this was built to
protect.

## Reference

- PowerSync — [Integrating with your backend](https://docs.powersync.com/configuration/app-backend/client-side-integration)
