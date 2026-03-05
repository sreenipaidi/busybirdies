import { z } from 'zod';
import { CONDITION_FIELDS, CONDITION_OPERATORS, RULE_ACTION_TYPES } from '../constants/index.js';

export const ruleConditionSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().min(1, 'Condition value is required'),
});

export const createAssignmentRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100),
  conditions: z.array(ruleConditionSchema).min(1, 'At least one condition is required'),
  action_type: z.enum(RULE_ACTION_TYPES),
  target_agent_id: z.string().uuid().optional(),
  target_group_id: z.string().uuid().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateAssignmentRuleSchema = createAssignmentRuleSchema.partial().extend({
  priority_order: z.number().int().min(0).optional(),
});

export const reorderRulesSchema = z.object({
  rule_ids: z.array(z.string().uuid()).min(1, 'At least one rule ID is required'),
});

export const createAgentGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
});

export const addGroupMemberSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
});

export type CreateAssignmentRuleInput = z.infer<typeof createAssignmentRuleSchema>;
export type UpdateAssignmentRuleInput = z.infer<typeof updateAssignmentRuleSchema>;
export type ReorderRulesInput = z.infer<typeof reorderRulesSchema>;
export type CreateAgentGroupInput = z.infer<typeof createAgentGroupSchema>;
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;
