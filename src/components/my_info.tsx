import React from "react";
import Image from "next/image";
import avatar from '../../public/avatar.jpg';
import DateLine from "@/components/date_line";

export default function MyInfo() {
    return(
        <div className="header flex flex-col">
            <div className="flex items-center gap-4">
                <Image
                    src={avatar}
                    width={82}
                    height={82}
                    alt="avatar"
                    className="rounded-full"
                />
                <div className="flex flex-col">
                    <span className="font-mono text-2xl font-bold">keremradu</span>
                    <DateLine/>
                    <span className="font-mono">{'konu: biyografi'}</span>
                </div>
            </div>
        </div>
    )
}
