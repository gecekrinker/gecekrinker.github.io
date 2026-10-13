import Head from "next/head";
import Link from "next/link";
import { GetStaticProps } from "next";

import Grid from "@/components/grid";
import Layout from "@/components/layout";
import { getAllPosts } from "@/lib/blog";
import type { PostMeta } from "@/lib/blog";
import { formatDate } from "@/lib/date";

export default function Page(props: { posts: PostMeta[] }) {
    return (
        <div className="lg:p-8 p-2 w-full flex flex-col justify-center items-center">
            <Head>
                <title>keremradu | bloglar</title>
            </Head>

            <Layout>
                <div className="header flex flex-col font-mono">
                    <span className="text-3xl font-bold">bloglar</span>
                    <span className="mt-1">{"konu: yazılar"}</span>
                    <Link href="/" className="mt-1 opacity-70 hover:opacity-100 hover:underline w-fit">← ana sayfa</Link>
                </div>

                {props.posts.length === 0 && <p className="font-mono opacity-70">henüz yazı yok.</p>}

                <div className="flex flex-col gap-3">
                    {props.posts.map((p) => (
                        <Link
                            key={p.slug}
                            href={`/blog/${p.slug}`}
                            className="flex flex-col gap-1 p-3 border border-neutral-500/40 hover:border-neutral-400 hover:bg-neutral-500/10 font-mono focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <span className="font-bold text-lg">{p.title}</span>
                            {p.date && <span className="text-sm opacity-60">{`tarih: ${formatDate(p.date)}`}</span>}
                            {p.description && <span className="text-sm opacity-80">{p.description}</span>}
                        </Link>
                    ))}
                </div>
            </Layout>
            <Grid/>
        </div>
    );
}

export const getStaticProps: GetStaticProps = async () => ({
    props: { posts: getAllPosts() },
});
