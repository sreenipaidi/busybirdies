-- ============================================================
-- BusyBirdies Demo Data Seed Script
-- Cleans all data and creates rich demo data showcasing
-- all product capabilities including Slack & Jira integrations
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. CLEAN UP ALL EXISTING DATA (order matters for FKs)
-- ─────────────────────────────────────────────
TRUNCATE TABLE
  csat_responses,
  ticket_attachments,
  ticket_view_heartbeats,
  ticket_audit_entries,
  ticket_replies,
  ticket_tags,
  tickets,
  canned_responses,
  assignment_rules,
  agent_group_memberships,
  agent_groups,
  sla_policies,
  kb_articles,
  kb_categories,
  tenant_integrations,

  users,
  tenants
CASCADE;

-- ─────────────────────────────────────────────
-- 2. TENANTS
-- ─────────────────────────────────────────────
-- TechFlow SaaS (primary demo tenant - full featured)
INSERT INTO tenants (id, name, subdomain, support_email, business_hours_start, business_hours_end, created_at, updated_at)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'TechFlow SaaS', 'techflow', 'support@techflow.io', '09:00', '17:00', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Retail Rocket', 'retailrocket', 'help@retailrocket.com', '08:00', '18:00', now(), now());

-- ─────────────────────────────────────────────
-- 3. USERS (password = 'Password123!' for all)
-- bcrypt hash of 'Password123!'
-- ─────────────────────────────────────────────
-- TechFlow Users
INSERT INTO users (id, tenant_id, email, full_name, password_hash, role, is_active, email_verified, created_at, updated_at)
VALUES
  -- Admin
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin@techflow.io', 'Sarah Chen', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', true, true, now() - interval '90 days', now()),
  -- Agents
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'marcus@techflow.io', 'Marcus Lee', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', true, true, now() - interval '80 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'priya@techflow.io', 'Priya Patel', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', true, true, now() - interval '75 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'james@techflow.io', 'James Wright', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', true, true, now() - interval '60 days', now()),
  -- Clients
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'alice@acmecorp.com', 'Alice Johnson', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', true, true, now() - interval '60 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'bob@globex.com', 'Bob Martinez', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', true, true, now() - interval '55 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 'carol@initech.com', 'Carol Smith', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', true, true, now() - interval '45 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001', 'david@umbrella.com', 'David Kim', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', true, true, now() - interval '30 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'emma@hooli.com', 'Emma Davis', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', true, true, now() - interval '20 days', now()),
  -- Retail Rocket Users
  ('bbbbbbbb-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000002', 'admin@retailrocket.com', 'Tom Bradley', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', true, true, now() - interval '60 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002', 'agent@retailrocket.com', 'Lisa Park', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', true, true, now() - interval '50 days', now()),
  ('bbbbbbbb-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000002', 'client@retailrocket.com', 'John Buyer', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', true, true, now() - interval '40 days', now());

-- ─────────────────────────────────────────────
-- 4. SLA POLICIES
-- ─────────────────────────────────────────────
INSERT INTO sla_policies (id, tenant_id, priority, first_response_minutes, resolution_minutes, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'urgent', 30,   240, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'high',   120,  480, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'medium', 480,  1440, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'low',    1440, 4320, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', 'urgent', 60,   480, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', 'high',   240,  960, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', 'medium', 720,  2880, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', 'low',    2880, 7200, now(), now());

-- ─────────────────────────────────────────────
-- 5. ASSIGNMENT RULES
-- ─────────────────────────────────────────────
INSERT INTO assignment_rules (id, tenant_id, name, conditions, condition_logic, action_type, target_agent_id, is_active, priority_order, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Urgent tickets → Marcus',
   '[{"field":"priority","operator":"equals","value":"urgent"}]', 'any',
   'assign_agent', 'bbbbbbbb-0000-0000-0000-000000000002', true, 1, now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Billing issues → Priya',
   '[{"field":"subject","operator":"contains","value":"billing"},{"field":"subject","operator":"contains","value":"invoice"},{"field":"subject","operator":"contains","value":"payment"}]', 'any',
   'assign_agent', 'bbbbbbbb-0000-0000-0000-000000000003', true, 2, now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'API & Integration issues → James',
   '[{"field":"subject","operator":"contains","value":"api"},{"field":"subject","operator":"contains","value":"integration"},{"field":"subject","operator":"contains","value":"webhook"}]', 'any',
   'assign_agent', 'bbbbbbbb-0000-0000-0000-000000000004', true, 3, now(), now());

-- ─────────────────────────────────────────────
-- 6. CANNED RESPONSES
-- ─────────────────────────────────────────────
INSERT INTO canned_responses (id, tenant_id, title, body, category, created_by_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
   'Thank you for reaching out',
   'Hi {{customer_name}},

Thank you for contacting TechFlow support. We''ve received your request and our team is looking into it right away.

You can expect to hear back from us within our SLA window. In the meantime, feel free to check our Knowledge Base for instant answers.

Best regards,
TechFlow Support Team', 'Greeting', 'bbbbbbbb-0000-0000-0000-000000000001', now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
   'Need more information',
   'Hi {{customer_name}},

Thank you for reaching out to us. To help you more effectively, could you please provide the following details:

1. The exact error message you are seeing
2. Steps to reproduce the issue
3. Your account ID or email address
4. Browser/OS version (if applicable)

Any screenshots or screen recordings would also be very helpful. Looking forward to your response!

Best regards,
TechFlow Support Team', 'Clarification', 'bbbbbbbb-0000-0000-0000-000000000001', now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
   'Issue resolved',
   'Hi {{customer_name}},

Great news! We''ve resolved the issue you reported. Here''s a summary of what was done:

{{resolution_summary}}

Please test this on your end and let us know if everything is working as expected. If you experience any further issues, don''t hesitate to reach out.

Best regards,
TechFlow Support Team', 'Resolution', 'bbbbbbbb-0000-0000-0000-000000000002', now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
   'Escalating to engineering',
   'Hi {{customer_name}},

Thank you for your patience. After investigating this issue, we''ve determined that this requires input from our engineering team.

We''ve escalated your ticket with high priority and our engineers are now aware of the situation. We''ll keep you updated as we make progress.

Expected resolution time: {{eta}}

Best regards,
TechFlow Support Team', 'Escalation', 'bbbbbbbb-0000-0000-0000-000000000001', now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
   'Following up on your request',
   'Hi {{customer_name}},

We wanted to follow up on your recent support request. Has the issue been resolved to your satisfaction?

If you''re still experiencing problems or have any further questions, please don''t hesitate to reply to this message — we''re happy to help.

Best regards,
TechFlow Support Team', 'Follow-up', 'bbbbbbbb-0000-0000-0000-000000000003', now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
   'Billing refund processed',
   'Hi {{customer_name}},

We have processed your refund of {{amount}} to your original payment method. Please allow 5-7 business days for the amount to appear on your statement.

Your updated invoice is attached to this ticket for your records.

Best regards,
TechFlow Support Team', 'Billing', 'bbbbbbbb-0000-0000-0000-000000000003', now(), now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
   'API rate limit explanation',
   'Hi {{customer_name}},

Thank you for reaching out about API rate limits. Here''s how our rate limiting works:

- **Free plan**: 100 requests/minute
- **Growth plan**: 1,000 requests/minute
- **Enterprise plan**: 10,000 requests/minute

If you''re hitting limits frequently, you may want to consider:
1. Implementing exponential backoff
2. Caching responses where possible
3. Upgrading your plan

Let me know if you have any questions!

Best regards,
TechFlow Support Team', 'Technical', 'bbbbbbbb-0000-0000-0000-000000000004', now(), now());

-- ─────────────────────────────────────────────
-- 7. KNOWLEDGE BASE CATEGORIES & ARTICLES
-- ─────────────────────────────────────────────
INSERT INTO kb_categories (id, tenant_id, name, description, display_order, created_at, updated_at)
VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Getting Started', 'New to TechFlow? Start here.', 1, now(), now()),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Billing & Payments', 'Invoices, refunds, and subscription management.', 2, now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'API & Integrations', 'API docs, webhooks, and third-party integrations.', 3, now(), now()),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Troubleshooting', 'Common issues and how to fix them.', 4, now(), now());

INSERT INTO kb_articles (id, tenant_id, category_id, title, slug, body, status, author_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'How to get started with TechFlow',
   'how-to-get-started-with-techflow',
   '# Getting Started with TechFlow

Welcome to TechFlow! This guide will help you get up and running in minutes.

## Step 1: Create your account
Sign up at techflow.io and verify your email address.

## Step 2: Set up your workspace
Configure your team settings, invite agents, and customize your portal.

## Step 3: Connect your channels
Add your support email, Slack, and Jira integrations from the Integrations settings page.

## Step 4: Create your first ticket
You can create tickets manually or let customers submit them via the client portal.

If you need help at any step, our support team is here for you!',
   'published', 'bbbbbbbb-0000-0000-0000-000000000001', now() - interval '60 days', now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002',
   'Understanding your invoice',
   'understanding-your-invoice',
   '# Understanding Your TechFlow Invoice

Your monthly invoice includes charges for your subscription plan plus any add-ons.

## Invoice sections

**Subscription**: Your base plan cost based on the number of agents.

**Add-ons**: Any additional features or seats added during the billing period.

**Taxes**: Applicable taxes based on your location.

## Payment methods accepted
- Credit/debit cards (Visa, Mastercard, Amex)
- ACH bank transfer (US only)
- Wire transfer (Enterprise plans)

## Need a refund?
Contact our billing team and we will process your refund within 5-7 business days.',
   'published', 'bbbbbbbb-0000-0000-0000-000000000003', now() - interval '45 days', now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003',
   'Getting started with the TechFlow API',
   'getting-started-with-the-techflow-api',
   '# TechFlow REST API Guide

Our REST API lets you integrate TechFlow into your own applications.

## Authentication
All API requests require a Bearer token in the Authorization header:
```
Authorization: Bearer your_api_token
```

## Base URL
```
https://api.techflow.io/v1
```

## Rate Limits
- Free: 100 req/min
- Growth: 1,000 req/min
- Enterprise: 10,000 req/min

## Key Endpoints
- `GET /tickets` — List all tickets
- `POST /tickets` — Create a ticket
- `GET /tickets/:id` — Get ticket details
- `PATCH /tickets/:id` — Update a ticket

Full API documentation is available at docs.techflow.io',
   'published', 'bbbbbbbb-0000-0000-0000-000000000004', now() - interval '30 days', now()),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000004',
   'Common login issues and solutions',
   'common-login-issues-and-solutions',
   '# Troubleshooting Login Issues

Having trouble logging in? Here are the most common issues and how to fix them.

## Forgot your password?
Click "Forgot password" on the login page and enter your email. You will receive a reset link within 5 minutes.

## Account locked?
After 5 failed attempts, accounts are temporarily locked for 15 minutes. Wait and try again.

## Email not verified?
Check your spam folder for the verification email. You can also request a new verification email from the login page.

## Still having issues?
Contact our support team with your account email and we will get you back in within the hour.',
   'published', 'bbbbbbbb-0000-0000-0000-000000000002', now() - interval '20 days', now());

