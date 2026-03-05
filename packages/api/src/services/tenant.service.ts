import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { tenants } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { getLogger } from '../lib/logger.js';
import type { Tenant, PortalConfig, UpdateTenantInput } from '@supportdesk/shared';

// ---------------------------------------------------------------------------
// Get Tenant Configuration
// ---------------------------------------------------------------------------

/**
 * Get the full tenant configuration for the current authenticated user's tenant.
 * Throws NotFoundError if the tenant does not exist.
 */
export async function getTenant(tenantId: string): Promise<Tenant> {
  const db = getDb();

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      logoUrl: tenants.logoUrl,
      brandColor: tenants.brandColor,
      supportEmail: tenants.supportEmail,
      businessHoursStart: tenants.businessHoursStart,
      businessHoursEnd: tenants.businessHoursEnd,
      businessHoursTimezone: tenants.businessHoursTimezone,
      businessHoursDays: tenants.businessHoursDays,
      teamLeadEmail: tenants.teamLeadEmail,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  return {
    id: tenant.id,
    name: tenant.name,
    subdomain: tenant.subdomain,
    logo_url: tenant.logoUrl ?? null,
    brand_color: tenant.brandColor ?? '#2563EB',
    support_email: tenant.supportEmail,
    business_hours_start: tenant.businessHoursStart,
    business_hours_end: tenant.businessHoursEnd,
    business_hours_timezone: tenant.businessHoursTimezone,
    business_hours_days: tenant.businessHoursDays,
    team_lead_email: tenant.teamLeadEmail ?? null,
    created_at: tenant.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Update Tenant Configuration
// ---------------------------------------------------------------------------

/**
 * Update the tenant configuration.
 * Only admins should call this function.
 * Throws NotFoundError if the tenant does not exist.
 */
export async function updateTenant(
  tenantId: string,
  input: UpdateTenantInput,
): Promise<Tenant> {
  const logger = getLogger();
  const db = getDb();

  // Verify tenant exists
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Tenant');
  }

  // Build update values
  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updateValues.name = input.name;
  if (input.brand_color !== undefined) updateValues.brandColor = input.brand_color;
  if (input.business_hours_start !== undefined)
    updateValues.businessHoursStart = input.business_hours_start;
  if (input.business_hours_end !== undefined)
    updateValues.businessHoursEnd = input.business_hours_end;
  if (input.business_hours_timezone !== undefined)
    updateValues.businessHoursTimezone = input.business_hours_timezone;
  if (input.business_hours_days !== undefined)
    updateValues.businessHoursDays = input.business_hours_days;
  if (input.team_lead_email !== undefined)
    updateValues.teamLeadEmail = input.team_lead_email;

  await db
    .update(tenants)
    .set(updateValues)
    .where(eq(tenants.id, tenantId));

  logger.info({ tenantId }, 'Tenant configuration updated');

  return getTenant(tenantId);
}

// ---------------------------------------------------------------------------
// Portal Configuration (Public)
// ---------------------------------------------------------------------------

/**
 * Get the public portal configuration for a given subdomain.
 * This is used by the client portal to display branding.
 * Throws NotFoundError if the subdomain is unknown.
 */
export async function getPortalConfig(subdomain: string): Promise<PortalConfig> {
  const db = getDb();

  const [tenant] = await db
    .select({
      name: tenants.name,
      logoUrl: tenants.logoUrl,
      brandColor: tenants.brandColor,
    })
    .from(tenants)
    .where(eq(tenants.subdomain, subdomain))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Portal');
  }

  return {
    name: tenant.name,
    logo_url: tenant.logoUrl ?? null,
    brand_color: tenant.brandColor ?? '#2563EB',
  };
}
