export interface Lead {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  profileUrl: string;
  avatarUrl?: string;
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
