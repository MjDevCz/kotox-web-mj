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
import {getAllSeries, getSeriesBySlug} from '../../lib/api'
import type {SeriesShowcase} from '../../lib/api'
import {getLocalImageMeta} from '../../lib/coverBlur'
import type {LocalImageMeta} from '../../lib/coverBlur'
import {CMS_DOMAIN, CMS_INTRO} from '../../lib/constants'

type Props = {
    series: SeriesShowcase | null
    coverMeta: LocalImageMeta | null
}

export default function SeriesPage({series, coverMeta}: Props) {
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
                            <meta property="og:description" content={series.description}/>
                            <meta property="og:type" content="website"/>
                            <meta property="og:url" content={CMS_DOMAIN + '/series/' + series.slug}/>
                            {series.cover && (
                                <meta property="og:image" content={CMS_DOMAIN + series.cover}/>
                            )}
                            {series.cover && (
                                <meta property="og:image:secure_url" content={CMS_DOMAIN + series.cover}/>
                            )}
                            {series.cover && (
                                <meta property="og:image:type" content="image/jpeg"/>
                            )}
                            {coverMeta && (
                                <meta property="og:image:width" content={String(coverMeta.width)}/>
                            )}
                            {coverMeta && (
                                <meta property="og:image:height" content={String(coverMeta.height)}/>
                            )}
                            {series.cover && (
                                <meta property="og:image:alt" content={`Cover image for ${series.name}`}/>
                            )}
                            <meta name="twitter:title" content={series.name}/>
                            <meta name="twitter:description" content={series.description}/>
                            <meta name="twitter:card" content={series.cover ? 'summary_large_image' : 'summary'}/>
                            {series.cover && (
                                <meta name="twitter:image" content={CMS_DOMAIN + series.cover}/>
                            )}
                        </Head>
                        <p className="uppercase tracking-widest font-semibold text-gray-500 text-sm mb-4">
                            Series · {series.parts.length} {series.parts.length === 1 ? 'part' : 'parts'}
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
                                        <span className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full border border-gray-300 bg-white text-base font-semibold text-gray-600">
                                            {part.part ?? '·'}
                                        </span>
                                        <span className="block flex-1 min-w-0">
                                            <span className="block text-xl md:text-2xl font-semibold leading-snug group-hover:underline">
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
    return {
        props: {
            series,
            coverMeta,
        },
    }
}

export async function getStaticPaths() {
    return {
        paths: getAllSeries().map((series) => ({
            params: {slug: series.slug},
        })),
        fallback: false,
    }
}
