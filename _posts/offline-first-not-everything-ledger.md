---
title: 'Not Everything Deserves a Ledger'
series: 'Offline-First KMP'
seriesPart: 14
excerpt: "Event sourcing is not an architecture-wide switch, it is a **per-operation** decision. Our app runs a full ledger, a **hybrid** where creating and deleting a row ride the plain sync queue while every update goes through the ledger, and lookup tables no device writes. The hybrid is not an unfinished migration: conflict detection has nothing to compare against on a row that did not exist a moment ago."
coverImage: '/assets/blog/post/offline-first-not-everything-ledger/cover.jpg'
date: '2026-11-08T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','event-sourcing','conflict-resolution','sync']
ogImage:
    url: '/assets/blog/post/offline-first-not-everything-ledger/cover.jpg'
ogTitle: 'Not Everything Deserves a Ledger'
---

*We event-source the entities whose history is the product. The interesting category is the one in between.*

**TL;DR** Event sourcing is usually discussed as an architecture-wide switch, on or off. In practice it is a
per-operation decision. Our app runs two write paths and one read-only class: a full ledger for entities whose
history is the product; a hybrid where **creating** and **deleting** a row go through the plain sync queue and
every **update** goes through the ledger; and a set of lookup tables that no device writes at all. That hybrid
looks like an unfinished migration. It isn't. It is the line falling exactly where the ledger stops paying for
itself, because conflict detection has nothing to compare against on a row that did not exist a moment ago.

> Part 14 of the **Offline-First KMP** series: field notes from a production winery app built on Kotlin
> Multiplatform (KMP), whose architecture [Part 11](/posts/offline-first-witness-not-judge) maps end to end.
> It assumes [Part 13](/posts/offline-first-auto-resolve): you know what a version snapshot is and how the
> disjoint-column check works. This is the question that comes next, which nobody asks until they have built
> one of these: *which* entities actually deserve that machinery.

## Three Entity Groups, Two Write Paths

Our entities fall into three groups, and the group decides how a write reaches the server, if it reaches it at
all.

<div class="diagram">
<div class="diagram-head">Three entity groups, by write path</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Pure event-driven: six entities</span><span class="diagram-tag">every write is an event</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">CRUD-create, event-update: eight entities</span><span class="diagram-tag">create and delete: sync queue<br>update: event</span></div>
<div class="diagram-row"><span class="diagram-row-name">Reference and lookup: a few dozen tables</span><span class="diagram-tag">server-seeded, read-only on the device</span></div>
</div>
</div>

**Pure event-driven.** Dockets, wines, vessels, bottle runs, docket analyses, and docket certifications. The
client never uploads these rows directly at all. It records an event and paints a provisional projection
so the screen updates instantly; the server's engine derives the authoritative row and syncs it back.

**CRUD-create, event-update.** Growers, varietals, additive definitions, manufacturers, and the packaging types.
You can create one of these offline and the sync layer uploads the row directly, the ordinary way, and you can
delete one the same way. But you cannot update one that way. A local update is applied for the screen and then
dropped before the wire; the update travels as an event instead, so the server stays the authoritative writer
for every mutation.

**Reference and lookup.** Status tables, type lookups, the genuinely static rows. A few dozen of them, seeded
for each workspace by the server, synced down, and never written by a device. Customising them for a winery
is a server-side migration, not something the app does. The connector does not upload them and the server would
refuse the row if it did. No events, no versions, and no conflicts, because the phone is never the writer.

Yes, creating and deleting catalog rows is the plain queue this series has spent several posts criticising, and
we shipped it on purpose: last write wins only loses data when there is something to lose.

## Why Creating and Editing Take Different Write Paths

The hybrid is the group that raises eyebrows, so here is the actual reason, and it is not gradual migration.

Conflict detection works by comparison. An event carries a version snapshot of what the user was looking at, and
on sync the server compares that snapshot against the current state. That comparison is the whole mechanism.

Now try to apply it to a row being created. There is no previous version. There is nothing on the server to
compare the snapshot against, because a moment ago the row did not exist. The machinery is not expensive here,
it is *inapplicable*. You are paying for a comparison that has no second operand.

The failure modes differ too, and that is the part that decides the trade:

<div class="diagram">
<div class="diagram-head">Two people, one grower, both offline</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">Both create it</div>
<div class="diagram-branch-rule">plain sync queue</div>
<div class="diagram-line">both uploads succeed: two growers</div>
<div class="diagram-line">a duplicate anyone can see</div>
<div class="diagram-verdict is-ok">Visible, and a human can fix it.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">Both edit it</div>
<div class="diagram-branch-rule">if it rode the queue too</div>
<div class="diagram-line">last write wins: one edit is gone</div>
<div class="diagram-line">no duplicate, no flag, no log</div>
<div class="diagram-verdict is-bad">Silent data loss.</div>
</div>
</div>
</div>

