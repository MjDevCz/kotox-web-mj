---
title: 'Every Synced Row Needs an ID'
series: 'Offline-First KMP'
seriesPart: 8
excerpt: "A row with **no identity of its own cannot survive a sync layer that addresses everything by id**. A composite key is enough for the database, which only has to find the row. It is not enough for a system that has to name the row to move it, and the id PostgreSQL calls redundant is load-bearing for the engine that carries the row across the wire."
coverImage: '/assets/blog/post/offline-first-join-table-id/cover.jpg'
date: '2026-10-06T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','powersync','sync','postgres']
ogImage:
    url: '/assets/blog/post/offline-first-join-table-id/cover.jpg'
ogTitle: 'Every Synced Row Needs an ID'
---

*Three certification types went up, one came back down, and nothing anywhere reported a problem.*

**TL;DR** PowerSync tracks every synced row by a single `id`. A many-to-many join table is keyed by its
two foreign keys and has no `id` of its own, so PowerSync handed every one of its rows the *same* empty
identifier. On sync-down each row overwrote the one before it, and only the last link per parent survived.
Nothing threw. We fixed it twice: first with a synthetic id the sync stream built by concatenating the two
foreign keys, then durably by adding a real `id` column server-side, a column PostgreSQL considers
redundant but the sync layer cannot ship the row without.

[Part 6](/posts/offline-first-adapter-layer) told the *upload* side of junction tables: fold the rows into
an array on their parent, then drop them before they go up. This is the mirror image, on the way *down*,
where the sync layer insists on addressing every row by an `id` the table was never built to have. It is
the third stop on the plumbing run.

## The Symptom: Many-to-Many Links Lost on Sync-Down

The relationship that caught it was a docket's certification record and the types on it. That is a classic
many-to-many: one certification record can carry several certification types, so the pairs live in a join
table, `docket_certification_certification_type_lookup`, one row per (certification record, type) link.

A user would tag a docket certification with three types, everything looked right on the device, and the
data synced. Then, from the server's copy, it came back down with **one** type on it. Not the wrong data,
not a blank, not an error toast. Two of the three links were simply gone, and the one that remained was
always the last one written. On the server all three rows were sitting there, correct and intact. The loss
happened in transit, and no layer on either side raised a hand.

That is the through-line of this whole series. The dangerous failures are not the ones that crash. They are
the ones that hand you data that looks plausible and is quietly missing a piece.

## The Root Cause: A Composite Key Has No Single ID

PowerSync's sync protocol identifies every row in a synced table by a single `id`. That is the unit it
tracks, diffs, and applies. It is not a suggestion you can model around; it is the address space the whole
sync engine operates in.

Our join tables were modelled the ordinary relational way: a composite primary key over the two foreign
keys, no surrogate `id` column. From PostgreSQL's point of view that is complete and correct. The pair
`(docket_certification_id, certification_type_id)` uniquely identifies a row, and adding a separate id
column would be redundant. The database has everything it needs.

The sync layer does not. With no `id` column to read, PowerSync gave every row of the table the same empty
`object_id`. And when every row shares one address, they are not three rows to the sync engine. They are one
address written three times, last-write-wins:

<div class="diagram">
<div class="diagram-head">Three links, one address</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">PostgreSQL</div>
<div class="diagram-branch-rule">keyed by the foreign-key pair</div>
<div class="diagram-line">(cert, type A)</div>
<div class="diagram-line">(cert, type B)</div>
<div class="diagram-line">(cert, type C)</div>
<div class="diagram-verdict is-ok">Three distinct rows.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">PowerSync</div>
<div class="diagram-branch-rule">keyed by a single id</div>
<div class="diagram-line"><span class="diagram-key">""</span> ← type A</div>
<div class="diagram-line"><span class="diagram-key">""</span> ← type B, overwrites A</div>
<div class="diagram-line"><span class="diagram-key">""</span> ← type C, overwrites B</div>
<div class="diagram-verdict is-bad">One row arrives: type C.</div>
</div>
</div>
</div>

So the pairs collapsed on the way down, and the survivor was whichever row landed last. The information the
server held perfectly could not be *represented* on the wire, because the rows had no identities to keep
them apart.

[Part 6](/posts/offline-first-adapter-layer) used that same fact to justify upload-side inlining. There it was about wire format. Here it is
about identity: a row that cannot be named cannot be moved.

## The Quick Fix: Mint the ID in the Sync Stream

The row needs an id of its own, and the fastest place to make one is out of the two values that already
make it unique. The composite key that satisfied Postgres becomes the raw material for the single id
PowerSync wants. The stream's query, the server-side definition of what each client is allowed to see,
concatenates the two foreign keys into a deterministic synthetic id:

