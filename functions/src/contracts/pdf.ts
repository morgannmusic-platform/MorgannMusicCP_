import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { contractFieldMap } from "./fieldMap";
import { ContractFieldPosition } from "./types";
import { clampText } from "./utils";

function normalizePlaceholderKey(key: string): string {
  return String(key || "").replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "").trim();
}

function drawWrapped(page: any, text: string, cfg: ContractFieldPosition, font: any) {
  const size = cfg.size ?? 11;
  const maxWidth = cfg.maxWidth ?? 240;
  const lineHeight = cfg.lineHeight ?? Math.round(size * 1.2);

  const words = clampText(text, 350).split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  lines.slice(0, 4).forEach((value, idx) => {
    page.drawText(value, {
      x: cfg.x,
      y: cfg.y - idx * lineHeight,
      size,
      font,
      color: rgb(0.09, 0.09, 0.1)
    });
  });
}

export async function fillContractPdf(template: Buffer, values: Record<string, string>): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(template);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  const drawField = (mapKey: string, value: string) => {
    const cfg = contractFieldMap[mapKey];
    const page = pages[cfg.page];
    if (!page) return;
    drawWrapped(page, value, cfg, font);
  };

  for (const mapKey of Object.keys(contractFieldMap)) {
    if (mapKey === "client_signature") continue;
    const valueKey = normalizePlaceholderKey(mapKey);
    const value = String(values[valueKey] || values[mapKey] || "").trim();
    if (!value) continue;
    drawField(mapKey, value);
  }

  return pdf.save();
}

export async function signContractPdf(generatedPdf: Buffer, signaturePng: Buffer, signMeta: { name: string; email: string; date: string; }): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(generatedPdf);
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const sigImg = await pdf.embedPng(signaturePng);
  const cfg = contractFieldMap.client_signature;

  const page = pages[cfg.page];
  if (!page) throw new Error("Page de signature introuvable");

  page.drawImage(sigImg, {
    x: cfg.x,
    y: cfg.y,
    width: cfg.width ?? 220,
    height: cfg.height ?? 72
  });

  page.drawText(`Signé par ${clampText(signMeta.name, 80)} (${clampText(signMeta.email, 120)})`, {
    x: cfg.x,
    y: cfg.y - 16,
    size: 9,
    font,
    color: rgb(0.18, 0.18, 0.2)
  });

  page.drawText(`Date de signature: ${signMeta.date}`, {
    x: cfg.x,
    y: cfg.y - 28,
    size: 9,
    font,
    color: rgb(0.18, 0.18, 0.2)
  });

  return pdf.save();
}
