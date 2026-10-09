import type { MediaSettings } from "../../shared/media-settings";
import { detectMediaFormat, MEDIA_BYTE_LIMIT } from "./media";

export const IMAGE_PIXEL_LIMIT = 32_000_000;
function animatedPng(bytes: Buffer): boolean {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (offset + length + 12 > bytes.length) break;
    if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") return true;
    offset += length + 12;
  }
  return false;
}
export async function processImage(bytes: Buffer, options: MediaSettings) {
  const result = {
    status: "original" as "original" | "processed" | "skipped" | "failed",
    message: "处理已关闭，将上传原图。",
    bytes: null as Buffer | null,
    extension: null as string | null,
    width: null as number | null,
    height: null as number | null,
    outputWidth: null as number | null,
    outputHeight: null as number | null,
  };
  if (!options.compress && !options.resize && options.format === "original") return result;
  const original = detectMediaFormat(bytes);
  if (
    original === ".svg" ||
    original === ".gif" ||
    (original === ".png" && animatedPng(bytes)) ||
    (original === ".avif" && bytes.toString("ascii", 8, 12) === "avis")
  )
    return {
      ...result,
      status: "skipped" as const,
      message: "SVG 或动画格式保持原样，不进行压缩、缩放或转换。",
    };
  try {
    const { default: sharp } = await import("sharp");
    const input = sharp(bytes, { limitInputPixels: IMAGE_PIXEL_LIMIT, failOn: "warning" }).timeout({
      seconds: 8,
    });
    const metadata = await input.metadata();
    result.width = metadata.width ?? null;
    result.height = metadata.height ?? null;
    if ((metadata.pages ?? 1) > 1)
      return {
        ...result,
        status: "skipped" as const,
        message: "检测到动画/多帧图片，保持原图以保留全部帧。",
      };
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > IMAGE_PIXEL_LIMIT)
      throw new Error("图片超过 3200 万像素处理上限。");
    const format =
      options.format === "original"
        ? ({ ".png": "png", ".jpg": "jpeg", ".webp": "webp", ".avif": "avif" } as const)[
            original as ".png" | ".jpg" | ".webp" | ".avif"
          ]
        : options.format;
    if (!format)
      return { ...result, status: "skipped" as const, message: "该格式不支持处理，可上传原图。" };
    if (format === "jpeg" && metadata.hasAlpha)
      throw new Error("JPEG 不支持透明通道，请选择 PNG、WebP、AVIF 或上传原图。");
    let pipeline = input.rotate();
    if (options.resize)
      pipeline = pipeline.resize({
        width: options.maxDimension,
        height: options.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
    const quality = options.compress ? options.quality : 100;
    pipeline =
      format === "png"
        ? pipeline.png({ compressionLevel: options.compress ? 9 : 6 })
        : format === "jpeg"
          ? pipeline.jpeg({ quality })
          : format === "webp"
            ? pipeline.webp({ quality, lossless: !options.compress })
            : pipeline.avif({ quality, lossless: !options.compress, effort: 4 });
    const output = await pipeline.toBuffer({ resolveWithObject: true });
    if (output.data.length > MEDIA_BYTE_LIMIT)
      throw new Error("处理后图片超过 20 MB，请调整设置或上传原图。");
    return {
      ...result,
      status: "processed" as const,
      message:
        output.data.length > bytes.length
          ? "处理完成，文件比原图更大，可选择上传原图。"
          : "处理完成；请核对尺寸、体积与目标路径后上传。",
      bytes: output.data,
      extension: format === "jpeg" ? ".jpg" : `.${format}`,
      outputWidth: output.info.width,
      outputHeight: output.info.height,
    };
  } catch (cause) {
    return {
      ...result,
      status: "failed" as const,
      message: `处理失败：${(cause as Error).message} 未写入任何图片，可调整设置或明确选择上传原图。`,
    };
  }
}
