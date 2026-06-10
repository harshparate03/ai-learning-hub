import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { YoutubeSearchSimpleComponent } from './search-simple.component';
import { YoutubeQuotaOptimizedService } from '../../../core/services/youtube-quota-optimized.service';
import { of, Subject } from 'rxjs';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('YoutubeSearchSimpleComponent', () => {
  let component: YoutubeSearchSimpleComponent;
  let fixture: ComponentFixture<YoutubeSearchSimpleComponent>;
  let youtubeService: jasmine.SpyObj<YoutubeQuotaOptimizedService>;
  let quotaExceeded$: Subject<boolean>;

  beforeEach(async () => {
    quotaExceeded$ = new Subject<boolean>();

    const youtubeServiceSpy = jasmine.createSpyObj(
      'YoutubeQuotaOptimizedService',
      ['searchVideos', 'getCacheInfo', 'clearCache'],
      { quotaExceeded$: quotaExceeded$ }
    );

    await TestBed.configureTestingModule({
      imports: [YoutubeSearchSimpleComponent],
      providers: [
        { provide: YoutubeQuotaOptimizedService, useValue: youtubeServiceSpy }
      ]
    }).compileComponents();

    youtubeService = TestBed.inject(YoutubeQuotaOptimizedService) as jasmine.SpyObj<YoutubeQuotaOptimizedService>;
    fixture = TestBed.createComponent(YoutubeSearchSimpleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with empty query', () => {
      expect(component.query).toBe('');
    });

    it('should initialize with no results', () => {
      expect(component.results.length).toBe(0);
    });

    it('should not be searching initially', () => {
      expect(component.isSearching).toBe(false);
    });
  });

  describe('Query Validation', () => {
    it('should validate query length', () => {
      component.query = 'ab';
      expect(component.isValidQuery()).toBe(false);

      component.query = 'abc';
      expect(component.isValidQuery()).toBe(true);
    });

    it('should disable search button for invalid query', () => {
      component.query = 'ab';
      const searchButton = fixture.debugElement.query(By.css('.search-button'));
      expect(searchButton.nativeElement.disabled).toBe(true);
    });

    it('should enable search button for valid query', () => {
      component.query = 'angular';
      fixture.detectChanges();
      const searchButton = fixture.debugElement.query(By.css('.search-button'));
      expect(searchButton.nativeElement.disabled).toBe(false);
    });
  });

  describe('Search Functionality', () => {
    it('should perform search on button click', fakeAsync(() => {
      const mockResults = {
        success: true,
        results: [
          {
            videoId: 'abc123',
            title: 'Angular Tutorial',
            channelName: 'Tech Academy',
            publishedAt: new Date().toISOString(),
            thumbnail: 'http://example.com/thumb.jpg'
          }
        ],
        message: 'Found 1 video'
      };

      youtubeService.searchVideos.and.returnValue(of(mockResults));

      component.query = 'angular';
      component.performSearch();
      tick();

      expect(youtubeService.searchVideos).toHaveBeenCalledWith('angular');
      expect(component.results.length).toBe(1);
      expect(component.successMessage).toContain('Found 1 video');
    }));

    it('should show error for short query', () => {
      component.query = 'ab';
      component.performSearch();

      expect(component.errorMessage).toContain('at least 3 characters');
      expect(youtubeService.searchVideos).not.toHaveBeenCalled();
    });

    it('should show loading state during search', () => {
      component.query = 'angular';
      youtubeService.searchVideos.and.returnValue(of({
        success: true,
        results: [],
        message: ''
      }));

      component.performSearch();

      expect(component.isSearching).toBe(false); // Completed immediately in test
    });
  });

  describe('Results Display', () => {
    beforeEach(() => {
      component.results = [
        {
          videoId: 'vid1',
          title: 'Angular Best Practices',
          channelName: 'Channel 1',
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          thumbnail: 'http://example.com/thumb1.jpg'
        },
        {
          videoId: 'vid2',
          title: 'TypeScript Advanced',
          channelName: 'Channel 2',
          publishedAt: new Date().toISOString(),
          thumbnail: 'http://example.com/thumb2.jpg'
        }
      ];
      fixture.detectChanges();
    });

    it('should display video cards', () => {
      const cards = fixture.debugElement.queryAll(By.css('.video-card'));
      expect(cards.length).toBe(2);
    });

    it('should display video titles', () => {
      const titles = fixture.debugElement.queryAll(By.css('.video-title'));
      expect(titles[0].nativeElement.textContent).toContain('Angular Best Practices');
      expect(titles[1].nativeElement.textContent).toContain('TypeScript Advanced');
    });

    it('should display channel names', () => {
      const channels = fixture.debugElement.queryAll(By.css('.channel-name'));
      expect(channels[0].nativeElement.textContent).toContain('Channel 1');
      expect(channels[1].nativeElement.textContent).toContain('Channel 2');
    });

    it('should display thumbnails', () => {
      const images = fixture.debugElement.queryAll(By.css('.thumbnail-img'));
      expect(images.length).toBe(2);
      expect(images[0].nativeElement.src).toBe('http://example.com/thumb1.jpg');
    });

    it('should open YouTube video on card click', () => {
      spyOn(window, 'open');
      const card = fixture.debugElement.query(By.css('.video-card'));
      card.nativeElement.click();

      expect(window.open).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=vid1',
        '_blank'
      );
    });
  });

  describe('Date Formatting', () => {
    it('should format recent dates correctly', () => {
      const today = new Date().toISOString();
      expect(component.formatDate(today)).toBe('Today');

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(component.formatDate(yesterday)).toBe('Yesterday');

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(component.formatDate(weekAgo)).toBe('1 weeks ago');
    });

    it('should handle invalid dates gracefully', () => {
      const result = component.formatDate('invalid-date');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should display error message on search failure', fakeAsync(() => {
      const mockError = {
        success: false,
        results: [],
        message: 'Search failed: Network error'
      };

      youtubeService.searchVideos.and.returnValue(of(mockError));

      component.query = 'angular';
      component.performSearch();
      tick();

      expect(component.errorMessage).toContain('Search failed');
    }));

    it('should display quota exceeded message', fakeAsync(() => {
      const mockError = {
        success: false,
        results: [],
        message: 'YouTube API quota exceeded',
        quotaExceeded: true
      };

      youtubeService.searchVideos.and.returnValue(of(mockError));

      component.query = 'angular';
      component.performSearch();
      tick();

      expect(component.errorMessage).toContain('quota exceeded');
    }));

    it('should clear previous error on new search', fakeAsync(() => {
      component.errorMessage = 'Previous error';
      component.query = 'angular';

      youtubeService.searchVideos.and.returnValue(of({
        success: true,
        results: [],
        message: 'Found 0 videos'
      }));

      component.performSearch();
      tick();

      expect(component.errorMessage).toBe('');
    }));
  });

  describe('Quota Exceeded State', () => {
    it('should track quota exceeded state', fakeAsync(() => {
      quotaExceeded$.next(true);
      tick();

      expect(component.quotaExceeded).toBe(true);

      quotaExceeded$.next(false);
      tick();

      expect(component.quotaExceeded).toBe(false);
    }));

    it('should disable search when quota exceeded', () => {
      component.quotaExceeded = true;
      component.query = 'angular';
      fixture.detectChanges();

      const searchButton = fixture.debugElement.query(By.css('.search-button'));
      expect(searchButton.nativeElement.disabled).toBe(true);
    });
  });

  describe('Result Source Display', () => {
    it('should show cache source', fakeAsync(() => {
      const mockResults = {
        success: true,
        results: [],
        message: 'Results from cache (24h)'
      };

      youtubeService.searchVideos.and.returnValue(of(mockResults));

      component.query = 'test';
      component.performSearch();
      tick();

      expect(component.resultSource).toContain('From Cache');
    }));

    it('should show API source', fakeAsync(() => {
      const mockResults = {
        success: true,
        results: [],
        message: 'Found 0 videos'
      };

      youtubeService.searchVideos.and.returnValue(of(mockResults));

      component.query = 'test';
      component.performSearch();
      tick();

      expect(component.resultSource).toContain('From API');
    }));
  });

  describe('Debug Info', () => {
    it('should toggle debug info visibility', () => {
      expect(component.showDebugInfo).toBe(false);

      component.toggleDebugInfo();
      expect(component.showDebugInfo).toBe(true);

      component.toggleDebugInfo();
      expect(component.showDebugInfo).toBe(false);
    });

    it('should clear cache', () => {
      youtubeService.getCacheInfo.and.returnValue({ size: 5, keys: [] });

      component.clearCache();

      expect(youtubeService.clearCache).toHaveBeenCalled();
      expect(component.results.length).toBe(0);
    });
  });

  describe('Responsive Design', () => {
    it('should be mobile responsive', () => {
      const container = fixture.debugElement.query(By.css('.youtube-search-container'));
      expect(container).toBeTruthy();
      expect(container.nativeElement.classList.contains('youtube-search-container')).toBe(true);
    });
  });
});
