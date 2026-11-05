import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const IMAGE_MAX_EDGE = 1600;
const IMAGE_TARGET_CHARS = 600 * 1024;

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/** 手机拍的护照照片常有几 MB 或 HEIC，上传前先在浏览器压成 600KB 以内的 JPEG。 */
export async function toUploadImage(file: File): Promise<string> {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas unavailable");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        let quality = 0.85;
        let image = canvas.toDataURL("image/jpeg", quality);
        while (image.length > IMAGE_TARGET_CHARS && quality > 0.5) {
            quality = Math.round((quality - 0.1) * 100) / 100;
            image = canvas.toDataURL("image/jpeg", quality);
        }
        return image;
    } catch {
        return await readAsDataUrl(file);
    }
}
