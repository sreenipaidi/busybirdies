// API endpoint constants
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',
    google: '/auth/google',
    verifyEmail: '/auth/verify-email',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },
  tenants: {
    create: '/tenants',
  },
  users: {
    list: '/users',
    invite: '/users/invite',
    activate: '/users/activate',
    detail: (id: string) => `/users/${id}`,
  },
  tickets: {
    list: '/tickets',
    create: '/tickets',
    detail: (id: string) => `/tickets/${id}`,
    attachments: (id: string) => `/tickets/${id}/attachments`,
    downloadAttachment: (ticketId: string, attachmentId: string) => `/tickets/${ticketId}/attachments/${attachmentId}/download`,
    replies: (id: string) => `/tickets/${id}/replies`,
    audit: (id: string) => `/tickets/${id}/audit`,
    heartbeat: (id: string) => `/tickets/${id}/heartbeat`,
  },
  assignmentRules: {
    list: '/assignment-rules',
    create: '/assignment-rules',
    detail: (id: string) => `/assignment-rules/${id}`,
    reorder: '/assignment-rules/reorder',
  },
  agentGroups: {
    list: '/agent-groups',
    create: '/agent-groups',
    detail: (id: string) => `/agent-groups/${id}`,
    members: (id: string) => `/agent-groups/${id}/members`,
    removeMember: (groupId: string, userId: string) =>
      `/agent-groups/${groupId}/members/${userId}`,
  },
  slaPolicies: {
    list: '/sla-policies',
    detail: (id: string) => `/sla-policies/${id}`,
  },
  integrations: {
    slack: '/integrations/slack',
    slackTest: '/integrations/slack/test',
    jira: '/integrations/jira',
    jiraTest: '/integrations/jira/test',
  },
  cannedResponses: {
    list: '/canned-responses',
    create: '/canned-responses',
    detail: (id: string) => `/canned-responses/${id}`,
  },
  kb: {
    categories: '/kb/categories',
    categoryDetail: (id: string) => `/kb/categories/${id}`,
    articles: '/kb/articles',
    articleBySlug: (slug: string) => `/kb/articles/${slug}`,
    articleDetail: (id: string) => `/kb/articles/${id}`,
    articleFeedback: (id: string) => `/kb/articles/${id}/feedback`,
    search: '/kb/search',
  },
  reports: {
    team: '/reports/team',
    dashboard: '/reports/dashboard',
    agent: (id: string) => `/reports/agent/${id}`,
  },
  csat: {
    get: (token: string) => `/csat/${token}`,
    submit: (token: string) => `/csat/${token}`,
  },
  tenant: {
    get: '/tenant',
    update: '/tenant',
    uploadLogo: '/tenant/logo',
    portalConfig: '/tenant/portal-config',
  },
} as const;

