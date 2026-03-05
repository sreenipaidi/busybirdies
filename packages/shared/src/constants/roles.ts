export const USER_ROLES = ['admin', 'agent', 'client'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  agent: 'Agent',
  client: 'Client',
};
