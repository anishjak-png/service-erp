export const PRINTER_PURPOSES = [
  "job_new",
  "job_delivery",
  "token_new",
  "token_delivery",
] as const;

export type PrinterPurpose = (typeof PRINTER_PURPOSES)[number];

export const PRINTER_PURPOSE_LABELS: Record<PrinterPurpose, string> = {
  job_new: "New job card",
  job_delivery: "Delivery",
  token_new: "New token",
  token_delivery: "Token delivery",
};

const LEGACY_PURPOSES: Record<string, PrinterPurpose> = {
  job_receipt: "job_new",
  token_receipt: "token_new",
};

function isPrinterPurpose(value: unknown): value is PrinterPurpose {
  return (
    typeof value === "string" &&
    (PRINTER_PURPOSES as readonly string[]).includes(value)
  );
}

export function parsePrinterPurposes(raw: string | null | undefined): PrinterPurpose[] {
  if (!raw) return ["job_new"];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ["job_new"];
    const purposes = parsed
      .map((p) => (typeof p === "string" ? LEGACY_PURPOSES[p] ?? p : p))
      .filter(isPrinterPurpose);
    return purposes.length > 0 ? [...new Set(purposes)] : ["job_new"];
  } catch {
    return ["job_new"];
  }
}

export function printerPurposeLabels(purposes: string[]): string {
  return purposes
    .map((p) => (isPrinterPurpose(p) ? PRINTER_PURPOSE_LABELS[p] : p))
    .join(", ");
}
