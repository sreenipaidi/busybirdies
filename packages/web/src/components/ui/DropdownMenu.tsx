import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ trigger, items, align = 'right', className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabledIndices = items
    .map((item, idx) => (item.disabled ? -1 : idx))
    .filter((idx) => idx !== -1);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Focus the item at the given index
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  // When menu opens, focus the first enabled item
  useEffect(() => {
    if (isOpen && enabledIndices.length > 0) {
      const firstEnabled = enabledIndices[0];
      if (firstEnabled !== undefined) {
        setFocusedIndex(firstEnabled);
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen) {
        close();
      } else {
        open();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        open();
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        close();
      }
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(focusedIndex);
        const nextPos = currentPos < enabledIndices.length - 1 ? currentPos + 1 : 0;
        const nextIdx = enabledIndices[nextPos];
        if (nextIdx !== undefined) setFocusedIndex(nextIdx);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(focusedIndex);
        const prevPos = currentPos > 0 ? currentPos - 1 : enabledIndices.length - 1;
        const prevIdx = enabledIndices[prevPos];
        if (prevIdx !== undefined) setFocusedIndex(prevIdx);
        break;
      }
      case 'Home': {
        e.preventDefault();
        const firstIdx = enabledIndices[0];
        if (firstIdx !== undefined) setFocusedIndex(firstIdx);
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIdx = enabledIndices[enabledIndices.length - 1];
        if (lastIdx !== undefined) setFocusedIndex(lastIdx);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        close();
        break;
      }
      case 'Tab': {
        // Close menu on Tab and let focus move naturally
        close();
        break;
      }
      default:
        break;
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, item: DropdownMenuItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!item.disabled) {
        item.onClick();
        close();
      }
    }
    // Arrow keys, Escape, etc. are handled by the menu-level handler via bubbling
  };

  return (
    <div ref={menuRef} className={cn('relative inline-block', className)}>
      <div
        ref={triggerRef}
        onClick={() => {
          if (isOpen) {
            close();
          } else {
            open();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[180px]',
            'bg-surface rounded-md border border-border shadow-md',
            'py-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              role="menuitem"
              disabled={item.disabled}
              tabIndex={focusedIndex === idx ? 0 : -1}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                'hover:bg-surface-alt transition-colors',
                'focus:bg-surface-alt focus:outline-none',
                'disabled:opacity-50 disabled:pointer-events-none',
                item.danger && 'text-danger hover:bg-danger-light focus:bg-danger-light',
                !item.danger && 'text-text-primary',
              )}
              onClick={() => {
                item.onClick();
                close();
              }}
              onKeyDown={(e) => handleItemKeyDown(e, item)}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
