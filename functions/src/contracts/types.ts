export type ContractStatus = "pending" | "signed" | "expired" | "failed";

export interface ContractRecord {
  id: string;
  orderId: string;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  purchasedProdIds?: string[];
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  trackName: string;
  licenseType: "exclusive" | string;
  amount: number;
  currency: string;
  templatePath: string;
  generatedPdfPath: string;
  signedPdfPath?: string | null;
  signatureImagePath?: string | null;
  signatureToken: string;
  signatureStatus: ContractStatus;
  tokenExpiresAt: FirebaseFirestore.Timestamp;
  generatedAt: FirebaseFirestore.Timestamp;
  signedAt?: FirebaseFirestore.Timestamp | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface ContractFieldPosition {
  page: number;
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
  lineHeight?: number;
  width?: number;
  height?: number;
}

export interface ContractFieldMap {
  [key: string]: ContractFieldPosition;
  client_signature: ContractFieldPosition;
}

export interface CreateContractInput {
  orderId: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  purchasedProdIds?: string[];
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  trackName: string;
  licenseType: string;
  amount: number;
  currency: string;
}

export interface SignatureRequestDTO {
  contractId: string;
  token: string;
  expiresAt: number;
  customerName: string;
  customerEmail: string;
  trackName: string;
  licenseType: string;
  amount: number;
  currency: string;
  generatedPdfUrl: string;
}
