import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateRule,
  evaluateRules,
} from './rule-evaluator.js';
import type { EvalCondition, EvalRule, TicketContext } from './rule-evaluator.js';

describe('Rule Evaluator', () => {
  // ---- evaluateCondition ----

  describe('evaluateCondition', () => {
    const baseTicket: TicketContext = {
      priority: 'high',
      subject: 'Cannot access billing dashboard',
      client_email: 'priya@acmecorp.com',
      tags: ['billing', 'login'],
    };

    describe('priority field', () => {
      it('should return true when priority equals the value', () => {
        const condition: EvalCondition = {
          field: 'priority',
          operator: 'equals',
          value: 'high',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should return true when priority matches case-insensitively', () => {
        const condition: EvalCondition = {
          field: 'priority',
          operator: 'equals',
          value: 'HIGH',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should return false when priority does not match', () => {
        const condition: EvalCondition = {
          field: 'priority',
          operator: 'equals',
          value: 'low',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(false);
      });

      it('should return false for unsupported operator on priority', () => {
        const condition: EvalCondition = {
          field: 'priority',
          operator: 'contains',
          value: 'high',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(false);
      });
    });

    describe('subject field', () => {
      it('should return true when subject contains the value', () => {
        const condition: EvalCondition = {
          field: 'subject',
          operator: 'contains',
          value: 'billing',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should be case-insensitive for subject contains', () => {
        const condition: EvalCondition = {
          field: 'subject',
          operator: 'contains',
          value: 'BILLING',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should return false when subject does not contain the value', () => {
        const condition: EvalCondition = {
          field: 'subject',
          operator: 'contains',
          value: 'shipping',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(false);
      });

      it('should support equals operator for exact subject match', () => {
        const condition: EvalCondition = {
          field: 'subject',
          operator: 'equals',
          value: 'cannot access billing dashboard',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should return false for partial match with equals operator', () => {
        const condition: EvalCondition = {
          field: 'subject',
          operator: 'equals',
          value: 'billing',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(false);
      });
    });

    describe('client_email_domain field', () => {
      it('should return true when email domain equals the value', () => {
        const condition: EvalCondition = {
          field: 'client_email_domain',
          operator: 'equals',
          value: 'acmecorp.com',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should be case-insensitive for email domain', () => {
        const condition: EvalCondition = {
          field: 'client_email_domain',
          operator: 'equals',
          value: 'ACMECORP.COM',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should return false when email domain does not match', () => {
        const condition: EvalCondition = {
          field: 'client_email_domain',
          operator: 'equals',
          value: 'othercorp.com',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(false);
      });

      it('should support contains operator for partial domain match', () => {
        const condition: EvalCondition = {
          field: 'client_email_domain',
          operator: 'contains',
          value: 'acme',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should handle email without domain gracefully', () => {
        const ticket: TicketContext = { ...baseTicket, client_email: 'nodomain' };
        const condition: EvalCondition = {
          field: 'client_email_domain',
          operator: 'equals',
          value: 'example.com',
        };
        expect(evaluateCondition(condition, ticket)).toBe(false);
      });
    });

    describe('tags field', () => {
      it('should return true when tags include the value', () => {
        const condition: EvalCondition = {
          field: 'tags',
          operator: 'includes',
          value: 'billing',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should be case-insensitive for tag matching', () => {
        const condition: EvalCondition = {
          field: 'tags',
          operator: 'includes',
          value: 'BILLING',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(true);
      });

      it('should return false when tag is not present', () => {
        const condition: EvalCondition = {
          field: 'tags',
          operator: 'includes',
          value: 'shipping',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(false);
      });

      it('should return false for unsupported operator on tags', () => {
        const condition: EvalCondition = {
          field: 'tags',
          operator: 'equals',
          value: 'billing',
        };
        expect(evaluateCondition(condition, baseTicket)).toBe(false);
      });

      it('should handle empty tags array', () => {
        const ticket: TicketContext = { ...baseTicket, tags: [] };
        const condition: EvalCondition = {
          field: 'tags',
          operator: 'includes',
          value: 'billing',
        };
        expect(evaluateCondition(condition, ticket)).toBe(false);
      });
    });
  });

  // ---- evaluateRule ----

  describe('evaluateRule', () => {
    const ticket: TicketContext = {
      priority: 'urgent',
      subject: 'Billing issue - cannot pay',
      client_email: 'user@acmecorp.com',
      tags: ['billing', 'payment'],
    };

    it('should return true when all conditions match', () => {
      const rule: EvalRule = {
        id: 'rule-1',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'urgent' },
          { field: 'subject', operator: 'contains', value: 'billing' },
        ],
      };
      expect(evaluateRule(rule, ticket)).toBe(true);
    });

    it('should return false when any condition does not match', () => {
      const rule: EvalRule = {
        id: 'rule-2',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'urgent' },
          { field: 'subject', operator: 'contains', value: 'shipping' },
        ],
      };
      expect(evaluateRule(rule, ticket)).toBe(false);
    });

    it('should return true for a single matching condition', () => {
      const rule: EvalRule = {
        id: 'rule-3',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'urgent' },
        ],
      };
      expect(evaluateRule(rule, ticket)).toBe(true);
    });

    it('should return false for a rule with no conditions', () => {
      const rule: EvalRule = {
        id: 'rule-4',
        conditions: [],
      };
      expect(evaluateRule(rule, ticket)).toBe(false);
    });

    it('should match complex multi-condition rules', () => {
      const rule: EvalRule = {
        id: 'rule-5',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'urgent' },
          { field: 'client_email_domain', operator: 'equals', value: 'acmecorp.com' },
          { field: 'tags', operator: 'includes', value: 'billing' },
        ],
      };
      expect(evaluateRule(rule, ticket)).toBe(true);
    });
  });

  // ---- evaluateRules ----

  describe('evaluateRules', () => {
    const ticket: TicketContext = {
      priority: 'high',
      subject: 'Cannot access billing dashboard',
      client_email: 'user@acmecorp.com',
      tags: ['billing', 'dashboard'],
    };

    it('should return the first matching rule', () => {
      const rules: EvalRule[] = [
        {
          id: 'rule-1',
          conditions: [{ field: 'priority', operator: 'equals', value: 'urgent' }],
        },
        {
          id: 'rule-2',
          conditions: [{ field: 'subject', operator: 'contains', value: 'billing' }],
        },
        {
          id: 'rule-3',
          conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
        },
      ];

      const result = evaluateRules(rules, ticket);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('rule-2');
    });

    it('should return null when no rules match', () => {
      const rules: EvalRule[] = [
        {
          id: 'rule-1',
          conditions: [{ field: 'priority', operator: 'equals', value: 'low' }],
        },
        {
          id: 'rule-2',
          conditions: [{ field: 'subject', operator: 'contains', value: 'shipping' }],
        },
      ];

      const result = evaluateRules(rules, ticket);
      expect(result).toBeNull();
    });

    it('should return null for empty rules list', () => {
      const result = evaluateRules([], ticket);
      expect(result).toBeNull();
    });

    it('should respect priority order (first match wins)', () => {
      const rules: EvalRule[] = [
        {
          id: 'rule-specific',
          conditions: [
            { field: 'priority', operator: 'equals', value: 'high' },
            { field: 'tags', operator: 'includes', value: 'billing' },
          ],
        },
        {
          id: 'rule-general',
          conditions: [
            { field: 'priority', operator: 'equals', value: 'high' },
          ],
        },
      ];

      const result = evaluateRules(rules, ticket);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('rule-specific');
    });

    it('should skip non-matching rules and find match later in list', () => {
      const rules: EvalRule[] = [
        {
          id: 'rule-1',
          conditions: [{ field: 'priority', operator: 'equals', value: 'low' }],
        },
        {
          id: 'rule-2',
          conditions: [{ field: 'priority', operator: 'equals', value: 'medium' }],
        },
        {
          id: 'rule-3',
          conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
        },
      ];

      const result = evaluateRules(rules, ticket);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('rule-3');
    });
  });
});
