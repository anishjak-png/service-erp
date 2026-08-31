import { prisma } from "./db";
import {
  parsePrinterPurposes,
  type PrinterPurpose,
} from "./printer-purposes";

export type { PrinterPurpose } from "./printer-purposes";
export {
  parsePrinterPurposes,
  printerPurposeLabels,
  PRINTER_PURPOSE_LABELS,
  PRINTER_PURPOSES,
} from "./printer-purposes";

const DEFAULT_PRINTER_ID = process.env.PRINT_PRINTER_ID?.trim() || "counter-1";

export async function resolvePrinterId(
  tenantId: string,
  purpose: PrinterPurpose
): Promise<string> {
  const printers = await prisma.shopPrinter.findMany({
    where: { tenantId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const match = printers.find((p) =>
    parsePrinterPurposes(p.purposes).includes(purpose)
  );
  return match?.printerId || printers[0]?.printerId || DEFAULT_PRINTER_ID;
}
