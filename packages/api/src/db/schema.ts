import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  time,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ---- Tenants ----
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    subdomain: varchar('subdomain', { length: 63 }).notNull().unique(),
    logoUrl: varchar('logo_url', { length: 500 }),
    brandColor: varchar('brand_color', { length: 7 }).default('#2563EB'),
    supportEmail: varchar('support_email', { length: 255 }).notNull().unique(),
    businessHoursStart: time('business_hours_start').notNull().default('09:00'),
    businessHoursEnd: time('business_hours_end').notNull().default('17:00'),
    businessHoursTimezone: varchar('business_hours_timezone', { length: 50 })
      .notNull()
      .default('UTC'),
    businessHoursDays: varchar('business_hours_days', { length: 20 })
      .notNull()
      .default('1,2,3,4,5'),
    teamLeadEmail: varchar('team_lead_email', { length: 255 }),
    ticketCounter: integer('ticket_counter').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_tenants_subdomain').on(table.subdomain),
    uniqueIndex('idx_tenants_support_email').on(table.supportEmail),
  ],
);

// ---- Users ----
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    role: varchar('role', { length: 10 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    emailVerified: boolean('email_verified').notNull().default(false),
    googleId: varchar('google_id', { length: 255 }),
    activationToken: varchar('activation_token', { length: 255 }),
    activationTokenExpires: timestamp('activation_token_expires', { withTimezone: true }),
    passwordResetToken: varchar('password_reset_token', { length: 255 }),
    passwordResetTokenExpires: timestamp('password_reset_token_expires', { withTimezone: true }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_users_tenant_email').on(table.tenantId, table.email),
    index('idx_users_tenant_role').on(table.tenantId, table.role),
  ],
);

// ---- Agent Groups ----
export const agentGroups = pgTable(
  'agent_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_agent_groups_tenant_name').on(table.tenantId, table.name)],
);

// ---- Agent Group Memberships ----
export const agentGroupMemberships = pgTable(
  'agent_group_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentGroupId: uuid('agent_group_id')
      .notNull()
      .references(() => agentGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_agm_group_user').on(table.agentGroupId, table.userId),
    index('idx_agm_user').on(table.userId),
  ],
);

// ---- Assignment Rules ----
export const assignmentRules = pgTable(
  'assignment_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    priorityOrder: integer('priority_order').notNull(),
    conditions: jsonb('conditions').notNull(),
    conditionLogic: varchar('condition_logic', { length: 10 }).notNull().default('any'),
    actionType: varchar('action_type', { length: 15 }).notNull(),
    targetAgentId: uuid('target_agent_id').references(() => users.id),
    targetGroupId: uuid('target_group_id').references(() => agentGroups.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_rules_tenant_active_order').on(
      table.tenantId,
      table.isActive,
      table.priorityOrder,
    ),
  ],
);

// ---- Tickets ----
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    ticketNumber: varchar('ticket_number', { length: 20 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    description: text('description').notNull(),
    priority: varchar('priority', { length: 10 }).notNull().default('medium'),
    status: varchar('status', { length: 10 }).notNull().default('open'),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id),
    assignedByRuleId: uuid('assigned_by_rule_id').references(() => assignmentRules.id),
    slaFirstResponseDue: timestamp('sla_first_response_due', { withTimezone: true }),
    slaResolutionDue: timestamp('sla_resolution_due', { withTimezone: true }),
    slaFirstResponseMet: boolean('sla_first_response_met'),
    slaResolutionMet: boolean('sla_resolution_met'),
    firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    source: varchar('source', { length: 10 }).notNull().default('portal'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_tickets_tenant_number').on(table.tenantId, table.ticketNumber),
    index('idx_tickets_tenant_status').on(table.tenantId, table.status),
    index('idx_tickets_tenant_assigned').on(table.tenantId, table.assignedAgentId),
    index('idx_tickets_tenant_client').on(table.tenantId, table.clientId),
    index('idx_tickets_tenant_priority').on(table.tenantId, table.priority),
  ],
);

// ---- Ticket Tags ----
export const ticketTags = pgTable(
  'ticket_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_ticket_tags_ticket_tag').on(table.ticketId, table.tag),
    index('idx_ticket_tags_tag').on(table.tag),
  ],
);

// ---- Ticket Replies ----
export const ticketReplies = pgTable(
  'ticket_replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    isInternal: boolean('is_internal').notNull().default(false),
    source: varchar('source', { length: 10 }).notNull().default('agent_ui'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_replies_ticket_created').on(table.ticketId, table.createdAt)],
);

// ---- Ticket Audit Entries ----
export const ticketAuditEntries = pgTable(
  'ticket_audit_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    action: varchar('action', { length: 50 }).notNull(),
    fieldName: varchar('field_name', { length: 50 }),
    oldValue: varchar('old_value', { length: 500 }),
    newValue: varchar('new_value', { length: 500 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_audit_ticket_created').on(table.ticketId, table.createdAt)],
);

// ---- Ticket Attachments ----
export const ticketAttachments = pgTable(
  'ticket_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    replyId: uuid('reply_id').references(() => ticketReplies.id),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    uploadedById: uuid('uploaded_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_attachments_ticket').on(table.ticketId)],
);

// ---- SLA Policies ----
export const slaPolicies = pgTable(
  'sla_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    priority: varchar('priority', { length: 10 }).notNull(),
    firstResponseMinutes: integer('first_response_minutes').notNull(),
    resolutionMinutes: integer('resolution_minutes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_sla_tenant_priority').on(table.tenantId, table.priority)],
);

// ---- Canned Responses ----
export const cannedResponses = pgTable(
  'canned_responses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    title: varchar('title', { length: 100 }).notNull(),
    body: text('body').notNull(),
    category: varchar('category', { length: 50 }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_canned_tenant').on(table.tenantId),
    index('idx_canned_tenant_category').on(table.tenantId, table.category),
  ],
);

// ---- KB Categories ----
export const kbCategories = pgTable(
  'kb_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_kb_categories_tenant_name').on(table.tenantId, table.name),
    index('idx_kb_categories_tenant_order').on(table.tenantId, table.displayOrder),
  ],
);

// ---- KB Articles ----
export const kbArticles = pgTable(
  'kb_articles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => kbCategories.id),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 220 }).notNull(),
    body: text('body').notNull(),
    status: varchar('status', { length: 10 }).notNull().default('draft'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    helpfulYesCount: integer('helpful_yes_count').notNull().default(0),
    helpfulNoCount: integer('helpful_no_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_kb_articles_tenant_slug').on(table.tenantId, table.slug),
    index('idx_kb_articles_tenant_category_status').on(
      table.tenantId,
      table.categoryId,
      table.status,
    ),
  ],
);

// ---- CSAT Responses ----
export const csatResponses = pgTable(
  'csat_responses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .unique()
      .references(() => tickets.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    rating: integer('rating'),
    comment: varchar('comment', { length: 500 }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_csat_token').on(table.token),
    index('idx_csat_tenant_responded').on(table.tenantId, table.respondedAt),
  ],
);

// ---- Ticket View Heartbeats ----
export const ticketViewHeartbeats = pgTable(
  'ticket_view_heartbeats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    isComposing: boolean('is_composing').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_heartbeat_ticket_user').on(table.ticketId, table.userId),
    index('idx_heartbeat_ticket_seen').on(table.ticketId, table.lastSeenAt),
  ],
);
