/** 从预约信 PDF 里抽文字（交给 pdfjs），再找出日期时间。扫描件没有文字层，认不出来。 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let loader: Promise<any> | null = null;

/** pdfjs 是纯 JS 实现，Bun 下直接跑 legacy 构建，不需要 worker。 */
function loadPdfjs(): Promise<any> {
    loader ??= import(require.resolve("pdfjs-dist/legacy/build/pdf.mjs"));
    return loader;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        useSystemFonts: false,
        verbosity: 0,
    });
    const doc = await task.promise;
    const parts: string[] = [];

    try {
        for (let page = 1; page <= doc.numPages; page++) {
            const content = await (await doc.getPage(page)).getTextContent();
            for (const item of content.items) {
                if (typeof item.str === "string" && item.str.trim()) parts.push(item.str);
            }
        }
    } finally {
        await task.destroy();
    }

    return parts.join(" ").replace(/\s+/g, " ");
}

const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(value: number, size = 2): string {
    return String(value).padStart(size, "0");
}

function toStamp(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
): string | null {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (hour > 23 || minute > 59) return null;
    return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

function to24(hour: number, meridiem?: string): number {
    if (!meridiem) return hour;
    const upper = meridiem.toUpperCase();
    if (upper === "PM" && hour < 12) return hour + 12;
    if (upper === "AM" && hour === 12) return 0;
    return hour;
}

/** 常见写法都收：2026-12-08 09:30 / 08-12-2026 09:30 / 8 December 2026 09:30 / December 8, 2026 9:30 AM / 2026年12月8日 09:30。 */
export function findDateTimes(text: string): string[] {
    const found = new Set<string>();
    const add = (stamp: string | null) => {
        if (stamp) found.add(stamp);
    };

    // 2026-12-08 09:30、2026/12/08、2026年12月8日 09:30
    for (const m of text.matchAll(
        /(\d{4})[-/.年]\s?(\d{1,2})[-/.月]\s?(\d{1,2})日?[^\d]{0,12}?(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/g,
    )) {
        add(
            toStamp(
                Number(m[1]),
                Number(m[2]),
                Number(m[3]),
                to24(Number(m[4]), m[6]),
                Number(m[5]),
            ),
        );
    }

    // 30-11-2026 10:30、08/12/2026 14:45（按日/月/年）
    for (const m of text.matchAll(
        /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[^\d]{0,12}?(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/g,
    )) {
        add(
            toStamp(
                Number(m[3]),
                Number(m[2]),
                Number(m[1]),
                to24(Number(m[4]), m[6]),
                Number(m[5]),
            ),
        );
    }

    // 8 December 2026 09:30
    for (const m of text.matchAll(
        /(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})[^\d]{0,12}?(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/g,
    )) {
        const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
        if (!month) continue;
        add(toStamp(Number(m[3]), month, Number(m[1]), to24(Number(m[4]), m[6]), Number(m[5])));
    }

    // December 8, 2026 9:30 AM
    for (const m of text.matchAll(
        /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})[^\d]{0,12}?(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/g,
    )) {
        const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
        if (!month) continue;
        add(toStamp(Number(m[3]), month, Number(m[2]), to24(Number(m[4]), m[6]), Number(m[5])));
    }

    return [...found].sort();
}
