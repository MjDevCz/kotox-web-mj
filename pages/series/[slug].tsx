import {useRouter} from 'next/router'
import ErrorPage from 'next/error'
import Link from 'next/link'
import Head from 'next/head'
import Image from 'next/image'
import Container from '../../components/container'
import Header from '../../components/header'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import DateFormatter from '../../components/date-formatter'
import CoverImage from '../../components/cover-image'
import SeriesPartBadge from '../../components/series-part-badge'
import {getAllSeries, getSeriesBySlug, getStaleSeriesAnchors} from '../../lib/api'
import type {SeriesShowcase} from '../../lib/api'
import {getLocalImageMeta} from '../../lib/coverBlur'
import type {LocalImageMeta} from '../../lib/coverBlur'
import {CMS_DOMAIN, CMS_INTRO} from '../../lib/constants'

type Props = {
    series: SeriesShowcase | null
    coverMeta: LocalImageMeta | null
    socialMeta: LocalImageMeta | null
}

export default function SeriesPage({series, coverMeta, socialMeta}: Props) {
    const router = useRouter()
    if (!router.isFallback && !series) {
        return <ErrorPage statusCode={404}/>
    }
    return (
        <Layout>
            <Container>
                <Header/>
                {router.isFallback || !series ? (
                    <PostTitle>Loading…</PostTitle>
                ) : (
                    <article className="mb-32">
                        <Head>
                            <title>
                                {series.name} | {CMS_INTRO}
                            </title>
                            <meta property="og:title" content={series.name}/>
                            <meta property="og:description" content={series.ogDescription}/>
                            <meta property="og:type" content="website"/>
                            <meta property="og:site_name" content={CMS_INTRO}/>
                            <meta property="og:locale" content="en_US"/>
                            {/*
                              Intentionally no canonical og:url. LinkedIn caches
                              share previews keyed on og:url and canonicalizes
                              query-string variants back to it, so a stale first
                              scrape (before this page had an image) sticks and
                              cache-busting URLs (?v=N) collapse to it. Omitting
                              og:url makes LinkedIn key on the exact shared URL,
                              so a fresh ?v= reliably forces a clean re-scrape.
                            */}
                            {series.social && (
                                <meta property="og:image" content={CMS_DOMAIN + series.social}/>
                            )}
                            {series.social && (
                                <meta property="og:image:secure_url" content={CMS_DOMAIN + series.social}/>
                            )}
                            {series.social && (
                                <meta property="og:image:type" content="image/jpeg"/>
                            )}
                            {socialMeta && (
                                <meta property="og:image:width" content={String(socialMeta.width)}/>
                            )}
                            {socialMeta && (
                                <meta property="og:image:height" content={String(socialMeta.height)}/>
                            )}
                            {series.social && (
                                <meta property="og:image:alt" content={`Cover image for ${series.name}`}/>
                            )}
                            <meta name="twitter:title" content={series.name}/>
                            <meta name="twitter:description" content={series.ogDescription}/>
                            <meta name="twitter:card" content={series.social ? 'summary_large_image' : 'summary'}/>
                            {series.social && (
                                <meta name="twitter:image" content={CMS_DOMAIN + series.social}/>
                            )}
                        </Head>
                        <p className="uppercase tracking-widest font-semibold text-gray-500 text-sm mb-4">
                            Series · {series.parts.length} {series.parts.length === 1 ? 'part' : 'parts'}
                            {series.planned.length > 0 && ` · ${series.planned.length} coming soon`}
                        </p>
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter leading-tight mb-6">
                            {series.name}
                        </h1>
                        {series.description && (
                            <p className="text-lg md:text-xl leading-relaxed text-gray-700 mb-12 max-w-3xl">
                                {series.description}
                            </p>
                        )}
                        {series.cover && (
                            <div className="mb-12">
                                <CoverImage
                                    title={series.name}
                                    src={series.cover}
                                    blurDataURL={coverMeta?.blurDataURL}
                                    priority
                                />
                            </div>
                        )}
                        <ol className="max-w-3xl">
                            {series.parts.map((part) => (
                                <li key={part.slug} className="border-t border-gray-200 py-6">
                                    <Link
                                        as={`/posts/${part.slug}`}
                                        href="/posts/[slug]"
                                        className="group flex items-center gap-5 no-underline"
                                    >
                                        <SeriesPartBadge part={part.part} highlight={part.highlight} className="w-11 h-11 text-base"/>
                                        <span className="block flex-1 min-w-0">
                                            <span className={`block text-xl md:text-2xl leading-snug group-hover:underline ${part.highlight ? 'font-extrabold' : 'font-semibold'}`}>
                                                {part.title}
                                            </span>
                                            <span className="block text-sm text-gray-500 mt-1">
                                                <DateFormatter dateString={part.date}/>
                                            </span>
                                        </span>
                                        {part.coverImage && (
                                            <span className="flex-shrink-0 relative block w-24 sm:w-32 aspect-[16/9] overflow-hidden rounded shadow-sm">
                                                <Image
                                                    src={part.coverImage}
                                                    alt=""
                                                    fill
                                                    sizes="128px"
                                                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                                                />
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ol>
                        {series.planned.length > 0 && (
                            <section className="max-w-3xl mt-16">
                                <h2 className="uppercase tracking-widest font-semibold text-gray-500 text-sm mb-2">
                                    Coming Soon
                                </h2>
                                <p className="text-gray-700 mb-6">
                                    Already written and on their way. If a published part mentions one of these,
                                    this is where it lands. Follow along on{' '}
                                    <a href="https://www.linkedin.com/in/jenicekmichal/" target="_blank" rel="noopener noreferrer" className="underline">
                                        LinkedIn
                                    </a>{' '}
                                    or the <a href="/feed.xml" className="underline">RSS feed</a> to catch each one as it ships.
                                </p>
                                <ol>
                                    {series.planned.map((part) => (
                                        <li
                                            key={part.part}
                                            id={`part-${part.part}`}
                                            className="scroll-mt-8 border-t border-gray-200 py-6 -mx-4 px-4 rounded transition-colors duration-700 target:bg-yellow-50"
                                        >
                                            <div className="flex items-center gap-5">
                                                <span className="flex-shrink-0 flex items-center justify-center rounded-full border border-dashed border-gray-300 bg-white text-gray-400 font-semibold w-11 h-11 text-base">
                                                    {part.part}
                                                </span>
                                                <span className="block flex-1 min-w-0">
                                                    <span className="block text-xl md:text-2xl leading-snug font-semibold text-gray-500">
                                                        {part.title}
                                                    </span>
                                                    {part.teaser && (
                                                        <span className="block text-gray-500 mt-1">{part.teaser}</span>
                                                    )}
                                                    <span className="inline-block text-xs uppercase tracking-widest text-gray-400 mt-2">
                                                        Coming soon
                                                    </span>
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}
                    </article>
                )}
            </Container>
        </Layout>
    )
}

type Params = {
    params: {
        slug: string
    }
}

export async function getStaticProps({params}: Params) {
    const series = getSeriesBySlug(params.slug)
    const coverMeta = series?.cover ? await getLocalImageMeta(series.cover) : null
    const socialMeta = series?.social ? await getLocalImageMeta(series.social) : null
    return {
        props: {
            series,
            coverMeta,
            socialMeta,
        },
    }
}

export async function getStaticPaths() {
    for (const link of getStaleSeriesAnchors()) {
        console.warn(`[series] Part is published now, link the post instead: ${link}`)
    }
    return {
        paths: getAllSeries().map((series) => ({
            params: {slug: series.slug},
        })),
        fallback: false,
    }
}