-- ─────────────────────────────────────────────
-- 8. INTEGRATIONS (Slack & Jira - keeping real config structure)
-- ─────────────────────────────────────────────
INSERT INTO tenant_integrations (id, tenant_id, type, config, enabled, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'slack',
   '{"webhookUrl": "https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK_URLxgh6wEJWpi4sk2PKKpQN9", "channel": "#support-alerts", "notifyOnPriorities": ["urgent", "high"]}',
   true, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'jira',
   '{"baseUrl": "https://busybirdies.atlassian.net", "email": "2busybirdies@gmail.com", "apiToken": "YOUR_ATLASSIAN_API_TOKEN", "projectKey": "BCS", "issueType": "Task"}',
   true, now(), now());

-- ─────────────────────────────────────────────
-- 9. TICKETS (diverse set showcasing all features)
-- ─────────────────────────────────────────────

-- TICKET 1: Urgent - Production outage (open, assigned to Marcus)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, first_responded_at, jira_issue_key, jira_issue_url, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00001',
  'URGENT: Production API completely down - all requests failing',
  'Our entire production environment is down. All API calls are returning 503 errors. This is affecting all of our customers and we are losing revenue by the minute. We have tried restarting services but nothing has helped. This started approximately 30 minutes ago.',
  'urgent', 'open',
  'bbbbbbbb-0000-0000-0000-000000000005',
  'bbbbbbbb-0000-0000-0000-000000000005',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'portal',
  now() + interval '15 minutes',
  now() + interval '3 hours',
  null, null,
  'BCS-1', 'https://busybirdies.atlassian.net/browse/BCS-1',
  now() - interval '25 minutes', now() - interval '25 minutes'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'production', now()),
  ('dddddddd-0000-0000-0000-000000000001', 'outage', now()),
  ('dddddddd-0000-0000-0000-000000000001', 'api', now());

