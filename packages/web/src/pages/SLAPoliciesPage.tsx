import { useState } from 'react';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { useSLAPolicies, useUpdateSLAPolicy } from '../hooks/useSLAPolicies.js';
import { useUIStore } from '../stores/ui.store.js';
import type { SLAPolicy } from '@busybirdies/shared';

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

function minutesToDisplay(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function hoursToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

interface EditModalProps {
  policy: SLAPolicy;
  onClose: () => void;
}

function EditModal({ policy, onClose }: EditModalProps) {
  const addToast = useUIStore((s) => s.addToast);
  const updatePolicy = useUpdateSLAPolicy(policy.id);

  const [firstResponseHours, setFirstResponseHours] = useState(
    Math.floor(policy.first_response_minutes / 60)
  );
  const [firstResponseMins, setFirstResponseMins] = useState(
    policy.first_response_minutes % 60
  );
  const [resolutionHours, setResolutionHours] = useState(
    Math.floor(policy.resolution_minutes / 60)
  );
  const [resolutionMins, setResolutionMins] = useState(
    policy.resolution_minutes % 60
  );

  const priorityInfo = PRIORITY_LABELS[policy.priority] ?? { label: policy.priority, color: 'bg-gray-100 text-gray-600' };

  const handleSave = async () => {
    const first_response_minutes = hoursToMinutes(firstResponseHours, firstResponseMins);
    const resolution_minutes = hoursToMinutes(resolutionHours, resolutionMins);

    if (first_response_minutes < 1) {
      return addToast({ type: 'error', message: 'First response time must be at least 1 minute.' });
    }
    if (resolution_minutes < first_response_minutes) {
      return addToast({ type: 'error', message: 'Resolution time must be greater than or equal to first response time.' });
    }

    try {
      await updatePolicy.mutateAsync({ first_response_minutes, resolution_minutes });
      addToast({ type: 'success', message: `SLA policy for ${priorityInfo.label} updated.` });
      onClose();
    } catch {
      addToast({ type: 'error', message: 'Failed to update SLA policy.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-xl shadow-lg border border-border w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary">Edit SLA Policy</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityInfo.color}`}>
              {priorityInfo.label}
            </span>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* First Response */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              First Response Time
            </label>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  min={0}
                  value={firstResponseHours}
                  onChange={(e) => setFirstResponseHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-text-secondary">hours</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={firstResponseMins}
                  onChange={(e) => setFirstResponseMins(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-20 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-text-secondary">minutes</span>
              </div>
            </div>
          </div>

          {/* Resolution Time */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Resolution Time
            </label>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  min={0}
                  value={resolutionHours}
                  onChange={(e) => setResolutionHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-text-secondary">hours</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={resolutionMins}
                  onChange={(e) => setResolutionMins(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-20 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-text-secondary">minutes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={onClose} disabled={updatePolicy.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={updatePolicy.isPending} disabled={updatePolicy.isPending}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SLAPoliciesPage() {
  const { data, isLoading } = useSLAPolicies();
  const [editingPolicy, setEditingPolicy] = useState<SLAPolicy | null>(null);

  const policies = data?.data ?? [];
  const priorityOrder = ['urgent', 'high', 'medium', 'low'];
  const sorted = [...policies].sort(
    (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
  );

  return (
    <div>
      {editingPolicy && (
        <EditModal policy={editingPolicy} onClose={() => setEditingPolicy(null)} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">SLA Policies</h1>
        <p className="text-sm text-text-secondary mt-1">
          Define response and resolution time targets for each ticket priority level.
        </p>
      </div>

      <Card padding="lg">
        {isLoading ? (
          <div className="text-center py-12 text-text-secondary text-sm">Loading policies...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-text-secondary uppercase tracking-wide border-b border-border">
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">First Response Target</th>
                  <th className="px-4 py-3">Resolution Target</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((policy) => {
                  const info = PRIORITY_LABELS[policy.priority] ?? { label: policy.priority, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={policy.id} className="border-t border-border hover:bg-surface-alt transition-colors">
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${info.color}`}>
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium text-text-primary">
                          {minutesToDisplay(policy.first_response_minutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium text-text-primary">
                          {minutesToDisplay(policy.resolution_minutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {new Date(policy.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingPolicy(policy)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          <span className="font-medium">Tip:</span> SLA timers start when a ticket is created. Breached tickets are highlighted in red on the tickets list.
        </p>
      </div>
    </div>
  );
}
