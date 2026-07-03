import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Fuse from 'fuse.js';
import {
  Search,
  Home,
  LayoutDashboard,
  Radar,
  Sparkles,
  User,
  ShieldCheck,
  FileText,
  LogOut,
  Bell,
  RefreshCw,
  Link2,
  MessageCircleQuestion,
  CornerDownLeft,
  History,
} from 'lucide-react';
import { searchIndex } from '../lib/searchIndex';
import type { SearchItem } from '../lib/searchIndex';

type CommandGroup = 'Navigate' | 'Actions' | 'Recent';

interface Command {
  id: string;
  name: string;
  keywords?: string;
  group: CommandGroup;
  icon: React.ReactNode;
  action: () => void;
}

const RECENTS_KEY = 'shopgauge-palette-recents';

const routeIcon = (path: string): React.ReactNode => {
  const props = { size: 16, strokeWidth: 2 };
  switch (path) {
    case '/':
      return <Home {...props} />;
    case '/dashboard':
      return <LayoutDashboard {...props} />;
    case '/competitors':
      return <Radar {...props} />;
    case '/business-intelligence':
      return <Sparkles {...props} />;
    case '/profile':
      return <User {...props} />;
    case '/admin':
      return <ShieldCheck {...props} />;
    case '/privacy-policy':
      return <FileText {...props} />;
    case '!logout':
      return <LogOut {...props} />;
    default:
      return <Search {...props} />;
  }
};

const loadRecents = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch {
    return [];
  }
};

