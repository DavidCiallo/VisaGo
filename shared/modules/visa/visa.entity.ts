import {
    VISA_SLOT_SUPPORT_LABELS,
    findCountry,
    normalizeSlotSupport,
    type VisaSlotSupport,
} from "./visa.catalog";
import { VISA_ORIGIN_LABELS, type VisaOriginCode } from "./visa.settings";

/** Fields as printed on the passport bio page; every field is optional while the traveler fills it in. */
export interface PassportDetails {
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: string;
    nationality: string;
    birth_place: string;
    passport_number: string;
    issue_date: string;
    expiry_date: string;
}

export interface VisaOrderFile {
    id: string;
    name: string;
    size: number;
    time: number;
}

export interface VisaOrderEntity {
    id: string;
    create_time: number;
    update_time: number | null;
    delete_time: number | null;
    invite_token: string;
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
    visa_fee: number;
    service_fee: number;
    extras_fee: number;
    total: number;
    status: string;
    /** 管理员确认收款的时间，用来算半小时后自动进入预约中 */
    locked_time?: number;
    /** 后台填的预约到的位置 */
    position?: string;
    files?: VisaOrderFile[];
    /** 只发给下单本人的查看密钥，不进 URL */
    view_key: string;
    /** 每位出行人由谁填写：位置 -> 填写人凭据 */
    slot_keys?: Record<string, string>;
}

export class VisaOrderDTO {
    public id: string;
    public create_time: number;
    public invite_token: string;
    public customer_email: string;
    public customer_name: string;
    public origin_code: string;
    public origin_label: string;
    public country_code: string;
    public country_name: string;
    public visa: string;
    public travelers: number;
    public flight: boolean;
    public hotel: boolean;
    public passports: PassportDetails[];
    public appointment_city: string;
    public appointment_dates: string[];
    public appointment_note: string;
    public travel_date: string;
    public trip_days: number;
    public slot_support: VisaSlotSupport;
    public slot_support_label: string;
    public visa_fee: number;
    public service_fee: number;
    public extras_fee: number;
    public total: number;
    public status: string;
    public locked_time: number;
    public position: string;
    public files: VisaOrderFile[];

    constructor(origin: VisaOrderEntity) {
        const country = findCountry(origin.country_code);
        this.id = origin.id;
        this.create_time = origin.create_time;
        this.invite_token = origin.invite_token;
        this.customer_email = origin.customer_email;
        this.customer_name = origin.customer_name;
        this.origin_code = origin.origin_code;
        this.origin_label = VISA_ORIGIN_LABELS[origin.origin_code as VisaOriginCode] ?? origin.origin_code;
        this.country_code = origin.country_code;
        this.country_name = country?.name ?? origin.country_code;
        this.visa = country?.visa ?? "签证";
        this.travelers = origin.travelers;
        this.flight = origin.flight;
        this.hotel = origin.hotel;
        this.passports = origin.passports;
        this.appointment_city = origin.appointment_city;
        this.appointment_dates = origin.appointment_dates;
        this.appointment_note = origin.appointment_note;
        this.travel_date = origin.travel_date;
        this.trip_days = origin.trip_days;
        this.slot_support = normalizeSlotSupport(origin.slot_support);
        this.slot_support_label = VISA_SLOT_SUPPORT_LABELS[this.slot_support];
        this.visa_fee = origin.visa_fee;
        this.service_fee = origin.service_fee;
        this.extras_fee = origin.extras_fee;
        this.total = origin.total;
        this.status = origin.status;
        this.locked_time = origin.locked_time ?? 0;
        this.position = origin.position ?? "";
        this.files = origin.files ?? [];
    }
}
