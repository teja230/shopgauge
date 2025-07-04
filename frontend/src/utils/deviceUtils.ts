/**
 * Device and browser detection utilities for session management
 */

interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  device: string;
  isMobile: boolean;
  isDesktop: boolean;
  isTablet: boolean;
  deviceIcon: string;
  browserIcon: string;
}

/**
 * Parse user agent string to extract device and browser information
 */
export const parseUserAgent = (userAgent: string): DeviceInfo => {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      device: 'Unknown Device',
      isMobile: false,
      isDesktop: true,
      isTablet: false,
      deviceIcon: '🖥️',
      browserIcon: '🌐'
    };
  }

  // Browser detection
  let browser = 'Unknown';
  let browserVersion = '';
  let browserIcon = '🌐';

  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
    browserIcon = '🟡';
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    browserVersion = match ? match[1].split('.')[0] : '';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
    browserIcon = '🟠';
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    browserVersion = match ? match[1].split('.')[0] : '';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    browserIcon = '🔵';
    const match = userAgent.match(/Version\/([0-9.]+)/);
    browserVersion = match ? match[1].split('.')[0] : '';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
    browserIcon = '🟢';
    const match = userAgent.match(/Edg\/([0-9.]+)/);
    browserVersion = match ? match[1].split('.')[0] : '';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
    browserIcon = '🔴';
    const match = userAgent.match(/(Opera|OPR)\/([0-9.]+)/);
    browserVersion = match ? match[2].split('.')[0] : '';
  }

  // OS detection
  let os = 'Unknown';
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  // Device type detection
  const isMobile = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android.*Tablet|Kindle/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;

  // Device name
  let device = 'Unknown Device';
  let deviceIcon = '🖥️';

  if (userAgent.includes('iPhone')) {
    device = 'iPhone';
    deviceIcon = '📱';
  } else if (userAgent.includes('iPad')) {
    device = 'iPad';
    deviceIcon = '📱';
  } else if (userAgent.includes('Android')) {
    if (isTablet) {
      device = 'Android Tablet';
      deviceIcon = '📱';
    } else {
      device = 'Android Phone';
      deviceIcon = '📱';
    }
  } else if (userAgent.includes('Windows')) {
    device = 'Windows PC';
    deviceIcon = '🖥️';
  } else if (userAgent.includes('Mac')) {
    device = 'Mac';
    deviceIcon = '🖥️';
  } else if (userAgent.includes('Linux')) {
    device = 'Linux PC';
    deviceIcon = '🖥️';
  } else if (isMobile) {
    device = 'Mobile Device';
    deviceIcon = '📱';
  } else if (isTablet) {
    device = 'Tablet';
    deviceIcon = '📱';
  } else {
    device = 'Desktop';
    deviceIcon = '🖥️';
  }

  return {
    browser,
    browserVersion,
    os,
    device,
    isMobile,
    isDesktop,
    isTablet,
    deviceIcon,
    browserIcon
  };
};

/**
 * Get current device information
 */
export const getCurrentDeviceInfo = (): DeviceInfo => {
  return parseUserAgent(navigator.userAgent);
};

/**
 * Generate a human-readable device description
 */
export const getDeviceDescription = (userAgent: string, ipAddress?: string): string => {
  const deviceInfo = parseUserAgent(userAgent);
  
  let description = `${deviceInfo.device}`;
  
  if (deviceInfo.browser !== 'Unknown') {
    description += ` • ${deviceInfo.browser}`;
    if (deviceInfo.browserVersion) {
      description += ` ${deviceInfo.browserVersion}`;
    }
  }
  
  if (deviceInfo.os !== 'Unknown') {
    description += ` • ${deviceInfo.os}`;
  }
  
  return description;
};

/**
 * Get device display name with icon
 */
export const getDeviceDisplay = (userAgent: string): { name: string; icon: string; subtitle: string } => {
  const deviceInfo = parseUserAgent(userAgent);
  
  const name = deviceInfo.device;
  const icon = deviceInfo.deviceIcon;
  const subtitle = `${deviceInfo.browser} on ${deviceInfo.os}`;
  
  return { name, icon, subtitle };
};

/**
 * Check if device is current device
 */
export const isCurrentDevice = (userAgent: string): boolean => {
  const current = getCurrentDeviceInfo();
  const target = parseUserAgent(userAgent);
  
  return (
    current.browser === target.browser &&
    current.os === target.os &&
    current.device === target.device
  );
};

/**
 * Get relative time string for last accessed
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Get location from IP address (simplified)
 */
export const getLocationFromIP = (ipAddress: string): string => {
  // This is a simplified version. In production, you might want to use a geolocation service
  if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
    return 'Local Network';
  }
  
  // You could integrate with a service like ipapi.co or similar
  return 'Unknown Location';
}; 