-- TICKET 2: High - Billing dispute (open, assigned to Priya)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, first_responded_at, jira_issue_key, jira_issue_url, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00002',
  'Incorrect billing charge - charged twice for same invoice',
  'I noticed that I have been charged twice for invoice #INV-2026-0892. Both charges of $299 appeared on my credit card statement on March 15th. I need an immediate refund for the duplicate charge. My account ID is ACC-4821.',
  'high', 'open',
  'bbbbbbbb-0000-0000-0000-000000000006',
  'bbbbbbbb-0000-0000-0000-000000000006',
  'bbbbbbbb-0000-0000-0000-000000000003',
  'portal',
  now() + interval '1 hour',
  now() + interval '7 hours',
  null, null,
  'BCS-2', 'https://busybirdies.atlassian.net/browse/BCS-2',
  now() - interval '2 hours', now() - interval '2 hours'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000002', 'billing', now()),
  ('dddddddd-0000-0000-0000-000000000002', 'refund', now());

-- TICKET 3: High - Webhook integration broken (open, assigned to James)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, first_responded_at, jira_issue_key, jira_issue_url, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00003',
  'Webhook integration stopped delivering events after last update',
  'Since the platform update on March 20th, our webhook endpoint is no longer receiving events. We have verified that our endpoint is live and accepting connections. The webhook was working perfectly before the update. We rely on these events for our order processing pipeline and this is causing significant business impact.',
  'high', 'pending',
  'bbbbbbbb-0000-0000-0000-000000000007',
  'bbbbbbbb-0000-0000-0000-000000000007',
  'bbbbbbbb-0000-0000-0000-000000000004',
  'portal',
  now() - interval '1 hour',
  now() + interval '5 hours',
  true,
  now() - interval '3 hours',
  'BCS-3', 'https://busybirdies.atlassian.net/browse/BCS-3',
  now() - interval '5 hours', now() - interval '1 hour'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000003', 'webhook', now()),
  ('dddddddd-0000-0000-0000-000000000003', 'integration', now()),
  ('dddddddd-0000-0000-0000-000000000003', 'api', now());

