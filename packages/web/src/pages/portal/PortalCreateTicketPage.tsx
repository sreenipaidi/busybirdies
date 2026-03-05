import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input, Textarea } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { usePortalCreateTicket } from '../../hooks/usePortalTickets.js';
import { useKBSearch } from '../../hooks/useKBArticles.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useUIStore } from '../../stores/ui.store.js';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

interface FormErrors {
  subject?: string;
  description?: string;
  priority?: string;
}

export function PortalCreateTicketPage() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const createTicket = usePortalCreateTicket();

  // KB suggestion phase
  const [phase, setPhase] = useState<'suggest' | 'form'>('suggest');
  const [kbQuery, setKbQuery] = useState('');
  const debouncedKbQuery = useDebounce(kbQuery, 400);

  // Form fields
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [errors, setErrors] = useState<FormErrors>({});

  // KB search results
  const { data: kbResults, isLoading: kbLoading } = useKBSearch(
    debouncedKbQuery,
    1,
    3,
  );

  const handleSkipToForm = useCallback(() => {
    // Pre-fill subject from KB search query if present
    if (kbQuery.trim()) {
      setSubject(kbQuery.trim());
    }
    setPhase('form');
  }, [kbQuery]);

  const handleArticleDismiss = useCallback(() => {
    navigate('/portal');
  }, [navigate]);

  const handleContinueToForm = useCallback(() => {
    if (kbQuery.trim()) {
      setSubject(kbQuery.trim());
    }
    setPhase('form');
  }, [kbQuery]);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!subject.trim()) {
      newErrors.subject = 'Please enter a subject for your ticket.';
    } else if (subject.trim().length > 200) {
      newErrors.subject = 'Subject must be 200 characters or less.';
    }

    if (!description.trim()) {
      newErrors.description = 'Please provide a description of your issue.';
    } else if (description.trim().length < 20) {
      newErrors.description = 'Please provide at least 20 characters describing your issue.';
    }

    if (!priority) {
      newErrors.priority = 'Please select a priority level.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [subject, description, priority]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) return;

      try {
        const ticket = await createTicket.mutateAsync({
          subject: subject.trim(),
          description: description.trim(),
          priority,
        });

        addToast({
          type: 'success',
          message: `Ticket ${ticket.ticket_number} submitted successfully.`,
        });

        navigate(`/portal/tickets/${ticket.id}`);
      } catch {
        addToast({
          type: 'error',
          message: 'We could not submit your ticket. Please try again.',
        });
      }
    },
    [validate, subject, description, priority, createTicket, addToast, navigate],
  );

  return (
    <div>
      {/* Back link */}
      <Link
        to="/portal"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors mb-4"
        aria-label="Back to dashboard"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold text-text-primary mb-6">
        Submit a Support Ticket
      </h1>

      {/* Phase 1: KB suggestion panel */}
      {phase === 'suggest' && (
        <Card padding="lg" className="max-w-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-primary mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Before submitting a ticket
            </h2>
            <p className="text-sm text-text-secondary">
              Check if your question has already been answered in our knowledge base.
            </p>
          </div>

          <div className="mb-4">
            <Input
              placeholder="Describe your issue..."
              value={kbQuery}
              onChange={(e) => setKbQuery(e.target.value)}
              aria-label="Search knowledge base for answers"
            />
          </div>

          {/* KB search results */}
          {kbLoading && debouncedKbQuery.length >= 3 && (
            <div className="flex items-center justify-center py-4" role="status">
              <Spinner size="sm" label="Searching knowledge base" />
              <span className="ml-2 text-sm text-text-secondary">Searching...</span>
            </div>
          )}

          {!kbLoading && kbResults && kbResults.data.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-text-primary mb-2">
                Did you find what you need?
              </p>
              <div className="space-y-2" role="list" aria-label="Suggested knowledge base articles">
                {kbResults.data.map((article) => (
                  <a
                    key={article.id}
                    href={`/kb/${article.category_name.toLowerCase().replace(/\s+/g, '-')}/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 border border-border rounded-md hover:bg-surface-alt hover:border-primary transition-colors group"
                    role="listitem"
                  >
                    <p className="text-sm font-medium text-primary group-hover:text-primary-hover">
                      {article.title}
                    </p>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                      {article.snippet}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-text-secondary mt-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                      </svg>
                      {article.category_name}
                    </span>
                  </a>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button variant="secondary" onClick={handleArticleDismiss} className="flex-1">
                  Yes, that helped
                </Button>
                <Button variant="primary" onClick={handleContinueToForm} className="flex-1">
                  No, I still need help
                </Button>
              </div>
            </div>
          )}

          {!kbLoading && debouncedKbQuery.length >= 3 && kbResults && kbResults.data.length === 0 && (
            <p className="text-sm text-text-secondary text-center py-2 mb-4">
              No articles found. Submit a ticket and our team will help you.
            </p>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={handleSkipToForm}
              className="text-sm text-primary hover:text-primary-hover font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Skip, submit a ticket
            </button>
          </div>
        </Card>
      )}

      {/* Phase 2: Ticket creation form */}
      {phase === 'form' && (
        <Card padding="lg" className="max-w-2xl">
          <form onSubmit={handleSubmit} noValidate aria-label="Create ticket form">
            <div className="space-y-4">
              <Input
                label="Subject"
                placeholder="Brief summary of your issue"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (errors.subject) {
                    setErrors((prev) => ({ ...prev, subject: undefined }));
                  }
                }}
                error={errors.subject}
                maxLength={200}
                required
                aria-required="true"
              />

              <Textarea
                label="Description"
                placeholder="Please describe your issue in detail..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) {
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }
                }}
                error={errors.description}
                className="min-h-[150px]"
                required
                aria-required="true"
                helperText={`${description.length} characters (minimum 20)`}
              />

              <Select
                label="Priority"
                options={PRIORITY_OPTIONS}
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  if (errors.priority) {
                    setErrors((prev) => ({ ...prev, priority: undefined }));
                  }
                }}
                error={errors.priority}
                aria-label="Select ticket priority"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/portal')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={createTicket.isPending}
                disabled={createTicket.isPending}
                aria-label="Submit support ticket"
              >
                Submit Ticket
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
