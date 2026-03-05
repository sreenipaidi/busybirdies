export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  brand_color: string;
  support_email: string;
  business_hours_start: string;
  business_hours_end: string;
  business_hours_timezone: string;
  business_hours_days: string;
  team_lead_email: string | null;
  created_at: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  subdomain: string;
  logo_url?: string | null;
  brand_color?: string;
}

export interface PortalConfig {
  name: string;
  logo_url: string | null;
  brand_color: string;
}
