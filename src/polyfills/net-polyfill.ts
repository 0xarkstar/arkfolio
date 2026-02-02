/**
 * Browser polyfill for Node.js 'net' module
 * Provides isIP function needed by CCXT's node-fetch
 */

/**
 * Check if string is an IP address
 * @returns 0 = invalid, 4 = IPv4, 6 = IPv6
 */
export function isIP(input: string): number {
  if (isIPv4(input)) return 4;
  if (isIPv6(input)) return 6;
  return 0;
}

/**
 * Check if string is IPv4 address
 */
export function isIPv4(input: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(input)) return false;

  const parts = input.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Check if string is IPv6 address
 */
export function isIPv6(input: string): boolean {
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(input) || /^::1$/.test(input) || /^::$/.test(input);
}

export default {
  isIP,
  isIPv4,
  isIPv6,
};
