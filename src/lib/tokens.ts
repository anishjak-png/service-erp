import { prisma } from "./db";
import { DEFAULT_TOKEN_PREFIX } from "./constants";

export function todayIstDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayMonthIst(isoDate = todayIstDate()): string {
  const [, month, day] = isoDate.split("-");
  return `${day}${month}`;
}

function safeTokenPrefix(prefix?: string | null): string {
  const cleaned = (prefix ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned || DEFAULT_TOKEN_PREFIX;
}

export function formatTokenNumber(
  prefix: string,
  lastNum: number,
  resetDaily: boolean,
  isoDate = todayIstDate()
): string {
  const safePrefix = safeTokenPrefix(prefix);
  if (resetDaily) {
    return `${safePrefix} ${dayMonthIst(isoDate)} ${lastNum}`;
  }
  return `${safePrefix} ${lastNum}`;
}

export async function generateTokenNumber(
  tenantId: string,
  prefix = DEFAULT_TOKEN_PREFIX,
  resetDaily = false
): Promise<string> {
  if (!tenantId) {
    throw new Error("generateTokenNumber requires tenantId");
  }
  const today = todayIstDate();
  const sequence = await prisma.$transaction(async (tx) => {
    const existing = await tx.tokenSequence.findUnique({ where: { tenantId } });
    if (!existing) {
      return tx.tokenSequence.create({
        data: { tenantId, lastNum: 1, lastResetOn: today },
      });
    }
    if (resetDaily && existing.lastResetOn !== today) {
      return tx.tokenSequence.update({
        where: { tenantId },
        data: { lastNum: 1, lastResetOn: today },
      });
    }
    return tx.tokenSequence.update({
      where: { tenantId },
      data: {
        lastNum: existing.lastNum + 1,
        lastResetOn: existing.lastResetOn ?? today,
      },
    });
  });

  return formatTokenNumber(prefix, sequence.lastNum, resetDaily, today);
}
