/** 英镑兑人民币：先查免费的公开汇率接口，查不到就用内存里上一次的结果。 */

export interface FxRate {
    rate: number;
    /** 汇率对应日期 */
    date: string;
    source: string;
}

const TTL = 6 * 60 * 60 * 1000;

/** 公开接口给的是中间价，支付宝按银行价收，这里补 0.5% 的差价。 */
const MARKUP = 0.005;

let cache: { value: FxRate; at: number } | null = null;

function withMarkup(rate: number) {
    return Math.round(rate * (1 + MARKUP) * 10000) / 10000;
}

async function frankfurter(): Promise<FxRate> {
    const res = await fetch("https://api.frankfurter.app/latest?from=GBP&to=CNY", {
        signal: AbortSignal.timeout(5000),
    });
    const data: any = await res.json();
    return {
        rate: withMarkup(Number(data?.rates?.CNY)),
        date: String(data?.date ?? ""),
        source: "frankfurter",
    };
}

async function openErApi(): Promise<FxRate> {
    const res = await fetch("https://open.er-api.com/v6/latest/GBP", {
        signal: AbortSignal.timeout(5000),
    });
    const data: any = await res.json();
    return {
        rate: withMarkup(Number(data?.rates?.CNY)),
        date: String(data?.time_last_update_utc ?? ""),
        source: "exchangerate-api",
    };
}

export async function gbpToCny(): Promise<FxRate | null> {
    if (cache && Date.now() - cache.at < TTL) return cache.value;

    for (const load of [frankfurter, openErApi]) {
        try {
            const value = await load();
            if (Number.isFinite(value.rate) && value.rate > 0) {
                cache = { value, at: Date.now() };
                return value;
            }
        } catch {
            // 换下一个源
        }
    }

    // 拿不到新的就沿用旧的，宁可旧汇率也别没有
    return cache?.value ?? null;
}
