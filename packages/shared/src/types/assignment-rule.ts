import type { ConditionField, ConditionOperator, RuleActionType } from '../constants/index.js';
import type { UserSummary } from './user.js';

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export type ConditionLogic = 'all' | 'any';

export interface AssignmentRule {
  id: string;
  name: string;
  is_active: boolean;
  priority_order: number;
  condition_logic: ConditionLogic;  // defaults to 'any'
  conditions: RuleCondition[];
  action_type: RuleActionType;
  target_agent: UserSummary | null;
  target_group: AgentGroupSummary | null;
  created_at: string;
  updated_at: string;
}

export interface AgentGroup {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  members: UserSummary[];
  created_at: string;
}

export interface AgentGroupSummary {
  id: string;
  name: string;
  member_count: number;
}
