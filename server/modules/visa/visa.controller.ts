import { VisaOrderDTO, type VisaOrderEntity } from "../../../shared/modules/visa/visa.entity";
import {
    passportFilled,
    toPassportDetails,
    VisaAddTravelerInput,
    VisaCalendarScanInput,
    VisaCreateInput,
    VisaCreateRequest,
    VisaExportInput,
    VisaImportInput,
    VisaIdentifyInput,
    VisaInviteInput,
    VisaInviteSubmitInput,
    VisaInviteSlotRemoveInput,
    VisaOrderInput,
    VisaOrdersInput,
    VisaOrderStatusInput,
    VisaOrderUpdateInput,
    VisaOrderUpdateRequest,
    VisaPassportScanInput,
    VisaPassportPhotoInput,
    VisaRemoveTravelerInput,
    VisaOcrInput,
    VisaOrderAttachInput,
    VisaOrderPositionInput,
    VisaOrderSetStatusInput,
    VisaOrderArchiveInput,
    VisaPayCodeListInput,
    VisaPayCodeRemoveInput,
    VisaPayCodeReorderInput,
    VisaPayCodeSaveInput,
    VisaPayCodeScanInput,
    VisaSaveSettingsInput,
    VisaSaveSettingsRequest,
} from "../../../shared/modules/visa/visa.interface";
import { visaRoutes } from "../../../shared/modules/visa/visa.router";
import { getIdentifyByVerify } from "../auth/auth.service";
import { VisaService } from "./visa.service";
import { ocrConfigured, recognizePassport } from "./visa.ocr";
import { gbpToCny } from "./visa.fx";

/** 后台接口：请求里必须带有效的登录 token。 */
function requireLogin(request: any) {
    if (!getIdentifyByVerify(String(request?.auth ?? ""))) throw new Error("请先登录");
}

async function settings() {
    return { settings: await VisaService.getSettings() };
}

async function saveSettings(request: VisaSaveSettingsInput) {
    requireLogin(request);
    const req = VisaSaveSettingsRequest.self(request);

    return { settings: await VisaService.saveSettings(req.settings) };
}

async function notifyTest(request: VisaOrdersInput) {
    requireLogin(request);

    return await VisaService.notifyTest();
}

async function passportPhotos(request: VisaPassportPhotoInput) {
    requireLogin(request);

    return { photos: await VisaService.passportPhotos(request.id) };
}

async function fx() {
    return { fx: await gbpToCny() };
}

async function toDTO(row: VisaOrderEntity) {
    return new VisaOrderDTO(row);
}

/** 查看密钥随请求带过来（x-api-key 或请求体里的 auth），不进 URL。 */
function authKey(request: any) {
    return String(request?.auth ?? "");
}

/** 订单号在链接里大写显示，存储里是小写，这里统一按小写查。 */
function tokenOf(request: any) {
    return String(request?.token ?? "").trim().toLowerCase();
}

async function create(request: VisaCreateInput) {
    const req = VisaCreateRequest.self(request);
    const order = await VisaService.create(req);

    return { order: await toDTO(order), view_key: order.view_key };
}

async function orders(request: VisaOrdersInput) {
    requireLogin(request);
    const rows = await VisaService.listOrders();

    return { orders: rows.map((row) => new VisaOrderDTO(row)) };
}

async function invite(request: VisaInviteInput) {
    const order = await VisaService.getInvite(tokenOf(request));

    return { order: VisaService.inviteView(order, request?.slot_keys ?? []) };
}

async function inviteSubmit(request: VisaInviteSubmitInput) {
    const passport = toPassportDetails(request?.passport);
    if (!passportFilled(passport)) throw new Error("请填写姓和名");

    const index = request?.index === undefined ? -1 : Number(request.index);
    const result = await VisaService.submitInvite(
        tokenOf(request),
        index,
        passport,
        String(request?.slot_key ?? ""),
    );

    return { ok: true, slot_key: result.slotKey };
}

async function inviteSlotRemove(request: VisaInviteSlotRemoveInput) {
    await VisaService.clearInviteSlot(
        tokenOf(request),
        Number(request?.index),
        String(request?.slot_key ?? ""),
    );

    return { ok: true };
}

async function order(request: VisaOrderInput) {
    const row = await VisaService.authorize(tokenOf(request), authKey(request));

    return {
        order: await toDTO(row),
        pay_code: await VisaService.payCodeFor(row),
    };
}

async function orderUpdate(request: VisaOrderUpdateInput) {
    const req = VisaOrderUpdateRequest.self(request);
    const row = await VisaService.updateOrder(tokenOf(request), req, authKey(request));

    return { order: await toDTO(row) };
}

async function orderStatus(request: VisaOrderStatusInput) {
    requireLogin(request);
    const row = await VisaService.setStatus(String(request?.id ?? ""), String(request?.status ?? ""));

    return { order: await toDTO(row), pay_code: await VisaService.payCodeFor(row) };
}

async function orderSetStatus(request: VisaOrderSetStatusInput) {
    requireLogin(request);
    const row = await VisaService.setStatus(String(request?.id ?? ""), String(request?.status ?? ""));

    return { order: await toDTO(row), pay_code: await VisaService.payCodeFor(row) };
}

