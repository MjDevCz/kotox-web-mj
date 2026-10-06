---
title: 'Your Sync Stack Fits in Three Containers'
series: 'Offline-First KMP'
seriesPart: 9
excerpt: "An offline-first app is **a distributed system wearing a mobile app's clothes**, so develop it like one. Standing our sync stack up locally took three Docker containers, and the database was the easy part. The time went into the seams a cloud provider hides from you: the token contract the sync service enforces, and the host networking between the app and the machine."
coverImage: '/assets/blog/post/offline-first-local-stack/cover.jpg'
date: '2026-10-06T01:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','ios','kmp','offline-first','powersync','sync','docker']
ogImage:
    url: '/assets/blog/post/offline-first-local-stack/cover.jpg'
ogTitle: 'Your Sync Stack Fits in Three Containers'
---

*We put our offline-first sync stack into three Docker containers, and the database was the easy part.*

**TL;DR** An offline-first app is a distributed system wearing a mobile app's clothes: a database, a REST
write path, a sync service, and an auth contract between them. For months we developed against a shared
cloud instance because it was the fastest way to start. Standing the stack up locally later took three
Docker containers, with a plain REST layer standing in for our write API, and the surprises were not in the
database. They were in auth and host networking, the two seams a cloud provider hides from you.

This one is a dev-environment note, not a war story, and it closes the plumbing run
[Part 6](/posts/offline-first-adapter-layer) opened. It reads fine on its own.

## The Shared-Cloud Trap

When you pick a sync layer, the fastest way to see it work is to point every developer at one hosted
instance. It ships in an afternoon and it demos beautifully. It is also the decision that quietly gets
expensive.

A shared remote database means every developer's writes land in the same place. Schema changes are a
negotiation. You cannot reset to a clean slate without stepping on a colleague, so nobody does, and the data
drifts into a state no fresh install would ever produce. Worst of all, you cannot see the *seams* of your
own system: the cloud provider terminates auth, routes your writes, and runs the sync service, so the parts
you most need to understand are the parts you never touch.

A hermetic local stack fixes all of that, and it is cheap to build on day one. It is painful to retrofit on
day three hundred, once every test and habit assumes the cloud. We learned that in the retrofit direction.
Learn it in the other.

## The Sync Stack Is Three Containers

Here is the thing the cloud hides: the stack an offline-first client syncs against is small. Ours is three
containers plus a token endpoint.

<div class="diagram">
<div class="diagram-head">The local stack</div>
<div class="diagram-rows">
<div class="diagram-row"><span class="diagram-row-name">Postgres · 5432</span><span class="diagram-tag">app database and the sync service's bucket storage</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">PostgREST · 3001</span><span class="diagram-tag">REST over the tables, stands in for our write API · uploads go here</span></div>
<div class="diagram-row is-derived"><span class="diagram-row-name">PowerSync · 8080</span><span class="diagram-tag">sync-down stream and checkpoints · downloads come from here</span></div>
<div class="diagram-row"><span class="diagram-row-name">token-server · 3002</span><span class="diagram-tag">nginx shim serving a signed JWT, stands in for Firebase · local scaffolding</span></div>
</div>
</div>