-- TICKET 4: Medium - Feature request (open, unassigned)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, first_responded_at, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000004',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00004',
  'Feature request: Export tickets to CSV',
  'It would be really useful to have the ability to export tickets to CSV format for our monthly reporting. We currently have to manually compile this data which takes several hours each month. Ideally we would like to filter by date range, status, and priority before exporting.',
  'medium', 'open',
  'bbbbbbbb-0000-0000-0000-000000000008',
  'bbbbbbbb-0000-0000-0000-000000000008',
  null,
  'portal',
  now() + interval '6 hours',
  now() + interval '2 days',
  null, null,
  now() - interval '1 day', now() - interval '1 day'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000004', 'feature-request', now()),
  ('dddddddd-0000-0000-0000-000000000004', 'reporting', now());

-- TICKET 5: Medium - Login issues (pending, assigned to Marcus)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, first_responded_at, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00005',
  'Cannot login - two-factor authentication not working',
  'I have been trying to log in for the past hour but the two-factor authentication code is not being accepted. I have verified that my phone time is correct and I have tried regenerating codes multiple times. I need access urgently as I have a client presentation in 2 hours.',
  'medium', 'pending',
  'bbbbbbbb-0000-0000-0000-000000000009',
  'bbbbbbbb-0000-0000-0000-000000000009',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'portal',
  now() - interval '2 hours',
  now() + interval '22 hours',
  true,
  now() - interval '4 hours',
  now() - interval '6 hours', now() - interval '30 minutes'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000005', 'login', now()),
  ('dddddddd-0000-0000-0000-000000000005', '2fa', now());

