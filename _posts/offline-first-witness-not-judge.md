---
title: 'Witness, Not Judge'
series: 'Offline-First KMP'
seriesPart: 11
excerpt: "Your offline-first app is not a sync queue. **The client witnesses; it never judges**: it records what happened as immutable events, and one shared Kotlin engine, the same one the phone runs, derives state and rules on conflicts on the server. The whole architecture in one read, with the Droidcon Berlin talk and slides."
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
happened* as immutable events instead of casting a vote about what's true, and a separate engine *derives*
state and rules on conflicts. The client witnesses; it never judges. And the engine that judges is one
shared Kotlin module, the same one the phone runs, so client and server can't disagree.

> Part 11 of the **Offline-First KMP** series, and the **written companion to my conference talk** ("Your
> offline-first app is not a sync queue."). The earlier parts each told one mechanic or one war story in
> depth; this one steps back and tells the shape they add up to. It's the map: every section links to the
> part that goes deep. Field notes from a production winery app built on Kotlin Multiplatform (KMP).

## Watch the Talk: Droidcon Berlin 2026

Prefer to watch? Here is the talk this post accompanies, recorded at Droidcon Berlin.

@[youtube](2rta1Z3lgso)

And the slides, if you'd rather click through at your own pace. Click, tap or use the arrow keys.

<div class="slides-embed">
<iframe src="/assets/blog/post/offline-first-witness-not-judge/deck/index.html" title="Witness, Not Judge: slides" loading="lazy" allowfullscreen></iframe>
</div>

<p class="slides-embed-links"><a href="/assets/blog/post/offline-first-witness-not-judge/deck/index.html" target="_blank" rel="noopener">Open the slides full page</a> · <a href="/assets/blog/post/offline-first-witness-not-judge/witness-not-judge-slides.pdf" target="_blank" rel="noopener">Download as PDF</a></p>

## The Queue That Quietly Loses

Start with the failure that motivates everything. A queue-and-replay client stores *mutations*. Tank 12
already holds a thousand kilos. Paula, offline, tips in 300 from docket 41, and her phone works out the new
figure: 1,300. Ben, offline too and close enough to wave, tips in 400 from his own delivery, same tank, and his
phone records 1,400. Neither is asking the app what to do; both are writing down what they did. They
reconnect, the queues flush, and Ben's write lands last: the tank reads 1,400. Nothing looks wrong, nothing is
flagged. But seventeen hundred kilos went in, and Paula's three hundred are in nobody's records.

That is not their mistake; it is the model. A queue of mutations cannot know two writes were about the same real
fact. And sit with what "last write wins" quietly assumes: that somebody has to win. That is a queue's idea,
not your domain's. Both of them did real work, both taps were correct where they stood, and nothing about the
winery required either to lose. Which is the question underneath this whole post: when your user taps Save with
no signal, is your app writing down what *happened*, or casting a vote about what's *true*?

The queue has a second way to lose, and it is the mirror image. A batch upload can come back `HTTP 200` while
an operation inside it was refused, and the queue crosses it off as done.
[Part 5](/posts/offline-first-silent-success) tells it as a war story: "200" is a fact about
HTTP, not about your *operation*.

## Witness, Not Judge

The fix started as a principle before it was any code. **The client witnesses; it never judges.** A witness
records "Paula assigned Docket 41 to Tank 12 at 14:03" as an immutable fact. Checking is not judging: her phone
checks every tap against the server's own rules and refuses what they forbid, a closed docket or a zero amount,
so a local *no* is real. Judging needs everyone's testimony, and her phone has only hers; it cannot see Ben's tap
on the other side of the cellar. So a local *yes* is provisional, and nobody waits on it: whether her work can be
*applied* is decided later, by something that can see everyone's testimony at once, and the outcome is written
on the event.

There is a practical reason for that split, not only a philosophical one. An offline client is the
worst-informed participant in the system: the one party that cannot see anyone else's work. Asking it to rule
on whether an action is allowed asks the least-informed party for the most consequential answer. Move the
ruling to where the information is.

So the thing the client writes is not a row in a `vessel` table. It is an *event*: intent, frozen, in one
append-only log. You never edit or delete one, you append a correction that defines reality forward. That
durability is the load-bearing property, because a fact that can never change underneath you is safe to
throw away and rebuild. [Part 2](/posts/offline-first-two-writes) unpacks why.

Hold those two roles; the rest is mechanics.

## Two Writes for Every Tap

The event is only half of what a tap does. Alongside it, the client derives a provisional projection: the
state the phone shows, and the state it checks your next tap against. It paints the UI instantly: tap, screen
updates now, no spinner. We call it Zero-Flicker. Only
one of those two writes leaves the device: the event uploads, the projection stays local. The server
computes its own authoritative state, sends it back down, and the provisional row falls away with **no
cleanup code of ours**, because PowerSync's reconciliation removes it for you.
[Part 4](/posts/offline-first-write-checkpoints) owns that mechanic. Two writes per tap: one you read, one you
trust.

## The Pipe Between Them

Say "the event uploads" quickly enough and it sounds like one line of code. It is a layer. What your device
stores and what your write endpoint accepts are rarely the same shape, so the upload path has to inline
junction rows, drop the operations that must travel as events, and strip the columns the server owns
([Part 6](/posts/offline-first-adapter-layer)). The column types driving that serialization live in a
generated file, which makes it the wrong place to fix anything
([Part 7](/posts/offline-first-generated-file)). Coming back down, a row the sync layer cannot
address by `id` does not survive the trip at all
([Part 8](/posts/offline-first-join-table-id)). And all of it is easier to reason about once the
sync stack runs on your laptop ([Part 9](/posts/offline-first-local-stack)).

None of that is architecture. It is plumbing, and it is where the architecture either works or quietly does
not.

## Mint the ID, and Make It Travel

For that clean swap to work, both sides have to agree on *identity*. [Part 3](/posts/offline-first-minting-ids)
explains why the client mints the real, permanent UUID at creation, before any server has heard of the
entity, so an offline user can create a docket and reference it in the same breath with no temporary id to
rewrite later. The collision fear is folklore.

Note that a single tap can mint more than one id. The event gets its own row id, and any entity that event
creates gets one minted on the device too, nested inside the event payload. That nesting is what matters: a
client-minted id only unifies the two sides if it *travels in the payload*, and an id minted independently on
each side is two ids that merely look alike. The ones most likely to go missing are the side-effect entities
nobody remembers to include. It bit us in production, and
Part 12 is that war story, plus the sting in the tail: an event-sourced system can't migrate its own past.

## Conflict as a Decision

Now the part that turns a bug class into a feature. Each event carries a **version snapshot**: the version
of every entity it read, captured on the user's screen at the moment they acted. On sync the server compares
that snapshot against the current state. A mismatch is only a suspicion, so before bothering anyone the server
checks whether the colliding edits touched *disjoint* columns. A rename and a re-assignment do not conflict;
they auto-resolve silently.

Only a genuine overlap, two different values written to the same field, reaches a human, who sees their
change beside the current state and "defines reality forward": a new corrective event, history never
rewritten. What that screen can offer depends on what reality still accepts: retry against a target that
merely changed, or discard when it was archived while you were offline. The way out is derived from the state
of the world, not from the kind of error.

Most "conflicts" are false positives the server settles on its own; the real ones become a decision with an
author and a timestamp, not a merge bug in a queue.

Conflict-free replicated data types converge without ever showing that screen, which is why the question comes
up every time. Our event log already *is* one: append-only, immutable, merged by union. What we refused to make
convergent is the projection. Paula and Ben both tip grapes into tank 12, and each phone's record says one tank,
one wine. A merge can say both happened; it cannot say which wine is in the tank. It can pick one docket, add the
kilos, or keep both, while the tank actually holds a new wine, a blend of both, that neither phone recorded and no
merge rule can vouch for. In a regulated cellar, provenance *is* the product. A merge answers the phones'
question, not the cellar's.

So here is the line. When all you need is the result, as with a text, a whiteboard or a shopping list, merge it.
When the testimony is the product, as with a wine, a stock or an account, record it, and let someone put their
name on it. Part 13 is the deep cut on everything those paragraphs hide, Part 14 is which entities get this
treatment at all, Part 16 is how we stop the declarations it rests on from rotting, and Parts 17 and 18 are
where the disjoint-column idea runs out and what a server owes a user when it refuses.

## The Kicker: The Same Kotlin Runs the Server

I have said "the server derives its own authoritative state" several times, here and across nine earlier
parts, without once saying *how*. That was deliberate. Here is the thing those parts kept walking around: it
derives that state by running *the same code the phone ran*. The processor and validator are one Kotlin
Multiplatform module.

Worth pausing on what that bought us before any backend existed: one source compiled natively for Android and
natively for iOS, so the rules could not fork between the two apps. Whoever writes the screens, in Compose or
SwiftUI, there is one docket assignment to write against, not one per platform.

Going server-side then cost five lines: one JavaScript target on a module we already had, so the same source
also compiles to a Node library, published as an npm package our backend imports. Two of those three runtimes
were free. One pure Kotlin engine processes sixty-four event types, not one of them reimplemented on the
server, so there is no second implementation to drift. Not even across versions: the suffix on the package's
version is a hash of the module's source. Same hash, same rules. It is not free at the type boundary: `Long` narrows to
`Double`, and coroutines become Promises with a rollback hazard attached. (One level down, one engine reading
two databases means every value it reads arrives as a string; that one the phone pays too.)
Part 15 is the deep cut on what that boundary actually charges.
But the property it buys is absolute: the client cannot disagree with the server, because they are the same
judge.

## The Whole Thing, in Five Lines

Five things to actually do when the testimony is the product:

- Store immutable events, not mutations, and derive state from them. You stop losing what actually happened.
- The client witnesses and never blocks real work; a separate engine judges, where it can see everyone.
- Mint identity at creation and make it travel, or the two sides only *look* like they agree.
- A version snapshot turns most conflicts into silent auto-resolves and the rest into human decisions.
- One rule, one implementation, compiled to every runtime, even JavaScript on your Node server.

Your app records testimony it can always stand behind, and leaves the ruling to something that can see the
whole courtroom. Your app testifies. It doesn't rule.
