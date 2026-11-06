import { Readable } from "node:stream"

import * as OpenApi from "@alicloud/openapi-client"
import OcrClient, {
  RecognizeAdvancedRequest,
  RecognizeGeneralRequest,
  RecognizePassportRequest,
} from "@alicloud/ocr-api20210707"

import type { PassportDetails } from "../../../shared/modules/visa/visa.entity"

const ENDPOINT = process.env.ALIYUN_OCR_ENDPOINT || "ocr-api.cn-hangzhou.aliyuncs.com"

export function ocrConfigured() {
  return Boolean(process.env.ALIYUN_OCR_ACCESS_KEY_ID && process.env.ALIYUN_OCR_ACCESS_KEY_SECRET)
}

function ocrClient() {
  const config = new OpenApi.Config({
    accessKeyId: process.env.ALIYUN_OCR_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_OCR_ACCESS_KEY_SECRET,
  })
  config.endpoint = ENDPOINT
  return new OcrClient(config)
}

export interface OcrWord {
  text: string
  x: number
  y: number
  width: number
  height: number
}

/** 通用文字识别，连每个词的坐标一起返回，用来定位价格下面那行小字。 */
export async function recognizeWords(image: Buffer): Promise<{ text: string; words: OcrWord[] }> {
  const response = await ocrClient().recognizeGeneral(
    new RecognizeGeneralRequest({ body: Readable.from(image) }),
  )
  const raw = response?.body?.data
  if (!raw) return { text: "", words: [] }

  const parsed = JSON.parse(raw) as { content?: string; prism_wordsInfo?: any[] }
  const words: OcrWord[] = (parsed.prism_wordsInfo ?? []).map((item) => {
    const pos: any[] = Array.isArray(item?.pos) ? item.pos : []
    const xs = pos.map((point) => Number(point?.x ?? 0))
    const ys = pos.map((point) => Number(point?.y ?? 0))
    const x = xs.length ? Math.min(...xs) : Number(item?.x ?? 0)
    const y = ys.length ? Math.min(...ys) : Number(item?.y ?? 0)
    return {
      text: String(item?.word ?? ""),
      x,
      y,
      width: xs.length ? Math.max(...xs) - x : Number(item?.width ?? 0),
      height: ys.length ? Math.max(...ys) - y : Number(item?.height ?? 0),
    }
  })

  return { text: String(parsed.content ?? ""), words }
}

/** 只要文字，不看坐标。 */
export async function recognizeText(image: Buffer): Promise<string> {
  const { text } = await recognizeWords(image)
  return text
}

function upper(value?: string) {
  return String(value ?? "").trim().toUpperCase()
}

function toNationality(fields: Record<string, string>) {
  return upper(String(fields.country || fields.nationality || ""));
}

/** 护照上印的是「北京/BEIJING」这种双语写法，取斜杠后的英文。 */
function toBirthPlace(fields: Record<string, string>) {
  const text = String(fields.birthPlaceEn || fields.birthPlace || "").trim()
  const parts = text.split("/")
  return upper(parts.length > 1 ? parts[parts.length - 1] : parts[0])
}

function pad(value: string) {
  return value.padStart(2, "0")
}

function toIsoDate(value?: string) {
  const text = String(value ?? "").trim()
  if (!text) return ""

  const chinese = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
  if (chinese) return `${chinese[1]}-${pad(chinese[2])}-${pad(chinese[3])}`

  const separated = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (separated) return `${separated[1]}-${pad(separated[2])}-${pad(separated[3])}`

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`

  return ""
}

function toGender(value?: string) {
  const text = String(value ?? "").trim().toLowerCase()
  if (text.startsWith("f") || text.includes("女")) return "女"
  if (text.startsWith("m") || text.includes("男")) return "男"
  return ""
}

function splitName(fields: Record<string, string>) {
  const source = String(fields.nameEn || fields.name || "").trim()
  if (!source) return { last_name: "", first_name: "" }

  const [last, first] = source.split(",")
  if (first !== undefined) {
    return { last_name: upper(last), first_name: upper(first) }
  }
  return { last_name: "", first_name: upper(source) }
}

export function toPassportDetails(fields: Record<string, string>): PassportDetails {
  const { last_name, first_name } = splitName(fields)

  return {
    first_name,
    last_name,
    birth_date: toIsoDate(fields.birthDateYmd || fields.birthDate),
    gender: toGender(fields.sex || fields.gender),
    nationality: toNationality(fields),
    birth_place: toBirthPlace(fields),
    passport_number: upper(fields.passportNumber),
    issue_date: toIsoDate(fields.issueDateYmd || fields.issueDate),
    expiry_date: toIsoDate(fields.validToDate || fields.expiryDate),
  }
}

export async function recognizePassport(image: Buffer): Promise<PassportDetails> {
  const response = await ocrClient().recognizePassport(
    new RecognizePassportRequest({ body: Readable.from(image) }),
  )
  const raw = response?.body?.data
  if (!raw) throw new Error("识别服务没有返回护照信息")

  const parsed = JSON.parse(raw) as { data?: Record<string, string> }
  const fields = parsed.data ?? {}
  if (process.env.ALIYUN_OCR_DEBUG === "1") {
    console.log("[ocr] passport fields", fields)
  }

  return toPassportDetails(fields)
}
