---
title: 'Shared Logic Is Not Free'
series: 'Offline-First KMP'
seriesPart: 15
excerpt: "One Kotlin module runs our business rules on iOS, Android and a Node.js backend, so the rules cannot drift. But sharing it charges a toll in three currencies: `Long` narrows to `Double`, every database value arrives as a string, and coroutines become Promises driving a transaction whose **rollback is yours** on every exit path. Design the API narrow, and pay each toll on purpose."
coverImage: '/assets/blog/post/offline-first-type-boundary/cover.jpg'
date: '2026-11-08T01:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','kotlin-js','nodejs','coroutines']
ogImage:
    url: '/assets/blog/post/offline-first-type-boundary/cover.jpg'
ogTitle: 'Shared Logic Is Not Free'
---

*"One module, three runtimes" is true for the rules. It is not free at the type boundary.*

**TL;DR** We ship one Kotlin module to iOS, Android, and a Node.js backend, so the business rules exist in
exactly one place and cannot drift. That is real and worth it. But sharing it charges a toll in three
currencies. Two are paid at the Kotlin-to-JavaScript boundary: numbers lose precision (`Long` becomes `Double`),
and coroutines become Promises driving a transaction on a connection the server owns, so every way out has to
end in a rollback. The third comes from one engine reading two different databases: every value arrives as a
string. Design the API narrow, and pay each toll on purpose.

