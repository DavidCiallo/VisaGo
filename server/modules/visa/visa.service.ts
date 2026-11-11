import Repository from "../../lib/repository";
import { nanoid } from "nanoid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
    PassportDetails,
    VisaOrderEntity,
    type VisaOrderFile,
} from "../../../shared/modules/visa/visa.entity";
import { findCountry, MAX_TRAVELERS, quoteVisa } from "../../../shared/modules/visa/visa.catalog";
import {
    buildDefaultSettings,
    currencyOf,
    findDestination,
    materialsPlan,
    normalizeSettings,
    type VisaMaterials,
    type VisaOrigin,
    type VisaSettings,
    VISA_ORIGIN_LABELS,
    type VisaOriginCode,
} from "../../../shared/modules/visa/visa.settings";
import {
    EMAIL_PATTERN,
    normalizeEmail,
    passportFilled,
    toPassportDetails,
    VisaCreateRequest,
    VisaOrderUpdateRequest,
} from "../../../shared/modules/visa/visa.interface";
import { ocrConfigured, recognizePassport, recognizeWords } from "./visa.ocr";

interface VisaSettingsRow {
    id: string;
    create_time: number;
    update_time: number | null;
    delete_time: number | null;
    materials: VisaMaterials;
    origins: VisaOrigin[];
}

interface VisaCustomerEntity {
    id: string;
    create_time: number;
    update_time: number | null;
    delete_time: number | null;
    email: string;
    name: string;
}

const visaOrderRepository: Repository<VisaOrderEntity> = Repository.instance("VisaOrder");
const visaSettingsRepository: Repository<VisaSettingsRow> = Repository.instance("VisaSettings");
const visaCustomerRepository: Repository<VisaCustomerEntity> = Repository.instance("VisaCustomer");

interface VisaPayCodeEntity {
    id: string;
    create_time: number;
    update_time: number | null;
    delete_time: number | null;
    amount: number;
    currency: string;
    label: string;
    image_id: string;
    /** 后台拖动排的顺序 */
    sort?: number;
}

const visaPayCodeRepository: Repository<VisaPayCodeEntity> = Repository.instance("VisaPayCode");

const UPLOAD_DIR = process.env.DATA_DIR
    ? path.join(path.resolve(process.env.DATA_DIR), "uploads")
    : path.join(
          path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."),
          "data/uploads",
      );

const UPLOAD_EXT: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
};

/** 已锁定的订单半小时后自动进入预约中。 */
const BOOKING_DELAY = 30 * 60 * 1000;

