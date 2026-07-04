import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  X as CloseIcon,
  Keyboard as KeyboardIcon,
} from 'lucide-react';
import type { KeyboardShortcut } from '../../hooks/useKeyboardNavigation';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

interface ShortcutGroup {
  title: string;
  shortcuts: KeyboardShortcut[];
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose,
  shortcuts,
}) => {
  const theme = useTheme();

  // Group shortcuts by category
  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Navigation',
      shortcuts: shortcuts.filter(s => 
        s.key === 'd' || s.key === 'h' || s.key === 's' || 
        s.key === 'a' || s.key === 'm' || s.key === 'b'
      ),
    },
    {
      title: 'Actions',
      shortcuts: shortcuts.filter(s => 
        s.key === 'r' || s.key === 'k' || s.key === 'Escape'
      ),
    },
    {
      title: 'General',
      shortcuts: shortcuts.filter(s => s.key === '?'),
    },
  ];

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys = [];
    
    if (shortcut.ctrlKey) keys.push('Ctrl');
    if (shortcut.altKey) keys.push('Alt');
    if (shortcut.shiftKey) keys.push('Shift');
    if (shortcut.metaKey) keys.push('Cmd');
    
    keys.push(shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase());
    
    return keys;
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="keyboard-shortcuts-title"
      aria-describedby="keyboard-shortcuts-description"
      onKeyDown={handleKeyDown}
    >
      <DialogTitle
        id="keyboard-shortcuts-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyboardIcon color="#2f5bea" />
          <Typography variant="h6" component="h2">
            Keyboard Shortcuts
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close keyboard shortcuts help"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent id="keyboard-shortcuts-description">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use these keyboard shortcuts to navigate and interact with the admin interface more efficiently.
        </Typography>

        {shortcutGroups.map((group, groupIndex) => (
          <Box key={group.title} sx={{ mb: 3 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: 'primary.main',
                mb: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {group.title}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {group.shortcuts.map((shortcut, index) => (
                <Box
                  key={`${group.title}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1,
                    px: 2,
                    borderRadius: 1,
                    backgroundColor: theme.palette.grey[50],
                    border: `1px solid ${theme.palette.grey[200]}`,
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {shortcut.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {formatShortcut(shortcut).map((key, keyIndex) => (
                      <Chip
                        key={keyIndex}
                        label={key}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.75rem',
                          height: 24,
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          backgroundColor: theme.palette.background.paper,
                          borderColor: theme.palette.grey[300],
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {groupIndex < shortcutGroups.length - 1 && (
              <Divider sx={{ mt: 3 }} />
            )}
          </Box>
        ))}

        <Box
          sx={{
            mt: 4,
            p: 2,
            backgroundColor: theme.palette.info.light,
            borderRadius: 1,
            border: `1px solid ${theme.palette.info.main}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Accessibility Tips:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2 }}>
            <li>Use Tab and Shift+Tab to navigate between interactive elements</li>
            <li>Use Arrow keys to navigate within menus and lists</li>
            <li>Press Enter or Space to activate buttons and links</li>
            <li>Press Escape to close dialogs and menus</li>
            <li>Screen reader users can use landmarks and headings for navigation</li>
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="contained" autoFocus>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KeyboardShortcutsHelp;