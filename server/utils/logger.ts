function anonymizeIP(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.xxx';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 2) return `${parts[0]}:${parts[1]}:xxxx:xxxx::xxxx`;
  }
  return 'masked_ip';
}

function maskSecrets(value: unknown): unknown {
  if (typeof value === 'string') {
    const isBearer = /Bearer\s+[a-zA-Z0-9_.-]+/i.test(value);
    const isSignedCookie = /s%3A[a-zA-Z0-9_.-]+/i.test(value);
    const isLongSecret = value.length > 32 && /^[a-zA-Z0-9_./+==]+$/.test(value);
    return isBearer || isSignedCookie || isLongSecret ? '[MASKED]' : value;
  }
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => {
      const name = key.toLowerCase();
      const sensitive = ['key', 'secret', 'token', 'cookie', 'authorization', 'password'].some(part => name.includes(part));
      return [key, sensitive ? '[MASKED]' : maskSecrets(nestedValue)];
    }));
  }
  return value;
}

export class Logger {
  static info(message: string, meta: Record<string, unknown> = {}) { this.log('INFO', message, meta); }
  static warn(message: string, meta: Record<string, unknown> = {}) { this.log('WARN', message, meta); }
  static error(message: string, meta: Record<string, unknown> = {}) { this.log('ERROR', message, meta); }

  private static log(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta: Record<string, unknown>) {
    const sanitized = { ...meta };
    if (typeof sanitized.ip === 'string') sanitized.ip = anonymizeIP(sanitized.ip);
    if (typeof sanitized.visitorId === 'string' && sanitized.visitorId.length > 8) sanitized.visitorId = `${sanitized.visitorId.slice(0, 8)}...`;
    const maskedMeta = maskSecrets(sanitized);
    const safeMeta = typeof maskedMeta === 'object' && maskedMeta !== null ? maskedMeta : {};
    const output = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...safeMeta });
    if (level === 'ERROR') console.error(output); else console.log(output);
  }
}
