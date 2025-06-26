import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import Fuse from 'fuse.js';
import { Box, Typography, IconButton, List, ListItemButton, ListItemText } from '@mui/material';
import { searchIndex } from '../lib/searchIndex';
import type { SearchItem } from '../lib/searchIndex';

interface Command {
  name: string;
  keywords?: string;
  action: () => void;
}

const buildCommands = (navigate: ReturnType<typeof useNavigate>): Command[] => {
  return searchIndex.map((item: SearchItem) => {
    if (item.action === '!logout') {
      return {
        name: item.name,
        keywords: item.keywords,
        action: () => (window.location.href = '/?logout=true'),
      } as Command;
    }
    return {
      name: item.name,
      keywords: item.keywords,
      action: () => navigate(item.action),
    } as Command;
  });
};

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const commands = useMemo(() => buildCommands(navigate), [navigate]);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['name', 'keywords'],
        threshold: 0.3,
      }),
    [commands]
  );

  const results: Command[] = query ? fuse.search(query).map((r: any) => r.item) : commands;

  // Keyboard shortcut handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  const onSelect = (cmd: Command) => {
    cmd.action();
    close();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={close} open={isOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <SearchIcon />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type a command or search…"
                    className="w-full outline-none border-none text-gray-700 placeholder-gray-400"
                  />
                  <IconButton size="small" onClick={close}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </div>
                <Box maxHeight={300} overflow="auto">
                  {results.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" px={2}>
                      No commands found.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {results.map((cmd: Command) => (
                        <ListItemButton key={cmd.name} onClick={() => onSelect(cmd)}>
                          <ListItemText primary={cmd.name} />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </Box>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CommandPalette; 