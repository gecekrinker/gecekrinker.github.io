import React from "react";

export default function DateLine() {
    const [date, setDate] = React.useState("");

    React.useEffect(() => {
        const now = new Date();
        setDate(`${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`);
    }, []);

    return <span className="font-mono mt-1">{`tarih: ${date}`}</span>;
}
