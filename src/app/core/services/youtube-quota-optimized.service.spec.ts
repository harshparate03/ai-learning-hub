import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { YoutubeQuotaOptimizedService } from './youtube-quota-optimized.service';

describe('YoutubeQuotaOptimizedService', () => {
  let service: YoutubeQuotaOptimizedService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [YoutubeQuotaOptimizedService]
    });
    service = TestBed.inject(YoutubeQuotaOptimizedService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('Input Validation', () => {
    it('should reject queries with fewer than 3 characters', (done) => {
      service.searchVideos('ab').subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.message).toContain('at least 3 characters');
        done();
      });
    });

    it('should accept queries with 3 or more characters', (done) => {
      service.searchVideos('angular').subscribe(response => {
        // Request should be made (we'll cancel it in the test)
        expect(response).toBeDefined();
        done();
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush({
        items: []
      });
    });
  });

  describe('Caching', () => {
    it('should cache search results', (done) => {
      const mockResponse = {
        items: [
          {
            id: { videoId: 'abc123' },
            snippet: {
              title: 'Test Video',
              channelTitle: 'Test Channel',
              publishedAt: new Date().toISOString(),
              thumbnails: { medium: { url: 'http://example.com/thumb.jpg' } }
            }
          }
        ]
      };

      service.searchVideos('test').subscribe(response => {
        expect(response.success).toBe(true);
        expect(response.results.length).toBe(1);

        // Verify cache was set
        const cacheInfo = service.getCacheInfo();
        expect(cacheInfo.size).toBeGreaterThan(0);
        done();
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush(mockResponse);
    });

    it('should return cached results on subsequent searches', (done) => {
      const mockResponse = {
        items: [
          {
            id: { videoId: 'abc123' },
            snippet: {
              title: 'Test Video',
              channelTitle: 'Test Channel',
              publishedAt: new Date().toISOString(),
              thumbnails: { medium: { url: 'http://example.com/thumb.jpg' } }
            }
          }
        ]
      };

      // First search
      service.searchVideos('test').subscribe(() => {
        // Second search - should use cache
        service.searchVideos('test').subscribe(response => {
          expect(response.success).toBe(true);
          expect(response.message).toContain('cache');
          done();
        });
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush(mockResponse);
    });

    it('should clear cache successfully', () => {
      localStorage.setItem('yt_search_abc123', '{"results":[],"timestamp":' + Date.now() + '}');
      expect(service.getCacheInfo().size).toBeGreaterThan(0);

      service.clearCache();

      expect(service.getCacheInfo().size).toBe(0);
    });
  });

  describe('Duplicate Request Prevention', () => {
    it('should prevent duplicate concurrent requests', () => {
      const mockResponse = {
        items: [
          {
            id: { videoId: 'abc123' },
            snippet: {
              title: 'Test Video',
              channelTitle: 'Test Channel',
              publishedAt: new Date().toISOString(),
              thumbnails: { medium: { url: 'http://example.com/thumb.jpg' } }
            }
          }
        ]
      };

      // Make two identical searches concurrently
      service.searchVideos('test').subscribe();
      service.searchVideos('test').subscribe();

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush(mockResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle quota exceeded errors', (done) => {
      service.searchVideos('test').subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.quotaExceeded).toBe(true);
        done();
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush(
        { error: { message: 'quotaExceeded', errors: [{ reason: 'quotaExceeded' }] } },
        { status: 403, statusText: 'Forbidden' }
      );
    });

    it('should handle generic API errors', (done) => {
      service.searchVideos('test').subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.message).toBeDefined();
        done();
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush(
        { error: { error: { message: 'Invalid API key' } } },
        { status: 401, statusText: 'Unauthorized' }
      );
    });
  });

  describe('API Parameters', () => {
    it('should use correct API parameters', (done) => {
      const mockResponse = { items: [] };

      service.searchVideos('angular tutorial').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(request => {
        expect(request.url).toContain('/api/youtube-search');
        expect(request.params.get('q')).toBe('angular tutorial');
        expect(request.params.get('type')).toBe('video');
        expect(request.params.get('maxResults')).toBe('25');
        expect(request.params.get('order')).toBe('relevance');
        return true;
      });

      req.flush(mockResponse);
    });
  });

  describe('Result Parsing', () => {
    it('should parse search results correctly', (done) => {
      const mockResponse = {
        items: [
          {
            id: { videoId: 'vid123' },
            snippet: {
              title: 'Angular Tutorial',
              channelTitle: 'Tech Channel',
              publishedAt: '2024-01-15T10:00:00Z',
              thumbnails: { medium: { url: 'http://example.com/img.jpg' } }
            }
          }
        ]
      };

      service.searchVideos('angular').subscribe(response => {
        expect(response.results.length).toBe(1);
        const result = response.results[0];
        expect(result.videoId).toBe('vid123');
        expect(result.title).toBe('Angular Tutorial');
        expect(result.channelName).toBe('Tech Channel');
        expect(result.thumbnail).toBe('http://example.com/img.jpg');
        done();
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush(mockResponse);
    });

    it('should filter out results without thumbnails', (done) => {
      const mockResponse = {
        items: [
          {
            id: { videoId: 'vid123' },
            snippet: {
              title: 'Valid Video',
              channelTitle: 'Tech Channel',
              publishedAt: '2024-01-15T10:00:00Z',
              thumbnails: { medium: { url: 'http://example.com/img.jpg' } }
            }
          },
          {
            id: { videoId: 'vid456' },
            snippet: {
              title: 'No Thumbnail Video',
              channelTitle: 'Tech Channel',
              publishedAt: '2024-01-15T10:00:00Z',
              thumbnails: {}
            }
          }
        ]
      };

      service.searchVideos('test').subscribe(response => {
        expect(response.results.length).toBe(1);
        expect(response.results[0].videoId).toBe('vid123');
        done();
      });

      const req = httpMock.expectOne(request =>
        request.url.includes('/api/youtube-search')
      );
      req.flush(mockResponse);
    });
  });
});