```sql
SELECT docket_certification_id || '_' || certification_type_id AS id,
       docket_certification_id, certification_type_id
FROM docket_certification_certification_type_lookup
WHERE docket_certification_id IN (
  SELECT id FROM docket_certification WHERE workspace_id IN (SELECT id FROM active_workspaces)
)
```

Now every row carries a stable, unique `id` before it leaves the server, PowerSync tracks each one
independently, and all three links arrive intact. The id is derived rather than stored: it lives in the
sync stream, not in a column, so nothing in the database schema had to change to ship the fix. It is
**deterministic**, so the same pair always resolves to the same id and updates land on the row they should
instead of spawning a duplicate, and it is **derivable from data the row already carries**, so no
coordination with whoever wrote the row is required.

The bug first surfaced on docket certifications, and the synthetic id went in for that one table. What
turned a patch into a lesson came a couple of weeks later. Three more many-to-many relationships were
landing at once: manufacturers to their categories, growers to their certifications, additive definitions
to their allergens. Every one of them was a composite-key join table. Every one of them was about to walk
into the identical trap, silently, with no test failing to warn us, because the failure mode produces
plausible data rather than a crash. So the fix generalized to all four join tables in one pass. This was
never a quirk of certifications. It is what happens to *any* row that has no identity of its own the moment
you put it on a sync layer that addresses everything by id.

## The Durable Fix: A Real ID PostgreSQL Calls Redundant

The synthetic id worked, but it lived in the wrong place. Encoding identity in a sync stream means the
stream now carries logic about how each junction table is keyed, and the id exists only for tables the
stream remembers to special-case. The row's identity ought to be a property of the row, not of the query
that happens to ship it. So the durable fix moved it into the data: a real
`id uuid DEFAULT gen_random_uuid()` column on each junction table, server-side.

That is not a change the app team can make alone. The junction tables live in a PostgreSQL schema the
backend team owns, so this meant asking them to add a column their model does not want. From PostgreSQL's
side the column is genuinely redundant: the composite foreign-key pair already uniquely identifies the row,
and a surrogate id buys the relational model nothing. The case for adding it is entirely about the layer
above. The engine that ships the row across the wire addresses everything by `id`, and without one the row
cannot travel intact, however complete it looks at rest in the database.

Once the column existed, the sync stream got simpler, not more complex. The concatenation disappeared, and
the query just reads the real id straight off the table:

```sql
SELECT docket_certification_certification_type_lookup.id,
       docket_certification_certification_type_lookup.docket_certification_id,
       docket_certification_certification_type_lookup.certification_type_id
FROM docket_certification_certification_type_lookup
INNER JOIN docket_certification dc
        ON dc.id = docket_certification_certification_type_lookup.docket_certification_id
WHERE dc.workspace_id IN (SELECT id FROM active_workspaces)
```

That is the shape the production sync config runs today, for all of the join tables. The synthetic-id trick
did its job as a bridge and is gone.

## The Takeaways

- **A row with no identity of its own cannot survive a sync layer that addresses everything by id.** A
  composite key is enough for the database, which only ever has to *find* the row. It is not enough for a
  system that has to *name* the row to move it. Those are different jobs, and the relational model only
  signs up for the first.
- **"Redundant" is relative to the layer asking.** The id PostgreSQL calls unnecessary is load-bearing for
  the engine that carries the row across the wire, so the durable fix meant persuading the backend team to
  add a column their model rejects on its own terms. [Part 6](/posts/offline-first-adapter-layer) met the same shape from the wire-format side, a
  declaration cosmetic in one place and load-bearing in another; here it lands on identity and
  addressability instead. Same lesson, different axis: what one layer can safely omit, the next layer down
  cannot.
- **Silent, again.** Like [Part 5](/posts/offline-first-silent-success)'s dropped breadcrumb and [Part 6](/posts/offline-first-adapter-layer)'s
  rejected `"770.0"`, this degraded without a sound: right-looking data, a missing piece, no error. If there
  is one habit this series keeps arguing for, it is to distrust the failures that do not announce
  themselves. Those are the ones that reach your users.

Next up ([Part 9](/posts/offline-first-local-stack)): the last stop on the plumbing run, and the one we should have made first: standing the
whole sync stack up on a laptop, and the two seams a cloud provider hides from you.

## Reference

- PowerSync — [Client ID](https://docs.powersync.com/sync/advanced/client-id)
- PowerSync — [Many-to-many and join tables](https://docs.powersync.com/sync/rules/many-to-many-join-tables)
