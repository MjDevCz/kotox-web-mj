---
title: 'Make Drift a Compile Error'
series: 'Offline-First KMP'
seriesPart: 16
excerpt: "Our server auto-resolves two offline edits when the hand-written lists of columns they write are disjoint. A list that misses a column turns a real conflict into a silent overwrite. So we check every list against the code: a contract test runs each event through the real processor and **fails the build** on any column it did not declare, one exhaustive `when` makes a new event type uncompilable until it is covered, and three more guards freeze what the builds already on phones depend on."
coverImage: '/assets/blog/post/offline-first-drift-compile-error/cover.jpg'
date: '2026-11-22T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','conflict-resolution','contract-testing','sync']
ogImage:
    url: '/assets/blog/post/offline-first-drift-compile-error/cover.jpg'
ogTitle: 'Make Drift a Compile Error'
---

*Auto-resolve trusts a hand-written list of what each event changes. Hand-written lists rot. So we don't trust it.*

**TL;DR** The server decides two offline edits do not conflict by comparing hand-written lists of the
columns each event writes. If a list misses a column, a real conflict gets applied silently and one user's
write overwrites another's. So we check every list against the code: a contract test runs each event
through the real processor, collects the columns it actually writes, and fails the build on any it did not
declare. The same move guards the payloads that builds already on phones depend on.