-- TICKET 6: Low - General question (resolved, assigned to Priya)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, sla_resolution_met, first_responded_at, resolved_at, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000006',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00006',
  'How do I add additional team members to my account?',
  'I would like to add 3 more support agents to our TechFlow account. We are on the Growth plan. Can you walk me through the process? Also, will there be any additional charges for the new seats?',
  'low', 'resolved',
  'bbbbbbbb-0000-0000-0000-000000000005',
  'bbbbbbbb-0000-0000-0000-000000000005',
  'bbbbbbbb-0000-0000-0000-000000000003',
  'portal',
  now() - interval '3 days',
  now() - interval '2 days',
  true, true,
  now() - interval '3 days' + interval '1 hour',
  now() - interval '2 days',
  now() - interval '3 days', now() - interval '2 days'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000006', 'account', now()),
  ('dddddddd-0000-0000-0000-000000000006', 'billing', now());

-- TICKET 7: Urgent - Data breach concern (open, assigned to Marcus)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, first_responded_at, jira_issue_key, jira_issue_url, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000007',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00007',
  'URGENT: Suspicious activity detected on our account',
  'We have detected suspicious login activity on our account from an IP address in a foreign country. Multiple unauthorized access attempts were logged at 3am this morning. We are concerned about a potential security breach. Please help us secure our account immediately and review any recent data access.',
  'urgent', 'open',
  'bbbbbbbb-0000-0000-0000-000000000006',
  'bbbbbbbb-0000-0000-0000-000000000006',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'email',
  now() + interval '5 minutes',
  now() + interval '3.5 hours',
  null, null,
  'BCS-4', 'https://busybirdies.atlassian.net/browse/BCS-4',
  now() - interval '10 minutes', now() - interval '10 minutes'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000007', 'security', now()),
  ('dddddddd-0000-0000-0000-000000000007', 'urgent', now());

-- TICKET 8: High - Performance issue (pending, assigned to James)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, first_responded_at, jira_issue_key, jira_issue_url, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000008',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00008',
  'API response times degraded - 10x slower than usual',
  'Over the past 48 hours our API response times have increased from an average of 120ms to over 1200ms. This is severely impacting our user experience. Our monitoring shows this affects all endpoints but is worst on the /search and /reports endpoints. We have attached performance logs for your review.',
  'high', 'pending',
  'bbbbbbbb-0000-0000-0000-000000000007',
  'bbbbbbbb-0000-0000-0000-000000000007',
  'bbbbbbbb-0000-0000-0000-000000000004',
  'portal',
  now() - interval '30 minutes',
  now() + interval '6 hours',
  true,
  now() - interval '2 hours',
  'BCS-5', 'https://busybirdies.atlassian.net/browse/BCS-5',
  now() - interval '1 day', now() - interval '30 minutes'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000008', 'performance', now()),
  ('dddddddd-0000-0000-0000-000000000008', 'api', now());

-- TICKET 9: Medium - Onboarding help (resolved, closed)
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, sla_resolution_met, first_responded_at, resolved_at, closed_at, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000009',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00009',
  'Help setting up SSO with Okta',
  'We are trying to configure Single Sign-On with Okta for our team but are getting stuck at the SAML configuration step. We have followed the documentation but the authentication keeps failing with an invalid certificate error.',
  'medium', 'closed',
  'bbbbbbbb-0000-0000-0000-000000000008',
  'bbbbbbbb-0000-0000-0000-000000000008',
  'bbbbbbbb-0000-0000-0000-000000000004',
  'portal',
  now() - interval '5 days',
  now() - interval '4 days',
  true, true,
  now() - interval '5 days' + interval '45 minutes',
  now() - interval '4 days',
  now() - interval '3 days',
  now() - interval '6 days', now() - interval '3 days'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000009', 'sso', now()),
  ('dddddddd-0000-0000-0000-000000000009', 'onboarding', now()),
  ('dddddddd-0000-0000-0000-000000000009', 'integration', now());

