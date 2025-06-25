import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, CheckIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { CompetitorSuggestion } from '../../api';
import { getCompetitorSuggestions, approveSuggestion, ignoreSuggestion } from '../../api';
import { useNotifications } from '../../hooks/useNotifications';

interface SuggestionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestionUpdate: () => void;
  isDemoMode?: boolean;
  demoSuggestions?: CompetitorSuggestion[];
}

export const SuggestionDrawer: React.FC<SuggestionDrawerProps> = ({ 
  isOpen, 
  onClose, 
  onSuggestionUpdate,
  isDemoMode = false,
  demoSuggestions = []
}) => {
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notifications = useNotifications();

  useEffect(() => {
    if (isOpen) {
      if (isDemoMode) {
        // Use demo suggestions
        setSuggestions(demoSuggestions);
        setLoading(false);
      } else {
        // Fetch real suggestions
        fetchSuggestions();
      }
    }
  }, [isOpen, isDemoMode, demoSuggestions]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getCompetitorSuggestions(0, 20, 'NEW');
      setSuggestions(response.content);
      onSuggestionUpdate();
    } catch (err) {
      setError('Failed to load suggestions');
      notifications.showError('Failed to load suggestions', {
        category: 'Competitors'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestion: CompetitorSuggestion) => {
    setActionLoading(suggestion.id);
    try {
      if (isDemoMode) {
        // In demo mode, just simulate the action
        notifications.showSuccess('Demo: Competitor approved - now tracking prices!', {
          category: 'Competitors'
        });
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        onSuggestionUpdate();
      } else {
        await approveSuggestion(suggestion.id);
        notifications.showSuccess('Competitor approved - now tracking prices!', {
          persistent: true,
          category: 'Competitors'
        });
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        onSuggestionUpdate();
      }
    } catch (error) {
      notifications.showError('Failed to approve suggestion', {
        persistent: true,
        category: 'Competitors'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleIgnore = async (suggestion: CompetitorSuggestion) => {
    setActionLoading(suggestion.id);
    try {
      if (isDemoMode) {
        // In demo mode, just simulate the action
        notifications.showSuccess('Demo: Suggestion ignored', {
          category: 'Competitors'
        });
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        onSuggestionUpdate();
      } else {
        await ignoreSuggestion(suggestion.id);
        notifications.showSuccess('Suggestion ignored', {
          category: 'Competitors'
        });
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        onSuggestionUpdate();
      }
    } catch (error) {
      notifications.showError('Failed to ignore suggestion', {
        persistent: true,
        category: 'Competitors'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return 'Price not available';
    return `$${price.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-lg font-medium text-gray-900">
                          Competitor Suggestions
                          {isDemoMode && <span className="ml-2 text-sm text-orange-600">(Demo)</span>}
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="relative -m-2 p-2 text-gray-400 hover:text-gray-500"
                            onClick={onClose}
                          >
                            <span className="absolute -inset-0.5" />
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-8">
                        {loading ? (
                          <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="animate-pulse">
                                <div className="bg-gray-200 rounded-lg p-4">
                                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                                  <div className="h-3 bg-gray-300 rounded w-1/2 mb-3"></div>
                                  <div className="flex space-x-2">
                                    <div className="h-8 bg-gray-300 rounded w-16"></div>
                                    <div className="h-8 bg-gray-300 rounded w-16"></div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : suggestions.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="mx-auto h-12 w-12 text-gray-400">
                              <svg
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 3.138 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 3.138 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 0 1.946-.806M7.835 4.697l-3.42 12.861a3.42 3.42 0 0 0 3.138 0l3.138-12.861a3.42 3.42 0 0 1 3.138 0l3.138 12.861a3.42 3.42 0 0 0 3.138 0L14.165 4.697a3.42 3.42 0 0 1 3.138 0z"
                                />
                              </svg>
                            </div>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                              No new suggestions
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {isDemoMode 
                                ? 'Demo mode: No more suggestions to show.'
                                : 'We\'ll discover new competitors automatically and show them here.'
                              }
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {suggestions.map((suggestion) => (
                              <div
                                key={suggestion.id}
                                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                              >
                                <div className="mb-3">
                                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                                    {suggestion.title || 'Competitor Product'}
                                  </h4>
                                  <p className="text-xs text-gray-600 truncate">
                                    {suggestion.suggestedUrl}
                                  </p>
                                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                    <span>{formatPrice(suggestion.price)}</span>
                                    <span>Found {formatDate(suggestion.discoveredAt)}</span>
                                  </div>
                                </div>
                                
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleApprove(suggestion)}
                                    disabled={actionLoading === suggestion.id}
                                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-xs font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                  >
                                    {actionLoading === suggestion.id ? (
                                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <>
                                        <CheckIcon className="h-4 w-4 mr-1" />
                                        Approve
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleIgnore(suggestion)}
                                    disabled={actionLoading === suggestion.id}
                                    className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-md text-xs font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                  >
                                    {actionLoading === suggestion.id ? (
                                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <>
                                        <XCircleIcon className="h-4 w-4 mr-1" />
                                        Ignore
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}; 