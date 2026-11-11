import { findCountry, normalizeSlotSupport } from "./visa.catalog";
import {
    normalizeSettings,
    type VisaSettings,
    VISA_ORIGIN_LABELS,
    type VisaOriginCode,
} from "./visa.settings";
import { PassportDetails, VisaOrderDTO, type VisaOrderEntity } from "./visa.entity";

export interface VisaCreateInput {
    customer_email: string;
    customer_name: string;
    origin_code: string;
    country_code: string;
    travelers: number;
    flight: boolean;
    hotel: boolean;
    passports: PassportDetails[];
    appointment_city: string;
    appointment_dates: string[];
    appointment_note: string;
    travel_date: string;
    trip_days: number;
    slot_support: string;
}

const passportFields: (keyof PassportDetails)[] = [
    "first_name",
    "last_name",
    "birth_date",
    "gender",
    "nationality",
    "birth_place",
    "passport_number",
    "issue_date",
    "expiry_date",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function toPassportDetails(raw: any): PassportDetails {
    return Object.fromEntries(
        passportFields.map((field) => [field, String(raw?.[field] ?? "")]),
    ) as unknown as PassportDetails;
}

export function passportFilled(passport: PassportDetails | undefined): boolean {
    return Boolean(passport?.first_name.trim() && passport?.last_name.trim());
}

export class VisaCreateRequest {
    public customer_email: string;
    public customer_name: string;
    public origin_code: string;
    public country_code: string;
    public travelers: number;
    public flight: boolean;
    public hotel: boolean;
    public passports: PassportDetails[];
    public appointment_city: string;
    public appointment_dates: string[];
    public appointment_note: string;
    public travel_date: string;
    public trip_days: number;
    public slot_support: string;

    constructor(data: any) {
        this.customer_email = normalizeEmail(String(data.customer_email ?? ""));
        if (!EMAIL_PATTERN.test(this.customer_email)) throw new Error("请先确认你的邮箱");
        this.customer_name = String(data.customer_name ?? "").trim();
        if (!this.customer_name) throw new Error("请先确认你的姓名");

        const originCode = String(data.origin_code ?? "") as VisaOriginCode;
        if (!VISA_ORIGIN_LABELS[originCode]) throw new Error("未知的出发地");
        this.origin_code = originCode;

        if (!data.country_code || !findCountry(data.country_code)) throw new Error("未知的国家");
        this.country_code = data.country_code;

        this.travelers = Number(data.travelers);
        if (!Number.isInteger(this.travelers) || this.travelers < 1 || this.travelers > 5) {
            throw new Error("出行人数需在 1 到 5 人之间");
        }

        this.flight = Boolean(data.flight);
        this.hotel = Boolean(data.hotel);

        const rawPassports: any[] = Array.isArray(data.passports) ? data.passports : [];
        if (rawPassports.length !== this.travelers) throw new Error("每位出行人都要有一份护照信息");
        this.passports = rawPassports.map(toPassportDetails);
        if (!this.passports.some(passportFilled)) {
            throw new Error("请至少填写一位出行人的姓名");
        }

        this.appointment_city = String(data.appointment_city ?? "");
        if (!this.appointment_city) throw new Error("请选择递签城市");

        const dates: string[] = Array.isArray(data.appointment_dates)
            ? data.appointment_dates.map((date: any) => String(date))
            : [];
        this.appointment_dates = [...new Set(dates)]
            .filter((date) => DATE_PATTERN.test(date))
            .sort();
        if (!this.appointment_dates.length) throw new Error("请至少选择一个递签日期");

        this.appointment_note = String(data.appointment_note ?? "").trim();
        if (this.appointment_note.length > 300) throw new Error("备注最多 300 字");

        this.travel_date = String(data.travel_date ?? "").trim();
        if (!this.travel_date) throw new Error("请填写出行日期");
        if (this.travel_date.length > 40) throw new Error("出行日期最多 40 个字符");

        this.trip_days = Number(data.trip_days);
        if (!Number.isInteger(this.trip_days) || this.trip_days < 1 || this.trip_days > 180) {
            throw new Error("行程天数需在 1 到 180 天之间");
        }

        this.slot_support = normalizeSlotSupport(data.slot_support);

        if (
            DATE_PATTERN.test(this.travel_date) &&
            this.travel_date <= this.appointment_dates[this.appointment_dates.length - 1]
        ) {
            throw new Error("出行日期需晚于递签日期");
        }
    }

    static self(data: any): VisaCreateRequest {
        return new VisaCreateRequest(data);
    }
}

export interface VisaCreateResponse {
    success: boolean;
    data?: { order: VisaOrderDTO; view_key: string };
    message?: string;
}

export interface VisaSettingsResponse {
    success: boolean;
    data?: { settings: VisaSettings };
    message?: string;
}

export interface VisaOrdersInput {
    auth?: string;
}

export interface VisaOrdersResponse {
    success: boolean;
    data?: { orders: VisaOrderDTO[] };
    message?: string;
}

export interface VisaSaveSettingsInput {
    settings: VisaSettings;
    auth?: string;
}

export class VisaSaveSettingsRequest {
    public settings: VisaSettings;

    constructor(data: any) {
        this.settings = normalizeSettings(data.settings);
    }

    static self(data: any): VisaSaveSettingsRequest {
        return new VisaSaveSettingsRequest(data);
    }
}

export interface VisaInviteSlot {
    index: number;
    filled: boolean;
    name: string;
    /** 这个位置是不是当前浏览器填的 */
    mine: boolean;
    passport?: PassportDetails;
}

export interface VisaInviteInput {
    token: string;
    slot_keys?: { index: number; key: string }[];
}

export interface VisaInviteResponse {
    success: boolean;
    data?: {
        order: {
            id: string;
            country_name: string;
            visa: string;
            origin_label: string;
            appointment_city: string;
            appointment_dates: string[];
            travel_date: string;
            trip_days: number;
            travelers: number;
            slots: VisaInviteSlot[];
        };
    };
    message?: string;
}

export interface VisaInviteSubmitInput {
    token: string;
    index?: number;
    passport: PassportDetails;
    slot_key?: string;
}

export interface VisaInviteSubmitResponse {
    success: boolean;
    data?: { ok: boolean; slot_key?: string };
    message?: string;
}

export interface VisaInviteSlotRemoveInput {
    token: string;
    index: number;
    slot_key: string;
}

export interface VisaInviteSlotRemoveResponse {
    success: boolean;
    data?: { ok: boolean };
    message?: string;
}

export interface VisaOrderInput {
    token: string;
    auth?: string;
}

export interface VisaOrderResponse {
    success: boolean;
    data?: { order: VisaOrderDTO; pay_code?: VisaPayCode | null };
    message?: string;
}

/** 后台维护的收款码：一个金额对应一张码。 */
export interface VisaPayCode {
    id: string;
    amount: number;
    currency: string;
    label: string;
    url: string;
}

export interface VisaPayCodeListInput {
    auth?: string;
}

export interface VisaPayCodeListResponse {
    success: boolean;
    data?: { codes: VisaPayCode[] };
    message?: string;
}

export interface VisaPayCodeSaveInput {
    id?: string;
    amount: number;
    currency: string;
    label?: string;
    /** data:image/png;base64,... 只在新增或换图时带 */
    image?: string;
    auth?: string;
}

export interface VisaPayCodeSaveResponse {
    success: boolean;
    data?: { code: VisaPayCode };
    message?: string;
}

export interface VisaPayCodeRemoveInput {
    id: string;
    auth?: string;
}

export interface VisaPayCodeRemoveResponse {
    success: boolean;
    data?: { ok: boolean };
    message?: string;
}

export interface VisaCalendarScanInput {
    /** data:image/...;base64,... 签证中心的档期截图 */
    image: string;
    auth?: string;
}

export interface VisaCalendarScanResponse {
    success: boolean;
    data?: { words: VisaOcrWord[] };
    message?: string;
}

export interface VisaPayCodeReorderInput {
    /** 按新顺序排好的收款码 id */
    ids: string[];
    auth?: string;
}

export interface VisaPayCodeReorderResponse {
    success: boolean;
    data?: { codes: VisaPayCode[] };
    message?: string;
}

export interface VisaOcrWord {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface VisaPayCodeScanInput {
    /** data:image/...;base64,... 收款码截图 */
    image: string;
    /** text：只要文字，用来看清价格下面那行小字 */
    mode?: string;
    auth?: string;
}

export interface VisaPayCodeScanResponse {
    success: boolean;
    data?: { amount: number | null; text: string; words: VisaOcrWord[] };
    message?: string;
}

export interface VisaOrderLockInput {
    id: string;
    auth?: string;
}

export interface VisaOrderSetStatusInput {    id: string;
    status: string;
    auth?: string;
}

export interface VisaOrderPositionInput {
    id: string;
    position: string;
    auth?: string;
}

export interface VisaOrderAttachInput {
    id: string;
    name: string;
    /** data:application/pdf;base64,... */
    data: string;
    auth?: string;
}

export interface VisaIdentifyInput {
    email: string;
    name?: string;
}

export interface VisaOrderUpdateInput {
    token: string;
    auth?: string;
    travel_date: string;
    trip_days: number;
    flight: boolean;
    hotel: boolean;
    appointment_note: string;
    slot_support: string;
}

export class VisaOrderUpdateRequest {
    public travel_date: string;
    public trip_days: number;
    public flight: boolean;
    public hotel: boolean;
    public appointment_note: string;
    public slot_support: string;

    constructor(data: any) {
        this.travel_date = String(data.travel_date ?? "").trim();
        if (!this.travel_date) throw new Error("请填写出行日期");
        if (this.travel_date.length > 40) throw new Error("出行日期最多 40 个字符");

        this.trip_days = Number(data.trip_days);
        if (!Number.isInteger(this.trip_days) || this.trip_days < 1 || this.trip_days > 180) {
            throw new Error("行程天数需在 1 到 180 天之间");
        }

        this.flight = Boolean(data.flight);
        this.hotel = Boolean(data.hotel);

        this.appointment_note = String(data.appointment_note ?? "").trim();
        if (this.appointment_note.length > 300) throw new Error("备注最多 300 字");

        this.slot_support = normalizeSlotSupport(data.slot_support);
    }

    static self(data: any): VisaOrderUpdateRequest {
        return new VisaOrderUpdateRequest(data);
    }
}

export interface VisaOrderStatusInput {
    id: string;
    status: string;
    auth?: string;
}

export interface VisaPassportScanInput {
    token: string;
    auth?: string;
    index: number;
    image: string;
}

export interface VisaPassportScanResponse {
    success: boolean;
    data?: { order: VisaOrderDTO; recognized: boolean };
    message?: string;
}

export interface VisaAddTravelerInput {
    token: string;
    auth?: string;
}

export interface VisaRemoveTravelerInput {
    token: string;
    auth?: string;
    index: number;
}

export interface VisaOcrInput {
    image: string;
}

export interface VisaOcrResponse {
    success: boolean;
    data?: { passport: PassportDetails };
    message?: string;
}

export interface VisaOrderBrief {
    id: string;
    token: string;
    country_name: string;
    visa: string;
    status: string;
    travel_date: string;
    trip_days: number;
    create_time: number;
}

export interface VisaBackupOrder
    extends Omit<VisaOrderEntity, "id" | "create_time" | "update_time" | "delete_time"> {}

export interface VisaBackupCustomer {
    email: string;
    name: string;
}

export interface VisaBackup {
    version: number;
    exported_at: number;
    settings: VisaSettings;
    customers: VisaBackupCustomer[];
    orders: VisaBackupOrder[];
    /** 收款码，含图片文件名 */
    pay_codes?: any[];
    /** 文件名 → base64，收款码图片和预约信 PDF 都在这里 */
    files?: Record<string, string>;
}

export interface VisaExportInput {
    auth?: string;
}

export interface VisaExportResponse {
    success: boolean;
    data?: { backup: VisaBackup };
    message?: string;
}

export interface VisaImportInput {
    /** 导入即整库替换：订单、客户、收款码、配置、文件全部以备份为准 */
    backup: VisaBackup;
    auth?: string;
}

export interface VisaImportResponse {
    success: boolean;
    data?: { orders: number; customers: number; pay_codes: number; files: number };
    message?: string;
}

export interface VisaIdentifyResponse {
    success: boolean;
    data?: {
        exists: boolean;
        ok?: boolean;
        orders?: VisaOrderBrief[];
        keys?: { token: string; key: string }[];
    };
    message?: string;
}
