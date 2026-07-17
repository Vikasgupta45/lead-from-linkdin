export interface Lead {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  profileUrl: string;
  avatarUrl?: string;
}

export interface PostLikesRequest {
  postUrl: string;
}

export interface PostLikesResponse {
  success: boolean;
  count: number;
  leads: Lead[];
  error?: string;
}

export interface ActivityLog {
  id: string;
  type: 'visitor_created' | 'search_started' | 'search_success' | 'search_failed' | 'blocked_duplicate' | 'rate_limited' | 'sbl_click' | 'unblock_ip' | 'unblock_visitor';
  ip: string;
  timestamp: string;
  details?: string;
  visitorId?: string;
}

export interface DashboardStats {
  totalVisitors: number;
  successfulSearches: number;
  blockedAttempts: number;
  rateLimitEvents: number;
  sblClicks: number;
  recentActivity: ActivityLog[];
}
