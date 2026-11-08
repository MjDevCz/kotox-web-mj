---
title: 'Witness, Not Judge'
series: 'Offline-First KMP'
seriesPart: 11
seriesHighlight: true
excerpt: "Your offline-first app is not a sync queue. **The client witnesses; it never judges**: it records what happened as immutable events, and one shared Kotlin engine, the same one the phone runs, derives state and rules on conflicts on a Node.js server. The whole architecture in one read, with the Droidcon Berlin talk and slides."
coverImage: '/assets/blog/post/offline-first-witness-not-judge/cover.jpg'
date: '2026-10-22T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','architecture','event-sourcing','talk']
ogImage:
    url: '/assets/blog/post/offline-first-witness-not-judge/cover.jpg'
ogTitle: "Witness, Not Judge"
---

*Your app testifies. It doesn't rule. The whole architecture, in one read.*

**TL;DR** Most "offline-first" apps queue writes and replay them at the server, which quietly loses
information the moment two people act offline. We built a different shape: the client only *records what
happened* as immutable events, and a separate engine *derives* state and rules on conflicts. The client
witnesses; it never judges. And the engine that judges is one shared Kotlin module, the same one the phone
runs, compiled to JavaScript for a Node.js server, so client and server can't disagree.

> Part 11 of the **Offline-First KMP** series, and the **written companion to my conference talk** ("Your
> offline-first app is not a sync queue."). The earlier parts each went deep on one mechanic or one war
> story; this one shows the shape they add up to, with a link to the deep dive in every section. Field
> notes from a production winery app built on Kotlin Multiplatform (KMP).

## Watch the Talk: Droidcon Berlin 2026

Prefer to watch? Here is the talk this post accompanies, recorded at Droidcon Berlin.

@[youtube](2rta1Z3lgso)

And the slides, if you'd rather click through at your own pace. Click, tap or use the arrow keys.

<div class="slides-embed">
<iframe src="/assets/blog/post/offline-first-witness-not-judge/deck/index.html" title="Witness, Not Judge: slides" loading="lazy" allowfullscreen></iframe>
</div>

<p class="slides-embed-links"><a href="/assets/blog/post/offline-first-witness-not-judge/deck/index.html" target="_blank" rel="noopener">Open the slides full page</a> · <a href="/assets/blog/post/offline-first-witness-not-judge/witness-not-judge-slides.pdf" target="_blank" rel="noopener">Download as PDF</a></p>

<p class="slides-embed-links">Cover photo (left): Volkmar Otto / <a href="https://www.flickr.com/photos/194372122@N07/55586737831/" target="_blank" rel="noopener noreferrer">next.app devCon Berlin 2026</a></p>

## The Queue That Quietly Loses

A queue-and-replay client stores *mutations*. Here is how that loses data:

1. Tank 12 holds a thousand kilos.
2. Paula, offline, tips in 300 from docket 41. Her phone records 1,300.
3. Ben, offline too and close enough to wave, tips in 400 from his own delivery. His phone records 1,400.
4. They reconnect, the queues flush, and Ben's write lands last. The tank reads 1,400.

Nothing looks wrong and nothing is flagged. But seventeen hundred kilos went in, and Paula's three hundred
are in nobody's records.

That is not their mistake; it is the model. A queue of mutations cannot know two writes were about the same
real fact, and "last write wins" assumes somebody has to win. That is a queue's idea, not your domain's:
both taps were correct where they stood. So the question underneath this whole post is: when your user taps
Save with no signal, is your app writing down what *happened*, or casting a vote about what's *true*?

The queue has a second way to lose. A batch upload can come back `HTTP 200` while an operation inside it
was refused, and the queue crosses it off as done. [Part 5](/posts/offline-first-silent-success) tells that
war story: "200" is a fact about HTTP, not about your *operation*.

## Witness, Not Judge

The fix started as a principle before it was any code. **The client witnesses; it never judges.** A witness
records "Paula assigned Docket 41 to Tank 12 at 14:03" as an immutable fact.

Checking is not judging. Her phone checks every tap against the server's own rules and refuses what they
forbid, a closed docket or a zero amount, so a local *no* is real. But her phone cannot see Ben's tap on the
other side of the cellar, so a local *yes* is only provisional. Nobody waits on it: whether her work can be
*applied* is decided later, by something that sees everyone's testimony, and the outcome is written on the
event.

The reason is practical. An offline client is the worst-informed party in the system, so it should not give
the most consequential answer. Move the ruling to where the information is.

So the client doesn't write a row in a `vessel` table. It writes an *event*: intent, frozen, in one
append-only log. You never edit or delete one; you append a correction that defines reality forward. A fact
that can never change is safe to throw away and rebuild from;
[Part 2](/posts/offline-first-two-writes) unpacks why.

## Two Writes for Every Tap

The event is only half of what a tap does. The client also writes a provisional projection: the state the
phone shows, and the state it checks your next tap against. The screen updates instantly, no spinner. We
call it Zero-Flicker.

Only the event leaves the device. The server computes its own authoritative state and sends it back down,
and the provisional row falls away with **no cleanup code of ours**: PowerSync's reconciliation removes it
([Part 4](/posts/offline-first-write-checkpoints)). Two writes per tap: one you read, one you trust.

## The Pipe Between Them

"The event uploads" sounds like one line of code. It is a layer:

- What your device stores and what your write endpoint accepts are rarely the same shape, so the upload path
  inlines junction rows, drops operations that must travel as events, and strips server-owned columns
  ([Part 6](/posts/offline-first-adapter-layer)).
- The column types behind that live in a generated file, the wrong place to fix anything
  ([Part 7](/posts/offline-first-generated-file)).
- Coming back down, a row the sync layer cannot address by `id` does not survive the trip
  ([Part 8](/posts/offline-first-join-table-id)).
- All of it is easier to reason about once the sync stack runs on your laptop
  ([Part 9](/posts/offline-first-local-stack)).

None of that is architecture. It is plumbing, and it is where the architecture either works or quietly does
not.

## Mint the ID, and Make It Travel

For that swap to work, both sides have to agree on *identity*. The client mints the real, permanent UUID at
creation, before any server has heard of the entity, so an offline user can create a docket and reference it
right away, with no temporary id to rewrite later
([Part 3](/posts/offline-first-minting-ids)). The collision fear is folklore.

A single tap can mint more than one id: one for the event, and one for each entity the event creates,
nested in the event payload. That nesting is what matters. A client-minted id only unifies the two sides if
it *travels in the payload*; an id minted separately on each side is two ids that merely look alike. The
ones most likely to go missing are side-effect entities nobody remembers to include. It bit us in
production: [Part 12](/posts/offline-first-shared-id) is that war story, plus the sting in the tail, that an
event-sourced system can't migrate its own past.

## Conflict as a Decision

Each event carries a **version snapshot**: the version of every entity it read, at the moment the user acted.
On sync the server compares it with the current state. A mismatch is only a suspicion:

- **Disjoint columns:** a rename and a re-assignment don't conflict. They auto-resolve silently.
- **A real overlap**, two different values in the same field, goes to a human. They see their change beside
  the current state and define reality forward with a new corrective event; history is never rewritten.
  The screen offers what reality still accepts: retry if the target merely changed, discard if it was
  archived while you were offline.

Most "conflicts" are false positives the server settles on its own. The real ones become a decision with an
author and a timestamp, not a merge bug in a queue.

### Why Not a CRDT?

Conflict-free replicated data types (CRDTs) converge without ever showing that screen, so the question comes
up every time. Our event log already *is* one: append-only, immutable, merged by union. What we refused to
make convergent is the projection.

Paula and Ben both tip grapes into tank 12, and each phone says one tank, one wine. A merge can pick one
docket, add the kilos, or keep both. But the tank actually holds a new wine, a blend of both, that neither
phone recorded and no merge rule can vouch for. In a regulated cellar, provenance *is* the product. A merge
answers the phones' question, not the cellar's.

So here is the line. When all you need is the result, as with a text, a whiteboard or a shopping list, merge
it. When the testimony is the product, as with a wine, a stock or an account, record it, and let someone put
their name on it.

Going deeper:

- [Part 13](/posts/offline-first-auto-resolve): everything those paragraphs hide.
- [Part 14](/posts/offline-first-not-everything-ledger): which entities get this treatment at all.
- [Part 16](/series/offline-first-kmp#part-16): keeping the declarations it rests on from rotting.
- [Part 17](/series/offline-first-kmp#part-17): where the disjoint-column idea runs out.
- [Part 18](/series/offline-first-kmp#part-18): what a server owes a user when it refuses.

## The Kicker: The Same Kotlin Runs on a Node.js Server

Across nine earlier parts I have said "the server derives its own authoritative state" without once saying *how*.
That was deliberate. It runs *the same code the phone ran*, on a **Node.js server**. Not a Kotlin backend,
not the Java Virtual Machine (JVM): a plain Node.js backend. The processor and validator are one Kotlin
Multiplatform module.

Before any backend existed, that module already compiled natively for Android and iOS, so the rules could not
fork between the two apps. Going server-side then cost five lines: one JavaScript target, so the same source
also compiles to a Node.js library, published as an npm package our backend imports.

- **No second implementation to drift.** One pure Kotlin engine processes sixty-four event types; none is
  reimplemented on the server.
- **Not even across versions.** The package version's suffix is a hash of the module's source. Same hash,
  same rules.
- **Not free at the type boundary.** `Long` narrows to `Double`, and coroutines become Promises with a
  rollback hazard attached. And one engine reading two databases gets every value as a string, a cost the
  phone pays too. [Part 15](/posts/offline-first-type-boundary) covers what that boundary charges.

But the property it buys is absolute: the client cannot disagree with the server, because they are the same
judge.

## The Whole Thing, in Five Lines

Five things to actually do when the testimony is the product:

- Store immutable events, not mutations, and derive state from them. You stop losing what actually happened.
- The client witnesses and never blocks real work; a separate engine judges, where it can see everyone.
- Mint identity at creation and make it travel, or the two sides only *look* like they agree.
- A version snapshot turns most conflicts into silent auto-resolves and the rest into human decisions.
- One rule, one implementation, compiled to every runtime, even JavaScript on your Node.js server.

Your app records testimony it can always stand behind, and leaves the ruling to something that can see the
whole courtroom. Your app testifies. It doesn't rule.
