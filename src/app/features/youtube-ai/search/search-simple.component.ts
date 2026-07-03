import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { YoutubeQuotaOptimizedService, YouTubeSearchResult } from '../../../core/services/youtube-quota-optimized.service';

@Component({
  selector: 'app-youtube-search-simple',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="youtube-search-container">
      <!-- Header -->
      <div class="search-header">
        <h2>YouTube Video Search</h2>
        <p class="subtitle">Find educational videos (quota optimized)</p>
      </div>

      <!-- Search Box -->
      <div class="search-box">
        <div class="input-group">
          <input
            type="text"
            [(ngModel)]="query"
            placeholder="Search videos (min 3 characters)..."
            (keyup.enter)="performSearch()"
            class="search-input"
            [disabled]="isSearching || quotaExceeded"
          />
          <button
            (click)="performSearch()"
            [disabled]="isSearching || !isValidQuery() || quotaExceeded"
            class="search-button"
          >
            <span *ngIf="!isSearching">🔍 Search</span>
            <span *ngIf="isSearching">⏳ Searching...</span>
          </button>
        </div>

        <!-- Character Counter & Info -->
        <div class="search-info">
          <small>{{ query.length }}/3 characters</small>
          <span *ngIf="resultSource" class="result-source">{{ resultSource }}</span>
        </div>
      </div>

      <!-- Messages -->
      <div *ngIf="errorMessage" class="alert alert-error">
        ⚠️ {{ errorMessage }}
      </div>

      <div *ngIf="quotaExceeded" class="alert alert-quota">
        🚫 API quota exceeded. Cached results only (24h cache)
      </div>

      <div *ngIf="successMessage" class="alert alert-success">
        ✓ {{ successMessage }}
      </div>

      <!-- Loading Indicator -->
      <div *ngIf="isSearching" class="loading-container">
        <div class="loader"></div>
        <p>Searching YouTube...</p>
      </div>

      <!-- Results Grid -->
      <div *ngIf="results.length > 0" class="results-grid">
        <div
          *ngFor="let video of results"
          class="video-card"
          (click)="openVideo(video.videoId)"
        >
          <!-- Thumbnail -->
          <div class="video-thumbnail">
            <img
              [src]="video.thumbnail"
              [alt]="video.title"
              class="thumbnail-img"
            />
            <div class="overlay">▶ Play</div>
          </div>

          <!-- Video Info -->
          <div class="video-info">
            <h3 class="video-title">{{ video.title }}</h3>
            <p class="channel-name">{{ video.channelName }}</p>
            <p class="published-date">{{ formatDate(video.publishedAt) }}</p>
          </div>
        </div>
      </div>

      <!-- No Results -->
      <div *ngIf="!isSearching && hasSearched && results.length === 0 && !errorMessage" class="no-results">
        <p>No videos found. Try a different search term.</p>
      </div>

      <!-- Cache Info (Dev) -->
      <div *ngIf="showDebugInfo" class="debug-info">
        <button (click)="toggleDebugInfo()" class="debug-toggle">Hide Debug Info</button>
        <small>
          <strong>Cache:</strong> {{ cacheInfo.size }} items<br>
          <strong>In-flight requests:</strong> {{ pendingCount }}<br>
          <strong>Quota exceeded:</strong> {{ quotaExceeded ? 'Yes' : 'No' }}
        </small>
        <button (click)="clearCache()" class="clear-cache-btn">Clear Cache</button>
      </div>

      <!-- Debug Toggle Button -->
      <button
        *ngIf="!showDebugInfo"
        (click)="toggleDebugInfo()"
        class="debug-toggle-mini"
      >
        🔧
      </button>
    </div>
  `,
  styles: [`
    .youtube-search-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    .search-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .search-header h2 {
      margin: 0 0 10px 0;
      font-size: 28px;
      color: #1f2937;
    }

    .subtitle {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    .search-box {
      margin-bottom: 20px;
    }

    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    .search-input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .search-input:disabled {
      background-color: #f3f4f6;
      cursor: not-allowed;
      color: #9ca3af;
    }

    .search-button {
      padding: 12px 24px;
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
      white-space: nowrap;
    }

    .search-button:hover:not(:disabled) {
      background-color: #2563eb;
    }

    .search-button:disabled {
      background-color: #d1d5db;
      cursor: not-allowed;
    }

    .search-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #6b7280;
      padding: 0 4px;
    }

    .result-source {
      background-color: #e0f2fe;
      color: #0369a1;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 500;
    }

    .alert {
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      line-height: 1.5;
    }

    .alert-error {
      background-color: #fee2e2;
      color: #b91c1c;
      border-left: 4px solid #dc2626;
    }

    .alert-success {
      background-color: #dcfce7;
      color: #166534;
      border-left: 4px solid #22c55e;
    }

    .alert-quota {
      background-color: #fef2f2;
      color: #7f1d1d;
      border-left: 4px solid #991b1b;
    }

    .loading-container {
      text-align: center;
      padding: 40px 20px;
    }

    .loader {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .video-card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s ease;
      background-color: white;
    }

    .video-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }

    .video-thumbnail {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background-color: #f3f4f6;
    }

    .thumbnail-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      opacity: 0;
      transition: opacity 0.3s;
    }

    .video-card:hover .overlay {
      opacity: 1;
    }

    .video-info {
      padding: 16px;
    }

    .video-title {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .channel-name {
      margin: 0 0 6px 0;
      font-size: 13px;
      color: #4b5563;
    }

    .published-date {
      margin: 0;
      font-size: 12px;
      color: #9ca3af;
    }

    .no-results {
      text-align: center;
      padding: 60px 20px;
      color: #6b7280;
      font-size: 16px;
    }

    .debug-info {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-top: 20px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #4b5563;
    }

    .debug-toggle {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 11px;
      cursor: pointer;
      margin-bottom: 8px;
    }

    .debug-toggle:hover {
      background-color: #e5e7eb;
    }

    .clear-cache-btn {
      background-color: #ef4444;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 11px;
      cursor: pointer;
      margin-top: 8px;
    }

    .clear-cache-btn:hover {
      background-color: #dc2626;
    }

    .debug-toggle-mini {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background-color: #3b82f6;
      color: white;
      border: none;
      font-size: 20px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.2s;
    }

    .debug-toggle-mini:hover {
      background-color: #2563eb;
      transform: scale(1.1);
    }

    @media (max-width: 768px) {
      .youtube-search-container {
        padding: 16px;
      }

      .search-header h2 {
        font-size: 22px;
      }

      .input-group {
        flex-direction: column;
      }

      .search-button {
        width: 100%;
      }

      .results-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class YoutubeSearchSimpleComponent implements OnInit, OnDestroy {
  query = '';
  results: YouTubeSearchResult[] = [];
  isSearching = false;
  hasSearched = false;
  errorMessage = '';
  successMessage = '';
  quotaExceeded = false;
  resultSource = '';
  showDebugInfo = false;
  cacheInfo: { size: number; keys: string[] } = { size: 0, keys: [] };
  pendingCount = 0;

  private destroy$ = new Subject<void>();

  constructor(private youtubeService: YoutubeQuotaOptimizedService) {}

  ngOnInit(): void {
    // Monitor quota exceeded state
    this.youtubeService.quotaExceeded$
      .pipe(takeUntil(this.destroy$))
      .subscribe(exceeded => {
        this.quotaExceeded = exceeded;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if query is valid (min 3 characters)
   */
  isValidQuery(): boolean {
    return this.query.trim().length >= 3;
  }

  /**
   * Perform search on button click
   */
  performSearch(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.resultSource = '';

    if (!this.isValidQuery()) {
      this.errorMessage = 'Please enter at least 3 characters';
      return;
    }

    this.isSearching = true;
    this.hasSearched = true;
    this.results = [];

    this.youtubeService.searchVideos(this.query).subscribe({
      next: (response) => {
        this.isSearching = false;

        if (response.success) {
          this.results = response.results;
          this.successMessage = response.message || '';
          this.resultSource = response.message?.includes('cache') ? '📦 From Cache' : '🌐 From API';
        } else {
          this.results = [];
          this.errorMessage = response.message || 'Search failed';
          if (response.quotaExceeded) {
            this.errorMessage = response.message || 'API quota exceeded';
          }
        }
      },
      error: (error) => {
        this.isSearching = false;
        this.errorMessage = 'An unexpected error occurred';
        }
    });
  }

  /**
   * Open video in YouTube
   */
  openVideo(videoId: string): void {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    window.open(url, '_blank');
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return dateString.split('T')[0];
    }
  }

  /**
   * Toggle debug info
   */
  toggleDebugInfo(): void {
    this.showDebugInfo = !this.showDebugInfo;
    if (this.showDebugInfo) {
      this.updateDebugInfo();
    }
  }

  /**
   * Update debug info
   */
  private updateDebugInfo(): void {
    this.cacheInfo = this.youtubeService.getCacheInfo();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.youtubeService.clearCache();
    this.updateDebugInfo();
    this.results = [];
    this.hasSearched = false;
    this.successMessage = 'Cache cleared!';
    setTimeout(() => { this.successMessage = ''; }, 3000);
  }
}