async function archivedOrders(request: VisaOrdersInput) {
    requireLogin(request);
    const rows = await VisaService.listOrders(true);

    return { orders: rows.map((row) => new VisaOrderDTO(row)) };
}

async function orderArchive(request: VisaOrderArchiveInput) {
    requireLogin(request);
    const row = await VisaService.archiveOrder(String(request?.id ?? ""));

    return { order: await toDTO(row) };
}

async function orderRestore(request: VisaOrderArchiveInput) {
    requireLogin(request);
    const row = await VisaService.restoreOrder(String(request?.id ?? ""));

    return { order: await toDTO(row) };
}

async function orderPosition(request: VisaOrderPositionInput) {
    requireLogin(request);
    const row = await VisaService.setPosition(String(request?.id ?? ""), String(request?.position ?? ""));

    return { order: await toDTO(row) };
}

async function orderAttach(request: VisaOrderAttachInput) {
    requireLogin(request);
    const row = await VisaService.attachFile(
        String(request?.id ?? ""),
        String(request?.name ?? ""),
        String(request?.data ?? ""),
    );

    return { order: await toDTO(row) };
}

async function payCodeList(request: VisaPayCodeListInput) {
    requireLogin(request);

    return { codes: await VisaService.listPayCodes() };
}

async function payCodeSave(request: VisaPayCodeSaveInput) {
    requireLogin(request);

    return { code: await VisaService.savePayCode(request) };
}

async function payCodeReorder(request: VisaPayCodeReorderInput) {
    requireLogin(request);
    const ids = Array.isArray(request?.ids) ? request.ids.map((id: any) => String(id)) : [];

    return { codes: await VisaService.reorderPayCodes(ids) };
}

async function calendarScan(request: VisaCalendarScanInput) {
    requireLogin(request);

    return await VisaService.scanCalendar(String(request?.image ?? ""));
}

async function payCodeRemove(request: VisaPayCodeRemoveInput) {
    requireLogin(request);

    return await VisaService.removePayCode(String(request?.id ?? ""));
}

async function payCodeScan(request: VisaPayCodeScanInput) {
    requireLogin(request);

    return await VisaService.scanPayCode(
        String(request?.image ?? ""),
        String(request?.mode ?? ""),
    );
}

/** 收款码和预约信都从这里按 id 取，id 是随机串，猜不到。 */
async function file(request: { id: string }) {
    const filePath = VisaService.resolveUpload(request?.id);
    // @ts-ignore Bun 运行时
    const body = Bun.file(filePath);
    const type = filePath.endsWith(".pdf")
        ? "application/pdf"
        : filePath.endsWith(".jpg")
          ? "image/jpeg"
          : filePath.endsWith(".webp")
            ? "image/webp"
            : "image/png";

    return new Response(body, {
        headers: { "Content-Type": type, "Cache-Control": "private, max-age=600" },
    });
}

async function passportScan(request: VisaPassportScanInput) {
    const image = String(request?.image ?? "");
    if (!image) throw new Error("没有收到图片");
    if (!ocrConfigured()) throw new Error("识别服务未配置");

    const result = await VisaService.scanPassport(
        tokenOf(request),
        Number(request?.index),
        image,
        authKey(request),
    );

    return { order: await toDTO(result.order), recognized: result.recognized };
}

async function addTraveler(request: VisaAddTravelerInput) {
    const row = await VisaService.addTraveler(tokenOf(request), authKey(request));

    return { order: await toDTO(row) };
}

async function removeTraveler(request: VisaRemoveTravelerInput) {
    const row = await VisaService.removeTraveler(
        tokenOf(request),
        Number(request?.index),
        authKey(request),
    );

    return { order: await toDTO(row) };
}

async function identify(request: VisaIdentifyInput) {
    return await VisaService.identify(
        String(request?.email ?? ""),
        String(request?.name ?? "").trim(),
    );
}

async function ocrPassport(request: VisaOcrInput) {
    if (!ocrConfigured()) throw new Error("识别服务未配置");

    const image = String(request?.image ?? "");
    const base64 = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;
    if (!base64) throw new Error("没有收到图片");

    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) throw new Error("没有收到图片");
    if (buffer.length > 8 * 1024 * 1024) throw new Error("图片请控制在 8MB 以内");

    return { passport: await recognizePassport(buffer) };
}

async function exportData(request: VisaExportInput) {
    requireLogin(request);
    return { backup: await VisaService.exportAll() };
}

async function importData(request: VisaImportInput) {
    requireLogin(request);

    return await VisaService.importAll(request?.backup);
}

export const visaMount = {
    routes: visaRoutes,
    handlers: {
        settings,
        saveSettings,
        fx,
        notifyTest,
        passportPhotos,
        create,
        orders,
        invite,
        inviteSubmit,
        inviteSlotRemove,
        order,
        orderUpdate,
        orderStatus,
        orderSetStatus,
        archivedOrders,
        orderArchive,
        orderRestore,
        orderPosition,
        orderAttach,
        payCodeList,
        payCodeSave,
        payCodeRemove,
        payCodeScan,
        payCodeReorder,
        calendarScan,
        file,
        passportScan,
        addTraveler,
        removeTraveler,
        identify,
        ocrPassport,
        exportData,
        importData,
    },
};
