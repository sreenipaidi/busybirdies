import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu } from '../../components/ui/DropdownMenu.js';
import type { DropdownMenuItem } from '../../components/ui/DropdownMenu.js';

function createItems(count = 3): DropdownMenuItem[] {
  return Array.from({ length: count }, (_, i) => ({
    label: `Item ${i + 1}`,
    onClick: vi.fn(),
  }));
}

function renderDropdown(items?: DropdownMenuItem[], props?: Record<string, unknown>) {
  const defaultItems = items ?? createItems();
  return render(
    <DropdownMenu trigger={<span>Open Menu</span>} items={defaultItems} {...props} />,
  );
}

describe('DropdownMenu', () => {
  it('renders the trigger element', () => {
    renderDropdown();
    expect(screen.getByText('Open Menu')).toBeInTheDocument();
  });

  it('does not show menu items initially', () => {
    renderDropdown();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens menu on trigger click', async () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('has correct ARIA attributes on trigger', () => {
    renderDropdown();
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders menu items with menuitem role', () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(3);
  });

  // Keyboard navigation tests (K-1 + A-2)

  it('opens menu and focuses first item on Enter key', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const trigger = screen.getByRole('button');
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('menu')).toBeInTheDocument();
    // First menu item should be focused
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems[0]).toHaveFocus();
  });

  it('opens menu and focuses first item on Space key', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const trigger = screen.getByRole('button');
    trigger.focus();
    await user.keyboard(' ');

    expect(screen.getByRole('menu')).toBeInTheDocument();
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems[0]).toHaveFocus();
  });

  it('opens menu on ArrowDown from trigger', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const trigger = screen.getByRole('button');
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('menu')).toBeInTheDocument();
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems[0]).toHaveFocus();
  });

  it('navigates items with ArrowDown key', async () => {
    const user = userEvent.setup();
    renderDropdown();

    // Open menu
    fireEvent.click(screen.getByRole('button'));

    const menuItems = screen.getAllByRole('menuitem');
    // First item should be focused after open
    expect(menuItems[0]).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(menuItems[1]).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(menuItems[2]).toHaveFocus();
  });

  it('wraps focus from last to first on ArrowDown', async () => {
    const user = userEvent.setup();
    renderDropdown();

    fireEvent.click(screen.getByRole('button'));
    const menuItems = screen.getAllByRole('menuitem');

    // Navigate to last item
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    expect(menuItems[2]).toHaveFocus();

    // Should wrap to first
    await user.keyboard('{ArrowDown}');
    expect(menuItems[0]).toHaveFocus();
  });

  it('navigates items with ArrowUp key', async () => {
    const user = userEvent.setup();
    renderDropdown();

    fireEvent.click(screen.getByRole('button'));
    const menuItems = screen.getAllByRole('menuitem');

    // Focus is on first item, ArrowUp should wrap to last
    await user.keyboard('{ArrowUp}');
    expect(menuItems[2]).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(menuItems[1]).toHaveFocus();
  });

  it('focuses first item on Home key', async () => {
    const user = userEvent.setup();
    renderDropdown();

    fireEvent.click(screen.getByRole('button'));
    const menuItems = screen.getAllByRole('menuitem');

    // Move to last item
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    expect(menuItems[2]).toHaveFocus();

    // Home should go to first
    await user.keyboard('{Home}');
    expect(menuItems[0]).toHaveFocus();
  });

  it('focuses last item on End key', async () => {
    const user = userEvent.setup();
    renderDropdown();

    fireEvent.click(screen.getByRole('button'));
    const menuItems = screen.getAllByRole('menuitem');

    expect(menuItems[0]).toHaveFocus();

    await user.keyboard('{End}');
    expect(menuItems[2]).toHaveFocus();
  });

  it('closes menu and returns focus to trigger on Escape', async () => {
    const user = userEvent.setup();
    renderDropdown();

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('activates item on Enter key', async () => {
    const user = userEvent.setup();
    const items = createItems();
    renderDropdown(items);

    fireEvent.click(screen.getByRole('button'));
    // First item is focused
    await user.keyboard('{Enter}');

    expect(items[0]!.onClick).toHaveBeenCalledTimes(1);
    // Menu should close
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('activates item on Space key', async () => {
    const user = userEvent.setup();
    const items = createItems();
    renderDropdown(items);

    fireEvent.click(screen.getByRole('button'));
    await user.keyboard(' ');

    expect(items[0]!.onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onClick and closes menu on item click', () => {
    const items = createItems();
    renderDropdown(items);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Item 2'));

    expect(items[1]!.onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('skips disabled items during keyboard navigation', async () => {
    const user = userEvent.setup();
    const items: DropdownMenuItem[] = [
      { label: 'First', onClick: vi.fn() },
      { label: 'Disabled', onClick: vi.fn(), disabled: true },
      { label: 'Third', onClick: vi.fn() },
    ];
    renderDropdown(items);

    fireEvent.click(screen.getByRole('button'));
    const menuItems = screen.getAllByRole('menuitem');

    // First enabled item is focused
    expect(menuItems[0]!).toHaveFocus();

    // ArrowDown should skip the disabled item
    await user.keyboard('{ArrowDown}');
    expect(menuItems[2]!).toHaveFocus();
  });

  it('renders icon when provided', () => {
    const items: DropdownMenuItem[] = [
      {
        label: 'With Icon',
        onClick: vi.fn(),
        icon: <span data-testid="test-icon">icon</span>,
      },
    ];
    renderDropdown(items);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('applies danger styling to danger items', () => {
    const items: DropdownMenuItem[] = [
      { label: 'Danger', onClick: vi.fn(), danger: true },
    ];
    renderDropdown(items);
    fireEvent.click(screen.getByRole('button'));
    const menuItem = screen.getByRole('menuitem');
    expect(menuItem).toHaveClass('text-danger');
  });
});
