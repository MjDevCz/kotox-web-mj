---
title: 'You Cannot Fix a Generated File'
series: 'Offline-First KMP'
seriesPart: 7
excerpt: "A generated file is an **input, not a place to put decisions**. Whatever you write there has a lifetime bounded by the next regeneration, and that regeneration arrives inside somebody else's unrelated pull request. Hold the exception in code the generator cannot reach, and point the guard at the upstream source of truth rather than the artifact."
coverImage: '/assets/blog/post/offline-first-generated-file/cover.jpg'
date: '2026-09-06T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','powersync','sync']
ogImage:
    url: '/assets/blog/post/offline-first-generated-file/cover.jpg'
ogTitle: 'You Cannot Fix a Generated File'
---

*A wrong column type broke our uploads. A teammate fixed it in one word. Sixteen days later my pull
request quietly undid it.*

**TL;DR** Our local database schema is generated from a dashboard and carries a banner telling you not to
edit it. A teammate edited it anyway, because the declaration was wrong and correcting it took one word.
Sixteen days later I regenerated that file inside a pull request about something else entirely, silently
reverted them, and re-broke a bug we had already closed. The lesson is not "read the banner." It is that a
generated file is an *input*, which makes it the wrong place to put a decision. Put the decision somewhere
regeneration cannot reach, and anchor your guard to the upstream truth instead of the artifact.

[Part 6](/posts/offline-first-adapter-layer) argued that the gap between your local schema and your wire
format is a real architectural layer, and closed by flagging one trap it did not open: the schema file
driving all of it is generated, not hand-written. This is that trap, and the second stop on the plumbing
run.

## Why the Generated Schema File Looks Cosmetic

Our client schema is generated per environment from the sync service's dashboard. It declares every synced
table and the type of every column, and it opens with a comment telling you it is machine-written.

