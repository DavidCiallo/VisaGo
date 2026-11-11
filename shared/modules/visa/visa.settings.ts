import { VISA_COUNTRIES } from "./visa.catalog";

export type VisaOriginCode = "CN" | "UK";

export const VISA_ORIGIN_LABELS: Record<VisaOriginCode, string> = {
    CN: "中国",
    UK: "英国",
};

export interface VisaCurrency {
    code: string;
    symbol: string;
}

/** 中国出发人民币、英国出发英镑，其他出发地美元；只换符号，不做汇率换算。 */
export const VISA_ORIGIN_CURRENCY: Record<VisaOriginCode, VisaCurrency> = {
    CN: { code: "CNY", symbol: "¥" },
    UK: { code: "GBP", symbol: "£" },
};

export const DEFAULT_CURRENCY: VisaCurrency = { code: "USD", symbol: "$" };

export function currencyOf(originCode: string): VisaCurrency {
    return VISA_ORIGIN_CURRENCY[originCode as VisaOriginCode] ?? DEFAULT_CURRENCY;
}

export interface VisaCenter {
    name: string;
    /** 可选日期（浅绿） */
    dates: string[];
    /** 不建议选的日期（橙色），仍然可以约 */
    cautionDates: string[];
}

export interface VisaDestination {
    /** 该目的地在这个出发国的签证费（每人） */
    price: number;
    /** 暂时下架：客户侧仍然显示，但不可选 */
    offline: boolean;
    /** 这个出发国 + 这个目的地组合下可选的签证中心 */
    centers: VisaCenter[];
}

export interface VisaOrigin {
    code: VisaOriginCode;
    label: string;
    /** 汇兑磨损，按人收，币种同出发地；没配就是 0 */
    fee?: number;
    destinations: Record<string, VisaDestination>;
}

export interface VisaSettings {
    /** 材料组的积压时长，决定最早能约到哪天 */
    materials: VisaMaterials;
    origins: VisaOrigin[];
}

export interface VisaMaterials {
    /** 积压还需要多少个工作日才处理得完 */
    workdays: number;
}

export interface MaterialsPlan {
    /** 消化当前堆积需要的工作日 */
    workingDays: number;
    /** 最早可递签日期 */
    firstDate: string;
}

export const DEFAULT_MATERIALS: VisaMaterials = { workdays: 6 };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CN_CENTERS: Record<string, string[]> = {
    FR: ["北京", "上海", "广州", "成都", "沈阳", "武汉"],
    DE: ["北京", "上海", "广州", "成都", "沈阳"],
    ES: ["北京", "上海", "广州"],
    FI: ["北京", "上海", "广州", "成都", "重庆", "长沙", "福州", "杭州", "济南", "昆明", "南京", "沈阳", "深圳", "武汉", "西安"],
    SE: ["北京", "上海", "广州", "成都", "重庆", "长沙", "福州", "杭州", "济南", "昆明", "南京", "沈阳", "武汉", "西安"],
    NO: ["北京", "上海", "广州", "成都", "长沙", "杭州", "沈阳", "武汉", "西安"],
    DK: ["北京", "上海"],
    IS: ["北京", "上海", "广州", "成都", "重庆", "长沙", "福州", "杭州", "济南", "昆明", "南京", "沈阳", "深圳", "武汉", "西安"],
    US: ["北京", "上海", "广州", "沈阳"],
    JP: ["北京", "上海", "广州", "重庆", "沈阳"],
    KR: ["北京", "上海", "广州", "成都", "沈阳"],
    VN: ["北京", "上海", "广州"],
};

