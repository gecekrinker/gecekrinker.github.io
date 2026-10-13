import Head from "next/head";
import Link from "next/link";
import Markdown from "react-markdown";
import { GetStaticPaths, GetStaticProps } from "next";

import Grid from "@/components/grid";
import Layout from "@/components/layout";
import { getAllPosts, getPost } from "@/lib/blog";
import type { Post } from "@/lib/blog";
import { formatDate } from "@/lib/date";

export default function Page(props: { post: Post }) {
    const { post } = props;
    return (
        <div className="lg:p-8 p-2 w-full flex flex-col justify-center items-center">
            <Head>
                <title>{`keremradu | ${post.title}`}</title>
                {post.description && <meta name="description" content={post.description} />}
            </Head>

            <Layout>
                <div className="header flex flex-col font-mono">
                    <span className="text-3xl font-bold">{post.title}</span>
                    {post.date && <span className="mt-1">{`tarih: ${formatDate(post.date)}`}</span>}
                    <Link href="/blog" className="mt-1 opacity-70 hover:opacity-100 hover:underline w-fit">← bloglar</Link>
                </div>

                <div className="markdown font-mono text-lg">
                    <Markdown>{post.content}</Markdown>
                </div>
            </Layout>
            <Grid/>
        </div>
    );
}

export const getStaticPaths: GetStaticPaths = async () => ({
    paths: getAllPosts().map((p) => ({ params: { slug: p.slug } })),
    fallback: false, // statik export: listede olmayan adres 404 olur
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const post = getPost(String(params?.slug ?? ""));
    if (!post) return { notFound: true };
    return { props: { post } };
};
