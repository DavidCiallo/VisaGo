/** VFS 排期接口返回的 JSON：同一天出现几次就是当天有几个位置。 */

export interface VfsParsed {
    country_code: string;
    city: string;
    /** 覆盖到的月份，如 "2026-11" */
    months: string[];
    /** ≥5 个位置 */
    dates: string[];
    /** 2-4 个位置，页面标橙色 */
    cautionDates: string[];
}

const MISSIONS: Record<string, string> = {
    Iceland: "IS",
    France: "FR",
    Germany: "DE",
    Spain: "ES",
    Finland: "FI",
    Sweden: "SE",
    Norway: "NO",
    Denmark: "DK",
};

const CITIES: Record<string, string> = {
    Beijing: "北京",
    Shanghai: "上海",
    Guangzhou: "广州",
    Shenzhen: "深圳",
    Chengdu: "成都",
    Chongqing: "重庆",
    Changsha: "长沙",
    Fuzhou: "福州",
    Hangzhou: "杭州",
    Jinan: "济南",
    Kunming: "昆明",
    Nanjing: "南京",
    Shenyang: "沈阳",
    Wuhan: "武汉",
    Xian: "西安",
    "Xi'an": "西安",
    London: "伦敦",
    Manchester: "曼彻斯特",
    Edinburgh: "爱丁堡",
    Cardiff: "卡迪夫",
    Belfast: "贝尔法斯特",
};

export function parseVfs(text: string): VfsParsed {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("不是 VFS 排期数据");

    const feed = JSON.parse(text.slice(start, end + 1));
    const calendar = Array.isArray(feed?.calendars) ? feed.calendars : [];
    if (!calendar.length) throw new Error("没有日历数据");

    const counts = new Map<string, number>();
    for (const item of calendar) {
        const m = String(item?.date ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) continue;
        const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
        counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    if (!counts.size) throw new Error("日历里没有日期");

    const mission = MISSIONS[String(feed?.mission ?? "").trim()];
    if (!mission) throw new Error("认不出目的国");

    const cityKey = String(feed?.center ?? "").split("-").pop()?.trim() ?? "";
    const city = CITIES[cityKey] ?? cityKey;
    if (!city) throw new Error("认不出签证中心");

    const dates: string[] = [];
    const cautionDates: string[] = [];
    for (const [iso, count] of [...counts].sort()) {
        if (count <= 1) continue;
        if (count <= 4) cautionDates.push(iso);
        else dates.push(iso);
    }

    return {
        country_code: mission,
        city,
        months: [...new Set([...counts.keys()].map((iso) => iso.slice(0, 7)))],
        dates,
        cautionDates,
    };
}
