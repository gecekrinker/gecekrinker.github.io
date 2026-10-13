import React from "react";
import Link from "next/link";
import { socials } from "@/data/links";

const CARD = "flex items-center gap-3 p-3 border border-neutral-500/40 hover:border-neutral-400 hover:bg-neutral-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export default function SocialCards() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            {socials.map(({ id, label, handle, href, icon: Icon }) => {
                const body = (
                    <>
                        <Icon className="shrink-0 text-2xl" aria-hidden />
                        <span className="flex flex-col min-w-0">
                            <span className="font-bold">{label}</span>
                            <span className="text-sm opacity-60 truncate">{handle}</span>
                        </span>
                    </>
                );

                // sitenin kendi sayfası (örn. /blog): Next.js Link ile
                if (href.startsWith("/")) {
                    return <Link key={id} href={href} className={CARD}>{body}</Link>;
                }

                const external = href.startsWith("http");
                return (
                    <a
                        key={id}
                        href={href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        className={CARD}
                    >
                        {body}
                    </a>
                );
            })}
        </div>
    );
}
