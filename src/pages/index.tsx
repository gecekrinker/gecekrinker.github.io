import Head from "next/head";
import Markdown from "react-markdown";
import { GetStaticProps } from "next";

import getMarkdown from "@/lib/getMarkdown";
import Grid from "@/components/grid";
import Layout from "@/components/layout";
import MyInfo from "@/components/my_info";
import NowPlaying from "@/components/now_playing";
  import NowGaming from "@/components/now_gaming";
import SocialCards from "@/components/social_cards";

export default function Page(props: { markdown: string }) {
    return (
        <div className="lg:p-8 p-2 w-full flex flex-col justify-center items-center">
            <Head>
                <title>keremradu | ev</title>
            </Head>

            <Layout>
                <MyInfo/>
                <div className="markdown font-mono text-base sm:text-xl">
                    <Markdown>{props.markdown}</Markdown>
                </div>

                <div className="flex flex-col gap-3 mt-4">
                    <NowPlaying/>
  <NowGaming />
                    <SocialCards/>
                </div>
            </Layout>
            <Grid/>
        </div>
    );
}

export const getStaticProps: GetStaticProps = async () => {
    return {
        props: {
            markdown: getMarkdown("me.md") ?? ""
        }
    };
};
