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
      console.log('🔧 NotificationSettingsProvider: Raw localStorage value:', saved);
      
      const loadedSettings = saved ? JSON.parse(saved) : defaultSettings;
      console.log('🔧 NotificationSettingsProvider: Loaded settings:', loadedSettings);
      console.log('🔧 NotificationSettingsProvider: Default settings:', defaultSettings);
      
      // Validate the loaded settings
      const validatedSettings = {
        showToasts: typeof loadedSettings.showToasts === 'boolean' ? loadedSettings.showToasts : defaultSettings.showToasts,
        soundEnabled: typeof loadedSettings.soundEnabled === 'boolean' ? loadedSettings.soundEnabled : defaultSettings.soundEnabled,
        systemNotifications: typeof loadedSettings.systemNotifications === 'boolean' ? loadedSettings.systemNotifications : defaultSettings.systemNotifications,
        emailNotifications: typeof loadedSettings.emailNotifications === 'boolean' ? loadedSettings.emailNotifications : defaultSettings.emailNotifications,
        marketingNotifications: typeof loadedSettings.marketingNotifications === 'boolean' ? loadedSettings.marketingNotifications : defaultSettings.marketingNotifications,
      };
      
      console.log('🔧 NotificationSettingsProvider: Validated settings:', validatedSettings);
      return validatedSettings;
    } catch (error) {
      console.warn('Failed to load notification settings, using defaults:', error);
      return defaultSettings;
    }
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('storesight_notification_settings', JSON.stringify(settings));
      console.log('🔧 NotificationSettingsProvider: Saved settings:', settings);
    } catch (error) {
      console.warn('Failed to save notification settings:', error);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    console.log('🔧 NotificationSettingsProvider: Updating settings:', newSettings);
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    console.log('🔧 NotificationSettingsProvider: Updating setting:', key, value);
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