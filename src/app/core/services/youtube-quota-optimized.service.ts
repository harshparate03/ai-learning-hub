import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, Subject } from 'rxjs';
import { catchError, finalize, share } from 'rxjs/operators';

/** Cached search result with expiration */
interface CachedSearchResult {
  results: YouTubeSearchResult[];
  timestamp: number;
}

/** YouTube search result item */
export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelName: string;
  publishedAt: string;
  thumbnail: string;
}

/** Search response structure */
export interface SearchResponse {
  success: boolean;
  results: YouTubeSearchResult[];
  message?: string;
  quotaExceeded?: boolean;
}

@Injectable({ providedIn: 'root' })
export class YoutubeQuotaOptimizedService {
  private SEARCH_URL = '/api/youtube-search';
  private CACHE_KEY_PREFIX = 'yt_search_';
  private CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  private MAX_RESULTS = 25;

  // Track in-flight requests to prevent duplicates
  private pendingRequests = new Map<string, Observable<SearchResponse>>();
  public quotaExceeded$ = new Subject<boolean>();

  constructor(private http: HttpClient) {
    this.initializeQuotaState();
  }

  /**
   * Initialize quota exceeded state from localStorage
   */
  private initializeQuotaState(): void {
    const quotaState = localStorage.getItem('yt_quota_exceeded');
    if (quotaState) {
      const { exceeded, timestamp } = JSON.parse(quotaState);
      if (exceeded && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        this.quotaExceeded$.next(true);
      } else {
        localStorage.removeItem('yt_quota_exceeded');
        this.quotaExceeded$.next(false);
      }
    }
  }

  /**
   * Search YouTube videos with quota optimization
   * - Check cache first (24-hour TTL)
   * - Prevent duplicate in-flight requests
   * - Handle quota exceeded errors gracefully
   * - Store results in localStorage
   */
  searchVideos(query: string): Observable<SearchResponse> {
    if (!query || query.trim().length < 3) {
      return of({
        success: false,
        results: [],
        message: 'Query must be at least 3 characters'
      });
    }

    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `${this.CACHE_KEY_PREFIX}${this.hashQuery(normalizedQuery)}`;

    // Check localStorage cache first
    const cached = this.getCachedResults(cacheKey);
    if (cached) {
      console.log('[YouTube Search] Cache hit for query:', normalizedQuery);
      return of({
        success: true,
        results: cached,
        message: 'Results from cache (24h)'
      });
    }

    // Prevent duplicate in-flight requests
    if (this.pendingRequests.has(normalizedQuery)) {
      console.log('[YouTube Search] Duplicate request prevented:', normalizedQuery);
      return this.pendingRequests.get(normalizedQuery)!;
    }

    const request$ = this.makeAPIRequest(normalizedQuery, cacheKey).pipe(
      share(),
      finalize(() => this.pendingRequests.delete(normalizedQuery))
    );
    this.pendingRequests.set(normalizedQuery, request$);

    return request$;
  }

  /**
   * Make actual API request to YouTube
   */
  private makeAPIRequest(query: string, cacheKey: string): Observable<SearchResponse> {
    console.log('[YouTube Search] Making API request for:', query);

    return new Observable(observer => {
      this.http.get<any>(this.SEARCH_URL, {
        params: {
          q: query,
          type: 'video',
          maxResults: this.MAX_RESULTS.toString(),
          order: 'relevance'
        }
      }).subscribe({
        next: (response) => {
          const results = this.parseSearchResults(response.items || []);
          
          // Cache results
          this.setCachedResults(cacheKey, results);
          this.setQuotaExceededState(false);

          observer.next({
            success: true,
            results,
            message: `Found ${results.length} videos`
          });
          observer.complete();
        },
        error: (error: HttpErrorResponse) => {
          const errBody = error.error || {};
          const errMsg = errBody.error?.message || errBody.message || 'Unknown error';
          console.error('[YouTube Search] API Error:', error.status, errMsg);

          // Check if quota exceeded
          if (this.isQuotaExceededError(error)) {
            this.setQuotaExceededState(true);
            observer.next({
              success: false,
              results: [],
              message: 'YouTube API quota exceeded. Please try again in 24 hours.',
              quotaExceeded: true
            });
          } else {
            observer.next({
              success: false,
              results: [],
              message: `Search failed: ${errMsg}`
            });
          }
          observer.complete();
        }
      });
    });
  }

  /**
   * Parse YouTube API response items
   */
  private parseSearchResults(items: any[]): YouTubeSearchResult[] {
    return items
      .map(item => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title || 'Untitled',
        channelName: item.snippet?.channelTitle || 'Unknown Channel',
        publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
        thumbnail: item.snippet?.thumbnails?.medium?.url || ''
      }))
      .filter(result => result.videoId && result.thumbnail); // Ensure valid results
  }

  /**
   * Get cached search results if still valid
   */
  private getCachedResults(cacheKey: string): YouTubeSearchResult[] | null {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const { results, timestamp }: CachedSearchResult = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < this.CACHE_DURATION_MS) {
        return results;
      } else {
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Store search results in localStorage
   */
  private setCachedResults(cacheKey: string, results: YouTubeSearchResult[]): void {
    try {
      const cacheData: CachedSearchResult = {
        results,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch {
      console.warn('[YouTube Search] Failed to cache results');
    }
  }

  /**
   * Check if error is quota exceeded
   */
  private isQuotaExceededError(error: HttpErrorResponse): boolean {
    const body = error.error || {};
    const nested = body.error || {};
    const message = String(nested.message || body.message || '');
    const reason = nested.errors?.[0]?.reason || '';
    const quotaErrorCodes = ['quotaExceeded', 'YouTube.QuotaExceeded'];
    return quotaErrorCodes.some(code => message.includes(code) || reason.includes(code)) ||
           (error.status === 403 && message.toLowerCase().includes('quota'));
  }

  /**
   * Store quota exceeded state in localStorage
   */
  private setQuotaExceededState(exceeded: boolean): void {
    if (exceeded) {
      localStorage.setItem('yt_quota_exceeded', JSON.stringify({
        exceeded: true,
        timestamp: Date.now()
      }));
      this.quotaExceeded$.next(true);
    } else {
      localStorage.removeItem('yt_quota_exceeded');
      this.quotaExceeded$.next(false);
    }
  }

  /**
   * Simple hash function for query normalization
   */
  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cache info for debugging
   */
  getCacheInfo(): { size: number; keys: string[] } {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    return { size: keys.length, keys };
  }

  /**
   * Clear all cached search results
   */
  clearCache(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
    console.log('[YouTube Search] Cache cleared');
  }
}