Here is what makes it feel harmless: the local database ignores it. [PowerSync](https://www.powersync.com)
keeps every value as text internally, so a column declared as text instead of a number behaves perfectly on
the device. Every screen renders. Every query returns. Sync down works. If the declared types were only
ever used locally, the file really would be cosmetic.

They are not only used locally. On the upload path our connector reads those same declarations to decide
how to serialize each value: columns declared as text ship as JSON strings, and everything else runs
through a coercion helper that turns numeric-looking strings into JSON numbers. One declaration, two
consumers, and the two consumers disagree about how much it matters. That is the whole setup.

The connector configuration and the wire format rules live in shared common Kotlin, so this single decision
covers both the iOS and the Android client. One place to get it right, and one place to get it wrong.

## The One-Word Fix That Did Not Survive Regeneration

The bug was a bottle volume. In production the dashboard had been hand-forced to declare that column
numeric; in staging, where nobody had done that, the same column in the same table came out as text. So
staging serialized the value as the string `"770.0"`, our write endpoint validated it as a number, and it
failed.

Nothing failed on the phone. Bottles were created, screens updated, and the local database was perfectly
happy. The rejection happened on the wire, and thanks to the lesson in
[Part 5](/posts/offline-first-silent-success), it happened quietly.

Finding it was the expensive part. Fixing it took one word: a teammate changed the column type in the
staging schema file from text to a numeric type, uploads started passing, and the ticket closed.

Four weeks after the ticket closed, the same bug came back. Not a regression in our code, and not a new
column. A pull request of mine, merged sixteen days in and shipping a feature that had nothing to do with
bottles, needed three new columns, so it pulled a fresh schema from the staging dashboard. That dashboard
still described the volume column as text, because the underlying environment had never been migrated. So
my regeneration was correct, the one-word fix was overwritten, and a closed bug reopened itself with nobody
having typed anything wrong.

That is the moment worth keeping. The fix was not incomplete or sloppy, and the regeneration that undid it
was not careless. Both were correct. One of them was applied in a place that has no memory.

## Why Fixing the Dashboard Was Never the Right Answer

The obvious next move is to fix the dashboard instead, so the next regeneration produces the right file. We
tried that, and it works exactly once, per column, per environment.

Our sync service always maps a Postgres `numeric` column to a client text column, deliberately, to preserve
arbitrary precision. It is not a bug and it is not going to change. Which means every numeric column in the
schema is declared text on the client, every regeneration re-declares them text, and every one of them
would upload as a string if the connector believed the file.

So the choice was never "correct declaration versus wrong declaration." It was: fight the generator, per
column, per environment, forever, and pay that cost again every time somebody regenerates. Any fix whose
lifetime is bounded by the next regeneration is not a fix. It is a countdown.

## Put the Decision Where Regeneration Cannot Reach

What we do now is treat the generated schema as one input among several, and hold the part it gets wrong
somewhere it cannot be touched.

The connector's configuration makes that concrete, and the interesting thing about it is where each piece
comes from. Most of what it holds has always been hand-written: which tables are allowed to upload at all,
which columns are the server's to write rather than ours, and the per-table translation rules
[Part 6](/posts/offline-first-adapter-layer) walks through. Exactly one of its inputs is derived from the
generated schema. That one is the only one that ever needed rescuing, and in hindsight that is not a
coincidence: the derived input is the fragile one, so it is the one that needs an escape hatch.

At startup the connector still derives the set of text columns from the generated schema, because for
genuinely textual columns that derivation is exactly right and it costs nothing to maintain as the schema
grows. Then it subtracts a small hand-written map of the columns the server expects as numbers. Those fall
through to the coercion helper and upload as JSON numbers, whatever the generated file happens to say this
week.

The map is keyed by table, not by column name, and that detail is load-bearing: the same column name can be
genuinely numeric in one table and genuinely textual in another. A flat list of names would have quietly
broken the second case while fixing the first.

The regeneration still overwrites the schema file. It just no longer overwrites the decision.

## Anchor the Drift Guard to the Upstream Schema, Not the Artifact

A hand-written map is a rot risk. So we solved it the way this codebase solves every rot risk: make drift
fail the build.

The guard is a test, and what matters is what it reads. It does not check the map against the generated
schema, because the generated schema is the thing we already decided not to trust. It parses the database's
own `schema.sql`, the actual upstream source of truth, and compares that against the generated files for
every environment we ship.

It checks both directions, which matters more than it sounds:

- A synced column that is numeric upstream but is not in the map would upload as a string. The build fails,
  and the message names the table and column to add.
- An entry in the map that is not actually numeric upstream is either stale, because the column was renamed
  or removed, or wrong, because somebody listed a genuinely textual column. One check catches both.

It also fails loudly rather than skipping if it cannot locate `schema.sql`. A guard that can silently pass
is worse than no guard, because it converts a real check into a reassuring noise.

The proof that this landed is a detail I like more than the fix itself. In the generated file, the column
that started all of this is still declared as a numeric type, and that declaration no longer decides
anything, because the map covers the column either way. A future regeneration is free to drift it back to
text. That drift is the exact event that re-broke the bug once, and today it does nothing at all.

## The Takeaways

- **A generated file is an input, not a place to put decisions.** Whatever you write there has a lifetime
  bounded by the next regeneration, and that regeneration will arrive inside somebody else's unrelated pull
  request.
- **When a generator is reliably wrong about one thing, stop arguing with it.** Derive what it gets right,
  and hold the exception in code it cannot reach. Fighting a tool per case, per environment, is a recurring
  cost disguised as a one-time fix.
- **Point your guard at the upstream truth, not the artifact.** Our test reads the database schema, because
  checking the generated file against the generated file would only prove that codegen is deterministic.
- **A fix has landed when its cause is allowed to come back.** Not when the symptom disappears; that is
  only the bug going quiet. The generated file is free to declare our column wrong again, because nothing
  on the upload path asks it about that column any more.

Next up (Part 8): the junction row that needed an id of its own, and what sync down does to a table whose
primary key is two foreign keys.

## Reference

- PowerSync — [Define your schema](https://docs.powersync.com/installation/client-side-setup/define-your-schema)
- PowerSync — [Types](https://docs.powersync.com/usage/sync-rules/types)
