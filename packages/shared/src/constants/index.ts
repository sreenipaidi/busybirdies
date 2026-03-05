export * from './roles.js';
export * from './ticket-status.js';
export * from './ticket-priority.js';
export * from './sla-defaults.js';

export const TICKET_SOURCES = ['portal', 'email', 'agent'] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const REPLY_SOURCES = ['portal', 'email', 'agent_ui'] as const;
export type ReplySource = (typeof REPLY_SOURCES)[number];

export const ARTICLE_STATUSES = ['draft', 'published'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const RULE_ACTION_TYPES = ['assign_agent', 'assign_group'] as const;
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];

export const CONDITION_OPERATORS = ['equals', 'contains', 'includes'] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const CONDITION_FIELDS = ['priority', 'client_email_domain', 'subject', 'tags'] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];