> Part 15 of the **Offline-First KMP** series: field notes from a production winery app built on Kotlin
> Multiplatform (KMP). [Part 11](/posts/offline-first-witness-not-judge#the-kicker-the-same-kotlin-runs-on-a-nodejs-server)
> lands the headline: our backend runs the same Kotlin engine our phones run, compiled to JavaScript. This
> post is the honest invoice for that, the three costs the headline skips.

## The Setup: One Kotlin Module, Three Runtimes

The engine that validates events and derives state is one KMP module. It already compiled to Android and
iOS; we added a single JavaScript target, and the same source now builds a Node library, published as an npm
package the backend imports. This post is about what happens at the seam where compiled Kotlin meets
hand-written JavaScript.

## Toll One: Kotlin `Long` Becomes a JavaScript `Double`

Kotlin has a real `Long`. JavaScript has one number type, an IEEE 754 double, and Kotlin/JS does not smuggle
a 64-bit integer across intact. So anything that is a `Long` on the Kotlin side crosses the boundary as a
`Double`.

You can see it in the facade signatures. A timestamp that is a `Long` internally is exposed to JavaScript as
a `Double`, and narrowed back with `.toLong()` on the inside:

```kotlin
public fun validateIntake(
    // ...
    // Long on the inside, Double at the boundary
    intakeDateMillis: Double?,
): Array<String> =
    validator.validateIntake(/* ... */, intakeDateMillis?.toLong())
```

A `Double` carries integers exactly up to `2^53`, about 9 × 10¹⁵:

<div class="diagram">
<div class="diagram-head">Which Longs survive as a Double</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Epoch-milliseconds timestamp</span><span class="diagram-tag">about 1.8 × 10¹²: fits with room to spare</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">Large counter</span><span class="diagram-tag">can pass 2^53: rounded silently</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">Synthetic id packed into an integer</span><span class="diagram-tag">can pass 2^53: rounded silently</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">Nanosecond clock</span><span class="diagram-tag">about 1.8 × 10¹⁸: already past it</span></div>
</div>
</div>

So for our data this is safe. But "safe for our data" is a decision, not a freebie: past that range the
boundary silently rounds, and you will not get a compile error telling you so. Know which of your numbers
are genuinely 64-bit, and keep them out of the arithmetic that crosses.

## Toll Two: Every Database Value Arrives as a String

The engine reads its database through one small interface, and that interface has exactly one way to read a
column:

```kotlin
/** Platform-agnostic row accessor for query results. */
public interface Row {
    // every column, always a string
    public fun getString(name: String): String?
}
```

Numbers, booleans, timestamps, JSON: the engine receives them all as strings and parses them itself. The
reason is not the JavaScript boundary, or not only. The same engine reads SQLite on the phone and Postgres on
the server, and the two disagree about types: a boolean comes back as `1` or `0` from one and as `true` or
`false` from the other, and dates and JSON come back in different shapes too. A string is the one form both
databases can always produce, so the shared code asks for nothing else. On the server, the bridge that NestJS
hands the engine does the flattening before the engine sees a value:

<div class="diagram">
<div class="diagram-head">Server bridge: Postgres value → string</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Dates</span><span class="diagram-tag"><code>toISOString()</code></span></div>
<div class="diagram-row"><span class="diagram-row-name">Numbers and booleans</span><span class="diagram-tag"><code>String(value)</code></span></div>
<div class="diagram-row"><span class="diagram-row-name">JSON columns</span><span class="diagram-tag"><code>JSON.stringify</code></span></div>
</div>
</div>

So this toll is not strictly the price of crossing into JavaScript, and the phone pays it as well. It is the
price of one engine over two databases, which is the same bargain as one engine over three runtimes, seen from
the storage side.

The phone's upload path has a cousin of this problem: PowerSync keeps every local value as text, so we keep a
small, deliberate coercion layer that turns a string into the right JSON shape: a numeric-looking string
becomes a JSON number, a value that starts with `{` or `[` gets parsed as structured JSON, and everything else
stays a string. There is even a variant that keeps numeric-looking values *as strings* on purpose, for the
columns where "10.4" must not become a float. [Part 6](/posts/offline-first-adapter-layer) tells that story,
and [Part 7](/posts/offline-first-generated-file) is the bug you get from putting one column on the wrong side
of that split.

## Toll Three: Coroutines Become Promises, and the Rollback Is Yours

Kotlin's concurrency is coroutines; JavaScript's is Promises. A `suspend` function cannot cross as-is, so the
facade wraps each one in `GlobalScope.promise { }`, which turns a suspending body into a real Promise the Node
code can `await` ([the facade itself is below](#design-a-narrow-facade-and-let-the-host-own-the-database)). The
`GlobalScope` is deliberate rather than the usual code smell: the caller is Node, there is no parent Kotlin
scope to inherit, and the returned Promise *is* the lifetime handle.

What crosses with it is a transaction. `processEvent` runs its whole dispatch as one database transaction, on a
connection the server owns, opened and closed by Kotlin through the bridge. So every way out of that block has
to end in a rollback, and Kotlin decides what "every way out" means.

We learned that from a `TODO()`. Early on, a few event types were still unimplemented branches, and `TODO()`
throws `NotImplementedError`: an `Error`, not an `Exception`. Both the dispatcher and the bridge adapter caught
`Exception`:

<div class="diagram">
<div class="diagram-head">A TODO() branch throws NotImplementedError</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">catch (e: Exception)</div>
<div class="diagram-branch-rule">back then, in two places</div>
<div class="diagram-line">the Error walks past both catches</div>
<div class="diagram-line">no rollback, no <code>PROCESSING_FAILURE</code></div>
<div class="diagram-line">event row stuck at <code>NOT_PROCESSED</code></div>
<div class="diagram-verdict is-bad">Transaction left to the host.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">catch (e: Throwable)</div>
<div class="diagram-branch-rule">the fix: one word, twice</div>
<div class="diagram-line">the Error is caught like any failure</div>
<div class="diagram-line">rollback runs, the failure is recorded</div>
<div class="diagram-line">row locks released</div>
<div class="diagram-verdict is-ok">Kotlin closes what it opened.</div>
</div>
</div>
</div>

Our server has a backstop, a `finally` that rolls back any judge connection still open. A host without one
keeps the transaction open, with its row locks held.

The same review asked which other exit could skip the cleanup, and the answer was cancellation. A cancelled
coroutine cannot suspend again: its next `await` throws `CancellationException` at once, and the rollback is an
`await` on the server's Promise. Nothing cancels these calls today, but the first timeout someone adds will. So
the adapter finishes its rollback outside cancellation:

```kotlin
js.beginTransaction().await()
try {
    val result = block()
    js.commitTransaction().await()
    return result
} catch (e: Throwable) {          // not Exception: a TODO() is an Error
    withContext(NonCancellable) { // finish even if we were cancelled
        js.rollbackTransaction().await()
    }
    throw e
}
```

## Design a Narrow Facade, and Let the Host Own the Database

None of this is an argument against the approach. It is an argument for building the boundary on purpose.
The engine writes every SQL statement itself, but never opens a database connection. It hands each statement
to one small interface, `DbExecutor`, and each host implements that interface to run the SQL on its own
database:

<div class="diagram">
<div class="diagram-head">One engine, two hosts, one database interface</div>
<div class="diagram-fork">
<div class="diagram-branch">
<div class="diagram-branch-title">On the phone</div>
<div class="diagram-branch-rule">Kotlin all the way down, no gate</div>
<div class="diagram-line"><span class="diagram-key">database</span> PowerSync over SQLite</div>
<div class="diagram-line"><span class="diagram-key">implements</span> <code>PowerSyncDbExecutor</code></div>
<div class="diagram-line"><span class="diagram-key">runs</span> the engine's SQL on the device</div>
<div class="diagram-line"><span class="diagram-key">calls</span> the engine's suspend functions</div>
<div class="diagram-verdict is-ok">Provisional projection.</div>
</div>
<div class="diagram-branch">
<div class="diagram-branch-title">On the server</div>
<div class="diagram-branch-rule">NestJS, through the JavaScript gate</div>
<div class="diagram-line"><span class="diagram-key">database</span> Postgres, via TypeORM</div>
<div class="diagram-line"><span class="diagram-key">implements</span> <code>JsDbExecutor</code> in TypeScript</div>
<div class="diagram-line"><span class="diagram-key">runs</span> the engine's SQL on the server</div>
<div class="diagram-line"><span class="diagram-key">calls</span> <code>WineryJudgeJs</code>: strings in, Promises out</div>
<div class="diagram-verdict is-ok">Authoritative state.</div>
</div>
</div>
</div>

On the phone there is no gate at all. The app wires the engine to SQLite and calls the same processor the
server runs, with typed Kotlin. Same judge, different weight: on the phone its answer is only provisional, a
projection that holds until the server's authoritative state syncs back:

```kotlin
// Wiring (Koin): the phone's DbExecutor is PowerSync over SQLite
single { PowerSyncDbExecutor(get<PowerSyncDatabase>()) }
single { WineryProcessorEngine(get<PowerSyncDbExecutor>(), /* ... */) }

// Renaming a docket on the phone (simplified)
// 1. check: a local no is real
val errors = validationEngine.validateDocket(/* ... */ name = event.name)
if (errors.isNotEmpty()) return Result.failure(/* ... */)
// 2. witness: the event uploads
eventEngine.recordDocketUpdate(workspaceId, docketId, event, userId)
// 3. provisional projection: the same rules, stays on the phone
processorEngine.processDocketUpdate(workspaceId, event)
```

Typed events and suspend functions: no strings, no Promises. The server runs the same engine but reaches it
through the gate, in two small pieces. First, in Kotlin, one exported class whose methods take strings and
numbers. The event arrives as raw JSON and is decoded *inside*, where the sealed classes and generics are real
again:

```kotlin
@JsExport
public class WineryJudgeJs(db: JsDbExecutor) {
    // Promises in, suspend out, rollback guaranteed
    private val dbAdapter = JsDbExecutorAdapter(db)

    public fun processEvent(
        eventId: String,
        workspaceId: String,
        eventType: String,
        eventData: String,      // raw JSON, decoded inside
        schemaVersion: Int,
    ): Promise<Unit> = GlobalScope.promise {
        // decode and validate, then write: Kotlin generates the SQL
        dbAdapter.execute(
            "UPDATE docket SET name = ? WHERE id = ?",
            listOf(name, docketId),
        )
    }
}
```

Then, in TypeScript, the host. It never writes SQL. It runs what Kotlin sends, on a connection it owns (simplified):

```typescript
const db: JsDbExecutor = {
  // Toll Two: every value becomes a string
  getAll: async (sql, params) =>
    (await runner.query(sql, params)).map(row => ({
      getString: name => toText(row[name]),
    })),
  // Kotlin's SQL, run as-is
  execute: async (sql, params) => { await runner.query(sql, params) },
  // connection affinity: one pooled connection, kept until
  // commit or rollback
  beginTransaction: async () => {
    runner = dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
  },
  // commitTransaction, rollbackTransaction, lockRows
}

const judge = new WineryJudgeJs(db)
await judge.processEvent(
  event.id, workspaceId, eventType, JSON.stringify(eventData), version,
)
```

That inversion is what lets one Kotlin module drive a Node backend without dragging Kotlin's runtime
assumptions across the wire with it.

## The Takeaways

- **"Shared logic, zero drift" is true for the logic, and only the logic.** One implementation of the rules
  is a real, large win: client and server cannot disagree, because there is no second copy to disagree. That
  property survives the boundary perfectly. The *types* do not.
- **A cross-language boundary is a boundary; budget for it.** Numbers narrow to `Double`, and coroutines
  become Promises, with a rollback you must guarantee on every exit path. One level down, one engine over two
  databases means every value arrives as a string. None of these throws a compile error at you, so each one is
  a decision you make on purpose or a bug you find in production.
- **Narrow the gate deliberately.** Cross primitives and JSON strings, decode to real types on the inside,
  and let the host own the database connection. Anyone who sells you the boundary as seamless is selling you
  the headline and skipping the invoice.
