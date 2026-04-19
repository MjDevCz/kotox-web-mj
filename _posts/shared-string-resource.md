---
title: 'Share iOs string resources with Android'
excerpt: "There might be a requirement for mobile string resources to be defined or adjusted by management or
copywriters. There also
might be a requirement to add localization later by those roles. And on top of that strings should be synced across
platforms."
coverImage: '/assets/blog/post/shared-string/cover.jpg'
date: '2023-04-08T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','resources','shared','poeditor']
ogImage:
    url: '/assets/blog/post/shared-string/cover.jpg'
ogTitle: "Share iOS string resources with Android"
---

This is a story about one project where Android platform is catching up iOS when using shared string resources. And how
this can be solved by custom gradle plugin.

## Localization platform

At the beginning there was a requirement where string resources in the mobile app should be easily reviewable, updatable
and in sync
across mobile platforms.

So we started to discuss some localization platform and translation management system.
There is a plenty of localization platforms. Let's mention some:

* [Phrase](https://phrase.com/)
* [PoEditor](https://poeditor.com/)
* [Lokalise](https://lokalise.com/)
* [Transifex](https://www.transifex.com/)
* [Crowdin](https://crowdin.com/)
* ...

Here we can skip discussion about which platform is better than the other. We can state the fact that 
**[PoEditor](https://poeditor.com/)** variant was chosen. And on top of that, it was decided to **import all existing
strings from iOS** including iOS specific string resource keys and parameter placeholders into the PoEditor platform. In
order to save money and use free tier to maximum, **Android should use imported iOS variants**.

## Integrate PoEditor in Android

There are some tips
on [how to translate iOS and Android apps in the same project](https://poeditor.com/kb/how-to-keep-ios-and-android-strings-in-the-same-localization-project).

There are also already available [gradle plugins](https://github.com/hyperdevs-team/poeditor-android-gradle-plugin)
treating standard cases.

But I was in the situation described above, which means **convert keys, parameters, split strings to
modules, etc.**

## Custom PoEditor gradle plugin

For situation when there is a need for custom data post-processing, **the best way is to create customized convention
plugin** and implement any processing specifically to the project needs.

For anyone interested in implementation details,
check [my GitHub repository custom PoEditor Android plugin implementation](https://github.com/mjDevCz/kotox-android/blob/main/build-logic/README-POEDITOR.md)

## Why using gradle plugin at all?

Why I am not using some easy scripting like python or ruby? For PoEditor there is
e.g. [Poesie](https://github.com/NijiDigital/poesie) available. So Why not to use it?

Well, that's also an option.

But by using gradle plugin I am using the advantage of
the [convention plugins](https://proandroiddev.com/exploring-now-in-android-gradle-convention-plugins-91983825bcd7)
already used by the project and let project define which module wants import shared string resources. Not mentioning
advantage of writing logic in Kotlin.

With the string resources import integrated as the gradle plugin it's a small step to connect this action in the CI
server and automate it.

So the sharing string resources begun.  
Happy coding!  
MJ    