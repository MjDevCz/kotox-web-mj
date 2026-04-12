---
title: 'Choosing an offline-first sync layer for KMP'
excerpt: "When your mobile app must work without internet as a standard — not an edge case — picking the right sync layer becomes the most critical architectural decision. Here is how we evaluated the landscape."
coverImage: '/assets/blog/post/offline-first/cover.png'
date: '2026-04-12T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first','powersync','architecture']
ogImage:
    url: '/assets/blog/post/offline-first/cover.png'
ogTitle: "Choosing an offline-first sync layer for KMP"
---

When your mobile app must work without internet as a **standard — not an edge case** — picking the right sync layer becomes the most critical architectural decision. This is the story of how we evaluated the offline-first landscape for a Kotlin Multiplatform project.

## The requirements

We needed a solution that supports **KMP (iOS & Android)**, handles **bidirectional sync** with a cloud database, respects **relational data** with complex entity relationships, and fits within a tight timeline — 4 months, 2 mobile engineers.

That last constraint was key. Whatever we chose had to provide enough out of the box that we wouldn't spend half the project building sync infrastructure.

## The landscape

The offline-first space is evolving fast. For a great overview of the movement and the people behind it, check out [this video](https://youtu.be/10d8HxS4y_g?si=pKNmaYKTfCRPo6fK).

We evaluated seven tools. Here's what we found.

**[PowerSync](https://www.powersync.com)** — infrastructure-agnostic DB bridge with complete KMP bidirectional sync support. SQL-based sync rules. This one checked every box.

**[Electric SQL](https://electric-sql.com)** — promising middleware with a solid sync layer, but missing a mobile solution for the write path. Engineers would be responsible for building the upload queue, network retries, background sync, and global causal consistency manually. Too much plumbing for our timeline.

**[Ditto](https://ditto.live)** — direct device-to-device sync over Bluetooth, WiFi, WAN — no internet needed. A fascinating concept built on a distributed mesh of JSON documents. Great as an additional mechanism, but our project needed structured relational data as the primary model, not NoSQL documents.

**[LiveStore](https://livestore.dev)** — a reactive database acting as a global state store with CRDT-based conflict resolution. Heavily skewed toward the TypeScript/Web ecosystem. Hard to integrate with Room, limited conflict resolution for relations, and zero traceability for debugging sync issues.

**[Myriad](https://codemyriad.io)** — a plumbing framework between Kotlin server and Kotlin client. Could be a nice competitor for PowerSync — if you have a Kotlin server. We didn't.

**[Jazz](https://jazz.tools)**, **[Overtone](https://overtone.pro)** — no KMP support. Non-starters.

## Why PowerSync won

Beyond the KMP support and bidirectional sync, PowerSync gave us **SQL-based sync rules** — which meant we could scope exactly what data syncs to each client. In a multi-tenant app with workspace isolation, this is essential.

It also meant we could focus our engineering effort on what actually matters: the **domain logic**, not the sync plumbing.

## The real challenge starts after choosing the tool

Picking the sync layer was just the first decision. The harder questions followed:

- **Event sourcing vs. CRUD** — how do you preserve user intent when two people work offline on the same data?
- **Optimistic projections** — how do you give instant UI feedback while the server hasn't confirmed the action yet?
- **Conflict resolution** — when offline edits collide, do you silently merge or surface the conflict for human review?

We chose an **event-first architecture** where the mobile client records immutable operational events (user intent), while a shared KMP processing engine runs on both client and server to produce deterministic state. The client gets instant feedback. The server remains the authoritative judge. And conflicts carry enough context to be resolved meaningfully — not just last-write-wins.

### KMP beyond mobile: sharing logic with the server

One advantage of building the processing engines in Kotlin Multiplatform is that they don't have to stay on the phone. We compile the same validation and state-projection logic to **Kotlin/JS** and ship it as a library to our colleagues running the Node.js server. The mobile client and the server literally execute the same code — so an event processed optimistically on the device produces the exact same result when the server processes it after sync.

This eliminates an entire class of bugs where client and server disagree on business rules. The only case where the outcome can differ is a genuine conflict — another user modified the same entity while you were offline — and for that we surface the conflict for human review rather than silently merging.

## The takeaway

The offline-first ecosystem is maturing, but it's still fragmented. Most tools assume a web-first, NoSQL, or single-platform world. If you're building for **KMP with relational data**, the options narrow quickly.

Choose your sync layer based on what it lets you **skip building** — not just what it provides. The months you save on plumbing are the months you spend on the logic that makes your app actually useful.
