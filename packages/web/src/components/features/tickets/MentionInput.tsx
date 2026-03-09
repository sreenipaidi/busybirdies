import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgents } from '../../../hooks/useAgents.js';
import type { User } from '@busybirdies/shared';

interface MentionInputProps {
  /** Current value of the text area. */
  value: string;
  /** Callback invoked when the value changes. */
  onChange: (value: string) => void;
  /** Placeholder text for the text area. */
  placeholder?: string;
  /** CSS class names to apply to the text area. */
  className?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Accessible label for the text area. */
  ariaLabel?: string;
  /** HTML id for the text area. */
  id?: string;
}

/**
 * Text area with @mention support for internal notes.
 * When the user types "@", a dropdown of agent names appears.
 * Selecting an agent inserts @[agent_name] into the text.
 */
export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  ariaLabel,
  id,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: agentsData } = useAgents();
  const agents: User[] = agentsData?.data ?? [];

  // Filter agents based on the current mention search query
  const filteredAgents = agents.filter((agent) =>
    agent.full_name.toLowerCase().includes(mentionSearch.toLowerCase()),
  );

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [mentionSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertMention = useCallback(
    (agent: User) => {
      if (mentionStartIndex === null) return;

      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(
        mentionStartIndex + mentionSearch.length + 1, // +1 for the "@" character
      );
      const mention = `@[${agent.full_name}]`;
      const newValue = `${before}${mention}${after}`;

      onChange(newValue);
      setShowDropdown(false);
      setMentionSearch('');
      setMentionStartIndex(null);

      // Refocus the textarea after inserting the mention
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const cursorPos = before.length + mention.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [value, onChange, mentionStartIndex, mentionSearch],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;
      onChange(newValue);

      // Check if we should show the mention dropdown
      // Look backwards from cursor for an "@" that starts a mention
      const textBeforeCursor = newValue.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex >= 0) {
        // Check that the "@" is at the start or preceded by a space/newline
        const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
          const searchText = textBeforeCursor.slice(lastAtIndex + 1);
          // Only show dropdown if search text does not contain space-breaking patterns like "]"
          if (!searchText.includes(']') && !searchText.includes('\n')) {
            setMentionSearch(searchText);
            setMentionStartIndex(lastAtIndex);
            setShowDropdown(true);
            return;
          }
        }
      }

      setShowDropdown(false);
      setMentionSearch('');
      setMentionStartIndex(null);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showDropdown || filteredAgents.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredAgents.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredAgents.length - 1,
        );
      } else if (e.key === 'Enter' && showDropdown) {
        e.preventDefault();
        const agent = filteredAgents[selectedIndex];
        if (agent) {
          insertMention(agent);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
      }
    },
    [showDropdown, filteredAgents, selectedIndex, insertMention],
  );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-controls={showDropdown ? 'mention-dropdown' : undefined}
        role="combobox"
        aria-autocomplete="list"
      />
      {showDropdown && filteredAgents.length > 0 && (
        <div
          ref={dropdownRef}
          id="mention-dropdown"
          className="absolute bottom-full left-0 z-50 mb-1 max-h-48 w-64 overflow-y-auto rounded-md border border-border bg-surface shadow-lg"
          role="listbox"
          aria-label="Agent suggestions"
          data-testid="mention-dropdown"
        >
          {filteredAgents.map((agent, index) => (
            <button
              key={agent.id}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-primary hover:bg-surface-alt'
              }`}
              role="option"
              aria-selected={index === selectedIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur on textarea
                insertMention(agent);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                {agent.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{agent.full_name}</div>
                <div className="truncate text-xs text-text-secondary">
                  {agent.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
