import { logger } from "firebase-functions";

export async function sendContractEmail(params: { to: string; customerName: string; trackName: string; contractId: string; signedPdfUrl: string; }) {
  logger.info("Envoi email externe désactivé", {
    contractId: params.contractId,
    to: params.to,
    trackName: params.trackName,
    signedPdfUrl: params.signedPdfUrl
  });
}
