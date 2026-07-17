import { PostLikesResponse } from '../types/api';

export class PostLikesService {
  /**
   * Securely queries the backend API to retrieve people who liked the LinkedIn post.
   */
  static async findLeads(postUrl: string): Promise<PostLikesResponse> {
    try {
      const visitorId = localStorage.getItem('sbl_visitor_id') || '';
      const response = await fetch('/api/leads/post-likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': visitorId,
        },
        body: JSON.stringify({ postUrl }),
      });

      // Parse JSON response
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          count: 0,
          leads: [],
          error: data.error || "We couldn't retrieve leads right now. Please try again.",
          code: data.code,
        };
      }

      // If the backend returned cached results immediately, return them
      if (data.status === 'completed') {
        return {
          success: true,
          count: data.count,
          leads: data.leads,
        };
      }

      // Otherwise, poll the job status
      const jobId = data.jobId;
      return new Promise<PostLikesResponse>((resolve) => {
        const intervalId = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/leads/job/${jobId}`, {
              method: 'GET',
              headers: {
                'X-Visitor-Id': visitorId,
              },
            });

            const statusData = await statusResponse.json();

            if (!statusResponse.ok) {
              clearInterval(intervalId);
              resolve({
                success: false,
                count: 0,
                leads: [],
                error: statusData.error || "Failed to check search status.",
              });
              return;
            }

            if (statusData.status === 'completed') {
              clearInterval(intervalId);
              resolve({
                success: true,
                count: statusData.count,
                leads: statusData.leads,
              });
            } else if (statusData.status === 'failed') {
              clearInterval(intervalId);
              resolve({
                success: false,
                count: 0,
                leads: [],
                error: statusData.error || "Scraper job execution failed.",
              });
            }
          } catch (e: any) {
            clearInterval(intervalId);
            resolve({
              success: false,
              count: 0,
              leads: [],
              error: "Connection lost while fetching leads. Please try again.",
            });
          }
        }, 2000);
      });
    } catch (err: unknown) {
      console.error('[PostLikesService] Network fetch error:', err instanceof Error ? err.message : 'Unknown error');
      return {
        success: false,
        count: 0,
        leads: [],
        error: "Unable to connect to the lead data service. Please try again later.",
      };
    }
  }
}
