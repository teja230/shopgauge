import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface NotificationSettings {
  showToasts: boolean;
  soundEnabled: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
  marketingNotifications: boolean;
}

interface NotificationSettingsContextType {
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  updateSetting: (key: keyof NotificationSettings, value: boolean) => void;
}

const NotificationSettingsContext = createContext<NotificationSettingsContextType | undefined>(undefined);

const defaultSettings: NotificationSettings = {
  showToasts: true,
  soundEnabled: false,
  systemNotifications: true,
  emailNotifications: true,
  marketingNotifications: false,
};

export const NotificationSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    // Load settings from localStorage on initialization
    try {
      const saved = localStorage.getItem('storesight_notification_settings');
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch (error) {
      console.warn('Failed to load notification settings, using defaults:', error);
      return defaultSettings;
    }
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('storesight_notification_settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save notification settings:', error);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <NotificationSettingsContext.Provider value={{ settings, updateSettings, updateSetting }}>
      {children}
    </NotificationSettingsContext.Provider>
  );
};

export const useNotificationSettings = () => {
  const context = useContext(NotificationSettingsContext);
  if (context === undefined) {
    throw new Error('useNotificationSettings must be used within a NotificationSettingsProvider');
  }
  return context;
}; 