const UK_CENTERS: Record<string, string[]> = {
    FR: ["伦敦", "曼彻斯特", "爱丁堡"],
    DE: ["伦敦", "曼彻斯特", "爱丁堡"],
    ES: ["伦敦", "曼彻斯特"],
    FI: ["伦敦", "曼彻斯特", "爱丁堡"],
    SE: ["伦敦", "爱丁堡"],
    NO: ["伦敦", "爱丁堡"],
    DK: ["伦敦"],
    IS: ["伦敦", "曼彻斯特", "爱丁堡", "卡迪夫"],
    US: ["伦敦", "贝尔法斯特"],
    JP: ["伦敦", "爱丁堡"],
    KR: ["伦敦"],
    VN: ["伦敦"],
};

const CN_PRICES: Record<string, number> = {
    FR: 60,
    DE: 60,
    ES: 60,
    FI: 60,
    SE: 60,
    NO: 60,
    DK: 60,
    IS: 60,
    US: 80,
    JP: 50,
    KR: 50,
    VN: 50,
};

const UK_PRICES: Record<string, number> = {
    FR: 75,
    DE: 75,
    ES: 75,
    FI: 70,
    SE: 70,
    NO: 70,
    DK: 70,
    IS: 70,
    US: 100,
    JP: 60,
    KR: 60,
    VN: 55,
};

function isoDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 默认开放未来 8 周的工作日；11 月一律标成「不建议选」，其余月份标成可选。 */
function buildDefaultDates(): string[] {
    const dates: string[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let offset = 1; offset <= 56; offset++) {
        const day = new Date(start);
        day.setDate(start.getDate() + offset);
        const weekday = day.getDay();
        if (weekday === 0 || weekday === 6) continue;
        dates.push(isoDate(day));
    }
    return dates;
}

function buildCenters(origin: VisaOriginCode, country: string, names: string[]): VisaCenter[] {
    return names.map((name) => {
        const all = buildDefaultDates();
        return {
            name,
            dates: all.filter((iso) => iso.slice(5, 7) !== "11"),
            cautionDates: all.filter((iso) => iso.slice(5, 7) === "11"),
        };
    });
}

export function buildDefaultSettings(): VisaSettings {
    return {
        materials: DEFAULT_MATERIALS,
        origins: (["CN", "UK"] as VisaOriginCode[]).map((code) => ({
            code,
            label: VISA_ORIGIN_LABELS[code],
            fee: 0,
            destinations: Object.fromEntries(
                VISA_COUNTRIES.map((country) => [
                    country.code,
                    {
                        price: (code === "CN" ? CN_PRICES : UK_PRICES)[country.code] ?? 0,
                        offline: false,
                        centers: buildCenters(
                            code,
                            country.code,
                            (code === "CN" ? CN_CENTERS : UK_CENTERS)[country.code] ?? [],
                        ),
                    },
                ]),
            ),
        })),
    };
}

export function findOrigin(settings: VisaSettings, code: string): VisaOrigin | null {
    return settings.origins.find((origin) => origin.code === code) ?? null;
}