-- TICKET 10: Low - Resolved billing question
INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, sla_first_response_due, sla_resolution_due, sla_first_response_met, sla_resolution_met, first_responded_at, resolved_at, created_at, updated_at)
VALUES (
  'dddddddd-0000-0000-0000-000000000010',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'TKT-00010',
  'Request for annual billing discount',
  'We have been a TechFlow customer for 8 months and are very happy with the service. We would like to switch to annual billing and wanted to know what discount is available. We are currently on the Growth plan.',
  'low', 'resolved',
  'bbbbbbbb-0000-0000-0000-000000000009',
  'bbbbbbbb-0000-0000-0000-000000000009',
  'bbbbbbbb-0000-0000-0000-000000000003',
  'portal',
  now() - interval '7 days',
  now() - interval '5 days',
  true, true,
  now() - interval '7 days' + interval '2 hours',
  now() - interval '5 days',
  now() - interval '8 days', now() - interval '5 days'
);

INSERT INTO ticket_tags (ticket_id, tag, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000010', 'billing', now()),
  ('dddddddd-0000-0000-0000-000000000010', 'account', now());

-- ─────────────────────────────────────────────
-- 10. TICKET REPLIES
-- ─────────────────────────────────────────────

-- Replies for TKT-00003 (Webhook issue - pending)
INSERT INTO ticket_replies (id, ticket_id, user_id, body, is_internal, source, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000004',
   'Hi Carol, thank you for reaching out. I can see from our logs that the webhook delivery system did have a configuration change in the March 20th update. I''m looking into this now and will have an update for you within the hour.',
   false, 'agent_ui', now() - interval '4 hours', now() - interval '4 hours'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000004',
   'INTERNAL NOTE: Confirmed issue with webhook signature verification after the TLS certificate rotation. Affected tenants: ACC-1821, ACC-2234, ACC-4821. Fix is being tested now. ETA 2 hours.',
   true, 'agent_ui', now() - interval '3 hours', now() - interval '3 hours'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000007',
   'Thank you for the quick response! Just to confirm - this is affecting our production webhook at https://api.ourcompany.com/webhooks/techflow. We have not received any events since 11pm on March 20th.',
   false, 'portal', now() - interval '2 hours', now() - interval '2 hours'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000004',
   'Hi Carol, we have identified the root cause. Our March 20th update changed the webhook signature algorithm from HMAC-SHA1 to HMAC-SHA256 for improved security. You will need to update your signature verification code to use SHA256. I''m attaching the updated documentation. The fix on our end is also being deployed now which will temporarily support both algorithms during the transition period.',
   false, 'agent_ui', now() - interval '1 hour', now() - interval '1 hour');

-- Replies for TKT-00005 (2FA issue - pending)
INSERT INTO ticket_replies (id, ticket_id, user_id, body, is_internal, source, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000005',
   'bbbbbbbb-0000-0000-0000-000000000002',
   'Hi Emma, I understand how urgent this is with your upcoming presentation. Let me help you right away. Can you tell me which authenticator app you are using? Also, have you tried using a backup code from your account settings?',
   false, 'agent_ui', now() - interval '4 hours', now() - interval '4 hours'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000005',
   'bbbbbbbb-0000-0000-0000-000000000009',
   'I am using Google Authenticator. I do not have backup codes saved unfortunately. I set up 2FA 6 months ago and never needed them until now.',
   false, 'portal', now() - interval '3.5 hours', now() - interval '3.5 hours'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000005',
   'bbbbbbbb-0000-0000-0000-000000000002',
   'No problem Emma. I can see your account is in good standing. I have sent an account recovery link to your registered email address (e**a@hooli.com). This link will allow you to temporarily bypass 2FA and access your account. The link expires in 30 minutes. Please also save your backup codes once you are logged in!',
   false, 'agent_ui', now() - interval '3 hours', now() - interval '3 hours'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000005',
   'bbbbbbbb-0000-0000-0000-000000000009',
   'That worked perfectly! I am in now and have saved my backup codes. Thank you so much for the quick help - you saved my presentation!',
   false, 'portal', now() - interval '2.5 hours', now() - interval '2.5 hours');

-- Replies for TKT-00006 (Adding team members - resolved)
INSERT INTO ticket_replies (id, ticket_id, user_id, body, is_internal, source, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000006',
   'bbbbbbbb-0000-0000-0000-000000000003',
   'Hi Alice! Great question. Adding team members is easy. Go to Settings → Users → Invite Agent and enter their email addresses. On your Growth plan, each additional agent beyond your base 5 seats is $15/month per agent billed on your next invoice. Would you like me to walk you through any specific step?',
   false, 'agent_ui', now() - interval '3 days' + interval '1 hour', now() - interval '3 days'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000006',
   'bbbbbbbb-0000-0000-0000-000000000005',
   'Perfect, thank you! That is very helpful. I have sent the invites and they have all accepted. The pricing is very reasonable too.',
   false, 'portal', now() - interval '2 days' + interval '2 hours', now() - interval '2 days'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000006',
   'bbbbbbbb-0000-0000-0000-000000000003',
   'Wonderful! Glad I could help Alice. I have marked this ticket as resolved. Do not hesitate to reach out if you need anything else!',
   false, 'agent_ui', now() - interval '2 days');

-- Replies for TKT-00009 (SSO setup - closed)
INSERT INTO ticket_replies (id, ticket_id, user_id, body, is_internal, source, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000009',
   'bbbbbbbb-0000-0000-0000-000000000004',
   'Hi David! I can help with the Okta SSO setup. The invalid certificate error usually means the X.509 certificate in Okta is not matching what TechFlow expects. Here are the steps: 1) In Okta, go to your app → Sign On → Edit → SAML Settings. 2) Make sure you are using SHA-256 as the signature algorithm. 3) Download the certificate from Okta and re-upload it in TechFlow under Settings → Security → SSO.',
   false, 'agent_ui', now() - interval '5 days' + interval '45 minutes', now() - interval '5 days'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000009',
   'bbbbbbbb-0000-0000-0000-000000000008',
   'That fixed it! The SHA-256 setting was the issue. SSO is now working perfectly for all our team members. Thank you!',
   false, 'portal', now() - interval '4 days'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000009',
   'bbbbbbbb-0000-0000-0000-000000000004',
   'Excellent! Glad that resolved it David. I have marked this as resolved. For future reference, you can find our full SSO setup guide in the Knowledge Base under Getting Started → Enterprise Features.',
   false, 'agent_ui', now() - interval '4 days');

-- Replies for TKT-00010 (Annual billing - resolved)
INSERT INTO ticket_replies (id, ticket_id, user_id, body, is_internal, source, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000010',
   'bbbbbbbb-0000-0000-0000-000000000003',
   'Hi Emma! Thank you for being a loyal TechFlow customer. We offer a 20% discount on annual billing which would bring your Growth plan from $79/month to $63.20/month (billed annually at $758.40). This would save you $189.60 per year. Would you like me to switch your account to annual billing?',
   false, 'agent_ui', now() - interval '7 days' + interval '2 hours', now() - interval '7 days'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000010',
   'bbbbbbbb-0000-0000-0000-000000000009',
   'That sounds great! Yes please go ahead and switch us to annual billing. Thank you for the discount!',
   false, 'portal', now() - interval '6 days'),

  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000010',
   'bbbbbbbb-0000-0000-0000-000000000003',
   'Done! I have switched your account to annual billing and applied the 20% discount. Your next payment of $758.40 will be charged on April 15th. You will receive a confirmation email with the updated invoice shortly.',
   false, 'agent_ui', now() - interval '5 days');

