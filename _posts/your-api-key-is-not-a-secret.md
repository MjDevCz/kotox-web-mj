---
title: 'Your API key is not a secret'
excerpt: "We have been hiding API keys in Android apps for a decade — with BuildConfig tricks, NDK, obfuscation libraries. None of it works. The fix is not better hiding; it is treating the key as a public identifier and proving the app is genuine instead."
coverImage: '/assets/blog/post/api-key-not-secret/cover.jpg'
date: '2026-06-05T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','security','play-integrity','bff','architecture']
ogImage:
    url: '/assets/blog/post/api-key-not-secret/cover.jpg'
ogTitle: "Your API key is not a secret"
---

I just gave a talk at mDevCamp called *Your API Key Is Not a Secret*. This is the short version for anyone who missed it — or who watched it and wants the ideas without the stage banter.

@[youtube](q7kYt-WPTwQ)

## The reframe

Here is the question I opened with: **what is the difference between a password and a username?**

You would say one is secret and one is not. But that is not a property of the string. The same thirty-two characters can be a password if I keep them, or a username if I publish them. *Secret* is not something the string is — it is something we do to the string.

So the obvious follow-up: which one is the API key in your Android app?

It ships inside the APK. Anyone who downloads it from the Play Store gets a copy. Apktool will surface it in seconds. BuildConfig wrappers, NDK, string obfuscation, key splitting — these are speed bumps, not secrets. **A key you have published to every device on Earth is a username.** It just happens to be one we have been treating like a password.

## A different question

The API key was supposed to answer one question: *is this request authorized?*

It cannot, because you cannot keep it. So instead of trying harder to hide it, ask a different question:

> Is this request coming from my genuine app, on a genuine device, at this moment?

That is not a question a key can answer. That is a question that needs proof from *outside the app* — proof an attacker cannot replicate by copying bytes out of your APK.

On Android, that proof comes from Google Play. Your app asks Google for a token. Google looks at the binary, the device, and the account, and hands back a signed verdict. Your app forwards the verdict to your backend. Your backend asks Google to decode it. If the verdict says *yes, this is your real app on a real device*, the request goes through. Otherwise, 403.

Three parties instead of two. The third one — Google Play — is the notary. It cannot be bribed by the attacker, because it is not running attacker code.

## The pattern in three lines

1. App asks Google for proof of genuineness.
2. App sends that proof to your backend together with the request.
3. Your backend trusts Google, not the app.

The API key still exists. It still ships in the APK. But it is doing nothing load-bearing — it is just a label, a username. The thing that actually authorizes the request is the verdict from Google, bound to that specific request, valid only for a few minutes.

A stolen key is no longer enough. To replay the request, the attacker needs a verdict — and to get a verdict they need a genuine, unmodified, Play-Store-installed copy of your app running on a real device. That is a very different shopping list from "copy a string out of an APK."

## When this pattern actually matters

This is the part I want to dwell on, because it is where teams over-apply or under-apply the pattern.

The right question is not *"is this endpoint sensitive?"* but **"what is the blast radius if it gets abused?"**

Imagine an app with no login. Every screen makes API calls, but those calls fall into two very different categories:

- **The app calls a third-party public API directly** — for example, CoinGecko for the coin catalog, or Coinbase for live prices. The upstream sees the abuser's IP and rate-limits *them*. Your other users keep working fine. The blast radius is the abuser, not your user base. **You do not need integrity here.** Skip the complexity. Their backend, their business.

- **The app calls *your* backend, which is hiding a paid third-party key** — a news endpoint fronting a paid NewsAPI key, an error-reporting endpoint forwarding to your Sentry quota. The upstream sees one account: yours. If someone hammers it, NewsAPI throttles your project, the feature breaks for *every* user of your app, and you eat the bill. **This is exactly where the pattern earns its keep.** Your backend, your secrets.

Same app. Same user. Two architectures, two intentional decisions. The rule of thumb: **wrap an endpoint in integrity when the cost of abuse lands on you, not on the upstream.**

## What about authenticated requests?

A reasonable objection: *"My API is behind login. Each user has a token. Isn't that enough?"*

For most apps, yes — and that is a good thing. A logged-in user already has a per-user identity, per-user rate limiting, and a clear blast radius (one account). Integrity verification on every authenticated call is rarely worth the operational complexity it adds.

Where integrity *still* helps after login is the **signup, login, and password-reset endpoints themselves** — the small set of routes that have to be reachable without a session and that attackers love (credential stuffing, fake account creation, OTP spam). Treat those like the no-login case. The endpoints behind them, once a real user is authenticated, can usually rely on the auth token alone.

## What the pattern does not do

Two things to be honest about.

**It is not unbreakable.** On a rooted device with kernel-level tooling, motivated attackers can spoof some of the device verdicts. What the pattern does is move attacker cost from *"apktool plus curl, twelve seconds, zero dollars"* to *"rooted device, custom kernel modules, ongoing maintenance per device."* For almost every app that is not a bank, that is the right trade.

And there is a second shift worth naming. A scraped key lets one attacker hide inside an anonymous flood — every request looks like any other call from your app, and you cannot tell abuse apart from real users. A bypass attacker does not get that anonymity: each compromised device has a real cost to set up, and each one carries a fingerprint your backend can see and ban. The damage stops being a faceless wave and becomes a small set of trackable, blockable instances. That is a very different incident to triage at 3am.

**It excludes some users.** Non-Play installs — F-Droid, sideloaded debug builds, GrapheneOS, Huawei without GMS — fail the verdict. Know your audience before you ship this. If half your users are on alternative app stores, this pattern is not for you.

## The takeaway

You will still have an API key in your app. That is fine. **Stop treating it like a password.** It is a username — a public identifier — and the moment you accept that, the rest of the architecture falls into place.

Move real secrets to a backend. Prove the app is genuine — not the key. Use the pattern where the blast radius of abuse lands on you, and skip it where the upstream is already self-policing.

The platform changes. The architecture does not.

![Resources from the talk: sample Android app and sample BFF (Kotlin / Ktor) on GitHub at github.com/MjDevCz](/assets/blog/post/api-key-not-secret/link-screen.jpg)