/**
 * Sends a background request to record redirection clicks to SBL.so
 */
export const trackClick = async (linkType: string): Promise<void> => {
  try {
    const visitorId = localStorage.getItem('sbl_visitor_id') || '';
    await fetch('/api/leads/track-click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Visitor-Id': visitorId
      },
      body: JSON.stringify({ linkType })
    });
  } catch (err) {
    console.error('[Analytics] Failed to track click redirect:', err);
  }
};
