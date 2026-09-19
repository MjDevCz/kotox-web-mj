---
title: 'HTTP 200 Is Not Success'
series: 'Offline-First KMP'
seriesPart: 5
excerpt: "A batch upload can return **HTTP 200 while an operation inside it failed**, and a sync connector must acknowledge those failures or wedge its queue. So data can vanish with everything reporting green. 'Success' is a per-operation outcome your transport cannot report for you: you have to build a channel to hear the failures you actually care about, and a place to keep the work they refused."
coverImage: '/assets/blog/post/offline-first-silent-success/cover.jpg'
date: '2026-08-10T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','powersync','sync']
ogImage:
    url: '/assets/blog/post/offline-first-silent-success/cover.jpg'
ogTitle: 'HTTP 200 Is Not Success'
---

*The event the server silently ate.*

**TL;DR** A batch upload endpoint can return HTTP 200 while an operation inside it failed, and a sync
connector must acknowledge those failures or wedge its queue. So data can vanish with everything
reporting green. "Success" is a per-operation outcome your transport cannot report for you: build a
channel to hear the failures you actually care about, and a place to keep the work they refused.

[Part 2](/posts/offline-first-two-writes) established the two-write model, an uploaded event plus a
local projection. [Part 3](/posts/offline-first-minting-ids) had the client mint the ids. [Part
4](/posts/offline-first-write-checkpoints) let checkpoints sweep the provisional rows away. Those three
posts built the model. **This is the first war story**: *what happened when that model quietly failed and
still returned HTTP 200 while doing it.*

## A Bug With No Error

The best bugs don't throw. This one didn't throw anywhere. No crash, no red log, no failed request. A
piece of data just wasn't there, sometimes, and everything upstream reported success.

The symptom: on the wine timeline (the history of everything that happened to a given wine), a
"wine created" entry was occasionally missing. The wine existed. Its volume was right. Its location was
right. But the little breadcrumb that says "this wine came into being here" wasn't on the timeline.

Everything that *mattered* was correct. Only a cosmetic marker was gone. Which is exactly why it took a
while to notice: everything we were watching — the HTTP status, the UI — said success. The failure was
sitting in the response body all along; back then, nothing was acting on it.

## The Breadcrumb

Quick context. Some of our actions create a wine as a *side effect*. Assign a docket to a tank and a
new wine is born in that tank. Transfer wine into an occupied tank and the blend produces a new wine.
The user didn't say "create a wine"; they said "assign" or "transfer." But a wine came out the far
side.

To make the timeline readable, whenever one of these side-effect wines is created we also emit a little
marker event: `CELLAR_WINE_CREATED`. It mutates nothing. Its only job is to give the timeline a row to
render: *a wine was created, here, by this action.* A breadcrumb.

And breadcrumbs were vanishing.

## Reading the Logs: Where the 200 Lied

The action itself always worked. Here's what a plain docket-to-tank assign *used to* do — online, no
conflict:

```
record HARVEST_DOCKET_ASSIGN  → operational_event   (uploaded)
mint wine locally             → wine row            (local-only projection)
emit CELLAR_WINE_CREATED      → operational_event   (uploaded)
```

Two events went up. Watching the upload batch:

```
POST /v1/powersync/write
  HARVEST_DOCKET_ASSIGN  → 200 {"success":1,"error":0}
  CELLAR_WINE_CREATED    → 200 {"success":0,"error":1}
      results[1].error: "wine_id 159e8928… does not reference an existing wine"
```

The assign succeeded. The breadcrumb *failed validation on the server*, and the whole batch still came
back HTTP 200.

That's the first lesson, and it's a big one for anyone building a custom sync connector: **for anything
our write endpoint turns away at the door, it returns 200 for the batch and reports the per-operation
failure inside the body.** One failed op doesn't fail the request. If your connector only checks the HTTP
status, it sees green.