The single most clarifying thing about running it yourself is seeing that **uploads and downloads use
different services**. The client writes *up* to [PostgREST](https://postgrest.org), plain REST straight at
the tables, and the sync service streams changes back *down*. Production splits them the same way, the sync
service on one URL and our own write API on another, but from inside the app they feel like one system. On
two local ports, the architecture stops being a diagram and becomes two things you can `curl`
independently. That mental model alone was worth the exercise.

One thing the local stack is not: a copy of the write path. In production, uploads go to a single batch
endpoint on our own API, which checks and processes every write before it is stored. Locally, PostgREST
takes the rows straight into the tables. That is enough to develop the client against, and it means
anything the server's processing would catch, the local stack will not.

## Localizing Is a Connector, Not a Rewrite

The app never talked to "the cloud" directly. It talked to a connector: a small class the sync SDK calls to
fetch credentials and to upload a batch of local changes. That indirection is what makes localizing cheap.
We did not rewrite the app. We wrote a second connector pointed at localhost and selected it in the
development build flavor.

```kotlin
class LocalConnector(private val httpClient: HttpClient) : PowerSyncBackendConnector() {

    override suspend fun fetchCredentials(): PowerSyncCredentials {
        val token = httpClient.get("http://$localSyncHost:3002/token").bodyAsText().trim()
        return PowerSyncCredentials(endpoint = "http://$localSyncHost:8080", token = token)
    }

    override suspend fun uploadData(database: PowerSyncDatabase) { /* POST/PATCH/DELETE to PostgREST */ }
}
```

The production upload half (one batch endpoint, and why a `200` from it is not the same as success) is its
own topic the series already covered ([Part 5](/posts/offline-first-silent-success),
[Part 6](/posts/offline-first-adapter-layer)). What matters here is the shape: the backend is a swappable
dependency, and a hermetic environment is one implementation of it. If your sync layer does not give you
that seam, that is the thing to fix first, before you build a local anything.

## Surprise One: JWT Auth Is the Hard Part, Not the Database

Postgres in a container is a solved problem. The seam that actually took thought was the token.

The sync service authenticates the client with a signed JWT, and two constraints fell out of that. First,
**you cannot bake the token into the app.** PowerSync rejects any token that lives longer than 24 hours, so
a build-time constant would expire mid-afternoon and never refresh. The connector has to *fetch* the token
at runtime, which is why there is a token-server at all. The SDK re-invokes `fetchCredentials()` on
reconnect, so a freshly minted token is picked up without a rebuild.

Second, and this is the one that cost me a silent stretch of debugging: the token's `sub` claim has to
match the seeded user id, because the sync stream resolves `auth.user_id()` to a workspace through that
claim. Get it wrong and the stream does not error. It returns *empty buckets*. No `401`, no failed request,
just an app that syncs nothing and says nothing about why. Auth in a sync system fails the same way
everything else in this series fails: quietly, with plausible-looking emptiness instead of a crash.

Bypassing Firebase for local dev was easy. Reproducing the *contract* the sync service checks (audience,
key id, subject, expiry) was the actual work. That contract is exactly what a cloud provider does for you,
which is exactly why you should build it once yourself.

## Surprise Two: "localhost" Is Three Different Hosts

The other tax nobody warns you about is that the developer machine's `127.0.0.1` is not the app's
`127.0.0.1`.

- **iOS simulator** shares the host network, so loopback reaches the stack directly.
- **Android** (emulator or a USB device) does not. It reaches the host through `adb reverse`, which
  forwards the ports over the debug bridge. Re-run it every time the device reconnects.
- **A physical iOS device** has neither and needs the machine's real LAN IP, same Wi-Fi, firewall open.

We hid the difference behind a one-line `expect/actual` that resolves the host per platform, and settled on
loopback everywhere with `adb reverse` on Android because it is the one recipe that covers both Android
cases. Small thing, but it is the difference between "run the app" and a stretch of `Connection refused`.

## The Takeaways

- **An offline-first architecture is a distributed system, so develop it like one.** The client is only
  half of it. A database, a write API, a sync service, and an auth contract are the other half, and you
  should be able to stand up the stack your client talks to on one laptop, reset it to a clean slate, and
  read its logs. A stack you can inspect is a stack you can debug.
- **Build the hermetic environment early.** It is a couple of containers on day one and a painful retrofit
  once every test assumes a shared cloud. The cost only goes up.
- **The database is the easy part.** The seams worth your attention are the ones the cloud hides: the token
  contract the sync service enforces, and the host networking between the app and the machine. Those are
  where the time goes, and understanding them is most of the point of doing it yourself.

That closes the plumbing run. Four parts spent inside the pipe between device and server, and later in the
series we climb back out of it, to the architecture all this plumbing exists to serve.

Next up (Part 10): one last failure from down in the pipes before we do. Part 5 said HTTP 200 is not
success; Part 10 is the other half, where a 500 is not a retry.

## Reference

- PowerSync — [Self-hosting](https://docs.powersync.com/intro/self-hosting)
- PowerSync — [Custom authentication](https://docs.powersync.com/configuration/auth/custom)
- PowerSync — [Integrating with your backend](https://docs.powersync.com/configuration/app-backend/client-side-integration)