> Part 16 of the **Offline-First KMP** series: field notes from a production winery app built on Kotlin
> Multiplatform (KMP). It builds on the auto-resolver from
> [Part 13](/posts/offline-first-auto-resolve#the-clean-version-version-snapshots-and-disjoint-columns); the
> architecture around both is mapped in [Part 11](/posts/offline-first-witness-not-judge#conflict-as-a-decision).

## The Hand-Written List Auto-Resolve Trusts

Every event declares, by hand, which columns it writes and which entities it touches:

```kotlin
// columns I write, per table
override fun modifiedAttributes(): Map<String, Set<String>>
// entity ids I touch, per table
override fun touchedEntities(): Map<String, Set<String>>
```

When two edits collide, the server auto-resolves them only if their `modifiedAttributes` are disjoint
([Part 13](/posts/offline-first-auto-resolve)). A rename writes `name`, an assignment writes
`occupant_wine_id`, nobody disagreed, apply both. That is safe only if the list is complete, and the two
ways it can be wrong are not equally bad:

<div class="diagram">
<div class="diagram-head">Two ways a declaration can be wrong</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">Under-declared</div>
<div class="diagram-branch-rule">the processor writes a column the list misses</div>
<div class="diagram-line">two colliding edits look disjoint</div>
<div class="diagram-line">one silently overwrites the other</div>
<div class="diagram-verdict is-bad">Corrupts data.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">Over-declared</div>
<div class="diagram-branch-rule">the list names a column the processor never writes</div>
<div class="diagram-line">edits overlap more often than they really do</div>
<div class="diagram-line">a person gets asked more often than needed</div>
<div class="diagram-verdict is-ok">Harmless.</div>
</div>
</div>
</div>

## How a Column List Rots

A developer adds a column to a processor and updates the SQL. Nothing makes them open the event class and
add the column to `modifiedAttributes()`. Everything compiles, the tests pass, the app ships.

Nothing goes wrong until two people edit that entity offline, both change the undeclared column, and the
server calls the conflict disjoint. No exception, no log line, just a wrong value that looks plausible.

## Check the List Against the Code

A contract test runs every event type through the same dispatch path auto-resolve uses, against a fake
database that records every statement, and compares what the processor wrote with what the event declared:

```kotlin
engine.processEventMutationsOnly(
    eventId = "evt-1", workspaceId = "ws-1", event = sample.event,
)

// scrape every `UPDATE … SET col = ?` the processor ran
val written = parseUpdateColumns(db.calls)
// what the event claims it writes
val declared = sample.event.modifiedAttributes()

// fail the build if the processor wrote a column it did not declare
for ((table, writtenCols) in written) {
    val undeclared = writtenCols -
        declared[table].orEmpty() - PAYLOAD_INDEPENDENT_COLUMNS
}
```

A miss fails the build with the event, the table and the column. The check fails only on
under-declaration, the dangerous direction, and ignores the safe one. Two bookkeeping columns are excluded:
`version_id`, which no event declares, and `updated_at`, which an event declares only on purpose, as a
conflict sentinel.

Two sibling tests do the same for `touchedEntities()` and for the values an event says it modifies.

## A New Event Type Won't Compile Until It's Covered

A test that covers the event types someone remembered to list has the same problem as the list. So the
tests do not keep lists. Every event type is an entry in `OperationalEventType`, and every contract test
builds its fixtures from one exhaustive `when` over it, with no `else`:

```kotlin
internal fun samplesOf(kind: OperationalEventType): List<EventSample> =
    when (kind) { /* one branch per type */ }
```

Add a type and that `when` stops compiling until it has a branch. The branch feeds every check built on
it: the three declaration contracts, plus the invariants that every `UPDATE` bumps `version_id`, every
`INSERT` sets it to one, and no event declares a table the validator does not know.

It used to be lists. Each test kept its own hand-written cases: the attribute test covered 18 of the 64
event types we had then, and the only coverage check compared two hand lists, so five event classes missing
from both passed. Moving to the one `when` found no bad declaration: all 64 passed. The gap was real; the
corruption had not happened yet.

The pattern spreads. The conflict screen decides per event type whether a conflicted change reopens its
form or only retries. That was two sets of types with a *keep in sync* comment, and a type in neither got a
plain retry. It is now an exhaustive `when` too.
[Part 7](/posts/offline-first-generated-file#what-the-drift-test-refuses-to-trust) applies the same move to
a hand-written type map, checked against the database schema.

## Drift Against the Builds You Already Shipped

The code can also drift from something you cannot recompile: the builds already on phones. Upload queues
survive app updates, a device offline for a week syncs last week's payloads, and older builds keep reading
every recorded event. Change a payload's shape carelessly and those builds stop reading it.

Three more contract tests guard that, one for each way an old build gets left behind:

<div class="diagram">
<div class="diagram-head">Three guards for a phone you cannot recompile</div>
<div class="diagram-fork is-three">
<div class="diagram-branch">
<div class="diagram-branch-title">Required keys</div>
<div class="diagram-branch-rule">a shipped build rejects a payload missing a key it requires</div>
<div class="diagram-line"><span class="diagram-key">HARVEST_DOCKET_ASSIGN -&gt; setOf("docketId", "vesselId")</span></div>
<div class="diagram-line">stops: a required key turning optional</div>
<div class="diagram-verdict is-ok">Way through: none. Keep writing the key.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">Enum constants</div>
<div class="diagram-branch-rule">a shipped build drops every event carrying a constant it does not know</div>
<div class="diagram-line"><span class="diagram-key">"…WineColor.ROSE",</span></div>
<div class="diagram-line">stops: a constant added or removed</div>
<div class="diagram-verdict is-ok">Way through: bump <code>PowerSyncSchemaVersion</code>.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">Shipped payloads</div>
<div class="diagram-branch-rule">a shipped build keeps sending them, from a queue that survived the update</div>
<div class="diagram-line"><span class="diagram-key">1.2.0-1068/HARVEST_DOCKET_ASSIGN-0-lean.json</span></div>
<div class="diagram-line">stops: a validator rule tightened</div>
<div class="diagram-verdict is-ok">Way through: an <code>AllowedRefusal</code> with a reason.</div>
</div>
</div>
</div>

**Required keys.** The test keeps a frozen list of the keys each payload requires:

```kotlin
CELLAR_WINE_UPDATE -> setOf("wineId", "name")
```

This one comes from a real case. An edit gave `WineUpdateEvent.name` a default, so a change to a wine's
fermentation status alone left the key out. Phones on the previous release still required it and dropped
the event from the wine's timeline, silently. The fix and the test landed together, and the same edit now
stops the build:

```kotlin
// was: val name: String?
val name: String? = null
```

```
[CELLAR_WINE_UPDATE] `name` is no longer required, but shipped builds
still require it: they fail to decode any payload without it.
```

There is no way through except to keep writing the key until no supported build needs it.

**Enum constants.** Every constant a payload can carry is frozen in one list. Add a harvest method and the
build goes red:

```kotlin
// MIXED is new
enum class HarvestMethod { HANDPICKED, MACHINE, MIXED }
```

```
`…HarvestMethod.MIXED` is new. Builds that don't know it drop every
event carrying it, so add it to payloadEnumConstants, and CI will then
require a PowerSyncSchemaVersion bump for a recommended update.
```

Adding it to the list is allowed. CI then forces the schema bump, which asks older builds to update before
they start dropping events.

**Shipped payloads.** Every release leaves behind a folder of the payloads it can send, full and with the
optional fields stripped. One that an earlier release sends when a docket is assigned:

```json
{
  "docketId": "d-1",
  "vesselId": "v-1",
  "amountVolumeL": 400.0,
  "sourceAmountVolumeL": 600.0
}
```

If we tightened the assign rule to require a reason on every assign, not only when the amounts differ,
this payload would turn red on Android, iOS and Node at once. Shipping the stricter rule anyway means
writing the refusal down:

```kotlin
AllowedRefusal(
    fixture = "1.2.0-1068/HARVEST_DOCKET_ASSIGN-0-lean.json",
    error = "...",
    // why the server may now refuse what that release sends
    reason = "...",
)
```

That list is empty today. A stricter rule can only get in with a written reason, next to the payload it
breaks.

## The Takeaways

- **When correctness depends on metadata, check the metadata against the code.** A hand-written list of
  what code does is a second source of truth, and it drifts. Run the code and compare.
- **Fail in the dangerous direction only.** Under-declaration corrupts data, so it breaks the build;
  over-declaration costs a question, so it passes.
- **Make extending the system extend the guard.** One exhaustive `when` over the event types turns "someone
  might forget" into a compile error.
- **Shipped builds are a source of truth you cannot edit.** Freeze what they depend on, and make breaking it
  a decision the build makes you write down.