Failures on the other side of that door, after the row is accepted and stored, come back a different way
entirely. Part 10 takes that one apart.

## Why the Connector Let It Go

Ours (one connector in common Kotlin, shared by both apps) did a little better than checking the status
blindly: it noticed the failed op and logged it. But then it did the only sane thing a
connector can do with a *permanently* rejected op: it acknowledged the batch and moved on.

Acknowledging is what clears the upload queue. Here's the bind you're in. If a rejected op is
*permanent* (it will fail identically no matter how many times you resend it) and you *don't*
acknowledge it, that one poison op wedges the queue forever, blocking every future upload behind it. The
user's next hundred actions never sync because op #1 keeps bouncing. So a connector essentially has to
acknowledge failures to stay alive.

But "acknowledge and move on" means a permanently rejected op is **silently dropped after one attempt.**
No retry. No user-visible error. No queue damage, and no trace unless you went looking in the logs. Our
breadcrumb was rejected, logged, acknowledged, and gone.

This is the first crack in a comfortable idea: that an offline-first app is *just a sync queue* — a
buffer you can trust to hold your writes until they land. It isn't. It's a queue that sometimes has to
drop what it can't deliver, and it drops it quietly. "The queue drained" and "your data arrived" turn out
to be two different claims.

## Nothing Is Lost at the Door Either

None of which means we shrugged. The breadcrumb bug is fixed, and a write the server turns away at the door
now goes to two places instead of a log line.

The first is an alert. A rejection at the door almost always means the two sides disagree about something
they should agree on: an inconsistency, or a bug. So the connector raises a Crashlytics non-fatal the moment
it sees one. That channel is for us. The team hears about it without the person in the cellar having to
notice anything, let alone report it.

The second is a ledger, and it is the part that changes what "acknowledge" means. The connector still
acknowledges the batch, because it has to. But before it does, it writes the refused operation to a table of
its own on the device: the operation's data, every column as the app wrote it; the error code and message
the server returned; the HTTP status; and when it was first and last refused, and how many times.
Acknowledging clears the queue. It no longer clears the record. If a later download proves the server has
the row after all, the entry retires itself. Otherwise the work is held, so that once whatever refused it is
fixed it can be replayed instead of retyped from memory. That replay is the recovery screen's job, and
Part 19 is about that screen. "Acknowledge and move on" stopped meaning "gone".

Past the door, the record was already safe. That door is the only place an event can slip through; once the
server ingests one it can't silently disappear, because it always ends in a definite, stored
`processing_state` on its own row. Most version conflicts auto-resolve, the genuine ones are parked in
`CONFLICT_RESOLUTION_REQUESTED` for a human decision, and anything that can't be processed is parked in a
terminal `PROCESSING_FAILURE` or `VALIDATION_FAILED`, sitting in the server database, queryable and there to
act on. Showing both kinds of held work to the person who did it is that same screen.

*Why* the two ids diverged, and the identity-minting fix behind it, is a bigger thread than this post wants
to pull, so it gets its own.

## The Takeaways

- **HTTP 200 is not success.** If your backend reports per-operation results in the body, your connector
  must inspect the body, not the status code. It's the single easiest place to lose data without knowing.
- **A sync connector has to acknowledge failures, or it wedges the queue.** A permanent rejection you
  refuse to acknowledge blocks everything behind it; a permanent rejection you *do* acknowledge is
  dropped, unless you keep it yourself. There's no free option on the queue, so decide, deliberately,
  which failures you want to be loud, and keep the refused work somewhere the acknowledgement can't reach.
- **The nastiest offline bugs are the ones where everything reports success.** No throw, no red log,
  just an absence. Build the observability to see absences, because your error handling won't.

Next up ([Part 6](/posts/offline-first-adapter-layer)): the layer nobody warns you about, the messy
adapter between your local database and your actual write endpoint, and the one-line schema mistake that
shipped `"770.0"` as a string.