import { prisma } from "@/lib/db";
import type { NotificationEventType } from "@prisma/client";
import { getSession } from "@/lib/session";
import { requireTenantId } from "@/lib/tenant";
import { DEFAULT_TEMPLATE_BODIES } from "./default-templates";
import type { NotificationSettingsDto } from "./types";

async function resolveTenantId(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const session = await getSession();
  return requireTenantId(session);
}

function toDto(row: {
  masterEnabled: boolean;
  jobCreatedEnabled: boolean;
  jobReadyEnabled: boolean;
  jobReturnEnabled: boolean;
  trackingLinkEnabled: boolean;
  provider: NotificationSettingsDto["provider"];
  apiUrl: string | null;
  apiKey: string | null;
  accessToken: string | null;
  phoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  businessNumber: string | null;
  additionalHeaders: string | null;
}): NotificationSettingsDto {
  return {
    masterEnabled: row.masterEnabled,
    jobCreatedEnabled: row.jobCreatedEnabled,
    jobReadyEnabled: row.jobReadyEnabled,
    jobReturnEnabled: row.jobReturnEnabled,
    trackingLinkEnabled: row.trackingLinkEnabled,
    provider: row.provider,
    apiUrl: row.apiUrl,
    apiKey: row.apiKey,
    accessToken: row.accessToken,
    phoneNumberId: row.phoneNumberId,
    whatsappBusinessAccountId: row.whatsappBusinessAccountId,
    businessNumber: row.businessNumber,
    additionalHeaders: row.additionalHeaders,
  };
}

export async function getNotificationSettings(
  tenantId?: string
): Promise<NotificationSettingsDto> {
  const id = await resolveTenantId(tenantId);
  const row = await prisma.notificationSettings.upsert({
    where: { tenantId: id },
    create: { tenantId: id },
    update: {},
  });

  return toDto(row);
}

export async function updateNotificationSettings(
  data: Partial<NotificationSettingsDto>,
  tenantId?: string
): Promise<NotificationSettingsDto> {
  const id = await resolveTenantId(tenantId);
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

  const row = await prisma.notificationSettings.upsert({
    where: { tenantId: id },
    create: {
      tenantId: id,
      ...clean,
    },
    update: clean,
  });

  return toDto(row);
}

export async function ensureDefaultTemplates(
  tenantId?: string
): Promise<
  Record<NotificationEventType, { eventType: NotificationEventType; body: string }>
> {
  const id = await resolveTenantId(tenantId);
  const existing = await prisma.notificationTemplate.findMany({
    where: { tenantId: id },
  });
  const byType = new Map(existing.map((t) => [t.eventType, t]));

  for (const eventType of Object.keys(
    DEFAULT_TEMPLATE_BODIES
  ) as NotificationEventType[]) {
    if (!byType.has(eventType)) {
      const created = await prisma.notificationTemplate.create({
        data: {
          tenantId: id,
          eventType,
          body: DEFAULT_TEMPLATE_BODIES[eventType],
        },
      });
      byType.set(eventType, created);
    }
  }

  return Object.fromEntries(
    [...byType.entries()].map(([eventType, row]) => [
      eventType,
      { eventType: row.eventType, body: row.body },
    ])
  ) as Record<
    NotificationEventType,
    { eventType: NotificationEventType; body: string }
  >;
}

export async function getTemplateForEvent(
  eventType: NotificationEventType,
  tenantId?: string
): Promise<string> {
  const id = await resolveTenantId(tenantId);
  await ensureDefaultTemplates(id);
  const row = await prisma.notificationTemplate.findUnique({
    where: { tenantId_eventType: { tenantId: id, eventType } },
  });
  return row?.body ?? DEFAULT_TEMPLATE_BODIES[eventType];
}

export async function updateTemplate(
  eventType: NotificationEventType,
  body: string,
  tenantId?: string
): Promise<{ eventType: NotificationEventType; body: string }> {
  const id = await resolveTenantId(tenantId);
  await ensureDefaultTemplates(id);
  const row = await prisma.notificationTemplate.update({
    where: { tenantId_eventType: { tenantId: id, eventType } },
    data: { body },
  });
  return { eventType: row.eventType, body: row.body };
}
