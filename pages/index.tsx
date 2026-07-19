import Container from '../components/container'
import MoreStories from '../components/more-stories'
import HeroPost from '../components/hero-post'
import SeriesShowcase from '../components/series-showcase'
import Intro from '../components/intro'
import Layout from '../components/layout'
import {getAllPosts, getFeaturedSeries} from '../lib/api'
import type {SeriesShowcase as SeriesShowcaseData} from '../lib/api'
import {getCoverBlurDataURL} from '../lib/coverBlur'
import {generateRssFeed} from '../lib/generateRssFeed'
import fs from 'fs'
import Head from 'next/head'
import Post from '../interfaces/post'

type Props = {
    allPosts: Post[]
    featuredSeries: SeriesShowcaseData[]
}

export default function Index({allPosts, featuredSeries}: Props) {
    const heroPost = allPosts[0]
    // Parts shown in a series band are dropped from the grid so a post never
    // appears twice (the hero is intentionally left as-is).
    const featuredSlugs = new Set(featuredSeries.flatMap((s) => s.parts.map((p) => p.slug)))
    const morePosts = allPosts.slice(1).filter((p) => !featuredSlugs.has(p.slug))
    return (
        <>
            <Layout>
                <Head>
                    <title>{`MJ Stories`}</title>
                </Head>
                <Container>
                    <Intro/>
                    {heroPost && (
                        <HeroPost
                            title={heroPost.title}
                            series={heroPost.series}
                            seriesPart={heroPost.seriesPart}
                            coverImage={heroPost.coverImage}
                            coverBlurDataURL={heroPost.coverBlurDataURL}
                            date={heroPost.date}
                            metaData={heroPost.metaData}
                            slug={heroPost.slug}
                            excerpt={heroPost.excerpt}
                        />
                    )}
                    {featuredSeries.map((series) => (
                        <SeriesShowcase key={series.name} series={series}/>
                    ))}
                    {morePosts.length > 0 && <MoreStories posts={morePosts}/>}
                </Container>
            </Layout>
        </>
    )
}

export const getStaticProps = async () => {
    const allPosts = getAllPosts([
        'title',
        'series',
        'seriesPart',
        'date',
        'slug',
        'metaData',
        'coverImage',
        'excerpt',
    ])

    const allPostsWithBlur = await Promise.all(
        allPosts.map(async (post) => ({
            ...post,
            coverBlurDataURL: post.coverImage ? await getCoverBlurDataURL(post.coverImage as string) : null,
        }))
    )

    fs.writeFileSync('public/feed.xml', await generateRssFeed())

    return {
        props: {allPosts: allPostsWithBlur, featuredSeries: getFeaturedSeries()},
    }
}