So the hybrid gives each operation the mechanism its failure calls for. Creating a grower rides the plain queue,
because its worst case is a duplicate somebody will see. Editing one goes through the ledger, because its worst
case is an edit nobody will ever know was lost.

## Event Sourcing Is Decided per Operation, Not per Entity

That is the transferable part, and it is why "do you event-source everything?" is the wrong question.

Two questions decide a path, and they are independent:

1. **Will somebody need to audit this operation later?** Grapes arriving as a docket is part of the winery's
   story; someone will eventually ask who moved that wine and when. Adding a row to the varietal list is data
   entry, and nobody has ever asked me to audit the history of a lookup table.
2. **Can this operation destroy work somebody else did?** Updates can. Creations mostly cannot; the worst case
   is a duplicate.

Put together, the two answers pick the path:

<div class="diagram">
<div class="diagram-head">Two questions, three paths</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Audited later, and can destroy work</span><span class="diagram-tag">full ledger</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">Creating can't destroy work, updating can</span><span class="diagram-tag">hybrid</span></div>
<div class="diagram-row"><span class="diagram-row-name">Not audited, can't destroy work</span><span class="diagram-tag">plain sync queue</span></div>
</div>
</div>

The bottom row is not a compromise, it is correct. The middle one is common and rarely modelled.

A ledger is not free: every event type costs a payload, a validator, a processor and a test. Spend that on
renaming a bottle size and event sourcing earns its reputation for being heavy.

## Doesn't the Event Ledger Slow Down as It Grows?

No, and the reason is the sync layer. The server applies each event once, when it arrives, and the phone reads
state from rows that are already computed:

<div class="diagram">
<div class="diagram-head">One event, from arrival to screen</div>
<div class="diagram-timeline">
<div class="diagram-tick"><div class="diagram-tick-label">Event arrives</div><div class="diagram-tick-tag">appended to the ledger</div></div>
<div class="diagram-window" style="flex-grow: 1">
<div class="diagram-window-ticks">
<div class="diagram-tick is-compare"><div class="diagram-tick-label">Engine applies it once</div><div class="diagram-tick-tag">writes the entity rows</div></div>
</div>
<div class="diagram-window-label">On the server</div>
</div>
<div class="diagram-tick"><div class="diagram-tick-label">Sync streams the rows</div><div class="diagram-tick-tag">to every phone</div></div>
<div class="diagram-tick"><div class="diagram-tick-label">Phone reads the rows</div><div class="diagram-tick-tag">plus its own<br>unsent events</div></div>
<div class="diagram-tick is-skip"><div class="diagram-tick-label">Replay the ledger</div><div class="diagram-tick-tag">never on a device</div></div>
</div>
</div>

No device ever replays the ledger to learn what is in a tank. The log is left with two jobs: the timeline, and a conflict check that
only looks back to the version the user saw.

## Give Each Entity's Category One Home

In a hybrid, which group an entity belongs to is the most important fact about its writes, and it is not decided
in one place. Say next season you add a new catalog entity, a cooperage. Putting it in the hybrid group takes
three decisions, in three places, that have to agree:

<div class="diagram">
<div class="diagram-head">Adding a cooperage to the hybrid group</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Conflict check version-tracks its table</span><span class="diagram-tag">shared engine</span></div>
<div class="diagram-row"><span class="diagram-row-name">Upload connector accepts its creates</span><span class="diagram-tag">phone sync layer</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">Upload rule keeps direct updates on the phone</span><span class="diagram-tag">forget it: the server refuses the edits</span></div>
</div>
<div class="diagram-formula">category(cooperage) = <span class="is-safe">hybrid</span> &rarr; all three settings</div>
<div class="diagram-legend"><span><span class="is-safe">&#9632;</span> declared once per table; the three settings follow from it</span></div>
</div>

So if you build one of these, declare the category once: one entry per table saying which group it is in, with
the rest derived from it, or at least a test that fails when they disagree. It is the same idea as
[Part 16](/series/offline-first-kmp#part-16): when correctness depends on metadata staying in step, let the build
check it, not the next person's memory.

## The Takeaways

- **Event sourcing is a per-operation decision, not an architecture-wide one.** Ask it per write, not per app,
  and expect the answer to differ between creating a thing and changing it.
- **Conflict detection needs something to compare against.** On creation there is no previous version, so the
  machinery is not costly there, it is inapplicable. That alone justifies a hybrid path.
- **Match the mechanism to the failure mode.** Duplicate rows and silent lost edits are different problems.
  Paying ledger prices to prevent duplicates is overkill; paying queue prices and losing edits is negligence.
- **In a hybrid, give the category one home.** An entity's group is decided in several places; declare it once
  and derive the rest, so the next table you add lands in the right group.
