import type { ConditionField, ConditionOperator } from '@busybirdies/shared';

/**
 * Shape of a single rule condition to evaluate.
 */
export interface EvalCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

/**
 * Shape of a rule with conditions to evaluate.
 */
export interface EvalRule {
  id: string;
  conditions: EvalCondition[];
}

/**
 * Ticket context used for rule evaluation.
 * Contains the fields that conditions can reference.
 */
export interface TicketContext {
  priority: string;
  subject: string;
  client_email: string;
  tags: string[];
}

/**
 * Evaluate a single condition against the ticket context.
 * Returns true if the condition matches.
 *
 * Condition semantics:
 * - priority + equals: ticket priority matches value exactly
 * - subject + contains: ticket subject contains value (case-insensitive)
 * - client_email_domain + equals: domain part of client email matches value (case-insensitive)
 * - tags + includes: ticket tags array includes the value (case-insensitive)
 */
export function evaluateCondition(
  condition: EvalCondition,
  ticket: TicketContext,
): boolean {
  const { field, operator, value } = condition;

  switch (field) {
    case 'priority': {
      if (operator === 'equals') {
        return ticket.priority.toLowerCase() === value.toLowerCase();
      }
      return false;
    }

    case 'subject': {
      if (operator === 'contains') {
        return ticket.subject.toLowerCase().includes(value.toLowerCase());
      }
      if (operator === 'equals') {
        return ticket.subject.toLowerCase() === value.toLowerCase();
      }
      return false;
    }

    case 'client_email_domain': {
      const domain = ticket.client_email.split('@')[1] ?? '';
      if (operator === 'equals') {
        return domain.toLowerCase() === value.toLowerCase();
      }
      if (operator === 'contains') {
        return domain.toLowerCase().includes(value.toLowerCase());
      }
      return false;
    }

    case 'tags': {
      if (operator === 'includes') {
        const lowerValue = value.toLowerCase();
        return ticket.tags.some((t) => t.toLowerCase() === lowerValue);
      }
      return false;
    }

    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a single rule against the ticket context.
 * All conditions must match for the rule to match (AND logic).
 */
export function evaluateRule(
  rule: EvalRule,
  ticket: TicketContext,
): boolean {
  if (rule.conditions.length === 0) {
    return false;
  }
  return rule.conditions.every((condition) => evaluateCondition(condition, ticket));
}

/**
 * Evaluate an ordered list of rules against a ticket context.
 * Returns the first matching rule, or null if none match.
 * Rules are evaluated in the order provided (caller is responsible for sorting by priority_order).
 */
export function evaluateRules(
  rules: EvalRule[],
  ticket: TicketContext,
): EvalRule | null {
  for (const rule of rules) {
    if (evaluateRule(rule, ticket)) {
      return rule;
    }
  }
  return null;
}
