import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { YoutubeService } from './youtube.service';

describe('YoutubeService', () => {
  let service: YoutubeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(YoutubeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should extract video ids from common YouTube URL formats', () => {
    const id = 'yE6tIle64tU';
    const urls = [
      `https://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/watch?si=test&v=${id}&feature=youtu.be`,
      `https://youtu.be/${id}?si=MfhwZU2BHSg2y8Xk`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://music.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/live/${id}?feature=share`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `www.youtube.com/watch?v=${id}`,
      id
    ];

    for (const url of urls) {
      expect(service.getVideoId(url)).withContext(url).toBe(id);
    }
  });

  it('should reject invalid YouTube ids', () => {
    expect(service.getVideoId('https://www.youtube.com/watch?v=too-short')).toBeNull();
    expect(service.getVideoId('not a youtube url')).toBeNull();
    expect(service.getVideoId('')).toBeNull();
  });
});