-- ─────────────────────────────────────────────
-- 11. AUDIT TRAIL
-- ─────────────────────────────────────────────
INSERT INTO ticket_audit_entries (id, ticket_id, user_id, action, field_name, old_value, new_value, created_at)
VALUES
  -- TKT-00003 audit
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004', 'assigned', 'assigned_agent_id', null, 'James Wright', now() - interval '5 hours'),
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004', 'status_changed', 'status', 'open', 'pending', now() - interval '1 hour'),
  -- TKT-00005 audit
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 'assigned', 'assigned_agent_id', null, 'Marcus Lee', now() - interval '6 hours'),
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 'status_changed', 'status', 'open', 'pending', now() - interval '3 hours'),
  -- TKT-00006 audit
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000003', 'assigned', 'assigned_agent_id', null, 'Priya Patel', now() - interval '3 days'),
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000003', 'status_changed', 'status', 'open', 'resolved', now() - interval '2 days'),
  -- TKT-00009 audit
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000004', 'assigned', 'assigned_agent_id', null, 'James Wright', now() - interval '6 days'),
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000004', 'status_changed', 'status', 'open', 'resolved', now() - interval '4 days'),
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000001', 'status_changed', 'status', 'resolved', 'closed', now() - interval '3 days'),
  -- TKT-00010 audit
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000010', 'bbbbbbbb-0000-0000-0000-000000000003', 'assigned', 'assigned_agent_id', null, 'Priya Patel', now() - interval '8 days'),
  (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000010', 'bbbbbbbb-0000-0000-0000-000000000003', 'status_changed', 'status', 'open', 'resolved', now() - interval '5 days');

-- ─────────────────────────────────────────────
-- 12. CSAT RESPONSES (for resolved/closed tickets)
-- ─────────────────────────────────────────────
INSERT INTO csat_responses (id, tenant_id, ticket_id, rating, comment, responded_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000006',
   5, 'Priya was incredibly helpful and answered all my questions clearly. Best support experience I have had!',
   now() - interval '1 day', now() - interval '2 days', now() - interval '1 day'),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000009',
   5, 'Issue was resolved very quickly. The agent knew exactly what the problem was and fixed it immediately.',
   now() - interval '2 days', now() - interval '3 days'),

  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000010',
   4, 'Good support, got a nice discount on annual billing. Response time could have been a bit faster.',
   now() - interval '4 days', now() - interval '5 days');