/** 老配置里没有这一项，一律按 0 收 */
export function feeOf(origin: VisaOrigin | null | undefined): number {
    const value = Number(origin?.fee);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

export function findDestination(
    settings: VisaSettings,
    originCode: string,
    countryCode: string,
): VisaDestination | null {
    return findOrigin(settings, originCode)?.destinations[countryCode] ?? null;
}

export function centersFor(
    settings: VisaSettings,
    originCode: string,
    countryCode: string,
): VisaCenter[] {
    return findDestination(settings, originCode, countryCode)?.centers ?? [];
}

export function visaPriceFor(settings: VisaSettings, originCode: string, countryCode: string): number {
    return findDestination(settings, originCode, countryCode)?.price ?? 0;
}

export function isDestinationOffline(
    settings: VisaSettings | null,
    originCode: string,
    countryCode: string,
): boolean {
    if (!settings) return false;
    return Boolean(findDestination(settings, originCode, countryCode)?.offline);
}

function addWorkingDays(from: Date, days: number): Date {
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    let left = days;
    while (left > 0) {
        cursor.setDate(cursor.getDate() + 1);
        const weekday = cursor.getDay();
        if (weekday !== 0 && weekday !== 6) left -= 1;
    }
    return cursor;
}

/** 积压几个工作日，最早就能约到那天之后。 */
export function materialsPlan(settings: VisaSettings | null, today: Date = new Date()): MaterialsPlan {
    const workingDays = Math.max(0, Math.floor(settings?.materials?.workdays ?? 0));
    const first = addWorkingDays(today, workingDays);
    return { workingDays, firstDate: isoDate(first) };
}

/** 材料组排期只会收紧，不会放开某个中心本来没开的日期。 */
export function materialDayState(
    plan: MaterialsPlan,
    iso: string,
    manual: "available" | "caution" | "off",
): "available" | "caution" | "off" {
    if (manual === "off") return "off";
    if (iso < plan.firstDate) return "off";
    return manual;
}

/** 后台保存与读取时都走一遍：只接受已知出发地和目的地，价格取整到分，中心按名字去重、日期去重排序。 */
export function normalizeSettings(input: any): VisaSettings {
    if (!input || !Array.isArray(input.origins)) {
        throw new Error("配置格式不正确");
    }

    const origins = (["CN", "UK"] as VisaOriginCode[]).map((code) => {
        const incoming = input.origins.find((origin: any) => origin && origin.code === code);
        if (!incoming) throw new Error(`缺少出发地：${VISA_ORIGIN_LABELS[code]}`);

        const destinations: Record<string, VisaDestination> = {};
        for (const country of VISA_COUNTRIES) {
            const source = incoming.destinations?.[country.code];
            if (!source) throw new Error(`缺少 ${VISA_ORIGIN_LABELS[code]} · ${country.name} 的配置`);

            const price = Number(source.price);
            if (!Number.isFinite(price) || price < 0) {
                throw new Error(`${VISA_ORIGIN_LABELS[code]} · ${country.name} 的签证费不合法`);
            }

            const merged = new Map<string, { dates: Set<string>; caution: Set<string> }>();
            for (const raw of Array.isArray(source.centers) ? source.centers : []) {
                const name = String(raw?.name ?? "").trim();
                if (!name) continue;
                const entry = merged.get(name) ?? { dates: new Set<string>(), caution: new Set<string>() };
                for (const date of Array.isArray(raw?.dates) ? raw.dates : []) {
                    const value = String(date);
                    if (DATE_PATTERN.test(value)) entry.dates.add(value);
                }
                for (const date of Array.isArray(raw?.cautionDates) ? raw.cautionDates : []) {
                    const value = String(date);
                    if (DATE_PATTERN.test(value)) entry.caution.add(value);
                }
                merged.set(name, entry);
            }

            destinations[country.code] = {
                price: Math.round(price * 100) / 100,
                offline: Boolean(source.offline),
                centers: [...merged].map(([name, entry]) => ({
                    name,
                    dates: [...entry.dates].sort(),
                    cautionDates: [...entry.caution].filter((date) => !entry.dates.has(date)).sort(),
                })),
            };
        }

        const rawFee = Number(incoming.fee);
        return {
            code,
            label: VISA_ORIGIN_LABELS[code],
            fee: Number.isFinite(rawFee) && rawFee > 0 ? Math.round(rawFee * 100) / 100 : 0,
            destinations,
        };
    });

    // 老数据存的是「堆积份数 ÷ 每天处理量」，换算成工作日；新数据直接读 workdays
    const rawWorkdays = Number(input.materials?.workdays);
    const legacyBacklog = Number(input.materials?.backlog);
    const legacyRate = Math.max(1, Number(input.materials?.dailyRate) || 1);
    const derived = Number.isFinite(legacyBacklog)
        ? Math.ceil(Math.max(0, legacyBacklog) / legacyRate)
        : DEFAULT_MATERIALS.workdays;

    return {
        materials: {
            workdays: Number.isFinite(rawWorkdays)
                ? Math.max(0, Math.floor(rawWorkdays))
                : derived,
        },
        origins,
    };
}
