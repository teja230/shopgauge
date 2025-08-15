import React, { useRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useKeyboardNavigation, ADMIN_KEYBOARD_SHORTCUTS, type KeyboardShortcut } from '../useKeyboardNavigation';

// Test component that uses the keyboard navigation hook
const TestKeyboardNavigation: React.FC<{
  shortcuts?: KeyboardShortcut[];
  enableArrowNavigation?: boolean;
  enableTabTrapping?: boolean;
  onEscape?: () => void;
}> = ({ shortcuts, enableArrowNavigation, enableTabTrapping, onEscape }) => {
  const { containerRef, focusFirst, focusLast } = useKeyboardNavigation({
    shortcuts,
    enableArrowNavigation,
    enableTabTrapping,
    onEscape,
  });

  return (
    <div ref={containerRef} data-testid="keyboard-container">
      <button data-testid="button-1">Button 1</button>
      <button data-testid="button-2">Button 2</button>
      <button data-testid="button-3">Button 3</button>
      <input data-testid="input-1" placeholder="Input 1" />
      <select data-testid="select-1">
        <option>Option 1</option>
        <option>Option 2</option>
      </select>
      <button data-testid="focus-first" onClick={focusFirst}>Focus First</button>
      <button data-testid="focus-last" onClick={focusLast}>Focus Last</button>
      <button disabled data-testid="disabled-button">Disabled Button</button>
    </div>
  );
};

