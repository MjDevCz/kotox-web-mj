import {useRouter} from 'next/router'
import ErrorPage from 'next/error'
import Container from '../../components/container'
import PostBody from '../../components/post-body'
import Header from '../../components/header'
import PostHeader from '../../components/post-header'
import Layout from '../../components/layout'
import {getPostBySlug, getAllPosts, getSeriesNav} from '../../lib/api'
import type {SeriesNavItem} from '../../lib/api'
import SeriesNav from '../../components/series-nav'
import {getCoverBlurDataURL} from '../../lib/coverBlur'
import PostTitle from '../../components/post-title'
import Head from 'next/head'
import {CMS_DOMAIN, CMS_INTRO} from '../../lib/constants'
import markdownToHtml from '../../lib/markdownToHtml'
import type PostType from '../../interfaces/post'

type Props = {
    post: PostType
    morePosts: PostType[]
    seriesNav: {prev: SeriesNavItem | null; next: SeriesNavItem | null}
    preview?: boolean
}

export default function Post({post, morePosts, seriesNav, preview}: Props) {
    const router = useRouter()
    if (!router.isFallback && !post?.slug) {
        return <ErrorPage statusCode={404}/>
    }
    return (
        <Layout preview={preview}>
            <Container>
                <Header/>
                {router.isFallback ? (
                    <PostTitle>Loading…</PostTitle>
                ) : (
                    <>
                        <article className="mb-32">
                            <Head>
                                <title>
                                    {post.title} | {CMS_INTRO}
                                </title>
                                <meta property="og:image" content={CMS_DOMAIN +post.ogImage.url}/>
                                <meta property="og:title" content={post.ogTitle}/>
                                <meta property="og:description" content={post.excerpt}/>
                                <meta property="og:type" content="article"/>
                                <meta property="og:url" content={CMS_DOMAIN + '/posts/' + post.slug}/>
                                <meta name="twitter:image" content={CMS_DOMAIN + post.ogImage.url}/>
                                <meta name="twitter:title" content={post.ogTitle}/>
                                <meta name="twitter:description" content={post.excerpt}/>
                                <meta name="twitter:card" content="summary_large_image"/>
                            </Head>
                            <PostHeader
                                title={post.title}
                                series={post.series}
                                seriesPart={post.seriesPart}
                                coverImage={post.coverImage}
                                coverBlurDataURL={post.coverBlurDataURL}
                                date={post.date}
                                readingTime={post.readingTime}
                                metaData={post.metaData}
                            />
                            <PostBody content={post.content}/>
                        </article>
                        <SeriesNav prev={seriesNav.prev} next={seriesNav.next}/>
                    </>
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
    const post = getPostBySlug(params.slug, [
        'title',
        'series',
        'seriesPart',
        'date',
        'slug',
        'excerpt',
        'metaData',
        'content',
        'readingTime',
        'ogImage',
        'ogTitle',
        'coverImage',
    ])
    const content = await markdownToHtml(post.content || '', { enrichImages: true })
    const coverBlurDataURL = post.coverImage ? await getCoverBlurDataURL(post.coverImage as string) : null
    const seriesNav = getSeriesNav(params.slug)

    return {
        props: {
            post: {
                ...post,
                content,
                coverBlurDataURL,
            },
            seriesNav,
        },
    }
}

export async function getStaticPaths() {
    const posts = getAllPosts(['slug'])

    return {
        paths: posts.map((post) => {
            return {
                params: {
                    slug: post.slug,
                },
            }
        }),
        fallback: false,
    }
}
