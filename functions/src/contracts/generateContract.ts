import admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import fs from "node:fs/promises";
import path from "node:path";
import { CreateContractInput } from "./types";
import { createContractDoc, getContractByOrderId } from "./firestore";
import { clampText, generateSignatureToken, parisDateDDMMYYYY, priceLabel, sanitizeEmail } from "./utils";
import { saveBuffer } from "./storage";

const TEMPLATE_PATH = "templates/contracts/exclusive-license.pdf";

export async function createContractFromOrder(input: CreateContractInput) {
  const existing = await getContractByOrderId(input.orderId);
  if (existing) return { id: existing.id, ...(existing.data() as any) };

  const now = admin.firestore.Timestamp.now();
  const tokenExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const values = {
    client_name: clampText(input.customerName, 120),
    client_email: sanitizeEmail(input.customerEmail),
    client_address: clampText(input.customerAddress, 220),
    track_name: clampText(input.trackName, 140),
    license_type: clampText(input.licenseType || "exclusive", 50),
    price: priceLabel(input.amount, input.currency),
    date_dmd: parisDateDDMMYYYY(new Date()),
    order_id: clampText(input.orderId, 120)
  };

  const localTemplatePath = path.resolve(__dirname, "../../templates/contracts/exclusive-license.pdf");
  const template = await fs.readFile(localTemplatePath);
  if (!template || !template.length) throw new HttpsError("failed-precondition", "Template PDF introuvable");

  const { fillContractPdf } = require("./pdf") as typeof import("./pdf");
  const pdfBytes = await fillContractPdf(template, values);
  const generatedId = admin.firestore().collection("contracts").doc().id;
  const generatedPdfPath = `contracts/generated/${generatedId}.pdf`;

  await saveBuffer(generatedPdfPath, pdfBytes, "application/pdf");

  const ref = await createContractDoc({
    orderId: input.orderId,
    stripeSessionId: input.stripeSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId || null,
    purchasedProdIds: Array.isArray(input.purchasedProdIds)
      ? input.purchasedProdIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 50)
      : [],
    customerName: values.client_name,
    customerEmail: values.client_email,
    customerAddress: values.client_address,
    trackName: values.track_name,
    licenseType: values.license_type,
    amount: input.amount,
    currency: String(input.currency || "eur").toLowerCase(),
    templatePath: TEMPLATE_PATH,
    generatedPdfPath,
    signedPdfPath: null,
    signatureImagePath: null,
    signatureToken: generateSignatureToken(),
    signatureStatus: "pending",
    tokenExpiresAt,
    generatedAt: now,
    signedAt: null,
    createdAt: now,
    updatedAt: now
  } as any);

  return { id: ref.id, ...(await ref.get()).data() };
}
