"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillContractPdf = fillContractPdf;
exports.signContractPdf = signContractPdf;
const pdf_lib_1 = require("pdf-lib");
const fieldMap_1 = require("./fieldMap");
const utils_1 = require("./utils");
function normalizePlaceholderKey(key) {
    return String(key || "").replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "").trim();
}
function drawWrapped(page, text, cfg, font) {
    const size = cfg.size ?? 11;
    const maxWidth = cfg.maxWidth ?? 240;
    const lineHeight = cfg.lineHeight ?? Math.round(size * 1.2);
    const words = (0, utils_1.clampText)(text, 350).split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(next, size);
        if (width > maxWidth && line) {
            lines.push(line);
            line = word;
        }
        else {
            line = next;
        }
    }
    if (line)
        lines.push(line);
    lines.slice(0, 4).forEach((value, idx) => {
        page.drawText(value, {
            x: cfg.x,
            y: cfg.y - idx * lineHeight,
            size,
            font,
            color: (0, pdf_lib_1.rgb)(0.09, 0.09, 0.1)
        });
    });
}
async function fillContractPdf(template, values) {
    const pdf = await pdf_lib_1.PDFDocument.load(template);
    const font = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const drawField = (mapKey, value) => {
        const cfg = fieldMap_1.contractFieldMap[mapKey];
        const page = pages[cfg.page];
        if (!page)
            return;
        drawWrapped(page, value, cfg, font);
    };
    for (const mapKey of Object.keys(fieldMap_1.contractFieldMap)) {
        if (mapKey === "client_signature")
            continue;
        const valueKey = normalizePlaceholderKey(mapKey);
        const value = String(values[valueKey] || values[mapKey] || "").trim();
        if (!value)
            continue;
        drawField(mapKey, value);
    }
    return pdf.save();
}
async function signContractPdf(generatedPdf, signaturePng, signMeta) {
    const pdf = await pdf_lib_1.PDFDocument.load(generatedPdf);
    const pages = pdf.getPages();
    const font = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const sigImg = await pdf.embedPng(signaturePng);
    const cfg = fieldMap_1.contractFieldMap.client_signature;
    const page = pages[cfg.page];
    if (!page)
        throw new Error("Page de signature introuvable");
    page.drawImage(sigImg, {
        x: cfg.x,
        y: cfg.y,
        width: cfg.width ?? 220,
        height: cfg.height ?? 72
    });
    page.drawText(`Signé par ${(0, utils_1.clampText)(signMeta.name, 80)} (${(0, utils_1.clampText)(signMeta.email, 120)})`, {
        x: cfg.x,
        y: cfg.y - 16,
        size: 9,
        font,
        color: (0, pdf_lib_1.rgb)(0.18, 0.18, 0.2)
    });
    page.drawText(`Date de signature: ${signMeta.date}`, {
        x: cfg.x,
        y: cfg.y - 28,
        size: 9,
        font,
        color: (0, pdf_lib_1.rgb)(0.18, 0.18, 0.2)
    });
    return pdf.save();
}
