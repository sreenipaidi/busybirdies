import { useState, useRef, useEffect, useCallback } from 'react';
import { useCannedResponses } from '../../../hooks/useCannedResponses.js';
import { Button } from '../../ui/Button.js';
import { Spinner } from '../../ui/Spinner.js';
import type { CannedResponse } from '@busybirdies/shared';

interface CannedResponsePickerProps {
  /** Callback invoked when a canned response is selected. */
  onSelect: (body: string) => void;
}

/**
 * A dropdown button that shows canned responses for quick insertion into the reply editor.
 * Supports search/filter and click-to-insert functionality.
 */
export function CannedResponsePicker({ onSelect }: CannedResponsePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useCannedResponses({
    search: searchQuery || undefined,
    per_page: 50,
  });

  const responses: CannedResponse[] = data?.data ?? [];

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (response: CannedResponse) => {
      onSelect(response.body);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onSelect],
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Insert canned response"
        data-testid="canned-response-trigger"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-1 h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
            clipRule="evenodd"
          />
        </svg>
        Canned
      </Button>

      {isOpen && (
        <div
          className="absolute bottom-full right-0 z-50 mb-1 w-80 rounded-md border border-border bg-surface shadow-lg"
          role="dialog"
          aria-label="Canned responses"
          data-testid="canned-response-dropdown"
        >
          {/* Search box */}
          <div className="border-b border-border p-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search canned responses..."
              className="w-full rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Search canned responses"
            />
          </div>

          {/* Response list */}
          <div
            className="max-h-60 overflow-y-auto"
            role="listbox"
            aria-label="Available canned responses"
          >
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}

            {!isLoading && responses.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-text-secondary">
                {searchQuery
                  ? 'No canned responses match your search.'
                  : 'No canned responses available.'}
              </div>
            )}

            {!isLoading &&
              responses.map((response) => (
                <button
                  key={response.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-surface-alt"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelect(response)}
                  data-testid="canned-response-item"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {response.title}
                    </span>
                    {response.category && (
                      <span className="rounded bg-surface-alt px-1.5 py-0.5 text-xs text-text-secondary">
                        {response.category}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-text-secondary">
                    {response.body}
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