function writeUpload(dataUrl: string) {
    const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(String(dataUrl ?? "").trim());
    if (!match) throw new Error("请选择要上传的文件");
    const [, type, base64] = match;
    const ext = UPLOAD_EXT[type];
    if (!ext) throw new Error("只支持 PNG、JPG、WebP 图片和 PDF");

    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) throw new Error("文件是空的");
    if (buffer.length > 12 * 1024 * 1024) throw new Error("文件请控制在 12MB 以内");

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const id = `${nanoid(20)}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, id), buffer);
    return { id, type, size: buffer.length };
}

export const VISA_UPLOAD_DIR = UPLOAD_DIR;

// 同行人可能同时在同一个链接里提交，读-改-写必须按 token 串起来，否则会互相覆盖。
const inviteQueue = new Map<string, Promise<unknown>>();

function serializeByToken<T>(token: string, task: () => Promise<T>): Promise<T> {
    const previous = inviteQueue.get(token) ?? Promise.resolve();
    const run = previous.then(task, task);
    inviteQueue.set(
        token,
        run.then(
            () => undefined,
            () => undefined,
        ),
    );
    return run;
}

export class VisaService {
    static async getSettings(): Promise<VisaSettings> {
        const row = await visaSettingsRepository.findOne({});
        return row ? normalizeSettings(row) : buildDefaultSettings();
    }

    static async saveSettings(settings: VisaSettings): Promise<VisaSettings> {
        const row = await visaSettingsRepository.findOne({});
        if (row) {
            await visaSettingsRepository.update(
                { id: row.id },
                { materials: settings.materials, origins: settings.origins },
            );
        } else {
            await visaSettingsRepository.insert({
                materials: settings.materials,
                origins: settings.origins,
            });
        }
        return await this.getSettings();
    }

    static async listOrders(): Promise<VisaOrderEntity[]> {
        const rows = await visaOrderRepository.find({});
        const sorted = rows.sort((a, b) => b.create_time - a.create_time);
        const advanced: VisaOrderEntity[] = [];
        for (const row of sorted) advanced.push(await this.advance(row));
        return advanced;
    }

    /** 已锁定满半小时的订单转成预约中，读的时候顺手落库。 */
    static async advance(row: VisaOrderEntity): Promise<VisaOrderEntity> {
        if (row.status !== "locked") return row;
        const lockedAt = row.locked_time ?? 0;
        if (!lockedAt || Date.now() - lockedAt < BOOKING_DELAY) return row;

        await visaOrderRepository.update({ id: row.id }, { status: "booking", update_time: Date.now() });
        const updated = await visaOrderRepository.findOne({ id: row.id });
        return updated ?? { ...row, status: "booking" };
    }

    static async listPayCodes() {
        const rows = await visaPayCodeRepository.find({});
        return rows
            .sort((a, b) => {
                const left = a.sort ?? Number.MAX_SAFE_INTEGER;
                const right = b.sort ?? Number.MAX_SAFE_INTEGER;
                if (left !== right) return left - right;
                return a.create_time - b.create_time;
            })
            .map((row) => this.payCodeView(row));
    }

    /** 拖动之后按传入顺序重排。 */
    static async reorderPayCodes(ids: string[]) {
        const rows = await visaPayCodeRepository.find({});
        const known = new Set(rows.map((row) => row.id));

        let index = 0;
        for (const id of ids) {
            if (!known.has(id)) continue;
            await visaPayCodeRepository.update({ id }, { sort: index, update_time: Date.now() });
            index += 1;
        }

        return await this.listPayCodes();
    }

    static payCodeView(row: VisaPayCodeEntity) {
        return {
            id: row.id,
            amount: row.amount,
            currency: row.currency,
            label: row.label,
            url: `/api/visa/file?id=${row.image_id}`,
        };
    }

    /** 一个金额配一张码，找不到就不收款。 */
    static async findPayCode(amount: number, currency: string) {
        const rows = await visaPayCodeRepository.find({ currency });
        const hit = rows
            .filter((row) => Math.round(row.amount) === Math.round(amount))
            .sort((a, b) => b.create_time - a.create_time)[0];
        return hit ? this.payCodeView(hit) : null;
    }

    static async savePayCode(req: any) {
        const amount = Math.round(Number(req?.amount));
        const currency = String(req?.currency ?? "").toUpperCase();
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("请填写正确的金额");
        if (!["CNY", "GBP"].includes(currency)) throw new Error("请选择币种");

        const existing = req?.id ? await visaPayCodeRepository.findOne({ id: req.id }) : null;
        let imageId = existing?.image_id ?? "";
        if (req?.image) imageId = writeUpload(req.image).id;
        if (!imageId) throw new Error("请上传收款码图片");

        const label = String(req?.label ?? "").trim().slice(0, 40);

        if (existing) {
            await visaPayCodeRepository.update(
                { id: existing.id },
                { amount, currency, label, image_id: imageId, update_time: Date.now() },
            );
        } else {
            const clash = await visaPayCodeRepository.find({ currency });
            if (clash.some((row) => Math.round(row.amount) === amount)) {
                throw new Error("这个金额已经有一张收款码了");
            }
            await visaPayCodeRepository.insert({ amount, currency, label, image_id: imageId });
        }

        const rows = await visaPayCodeRepository.find({ currency });
        const saved = rows.sort((a, b) => b.create_time - a.create_time)[0];
        return this.payCodeView(saved);
    }

    static async removePayCode(id: string) {
        const row = await visaPayCodeRepository.findOne({ id });
        if (!row) throw new Error("收款码不存在");
        await visaPayCodeRepository.delete({ id });
        return { ok: true };
    }

    static async getById(id: string) {
        const row = await visaOrderRepository.findOne({ id });
        if (!row) throw new Error("订单不存在");
        return await this.advance(row);
    }

    static async setPosition(id: string, position: string) {
        const row = await this.getById(id);
        await visaOrderRepository.update(
            { id: row.id },
            { position: String(position ?? "").trim().slice(0, 300), update_time: Date.now() },
        );
        return await this.getById(id);
    }

    /** 后台传预约信：文件挂到订单上，状态同时走到已完成。 */
    static async attachFile(id: string, name: string, data: string) {
        const row = await this.getById(id);
        const upload = writeUpload(data);
        const file: VisaOrderFile = {
            id: upload.id,
            name: String(name || "预约信").slice(0, 80),
            size: upload.size,
            time: Date.now(),
        };

        await visaOrderRepository.update(
            { id: row.id },
            {
                files: [...(row.files ?? []), file],
                status: "done",
                update_time: Date.now(),
            },
        );
        return await this.getById(id);
    }

    /** 档期截图只取文字和坐标，怎么判断哪天可选由前端按像素看。 */
    static async scanCalendar(image: string) {
        if (!ocrConfigured()) throw new Error("识别服务未配置");

        const base64 = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;
        const buffer = Buffer.from(base64, "base64");
        if (!buffer.length) throw new Error("没有收到图片");
        if (buffer.length > 8 * 1024 * 1024) throw new Error("图片请控制在 8MB 以内");

        const { words } = await recognizeWords(buffer);
        return { words };
    }

    /** 从收款码截图里读金额，并把每个词的坐标带回去，方便再放大识别价格下面那行小字。 */
    static async scanPayCode(image: string, mode: string) {
        if (!ocrConfigured()) throw new Error("识别服务未配置");

        const base64 = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;
        const buffer = Buffer.from(base64, "base64");
        if (!buffer.length) throw new Error("没有收到图片");
        if (buffer.length > 8 * 1024 * 1024) throw new Error("图片请控制在 8MB 以内");

        const { text, words } = await recognizeWords(buffer);
        if (mode === "text") return { amount: null, text, words: [] };

        const money = /[¥￥$£]\s*(\d+(?:\.\d{1,2})?)/.exec(text);
        return { amount: money ? Number(money[1]) : null, text, words };
    }

    static resolveUpload(id: string) {        const clean = String(id ?? "").replace(/[^A-Za-z0-9._-]/g, "");
        if (!clean || clean.includes("..")) throw new Error("文件不存在");
        const file = path.join(UPLOAD_DIR, clean);
        if (!fs.existsSync(file)) throw new Error("文件不存在");
        return file;
    }

    /** 备份只导出业务字段，id 和时间戳由导入时重新生成。 */
    static async exportAll() {
        const [settings, customers, orders, payCodes] = await Promise.all([
            this.getSettings(),
            visaCustomerRepository.find({}),
            visaOrderRepository.find({}),
            visaPayCodeRepository.find({}),
        ]);

        // 收款码图片和预约信 PDF 一起带走，不然换个机器这些单据全打不开
        const referenced = new Set<string>();
        for (const code of payCodes) if (code.image_id) referenced.add(code.image_id);
        for (const order of orders) {
            for (const file of order.files ?? []) if (file?.id) referenced.add(file.id);
        }

        const files: Record<string, string> = {};
        for (const name of referenced) {
            try {
                files[name] = fs.readFileSync(path.join(UPLOAD_DIR, name)).toString("base64");
            } catch {
                // 文件已经不在了就跳过，别让整个导出失败
            }
        }

        return {
            version: 3,
            exported_at: Date.now(),
            settings,
            customers: customers.map((row) => ({ email: row.email, name: row.name })),
            pay_codes: payCodes.map((row) => ({
                id: row.id,
                amount: row.amount,
                currency: row.currency,
                label: row.label,
                image_id: row.image_id,
                sort: row.sort,
                create_time: row.create_time,
            })),
            orders: orders.map((row) => {
                const { id, create_time, update_time, delete_time, ...rest } = row;
                return rest;
            }),
            files,
        };
    }

    /** 导入就是整库替换：先清空，再按备份写回。 */
    static async importAll(backup: any) {
        if (!backup || !Array.isArray(backup.orders) || !Array.isArray(backup.customers)) {
            throw new Error("文件内容不对，应为本系统导出的备份");
        }
        const orders = backup.orders.filter((row: any) => row?.invite_token);
        const customers = backup.customers.filter((row: any) => row?.email);
        const payCodes = Array.isArray(backup.pay_codes) ? backup.pay_codes : [];
        const files =
            backup.files && typeof backup.files === "object" ? (backup.files as Record<string, string>) : {};

        await visaOrderRepository.truncate();
        await visaCustomerRepository.truncate();
        await visaPayCodeRepository.truncate();

        // 先把文件放回去，订单和收款码打开才有图
        let filesIn = 0;
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        for (const [name, base64] of Object.entries(files)) {
            if (!/^[\w.-]+$/.test(name)) continue;
            const target = path.join(UPLOAD_DIR, name);
            if (fs.existsSync(target)) continue;
            fs.writeFileSync(target, Buffer.from(String(base64), "base64"));
            filesIn += 1;
        }

        if (backup.settings?.materials && Array.isArray(backup.settings.origins)) {
            await this.saveSettings(backup.settings);
        }

        let payCodesIn = 0;
        for (const row of payCodes) {
            if (!row?.image_id) continue;
            await visaPayCodeRepository.insert({
                id: row.id,
                amount: Number(row.amount) || 0,
                currency: String(row.currency ?? "CNY"),
                label: String(row.label ?? ""),
                image_id: String(row.image_id),
                sort: typeof row.sort === "number" ? row.sort : undefined,
                create_time: Number(row.create_time) || undefined,
            });
            payCodesIn += 1;
        }

        let customersIn = 0;
        for (const row of customers) {
            await visaCustomerRepository.insert({ email: row.email, name: String(row.name ?? "") });
            customersIn += 1;
        }

        let ordersIn = 0;
        for (const row of orders) {
            await visaOrderRepository.insert(row);
            ordersIn += 1;
        }

        return { orders: ordersIn, customers: customersIn, pay_codes: payCodesIn, files: filesIn };
    }

    static async identify(email: string, name: string) {
        const normalized = normalizeEmail(email);
        if (!EMAIL_PATTERN.test(normalized)) throw new Error("邮箱格式不对");

        const orders = await this.orderHistory(normalized);
        const keys = await this.orderKeys(normalized);
        const existing = await visaCustomerRepository.findOne({ email: normalized });
        if (!existing) {
            // 邮箱先落库，姓名可以之后再补
            await visaCustomerRepository.insert({ email: normalized, name });
            return name ? { exists: false, ok: true, orders, keys } : { exists: false, orders };
        }

        // 姓名留空的档案等于还没登记姓名，这次填上就行
        if (!existing.name.trim()) {
            if (!name) return { exists: false, orders };
            await visaCustomerRepository.update(
                { id: existing.id },
                { name, update_time: Date.now() },
            );
            return { exists: false, ok: true, orders, keys };
        }

        if (!name) return { exists: true, orders };
        if (existing.name.trim() !== name) throw new Error("姓名和这个邮箱之前登记的不一致");

        return { exists: true, ok: true, orders, keys };
    }

    /** 只有姓名核对通过时才把订单查看密钥发出去。 */
    static async orderKeys(email: string) {
        const rows = await visaOrderRepository.find({ customer_email: email });
        const keys: { token: string; key: string }[] = [];
        for (const row of rows) {
            let key = row.view_key;
            // 早于密钥机制创建的老订单，首次认领时补一个
            if (!key) {
                key = nanoid(20);
                await visaOrderRepository.update({ id: row.id }, { view_key: key });
            }
            keys.push({ token: row.invite_token, key });
        }
        return keys;
    }

    static async orderHistory(email: string) {
        const rows = await visaOrderRepository.find({ customer_email: email });
        const sorted = rows.sort((a, b) => b.create_time - a.create_time);
        const result = [];
        for (const row of sorted) {
            const current = await this.advance(row);
            result.push({
                id: current.id,
                token: current.invite_token,
                country_name: findCountry(current.country_code)?.name ?? current.country_code,
                visa: findCountry(current.country_code)?.visa ?? "",
                status: current.status,
                travel_date: current.travel_date,
                trip_days: current.trip_days,
                create_time: current.create_time,
            });
        }
        return result;
    }

    static async create(req: VisaCreateRequest): Promise<VisaOrderEntity> {
        // 没有这条邮箱记录时（比如换了设备、服务端数据清过）直接补一条，
        // 只有已经登记过的邮箱才需要姓名对得上
        const customer = await visaCustomerRepository.findOne({ email: req.customer_email });
        if (!customer) {
            await visaCustomerRepository.insert({
                email: req.customer_email,
                name: req.customer_name,
            });
        } else if (!customer.name.trim()) {
            await visaCustomerRepository.update(
                { id: customer.id },
                { name: req.customer_name, update_time: Date.now() },
            );
        } else if (customer.name.trim() !== req.customer_name) {
            throw new Error("姓名和这个邮箱之前登记的不一致");
        }

        const settings = await this.getSettings();
        const destination = findDestination(settings, req.origin_code, req.country_code);
        if (!destination) throw new Error("该出发地暂不支持这个目的地");
        if (destination.offline) throw new Error("这个目的地暂不可选");

        const center = destination.centers.find((item) => item.name === req.appointment_city);
        if (!center) throw new Error("该出发地没有这个签证中心");

        const bookable = new Set([...center.dates, ...center.cautionDates]);
        const unavailable = req.appointment_dates.find((date) => !bookable.has(date));
        if (unavailable) throw new Error("所选递签日期不可预约，请重新选择");

        const plan = materialsPlan(settings);
        const tooEarly = req.appointment_dates.find((date) => date < plan.firstDate);
        if (tooEarly) throw new Error(`材料组排期未到，最早可选 ${plan.firstDate}`);

        const quote = quoteVisa(destination.price, req.travelers, req.flight, req.hotel);

        return await visaOrderRepository.insert({
            invite_token: Math.random().toString(36).slice(2, 10),
            view_key: nanoid(20),
            customer_email: req.customer_email,
            customer_name: req.customer_name,
            origin_code: req.origin_code,
            country_code: req.country_code,
            travelers: req.travelers,
            flight: req.flight,
            hotel: req.hotel,
            passports: req.passports,
            appointment_city: req.appointment_city,
            appointment_dates: req.appointment_dates,
            appointment_note: req.appointment_note,
            travel_date: req.travel_date,
            trip_days: req.trip_days,
            slot_support: req.slot_support,
            visa_fee: quote.visaFee,
            service_fee: quote.serviceFee,
            extras_fee: quote.extrasFee,
            total: quote.toPay,
            status: "new",
        });
    }

    static async getInvite(token: string) {
        const order = await visaOrderRepository.findOne({ invite_token: token });
        if (!order) throw new Error("邀请链接无效，请向你的同行人确认");
        return order;
    }

    static async getByToken(token: string) {
        const order = await visaOrderRepository.findOne({ invite_token: token });
        if (!order) throw new Error("订单链接无效，请联系你的签证专员");
        return await this.advance(order);
    }

    /** 只有下单本人（或凭邮箱+姓名换到密钥的人）才能查看和修改订单。 */
    static async authorize(token: string, key: string) {
        const order = await this.getByToken(token);
        if (!order.view_key || order.view_key !== key) {
            throw new Error("请先用下单邮箱和姓名确认身份，再打开这个订单");
        }
        return order;
    }

    static async updateOrder(token: string, req: VisaOrderUpdateRequest, key: string) {
        const order = await this.authorize(token, key);
        if (order.status === "locked") {
            throw new Error("订单已锁定，如需修改请联系签证专员");
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(req.travel_date)) {
            const latest = [...order.appointment_dates].sort().pop();
            if (latest && req.travel_date <= latest) throw new Error("出行日期需晚于递签日期");
        }

        const quote = quoteVisa(0, order.travelers, req.flight, req.hotel);
        await visaOrderRepository.update(
            { id: order.id },
            {
                travel_date: req.travel_date,
                trip_days: req.trip_days,
                flight: req.flight,
                hotel: req.hotel,
                appointment_note: req.appointment_note,
                slot_support: req.slot_support,
                extras_fee: quote.extrasFee,
                total: order.service_fee + quote.extrasFee,
                update_time: Date.now(),
            },
        );

        return await this.getByToken(token);
    }

    static async setStatus(id: string, status: string) {
        if (!["new", "locked", "booking", "queued"].includes(status)) {
            throw new Error("未知的订单状态");
        }
        const order = await visaOrderRepository.findOne({ id });
        if (!order) throw new Error("订单不存在");

        await visaOrderRepository.update(
            { id },
            {
                status,
                locked_time: status === "new" ? 0 : status === "locked" ? Date.now() : order.locked_time,
                update_time: Date.now(),
            },
        );
        return await this.getById(id);
    }

    /** 状态走到待处理时，订单页显示对应金额的收款码。 */
    static async payCodeFor(order: VisaOrderEntity) {
        if (order.status !== "new") return null;
        return await this.findPayCode(order.total, currencyOf(order.origin_code).code);
    }

    /** 只做识别并写回字段，图片本身不落盘。 */
    static async scanPassport(token: string, index: number, image: string, key: string) {
        const order = await this.authorize(token, key);
        if (order.status === "locked") throw new Error("订单已锁定，如需修改请联系签证专员");
        if (index < 0 || index >= order.passports.length) throw new Error("没有这位出行人");

        let recognized = false;
        if (ocrConfigured()) {
            const base64 = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;
            const fields = await recognizePassport(Buffer.from(base64, "base64"));
            const merged = { ...order.passports[index] };
            for (const [key, value] of Object.entries(fields)) {
                if (String(value).trim()) merged[key as keyof PassportDetails] = String(value);
            }
            const passports = order.passports.map((item, i) => (i === index ? merged : item));
            await visaOrderRepository.update(
                { id: order.id },
                { passports, update_time: Date.now() },
            );
            recognized = true;
        }

        return { order: await this.getByToken(token), recognized };
    }

    static async addTraveler(token: string, key: string) {
        const order = await this.authorize(token, key);
        if (order.status === "locked") throw new Error("订单已锁定，如需修改请联系签证专员");
        if (order.travelers >= MAX_TRAVELERS) throw new Error(`最多 ${MAX_TRAVELERS} 位出行人`);

        const settings = await this.getSettings();
        const destination = findDestination(settings, order.origin_code, order.country_code);
        const travelers = order.travelers + 1;
        const passports = [
            ...order.passports,
            toPassportDetails({}),
        ];
        const quote = quoteVisa(destination?.price ?? 0, travelers, order.flight, order.hotel);

        await visaOrderRepository.update(
            { id: order.id },
            {
                travelers,
                passports,
                visa_fee: quote.visaFee,
                service_fee: quote.serviceFee,
                extras_fee: quote.extrasFee,
                total: quote.toPay,
                update_time: Date.now(),
            },
        );

        return await this.getByToken(token);
    }

    static async removeTraveler(token: string, index: number, key: string) {
        const order = await this.authorize(token, key);
        if (order.status === "locked") throw new Error("订单已锁定，如需修改请联系签证专员");
        if (order.travelers <= 1) throw new Error("至少要保留一位出行人");
        if (!Number.isInteger(index) || index < 0 || index >= order.passports.length) {
            throw new Error("没有这位出行人");
        }

        const settings = await this.getSettings();
        const destination = findDestination(settings, order.origin_code, order.country_code);
        const travelers = order.travelers - 1;
        const passports = order.passports.filter((_, i) => i !== index);
        const quote = quoteVisa(destination?.price ?? 0, travelers, order.flight, order.hotel);

        await visaOrderRepository.update(
            { id: order.id },
            {
                travelers,
                passports,
                visa_fee: quote.visaFee,
                service_fee: quote.serviceFee,
                extras_fee: quote.extrasFee,
                total: quote.toPay,
                update_time: Date.now(),
            },
        );

        return await this.getByToken(token);
    }

    static async submitInvite(
        token: string,
        index: number,
        passport: PassportDetails,
        slotKey: string,
    ) {
        return serializeByToken(token, async () => {
            const order = await this.getInvite(token);
            const target = Number.isInteger(index)
                ? index
                : order.passports.findIndex((item) => !passportFilled(item));
            if (target < 0) throw new Error("所有出行人都已填写完成");
            if (target >= order.passports.length) throw new Error("没有这位出行人");

            const keys = { ...(order.slot_keys ?? {}) };
            if (passportFilled(order.passports[target]) && keys[target] !== slotKey) {
                throw new Error("这一位已经有人填过了，改不了");
            }

            const key = keys[target] ?? nanoid(16);
            keys[target] = key;

            const passports = order.passports.map((item, i) => (i === target ? passport : item));
            await visaOrderRepository.update(
                { id: order.id },
                { passports, slot_keys: keys, update_time: Date.now() },
            );
            return { slotKey: key };
        });
    }

    static async clearInviteSlot(token: string, index: number, slotKey: string) {
        return serializeByToken(token, async () => {
            const order = await this.getInvite(token);
            if (!Number.isInteger(index) || index < 0 || index >= order.passports.length) {
                throw new Error("没有这位出行人");
            }

            const keys = { ...(order.slot_keys ?? {}) };
            if (passportFilled(order.passports[index]) && keys[index] !== slotKey) {
                throw new Error("只能删掉自己填的那一份");
            }

            delete keys[index];
            const passports = order.passports.map((item, i) =>
                i === index ? toPassportDetails({}) : item,
            );
            await visaOrderRepository.update(
                { id: order.id },
                { passports, slot_keys: keys, update_time: Date.now() },
            );
            return { ok: true };
        });
    }

    static inviteView(order: VisaOrderEntity, slotKeys: { index: number; key: string }[] = []) {
        const keys = order.slot_keys ?? {};
        return {
            id: order.id,
            country_name: findCountry(order.country_code)?.name ?? order.country_code,
            visa: findCountry(order.country_code)?.visa ?? "签证",
            origin_label: VISA_ORIGIN_LABELS[order.origin_code as VisaOriginCode] ?? order.origin_code,
            appointment_city: order.appointment_city,
            appointment_dates: order.appointment_dates,
            travel_date: order.travel_date,
            trip_days: order.trip_days,
            travelers: order.travelers,
            slots: order.passports.map((passport, index) => {
                const filled = passportFilled(passport);
                const mine =
                    Boolean(keys[index]) &&
                    slotKeys.some((item) => Number(item.index) === index && item.key === keys[index]);
                return {
                    index,
                    filled,
                    name: filled ? `${passport.last_name} ${passport.first_name}` : "",
                    mine,
                    // 只把本机填过的那一份原样带回去，别人的字段不下发
                    passport: mine ? passport : undefined,
                };
            }),
        };
    }
}
