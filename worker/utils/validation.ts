/**
 * Validates a URL for security and format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // No private IPs or localhost
    const hostname = parsed.hostname.toLowerCase();
    const privatePatterns = [
      'localhost',
      '127.',
      '192.168.',
      '10.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
      '0.0.0.0',
      '::1',
      'fe80:',
      'fc00:',
      'fd00:'
    ];
    
    if (privatePatterns.some(pattern => hostname.startsWith(pattern))) {
      return false;
    }
    
    // Max URL length
    if (url.length > 2048) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates an email address
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 compliant regex (simplified)
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
}

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 2048);
}
