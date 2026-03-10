import { useState } from 'react';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { useAssignmentRules, useCreateRule, useUpdateRule, useDeleteRule } from '../hooks/useAssignmentRules.js';
import { useAgentsAndAdmins } from '../hooks/useAgents.js';
import { useUIStore } from '../stores/ui.store.js';
import type { AssignmentRule } from '@busybirdies/shared';

const FIELD_OPTIONS = [
  { value: 'priority', label: 'Priority' },
  { value: 'subject', label: 'Subject' },
  { value: 'client_email_domain', label: 'Client Email Domain' },
  { value: 'tags', label: 'Tags' },
];

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  priority: [{ value: 'equals', label: 'equals' }],
  subject: [{ value: 'contains', label: 'contains' }],
  client_email_domain: [{ value: 'equals', label: 'equals' }],
  tags: [{ value: 'includes', label: 'includes' }],
};

const PRIORITY_VALUES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface RuleFormProps {
  onClose: () => void;
  existing?: AssignmentRule;
}

function RuleForm({ onClose, existing }: RuleFormProps) {
  const addToast = useUIStore((s) => s.addToast);
  const { data: agentsData } = useAgentsAndAdmins();
  const agents = agentsData?.data ?? [];

  const createRule = useCreateRule();
  const updateRule = useUpdateRule(existing?.id ?? '');

  const [name, setName] = useState(existing?.name ?? '');
  const [targetAgentId, setTargetAgentId] = useState(existing?.target_agent?.id ?? '');
  const [conditions, setConditions] = useState<Condition[]>(
    existing?.conditions ?? [{ field: 'priority', operator: 'equals', value: 'low' }]
  );

  const agentOptions = [
    { value: '', label: 'Select agent...', disabled: true },
    ...agents.map((a) => ({ value: a.id, label: `${a.full_name} (${a.role})` })),
  ];

  const addCondition = () =>
    setConditions((prev) => [...prev, { field: 'priority', operator: 'equals', value: '' }]);

  const removeCondition = (index: number) =>
    setConditions((prev) => prev.filter((_, i) => i !== index));

  const updateCondition = (index: number, key: keyof Condition, val: string) => {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, [key]: val };
        if (key === 'field') {
          updated.operator = OPERATOR_OPTIONS[val]?.[0]?.value ?? 'equals';
          updated.value = val === 'priority' ? 'low' : '';
        }
        return updated;
      })
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) return addToast({ type: 'error', message: 'Rule name is required.' });
    if (!targetAgentId) return addToast({ type: 'error', message: 'Please select an agent.' });
    if (conditions.some((c) => !c.value.trim())) return addToast({ type: 'error', message: 'All condition values are required.' });

    const payload = {
      name: name.trim(),
      conditions,
      action_type: 'assign_agent' as const,
      target_agent_id: targetAgentId,
      is_active: true,
    };

    try {
      if (existing) {
        await updateRule.mutateAsync(payload);
        addToast({ type: 'success', message: 'Rule updated successfully.' });
      } else {
        await createRule.mutateAsync(payload);
        addToast({ type: 'success', message: 'Rule created successfully.' });
      }
      onClose();
    } catch {
      addToast({ type: 'error', message: 'Failed to save rule. Please try again.' });
    }
  };

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-xl shadow-lg border border-border w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">
            {existing ? 'Edit Rule' : 'Create Assignment Rule'}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Rule Name */}
          <Input
            label="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Assign urgent tickets to Jane"
            disabled={isPending}
          />

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-primary">Conditions</p>
              <button
                type="button"
                onClick={addCondition}
                className="text-xs text-primary hover:underline"
              >
                + Add condition
              </button>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Select
                      options={FIELD_OPTIONS}
                      value={condition.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      disabled={isPending}
                    />
                    <Select
                      options={OPERATOR_OPTIONS[condition.field] ?? [{ value: 'equals', label: 'equals' }]}
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                      disabled={isPending}
                    />
                    {condition.field === 'priority' ? (
                      <Select
                        options={PRIORITY_VALUES}
                        value={condition.value}
                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                        disabled={isPending}
                      />
                    ) : (
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                        placeholder={
                          condition.field === 'client_email_domain' ? 'e.g. acme.com' :
                          condition.field === 'tags' ? 'e.g. enterprise' : 'value'
                        }
                        className="rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={isPending}
                      />
                    )}
                  </div>
                  {conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="mt-2 text-danger hover:text-danger/80"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {conditions.length > 1 && (
              <p className="text-xs text-text-secondary mt-2">All conditions must match for the rule to trigger.</p>
            )}
          </div>

          {/* Assign To */}
          <Select
            label="Assign to"
            options={agentOptions}
            value={targetAgentId}
            onChange={(e) => setTargetAgentId(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isPending} disabled={isPending}>
            {existing ? 'Save Changes' : 'Create Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RuleCard({ rule, onEdit }: { rule: AssignmentRule; onEdit: () => void }) {
  const addToast = useUIStore((s) => s.addToast);
  const deleteRule = useDeleteRule();
  const updateRule = useUpdateRule(rule.id);

  const handleDelete = async () => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await deleteRule.mutateAsync(rule.id);
      addToast({ type: 'success', message: 'Rule deleted.' });
    } catch {
      addToast({ type: 'error', message: 'Failed to delete rule.' });
    }
  };

  const handleToggle = async () => {
    try {
      await updateRule.mutateAsync({ is_active: !rule.is_active });
      addToast({ type: 'success', message: `Rule ${rule.is_active ? 'disabled' : 'enabled'}.` });
    } catch {
      addToast({ type: 'error', message: 'Failed to update rule.' });
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${rule.is_active ? 'border-border bg-surface' : 'border-border bg-surface-alt opacity-60'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-text-secondary font-mono bg-surface-alt px-1.5 py-0.5 rounded">
              #{rule.priority_order}
            </span>
            <p className="text-sm font-semibold text-text-primary">{rule.name}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              rule.is_active ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-500'
            }`}>
              {rule.is_active ? 'Active' : 'Disabled'}
            </span>
          </div>

          {/* Conditions */}
          <div className="flex flex-wrap gap-2 mb-2">
            {rule.conditions.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                <span className="font-medium">{c.field}</span>
                <span className="opacity-70">{c.operator}</span>
                <span className="font-medium">"{c.value}"</span>
              </span>
            ))}
          </div>

          {/* Action */}
          <p className="text-xs text-text-secondary">
            → Assign to{' '}
            <span className="font-medium text-text-primary">
              {rule.target_agent?.full_name ?? rule.target_group?.name ?? 'Unknown'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={handleToggle} disabled={updateRule.isPending}>
            {rule.is_active ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDelete} disabled={deleteRule.isPending}>
            <svg className="h-4 w-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AssignmentRulesPage() {
  const { data, isLoading } = useAssignmentRules();
  const rules = data?.data ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);

  return (
    <div>
      {(showForm || editingRule) && (
        <RuleForm
          existing={editingRule ?? undefined}
          onClose={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Auto-Assignment Rules</h1>
          <p className="text-sm text-text-secondary mt-1">
            Rules are evaluated in priority order. First match wins.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ New Rule</Button>
      </div>

      <Card padding="lg">
        {isLoading ? (
          <div className="text-center py-12 text-text-secondary text-sm">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <svg className="h-12 w-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-text-secondary text-sm mb-4">No assignment rules yet.</p>
            <Button onClick={() => setShowForm(true)}>Create your first rule</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => setEditingRule(rule)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