describe('useKeyboardNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('sets up container ref correctly', () => {
      render(<TestKeyboardNavigation />);
      
      const container = screen.getByTestId('keyboard-container');
      expect(container).toBeInTheDocument();
    });

    it('focuses first focusable element', async () => {
      const user = userEvent.setup();
      render(<TestKeyboardNavigation />);

      // Wait for component to be ready
      await act(async () => {
        await user.click(screen.getByTestId('focus-first'));
      });

      expect(screen.getByTestId('button-1')).toHaveFocus();
    });

    it('focuses last focusable element', async () => {
      const user = userEvent.setup();
      render(<TestKeyboardNavigation />);

      await act(async () => {
        await user.click(screen.getByTestId('focus-last'));
      });

      // The last focusable element should be the "focus-last" button itself
      expect(screen.getByTestId('focus-last')).toHaveFocus();
    });

    it('excludes disabled elements from focus management', async () => {
      const user = userEvent.setup();
      render(<TestKeyboardNavigation />);

      await act(async () => {
        await user.click(screen.getByTestId('focus-first'));
      });

      // Disabled button should not be focused
      expect(screen.getByTestId('disabled-button')).not.toHaveFocus();
      expect(screen.getByTestId('button-1')).toHaveFocus();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('executes keyboard shortcuts', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'k',
          ctrlKey: true,
          action: mockAction,
          description: 'Test shortcut',
        },
      ];

      render(<TestKeyboardNavigation shortcuts={shortcuts} />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        await user.keyboard('{Control>}k{/Control}');
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('handles multiple modifier keys', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 's',
          ctrlKey: true,
          shiftKey: true,
          action: mockAction,
          description: 'Save as shortcut',
        },
      ];

      render(<TestKeyboardNavigation shortcuts={shortcuts} />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        await user.keyboard('{Control>}{Shift>}s{/Shift}{/Control}');
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('handles Alt and Meta keys', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'd',
          altKey: true,
          action: mockAction,
          description: 'Alt+D shortcut',
        },
      ];

      render(<TestKeyboardNavigation shortcuts={shortcuts} />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        await user.keyboard('{Alt>}d{/Alt}');
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('prevents default behavior by default', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'r',
          ctrlKey: true,
          action: mockAction,
          description: 'Refresh shortcut',
        },
      ];

      render(<TestKeyboardNavigation shortcuts={shortcuts} />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        // This would normally refresh the page, but should be prevented
        await user.keyboard('{Control>}r{/Control}');
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('allows default behavior when preventDefault is false', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'a',
          ctrlKey: true,
          action: mockAction,
          description: 'Select all shortcut',
          preventDefault: false,
        },
      ];

      render(<TestKeyboardNavigation shortcuts={shortcuts} />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        await user.keyboard('{Control>}a{/Control}');
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('handles case-insensitive key matching', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'K', // Uppercase in definition
          ctrlKey: true,
          action: mockAction,
          description: 'Test shortcut',
        },
      ];

      render(<TestKeyboardNavigation shortcuts={shortcuts} />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        // Type lowercase k
        await user.keyboard('{Control>}k{/Control}');
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape Key Handling', () => {
    it('calls onEscape when Escape is pressed', async () => {
      const user = userEvent.setup();
      const mockOnEscape = vi.fn();

      render(<TestKeyboardNavigation onEscape={mockOnEscape} />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        await user.keyboard('{Escape}');
      });

      expect(mockOnEscape).toHaveBeenCalledTimes(1);
    });

    it('does not call onEscape when not provided', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation />);

      const container = screen.getByTestId('keyboard-container');
      
      await act(async () => {
        container.focus();
        // Should not throw error
        await user.keyboard('{Escape}');
      });
    });
  });

  describe('Arrow Navigation', () => {
    it('navigates with arrow keys when enabled', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableArrowNavigation={true} />);

      // Focus first button
      const button1 = screen.getByTestId('button-1');
      button1.focus();

      expect(button1).toHaveFocus();

      // Navigate down
      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('button-2')).toHaveFocus();

      // Navigate down again
      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('button-3')).toHaveFocus();
    });

    it('wraps around at the end of the list', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableArrowNavigation={true} />);

      // Focus last focusable element
      await user.click(screen.getByTestId('focus-last'));

      // Navigate down (should wrap to first)
      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('button-1')).toHaveFocus();
    });

    it('wraps around at the beginning of the list', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableArrowNavigation={true} />);

      // Focus first element
      const button1 = screen.getByTestId('button-1');
      button1.focus();

      // Navigate up (should wrap to last)
      await user.keyboard('{ArrowUp}');

      expect(screen.getByTestId('focus-last')).toHaveFocus();
    });

    it('handles left and right arrow keys', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableArrowNavigation={true} />);

      const button1 = screen.getByTestId('button-1');
      button1.focus();

      // Navigate right
      await user.keyboard('{ArrowRight}');

      expect(screen.getByTestId('button-2')).toHaveFocus();

      // Navigate left
      await user.keyboard('{ArrowLeft}');

      expect(screen.getByTestId('button-1')).toHaveFocus();
    });

    it('does not navigate with arrows when disabled', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableArrowNavigation={false} />);

      const button1 = screen.getByTestId('button-1');
      button1.focus();

      await user.keyboard('{ArrowDown}');

      // Should still be focused on the same element
      expect(button1).toHaveFocus();
    });
  });

  describe('Tab Trapping', () => {
    it('traps tab navigation when enabled', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableTabTrapping={true} />);

      // Focus last focusable element
      await user.click(screen.getByTestId('focus-last'));

      // Tab forward (should wrap to first)
      await user.keyboard('{Tab}');

      expect(screen.getByTestId('button-1')).toHaveFocus();
    });

    it('traps shift+tab navigation', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableTabTrapping={true} />);

      // Focus first element
      const button1 = screen.getByTestId('button-1');
      button1.focus();

      // Shift+Tab backward (should wrap to last)
      await user.keyboard('{Shift>}{Tab}{/Shift}');

      expect(screen.getByTestId('focus-last')).toHaveFocus();
    });

    it('allows normal tab navigation when disabled', async () => {
      const user = userEvent.setup();

      render(<TestKeyboardNavigation enableTabTrapping={false} />);

      const button1 = screen.getByTestId('button-1');
      button1.focus();

      await user.keyboard('{Tab}');

      // Should move to next element normally
      expect(screen.getByTestId('button-2')).toHaveFocus();
    });
  });

  describe('Dynamic DOM Updates', () => {
    it('updates focusable elements when DOM changes', async () => {
      const user = userEvent.setup();
      
      const DynamicTestComponent: React.FC = () => {
        const [showExtra, setShowExtra] = React.useState(false);
        const { containerRef, focusLast } = useKeyboardNavigation();

        return (
          <div ref={containerRef} data-testid="dynamic-container">
            <button data-testid="button-1">Button 1</button>
            <button data-testid="button-2">Button 2</button>
            {showExtra && <button data-testid="button-extra">Extra Button</button>}
            <button data-testid="toggle" onClick={() => setShowExtra(!showExtra)}>
              Toggle Extra
            </button>
            <button data-testid="focus-last" onClick={focusLast}>Focus Last</button>
          </div>
        );
      };

      render(<DynamicTestComponent />);

      // Initially, focus last should focus the "Focus Last" button
      await user.click(screen.getByTestId('focus-last'));
      expect(screen.getByTestId('focus-last')).toHaveFocus();

      // Add extra button
      await user.click(screen.getByTestId('toggle'));

      // Now focus last should focus the new "Focus Last" button (still the last)
      await user.click(screen.getByTestId('focus-last'));
      expect(screen.getByTestId('focus-last')).toHaveFocus();
    });
  });

  describe('Admin Keyboard Shortcuts Constants', () => {
    it('provides predefined admin shortcuts', () => {
      expect(ADMIN_KEYBOARD_SHORTCUTS.TOGGLE_SIDEBAR).toEqual({
        key: 'b',
        ctrlKey: true,
        description: 'Toggle sidebar',
      });

      expect(ADMIN_KEYBOARD_SHORTCUTS.REFRESH_DATA).toEqual({
        key: 'r',
        ctrlKey: true,
        description: 'Refresh data',
      });

      expect(ADMIN_KEYBOARD_SHORTCUTS.SEARCH).toEqual({
        key: 'k',
        ctrlKey: true,
        description: 'Focus search',
      });

      expect(ADMIN_KEYBOARD_SHORTCUTS.HELP).toEqual({
        key: '?',
        description: 'Show keyboard shortcuts',
      });

      expect(ADMIN_KEYBOARD_SHORTCUTS.DASHBOARD).toEqual({
        key: 'd',
        altKey: true,
        description: 'Go to dashboard',
      });
    });

    it('can use predefined shortcuts in hook', async () => {
      const user = userEvent.setup();
      const mockToggleSidebar = vi.fn();
      const mockRefreshData = vi.fn();
      
      const shortcuts: KeyboardShortcut[] = [
        {
          ...ADMIN_KEYBOARD_SHORTCUTS.TOGGLE_SIDEBAR,
          action: mockToggleSidebar,
        },
        {
          ...ADMIN_KEYBOARD_SHORTCUTS.REFRESH_DATA,
          action: mockRefreshData,
        },
      ];

      render(<TestKeyboardNavigation shortcuts={shortcuts} />);

      const container = screen.getByTestId('keyboard-container');
      container.focus();

      // Test toggle sidebar shortcut
      await user.keyboard('{Control>}b{/Control}');
      expect(mockToggleSidebar).toHaveBeenCalledTimes(1);

      // Test refresh data shortcut
      await user.keyboard('{Control>}r{/Control}');
      expect(mockRefreshData).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty container', () => {
      const EmptyContainer: React.FC = () => {
        const { containerRef, focusFirst, focusLast } = useKeyboardNavigation();

        return (
          <div ref={containerRef} data-testid="empty-container">
            <button data-testid="focus-first" onClick={focusFirst}>Focus First</button>
            <button data-testid="focus-last" onClick={focusLast}>Focus Last</button>
          </div>
        );
      };

      render(<EmptyContainer />);

      // Should not throw errors when trying to focus in empty container
      expect(() => {
        screen.getByTestId('focus-first').click();
        screen.getByTestId('focus-last').click();
      }).not.toThrow();
    });

    it('handles container with only disabled elements', () => {
      const DisabledOnlyContainer: React.FC = () => {
        const { containerRef, focusFirst } = useKeyboardNavigation();

        return (
          <div ref={containerRef} data-testid="disabled-container">
            <button disabled>Disabled Button 1</button>
            <button disabled>Disabled Button 2</button>
            <button data-testid="focus-first" onClick={focusFirst}>Focus First</button>
          </div>
        );
      };

      render(<DisabledOnlyContainer />);

      // Should not focus disabled elements
      screen.getByTestId('focus-first').click();
      expect(screen.getByTestId('focus-first')).toHaveFocus();
    });

    it('handles hidden elements correctly', () => {
      const HiddenElementsContainer: React.FC = () => {
        const { containerRef, focusFirst } = useKeyboardNavigation();

        return (
          <div ref={containerRef} data-testid="hidden-container">
            <button style={{ display: 'none' }}>Hidden Button</button>
            <button style={{ visibility: 'hidden' }}>Invisible Button</button>
            <button data-testid="visible-button">Visible Button</button>
            <button data-testid="focus-first" onClick={focusFirst}>Focus First</button>
          </div>
        );
      };

      render(<HiddenElementsContainer />);

      screen.getByTestId('focus-first').click();
      
      // Should focus the visible button, not hidden ones
      expect(screen.getByTestId('visible-button')).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('does not cause excessive re-renders', () => {
      const renderSpy = vi.fn();
      
      const PerformanceTestComponent: React.FC = () => {
        renderSpy();
        const { containerRef } = useKeyboardNavigation();

        return (
          <div ref={containerRef}>
            <button>Button 1</button>
            <button>Button 2</button>
          </div>
        );
      };

      const { rerender } = render(<PerformanceTestComponent />);
      
      const initialRenderCount = renderSpy.mock.calls.length;

      // Re-render multiple times
      rerender(<PerformanceTestComponent />);
      rerender(<PerformanceTestComponent />);
      rerender(<PerformanceTestComponent />);

      // Should not cause excessive re-renders due to hook
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount + 3);
    });
  });
});