const pushRecent = (id: string) => {
  const next = [id, ...loadRecents().filter((r) => r !== id)].slice(0, 5);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
};

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = searchIndex.map((item: SearchItem) => ({
      id: `nav:${item.action}`,
      name: item.name,
      keywords: item.keywords,
      group: 'Navigate',
      icon: routeIcon(item.action),
      action:
        item.action === '!logout'
          ? () => (window.location.href = '/?logout=true')
          : () => navigate(item.action),
    }));

    const actions: Command[] = [
      {
        id: 'act:notifications',
        name: 'Open notifications',
        keywords: 'notifications alerts bell inbox unread',
        group: 'Actions',
        icon: <Bell size={16} strokeWidth={2} />,
        action: () => window.dispatchEvent(new CustomEvent('shopgauge:open-notifications')),
      },
      {
        id: 'act:refresh-dashboard',
        name: 'Refresh dashboard data',
        keywords: 'refresh reload sync data update',
        group: 'Actions',
        icon: <RefreshCw size={16} strokeWidth={2} />,
        action: () => {
          if (location.pathname !== '/dashboard') navigate('/dashboard');
          window.dispatchEvent(new CustomEvent('shopgauge:refresh-dashboard'));
        },
      },
      {
        id: 'act:copy-link',
        name: 'Copy current page link',
        keywords: 'copy link url share clipboard',
        group: 'Actions',
        icon: <Link2 size={16} strokeWidth={2} />,
        action: () => navigator.clipboard?.writeText(window.location.href),
      },
    ];

    return [...nav, ...actions];
  }, [navigate, location.pathname]);

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['name', 'keywords'],
        threshold: 0.3,
      }),
    [commands]
  );

  const askShopGpt = useMemo<Command | null>(() => {
    if (!query.trim()) return null;
    const q = query.trim();
    return {
      id: 'act:ask-shopgpt',
      name: `Ask ShopGPT: "${q}"`,
      group: 'Actions',
      icon: <MessageCircleQuestion size={16} strokeWidth={2} />,
      action: () => navigate(`/business-intelligence?ask=${encodeURIComponent(q)}`),
    };
  }, [query, navigate]);

  const results: Command[] = useMemo(() => {
    if (query) {
      const matched = fuse.search(query).map((r: { item: Command }) => r.item);
      return askShopGpt ? [...matched, askShopGpt] : matched;
    }
    const recents = loadRecents()
      .map((id) => commands.find((c) => c.id === id))
      .filter((c): c is Command => Boolean(c))
      .map((c) => ({ ...c, group: 'Recent' as CommandGroup, id: `recent:${c.id}` }));
    return [...recents, ...commands];
  }, [query, fuse, commands, askShopGpt]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    const openHandler = () => setIsOpen(true);

    window.addEventListener('keydown', handler);
    window.addEventListener('shopgauge:open-command-palette', openHandler);

    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('shopgauge:open-command-palette', openHandler);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  const close = () => {
    setIsOpen(false);
    setQuery('');
    // Headless UI restores focus to the trigger button on close; blur it so a
    // trailing Enter keyup can't immediately re-open the palette.
    setTimeout(() => (document.activeElement as HTMLElement | null)?.blur?.(), 0);
  };

  const onSelect = (cmd: Command) => {
    pushRecent(cmd.id.replace(/^recent:/, ''));
    cmd.action();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      onSelect(results[activeIndex]);
    }
  };

  // Keep the active row in view while arrowing through results
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let lastGroup: CommandGroup | null = null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[1400]" onClose={close} open={isOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-[#101820]/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto lg:pl-64">
          <div className="flex min-h-full items-start justify-center p-4 pt-[12vh] text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95 -translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-xl bg-white text-left align-middle shadow-[0_40px_90px_-30px_rgba(16,24,32,0.55)] ring-1 ring-black/5 transition-all">
                <div className="flex items-center gap-3 border-b border-[#e4e7eb] px-4 py-3.5">
                  <Search size={18} className="shrink-0 text-[#5f6b76]" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Search pages, run actions, or ask ShopGPT…"
                    className="w-full border-none bg-transparent text-[15px] text-[#101820] outline-none placeholder:text-[#98a1ab]"
                  />
                  <kbd className="hidden shrink-0 rounded border border-[#e4e7eb] bg-[#f6f7f9] px-1.5 py-0.5 text-[11px] font-bold text-[#5f6b76] sm:block">
                    esc
                  </kbd>
                </div>

                <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2">
                  {results.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-[#5f6b76]">
                      No matches. Press <span className="font-bold">Enter</span> to ask ShopGPT.
                    </p>
                  ) : (
                    results.map((cmd, index) => {
                      const showHeader = cmd.group !== lastGroup;
                      lastGroup = cmd.group;
                      const active = index === activeIndex;
                      return (
                        <Fragment key={cmd.id}>
                          {showHeader && (
                            <p className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-[11px] font-black uppercase tracking-wide text-[#98a1ab] first:pt-1">
                              {cmd.group === 'Recent' && <History size={11} strokeWidth={2.5} />}
                              {cmd.group}
                            </p>
                          )}
                          <button
                            type="button"
                            data-index={index}
                            onClick={() => onSelect(cmd)}
                            onMouseMove={() => setActiveIndex(index)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-100 ${
                              active ? 'bg-[#2f5bea]/8 text-[#2f5bea]' : 'text-[#101820]'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                                active
                                  ? 'border-[#2f5bea]/25 bg-[#2f5bea]/10 text-[#2f5bea]'
                                  : 'border-[#e4e7eb] bg-[#f6f7f9] text-[#5f6b76]'
                              }`}
                            >
                              {cmd.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{cmd.name}</span>
                            {active && <CornerDownLeft size={14} className="shrink-0 text-[#98a1ab]" />}
                          </button>
                        </Fragment>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-4 border-t border-[#e4e7eb] bg-[#f6f7f9] px-4 py-2 text-[11px] font-bold text-[#98a1ab]">
                  <span>
                    <kbd className="rounded border border-[#e4e7eb] bg-white px-1 py-0.5">↑↓</kbd> navigate
                  </span>
                  <span>
                    <kbd className="rounded border border-[#e4e7eb] bg-white px-1 py-0.5">↵</kbd> select
                  </span>
                  <span className="ml-auto">ShopGauge command</span>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CommandPalette;
