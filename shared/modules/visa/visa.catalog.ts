export type VisaGroupKey = "europe" | "nordic" | "usa" | "asia";

export interface VisaCountry {
    /** ISO 3166-1 alpha-2，作为预定记录里的稳定标识 */
    code: string;
    name: string;
    visa: string;
    group: VisaGroupKey;
    badge?: "热门" | "新上线";
}

export const VISA_GROUPS: { key: VisaGroupKey; label: string }[] = [
    { key: "europe", label: "法德西" },
    { key: "nordic", label: "北欧" },
    { key: "usa", label: "美国" },
    { key: "asia", label: "日韩越" },
];

export type VisaExtraKey = "flight" | "hotel";

export interface VisaExtra {
    key: VisaExtraKey;
    name: string;
    price: number;
    desc: string;
}

export const VISA_EXTRA_FEE = 0;

export const VISA_EXTRAS: VisaExtra[] = [
    {
        key: "flight",
        name: "机票预订单",
        price: VISA_EXTRA_FEE,
        desc: "用于签证材料的临时往返机票，并非真实购买。",
    },
    {
        key: "hotel",
        name: "酒店预订单",
        price: VISA_EXTRA_FEE,
        desc: "用于签证材料的酒店预定记录，无需实际入住。",
    },
];

/** 系统不收服务费；签证费按官方标准代收。 */
export const SERVICE_FEE = 0;
export const MAX_TRAVELERS = 4;

const SCHENGEN = "申根签证";

export const VISA_COUNTRIES: VisaCountry[] = [
    { code: "FR", name: "法国", visa: SCHENGEN, group: "europe", badge: "热门" },
    { code: "DE", name: "德国", visa: SCHENGEN, group: "europe", badge: "热门" },
    { code: "ES", name: "西班牙", visa: SCHENGEN, group: "europe" },
    { code: "FI", name: "芬兰", visa: SCHENGEN, group: "nordic" },
    { code: "SE", name: "瑞典", visa: SCHENGEN, group: "nordic" },
    { code: "NO", name: "挪威", visa: SCHENGEN, group: "nordic", badge: "热门" },
    { code: "DK", name: "丹麦", visa: SCHENGEN, group: "nordic" },
    { code: "IS", name: "冰岛", visa: SCHENGEN, group: "nordic" },
    { code: "US", name: "美国", visa: "美国旅游签证", group: "usa", badge: "热门" },
    { code: "JP", name: "日本", visa: "日本旅游签证", group: "asia", badge: "热门" },
    { code: "KR", name: "韩国", visa: "韩国旅游签证", group: "asia" },
    { code: "VN", name: "越南", visa: "越南电子签", group: "asia", badge: "新上线" },
];

export function findCountry(code: string): VisaCountry | null {
    return VISA_COUNTRIES.find((country) => country.code === code) ?? null;
}

export function serviceFeePerTraveler(travelers: number): number {
    return SERVICE_FEE;
}

export interface VisaQuote {
    /** 每人服务费，目前全免 */
    perTraveler: number;
    serviceFee: number;
    extrasFee: number;
    /** 签证费，官方标准，代收 */
    visaFee: number;
    /** 汇兑磨损，按人收 */
    fee: number;
    /** 本单需要支付的金额，含代收的签证费 */
    toPay: number;
}

export function quoteVisa(
    visaPricePerPerson: number,
    travelers: number,
    flight: boolean,
    hotel: boolean,
    feePerTraveler = 0,
): VisaQuote {
    const perTraveler = serviceFeePerTraveler(travelers);
    const extrasPerTraveler = (flight ? VISA_EXTRA_FEE : 0) + (hotel ? VISA_EXTRA_FEE : 0);
    const visaFee = visaPricePerPerson * travelers;
    const fee = feePerTraveler * travelers;
    return {
        perTraveler,
        serviceFee: perTraveler * travelers,
        extrasFee: extrasPerTraveler * travelers,
        visaFee,
        fee,
        toPay: visaFee + perTraveler * travelers + extrasPerTraveler * travelers + fee,
    };
}

/** 刷位意愿：是否允许在夜间继续抢更早的递签档期。 */
export type VisaSlotSupport = "allow" | "maybe" | "deny";

export interface VisaSlotSupportOption {
    key: VisaSlotSupport;
    label: string;
    desc: string;
}

export const VISA_SLOT_SUPPORT_OPTIONS: VisaSlotSupportOption[] = [
    {
        key: "allow",
        label: "允许",
        desc: "位置紧张时可以直接加急抢号，额外费用后续结算。",
    },
    {
        key: "maybe",
        label: "视情况",
        desc: "建议此项。我们会根据放位情况征求您的意见，再调整预约。",
    },
    {
        key: "deny",
        label: "禁止",
        desc: "预留时间充裕，可以等待放号而无须加急抢号。",
    },
];

export const VISA_SLOT_SUPPORT_LABELS: Record<VisaSlotSupport, string> = {
    allow: "允许",
    maybe: "视情况",
    deny: "禁止",
};

export function normalizeSlotSupport(value: unknown): VisaSlotSupport {
    const text = String(value ?? "").trim();
    if (text === "allow" || text === "deny" || text === "maybe") return text;
    return "maybe";
}