-- ─────────────────────────────────────────────
-- 13. RETAIL ROCKET DEMO DATA
-- ─────────────────────────────────────────────
INSERT INTO sla_policies (id, tenant_id, priority, first_response_minutes, resolution_minutes, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', 'urgent', 60,   480, now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', 'high',   240,  960, now(), now());

INSERT INTO tickets (id, tenant_id, ticket_number, subject, description, priority, status, client_id, created_by_id, assigned_agent_id, source, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', 'TKT-00001',
   'Order #98234 not received after 2 weeks',
   'I placed an order two weeks ago and it has not arrived yet. The tracking number shows it has been stuck at a distribution center for 10 days.',
   'high', 'open',
   'bbbbbbbb-0000-0000-0000-000000000012',
   'bbbbbbbb-0000-0000-0000-000000000012',
   'bbbbbbbb-0000-0000-0000-000000000011',
   'portal',
   now() - interval '1 day', now() - interval '1 day');

COMMIT;

-- ─────────────────────────────────────────────
-- SUMMARY
-- ─────────────────────────────────────────────
SELECT 'TENANTS' as entity, count(*) FROM tenants
UNION ALL SELECT 'USERS', count(*) FROM users
UNION ALL SELECT 'TICKETS', count(*) FROM tickets
UNION ALL SELECT 'REPLIES', count(*) FROM ticket_replies
UNION ALL SELECT 'CSAT RESPONSES', count(*) FROM csat_responses
UNION ALL SELECT 'KB ARTICLES', count(*) FROM kb_articles
UNION ALL SELECT 'CANNED RESPONSES', count(*) FROM canned_responses
UNION ALL SELECT 'ASSIGNMENT RULES', count(*) FROM assignment_rules
UNION ALL SELECT 'INTEGRATIONS', count(*) FROM tenant_integrations;
