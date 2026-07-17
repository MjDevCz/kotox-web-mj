---
title: 'Two writes for every tap'
series: 'Offline-First KMP'
seriesPart: 2
excerpt: "The write your UI reads is not the write your server trusts. In an offline-first app, every user action produces two local writes — an immutable event you upload, and a provisional projection you render so the UI updates instantly."
coverImage: '/assets/blog/post/offline-first-two-writes/cover.jpg'
date: '2026-07-17T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','event-sourcing','architecture']
ogImage:
    url: '/assets/blog/post/offline-first-two-writes/cover.jpg'
ogTitle: "Two writes for every tap"
---

*The write your UI reads is not the write your server trusts.*

**TL;DR** Every user action produces **two local writes** — an immutable event you upload, and a
provisional projection you render so the UI updates instantly. The event is what the server trusts; the
projection is a disposable guess. Keep them separate and the app behaves identically whether the device
is online or off.

## The Problem With "Just Sync It"

In Part 1 I picked PowerSync and hand-waved the hard part: choosing a sync engine is the easy 20%. The
other 80% is deciding what your app writes, when, and what the user sees while the server hasn't heard
about any of it yet.

Here's the constraint that shapes everything. Our users are cellar hands: people moving wine between
tanks, recording intake at the crush pad, blending, bottling. Half the time they're standing in a
metal shed with no signal. When someone taps "move this wine to Tank 7," the app cannot wait for a
server to agree. The screen has to update *now*, on a device that might not reconnect for hours.

So the naive model (tap, send request, wait, update UI) is dead on arrival. What replaces it is a
pattern that felt strange the first time I wrote it: **every user action produces two local writes.**

## Write #1: The Event (What Happened)

The first write is an immutable record of *intent*. Not "wine X is now in Tank 7," but "at 14:32, this
user moved wine X to Tank 7." A fact about the past, in an append-only log. We call it an
`operational_event`.

```
User taps "Move to Tank 7"
   │
   └─ record CELLAR_WINE_TRANSFER  →  operational_event row
```

This row is the thing that gets uploaded. It's the only thing the server ultimately trusts. Everything
else in the local database is, in a sense, a guess.

The reason it's an *event* and not a *state update* is a whole topic of its own, and one I'll set aside
here to keep this post about the mechanics. For now the takeaway is enough: we write down what the user
did, not what we think the world now looks like.

## Write #2: The Projection (What It Means, Provisionally)

But an event log doesn't render a screen. The user doesn't want to see "you recorded a transfer event."
They want to see wine X sitting in Tank 7, right now, with the right volume.

So the second write takes that event and *projects* it into the entity tables the UI reads from:
`wine`, `vessel`, `docket`. A local engine reads the transfer event and updates the local rows: Tank 7
now shows wine X, the source vessel shows empty, volumes adjust.

```
User taps "Move to Tank 7"
   │
   ├─ record CELLAR_WINE_TRANSFER  →  operational_event row   (uploaded)
   │
   └─ project it                   →  wine / vessel rows      (local-only)
```

The screen updates instantly because the rows it reads from just changed, with no network in the loop.
We call this Zero-Flicker: the UI never shows a spinner waiting for a round trip, and it never shows the
old state for a frame before snapping to the new one.

The engine that does this projection is deliberately dumb about the network. It just derives current
state from an event. (Where that engine *runs*, and what else runs it, is the good part. I'll leave that
thread hanging for now.)

## The Part That Feels Wrong

Here's the detail that trips people up: **the projection is never uploaded.**

Only the event goes to the server. The `wine` and `vessel` rows you just wrote locally stay local. They
exist purely to paint the screen while you wait for the server to process your event and send back its
own authoritative version of those same rows.

The first reaction is always "so I'm writing data I'm going to throw away?" Yes. Exactly that. The local
projection is a provisional answer: a bet that the server will agree. When the server's version syncs
back, it replaces your local guess.

And the beautiful part, the part that made me trust this architecture, is that *you write no cleanup
code for this.* You don't diff, you don't reconcile, you don't delete your optimistic row when the real
one arrives. The sync layer does it for you, through a mechanism I'll unpack in Part 4.

## Why Split It This Way

You could imagine collapsing the two writes into one: just update the entity tables and sync those. Lots
of offline apps do exactly that. Here's what you lose.

- **The event is the truth; the entity is a view.** If a projection is wrong (a bug, a bad assumption
  about current state), you fix the projection logic and re-derive. The historical record of what the
  user actually did is untouched. You never corrupt history to fix a display bug.
- **The server can be late without being wrong.** Because the client and server both derive state from
  the same events, "the device is ahead of the server" is a normal, expected condition, not a
  desync bug. The device shows its best guess; the server confirms or corrects; they converge.
- **Conflicts have somewhere to live.** When two cellar hands move the same wine on two disconnected
  phones, you have two events, both real, both recorded. Nothing is lost. What happens next is a
  genuinely interesting problem, and too big to bury in a subsection here.

## The Shape to Take Away

If you remember one thing: **in an offline-first app, the write your UI reads and the write your server
trusts are not the same write.** One is a provisional projection for instant feedback; the other is an
immutable fact you upload. Keeping them separate is what lets the app behave identically on a plane and
at a desk.

Next up (Part 3): those local rows need IDs before any server has heard of them. Minting identity on the
client, and why UUID-collision anxiety is misplaced.