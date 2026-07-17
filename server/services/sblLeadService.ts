import { Lead } from '../types/api.js';
import { createAppError, getErrorMessage, getErrorStatusCode } from '../utils/errors.js';

function isSafeLinkedInUrl(value: string, allowedHosts: readonly string[]): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export class SBLLeadService {
  /**
   * Securely retrieves leads that reacted to a specified LinkedIn post from the Apify LinkedIn reactions scraper.
   * This implementation contains ZERO fake, mock, dummy, or hardcoded leads.
   * If SBL API credentials are not configured, it throws an unconfigured error state.
   */
  static async getPostLikes(postUrl: string): Promise<Lead[]> {
    const token = process.env.APIFY_API_TOKEN || process.env.SBL_API_KEY;

    if (!token) {
      throw createAppError('SBL API integration is not configured.', 500);
    }

    // Set up Apify sync execution endpoint
    const endpoint = 'https://api.apify.com/v2/acts/apimaestro~linkedin-post-reactions/run-sync-get-dataset-items?timeout=60';

    // Configure AbortController timeout (50 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          post_urls: [postUrl],
          page_number: 1,
          reaction_type: "ALL",
          limit: 50, // Request only 50 leads to optimize scraper execution runtime/cost
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw createAppError("You've reached the current usage limit. Explore the full SBL platform for more.", 429);
        }
        throw new Error(`Apify scraper API responded with status ${response.status}`);
      }

      const rawItems: unknown = await response.json();

      if (!Array.isArray(rawItems)) {
        throw new Error("Invalid response format returned by SBL API.");
      }

      // Safe Response DTO Mapping
      const mappedLeads: Lead[] = rawItems.flatMap((item: unknown): Lead[] => {
        const record = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
        const reactor = typeof record.reactor === 'object' && record.reactor !== null ? record.reactor as Record<string, unknown> : {};
        const profilePictures = typeof reactor.profile_pictures === 'object' && reactor.profile_pictures !== null ? reactor.profile_pictures as Record<string, unknown> : {};

        const name = typeof reactor.name === 'string' && reactor.name.trim() ? reactor.name.trim().slice(0, 160) : 'LinkedIn Member';
        const title = typeof reactor.headline === 'string' ? reactor.headline.trim().slice(0, 300) : '';
        const profileUrl = typeof reactor.profile_url === 'string' ? reactor.profile_url : '';
        const avatarUrl = [profilePictures.medium, profilePictures.large, profilePictures.small].find((value): value is string => typeof value === 'string') ?? '';

        if (!isSafeLinkedInUrl(profileUrl, ['linkedin.com'])) return [];

        return [{
          name,
          title: title || undefined,
          company: undefined, // Scraper reactions output does not include company
          location: undefined, // Scraper reactions output does not include location
          profileUrl,
          avatarUrl: isSafeLinkedInUrl(avatarUrl, ['linkedin.com', 'licdn.com']) ? avatarUrl : undefined,
        }];
      });

      // Strict limit slicing
      return mappedLeads.slice(0, 50);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      console.error('[SBLLeadService] Scraper API request failed:', getErrorMessage(err));

      if (err instanceof Error && err.name === 'AbortError') {
        throw createAppError('Request timed out. Please try again later.', 504);
      }

      // Re-throw known configuration errors
      if (getErrorStatusCode(err) || getErrorMessage(err).includes('not configured')) {
        throw err;
      }

      throw new Error("Unable to retrieve leads. Please try again.");
    }
  }

  static async startPostLikesJob(postUrl: string): Promise<{ runId: string; datasetId: string }> {
    const token = process.env.APIFY_API_TOKEN || process.env.SBL_API_KEY;
    if (!token) {
      throw createAppError('SBL API integration is not configured.', 500);
    }
    const endpoint = `https://api.apify.com/v2/acts/apimaestro~linkedin-post-reactions/runs?token=${token}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_urls: [postUrl],
        page_number: 1,
        reaction_type: "ALL",
        limit: 50,
      }),
    });
    if (!response.ok) {
      throw new Error(`Apify start run API responded with status ${response.status}`);
    }
    const result: any = await response.json();
    const runId = result.data?.id;
    const datasetId = result.data?.defaultDatasetId;
    if (!runId || !datasetId) {
      throw new Error("Invalid response received from Apify while starting background job.");
    }
    return { runId, datasetId };
  }

  static async checkJobStatus(runId: string): Promise<'processing' | 'completed' | 'failed'> {
    const token = process.env.APIFY_API_TOKEN || process.env.SBL_API_KEY;
    if (!token) {
      throw createAppError('SBL API integration is not configured.', 500);
    }
    const endpoint = `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Apify get run API responded with status ${response.status}`);
    }
    const result: any = await response.json();
    const status = result.data?.status;
    if (status === 'SUCCEEDED') return 'completed';
    if (status === 'RUNNING' || status === 'READY' || status === 'QUEUED') return 'processing';
    return 'failed';
  }

  static async fetchDatasetLeads(datasetId: string): Promise<Lead[]> {
    const token = process.env.APIFY_API_TOKEN || process.env.SBL_API_KEY;
    if (!token) {
      throw createAppError('SBL API integration is not configured.', 500);
    }
    const endpoint = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Apify get dataset items API responded with status ${response.status}`);
    }
    const rawItems: unknown = await response.json();
    if (!Array.isArray(rawItems)) {
      throw new Error("Invalid response format returned by SBL API.");
    }

    const mappedLeads: Lead[] = rawItems.flatMap((item: unknown): Lead[] => {
      const record = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
      const reactor = typeof record.reactor === 'object' && record.reactor !== null ? record.reactor as Record<string, unknown> : {};
      const profilePictures = typeof reactor.profile_pictures === 'object' && reactor.profile_pictures !== null ? reactor.profile_pictures as Record<string, unknown> : {};

      const name = typeof reactor.name === 'string' && reactor.name.trim() ? reactor.name.trim().slice(0, 160) : 'LinkedIn Member';
      const title = typeof reactor.headline === 'string' ? reactor.headline.trim().slice(0, 300) : '';
      const profileUrl = typeof reactor.profile_url === 'string' ? reactor.profile_url : '';
      const avatarUrl = [profilePictures.medium, profilePictures.large, profilePictures.small].find((value): value is string => typeof value === 'string') ?? '';

      if (!isSafeLinkedInUrl(profileUrl, ['linkedin.com'])) return [];

      return [{
        name,
        title: title || undefined,
        company: undefined,
        location: undefined,
        profileUrl,
        avatarUrl: isSafeLinkedInUrl(avatarUrl, ['linkedin.com', 'licdn.com']) ? avatarUrl : undefined,
      }];
    });

    return mappedLeads.slice(0, 50);
  }
}
