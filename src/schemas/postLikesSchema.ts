import { z } from 'zod';

export const postUrlSchema = z.string()
  .min(1, { message: "Paste a LinkedIn post URL to continue." })
  .max(500, { message: "URL is too long. Please enter a valid URL." })
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        
        // Enforce HTTPS strictly
        if (parsed.protocol !== 'https:') return false;

        const host = parsed.hostname.toLowerCase();
        
        // Enforce strict hostname match (linkedin.com or subdomains like www.linkedin.com)
        if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return false;

        // Prevent SSRF: Reject any loopback, private IP ranges, or localhost names in resolved urls
        if (
          host.includes('localhost') || 
          host.includes('127.0.0.1') || 
          host === '::1' ||
          host.startsWith('169.254.') || // AWS/cloud metadata
          host.startsWith('10.') ||      // Private class A
          host.startsWith('172.16.') ||  // Private class B
          host.startsWith('192.168.')    // Private class C
        ) {
          return false;
        }

        // Validate path format conforms to standard LinkedIn posts, feed updates, or member paths
        const path = parsed.pathname;
        const isValidPath = 
          path.includes('/posts/') || 
          path.includes('/feed/update/urn:li:') ||
          path.includes('/in/');

        return isValidPath;
      } catch {
        return false;
      }
    },
    { message: "Please enter a valid LinkedIn post URL." }
  );

export const postLikesRequestSchema = z.object({
  postUrl: postUrlSchema,
});
