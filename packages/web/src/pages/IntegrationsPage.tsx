import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import { useUIStore } from '../stores/ui.store.js';

interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  notifyOnPriorities: string[];
}

const ALL_PRIORITIES = ['urgent', 'high', 'medium', 'low'];

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '🚨 Urgent',
  high: '🔴 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
};

export function IntegrationsPage() {
  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading, refetch } = useQuery<SlackConfig>({
    queryKey: ['integrations', 'slack'],
    queryFn: () => api.get<SlackConfig>(ENDPOINTS.integrations.slack),
  });

  const [form, setForm] = useState<SlackConfig | null>(null);
  const config = form ?? data ?? { enabled: false, webhookUrl: '', channel: '', notifyOnPriorities: ['urgent', 'high'] };

  const saveMutation = useMutation({
    mutationFn: (payload: SlackConfig) => api.put<SlackConfig>(ENDPOINTS.integrations.slack, payload),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Slack integration saved.' });
      void refetch();
      setForm(null);
    },
    onError: () => addToast({ type: 'error', message: 'Failed to save Slack integration.' }),
  });

  const testMutation = useMutation({
    mutationFn: () => api.post<{ message: string }>(ENDPOINTS.integrations.slackTest, {}),
    onSuccess: () => addToast({ type: 'success', message: 'Test notification sent! Check your Slack channel.' }),
    onError: () => addToast({ type: 'error', message: 'Test failed. Check your webhook URL.' }),
  });

  const update = (patch: Partial<SlackConfig>) => setForm((prev) => ({ ...config, ...prev, ...patch }));

  const togglePriority = (p: string) => {
    const current = config.notifyOnPriorities;
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    update({ notifyOnPriorities: next });
  };

  const isDirty = form !== null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Integrations</h1>
        <p className="text-sm text-text-secondary mt-1">Connect BusyBirdies with your other tools.</p>
      </div>

      <Card>
        <div className="flex items-start gap-4">
          {/* Slack logo */}
          <div className="shrink-0 w-12 h-12 rounded-xl bg-[#4A154B] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Slack</h2>
                <p className="text-sm text-text-secondary">Get notified in Slack when high or urgent tickets are created.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-text-secondary">{config.enabled ? 'Enabled' : 'Disabled'}</span>
                <div
                  onClick={() => update({ enabled: !config.enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${config.enabled ? 'bg-primary' : 'bg-border'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </label>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Incoming Webhook URL
                </label>
                <Input
                  value={config.webhookUrl}
                  onChange={(e) => update({ webhookUrl: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                  disabled={isLoading}
                />
                <p className="text-xs text-text-secondary mt-1">
                  Create an incoming webhook in your <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Slack app settings</a>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Channel <span className="text-text-secondary font-normal">(optional)</span>
                </label>
                <Input
                  value={config.channel}
                  onChange={(e) => update({ channel: e.target.value })}
                  placeholder="#support-alerts"
                  disabled={isLoading}
                />
                <p className="text-xs text-text-secondary mt-1">Override the default channel set in your webhook. Include the # symbol.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Notify on priorities
                </label>
                <div className="flex gap-2 flex-wrap">
                  {ALL_PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePriority(p)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        config.notifyOnPriorities.includes(p)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface border-border text-text-secondary hover:border-primary'
                      }`}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => saveMutation.mutate(config)}
                isLoading={saveMutation.isPending}
                disabled={!isDirty || saveMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => testMutation.mutate()}
                isLoading={testMutation.isPending}
                disabled={!config.webhookUrl || testMutation.isPending}
              >
                Send Test
              </Button>
              {isDirty && (
                <Button variant="secondary" onClick={() => setForm(null)} disabled={saveMutation.isPending}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
