/** QQ 通知：直接 POST qqbridge 的 /send，配置来自后台设置，缺项就当没配。 */

import type { VisaSettings } from "../../../shared/modules/visa/visa.settings";

export interface NotifyResult {
    ok: boolean;
    error?: string;
}

function config(settings: VisaSettings | null | undefined) {
    const notify = settings?.notify;
    const url = String(notify?.qq_url ?? "").trim().replace(/\/+$/, "");
    const target = String(notify?.qq_target ?? "").trim();
    const token = String(notify?.qq_token ?? "").trim();
    return { url, target, token };
}

export function notifyConfigured(settings: VisaSettings | null | undefined): boolean {
    const { url, target } = config(settings);
    return Boolean(url && target);
}

export async function sendQQ(
    settings: VisaSettings | null | undefined,
    content: string,
): Promise<NotifyResult> {
    const { url, target, token } = config(settings);
    if (!url || !target) return { ok: false, error: "还没配置通知" };

    try {
        const res = await fetch(`${url}/send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ target_id: target, content }),
            signal: AbortSignal.timeout(35000),
        });
        if (!res.ok) {
            const text = (await res.text().catch(() => "")).slice(0, 200);
            return { ok: false, error: `HTTP ${res.status} ${text}`.trim() };
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, error: String(error).slice(0, 200) };
    }
}

/** 通知发不出去也不能影响下单，所以调用方不 await。 */
export function notifyInBackground(settings: VisaSettings | null | undefined, content: string) {
    if (!notifyConfigured(settings)) return;
    void sendQQ(settings, content).catch(() => {});
}
