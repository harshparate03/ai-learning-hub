import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { sanitizeUserInput } from '../utils/sanitize.util';

/** Curated list of verified real educational YouTube videos */
const CURATED_VIDEOS: { videoId: string; title: string; channel: string; tags: string[] }[] = [
  // Python
  { videoId: 'rfscVS0vtbw', title: 'Learn Python - Full Course for Beginners', channel: 'freeCodeCamp.org', tags: ['python','programming','coding','beginner'] },
  { videoId: '_uQrJ0TkZlc', title: 'Python Full Course for Beginners', channel: 'Programming with Mosh', tags: ['python','programming','beginner'] },
  { videoId: 'kqtD5dpn9C8', title: 'Python for Beginners in 1 Hour', channel: 'Programming with Mosh', tags: ['python','beginner','quick'] },
  { videoId: 'gfDE2a7MKjA', title: 'Python Tutorial For Beginners In Hindi', channel: 'CodeWithHarry', tags: ['python','hindi','beginner','tutorial'] },
  { videoId: '4Mf0h3HphEA', title: 'Python Programming Tutorial', channel: 'thenewboston', tags: ['python','programming','tutorial'] },
  // JavaScript
  { videoId: 'PkZNo7MFNFg', title: 'Learn JavaScript - Full Course for Beginners', channel: 'freeCodeCamp.org', tags: ['javascript','js','web','programming','beginner'] },
  { videoId: 'W6NZfCO5SIk', title: 'JavaScript Course for Beginners', channel: 'Programming with Mosh', tags: ['javascript','js','web','beginner'] },
  { videoId: 'hdI2bqOjy3c', title: 'JavaScript Crash Course For Beginners', channel: 'Traversy Media', tags: ['javascript','js','crash course','web'] },
  { videoId: 'jS4aFq5-91M', title: 'JavaScript Full Course', channel: 'Bro Code', tags: ['javascript','js','full course'] },
  // HTML/CSS/Web
  { videoId: '1Rs2ND1ryYc', title: 'CSS Tutorial - Zero to Hero (Complete Course)', channel: 'freeCodeCamp.org', tags: ['css','web','html','frontend','design'] },
  { videoId: 'qz0aGYrrlhU', title: 'HTML Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['html','web','frontend','beginner'] },
  { videoId: 'mU6anWqZJcc', title: 'HTML Full Course - Build a Website Tutorial', channel: 'freeCodeCamp.org', tags: ['html','web','frontend','website'] },
  // SQL / Databases
  { videoId: 'HXV3zeQKqGY', title: 'SQL Tutorial - Full Database Course for Beginners', channel: 'freeCodeCamp.org', tags: ['sql','database','mysql','postgresql','data'] },
  { videoId: 'xiUTqnI6xk8', title: 'MySQL Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['mysql','sql','database','beginner'] },
  // Computer Science / CS50
  { videoId: '8mAITcNt710', title: 'Harvard CS50 – Full Computer Science University Course', channel: 'freeCodeCamp.org', tags: ['computer science','cs50','harvard','fundamentals','cs'] },
  // Machine Learning / AI
  { videoId: 'aircAruvnKk', title: 'But what is a neural network? | Deep learning', channel: '3Blue1Brown', tags: ['neural network','deep learning','ai','machine learning'] },
  { videoId: 'Gv9_4yMHFhI', title: 'Machine Learning for Everybody', channel: 'freeCodeCamp.org', tags: ['machine learning','ml','ai','beginner','data science'] },
  { videoId: 'i_LwzRVP7bg', title: 'Machine Learning Course for Beginners', channel: 'freeCodeCamp.org', tags: ['machine learning','ml','beginner','python'] },
  // Data Science
  { videoId: 'ua-CiDNNj30', title: 'Data Science Full Course', channel: 'Simplilearn', tags: ['data science','python','analytics','statistics'] },
  { videoId: 'N6BghzuFLIg', title: 'Data Science Roadmap 2024', channel: 'Ken Jee', tags: ['data science','roadmap','career','statistics'] },
  // React
  { videoId: 'bMknfKXIFA8', title: 'React Course - Beginner\'s Tutorial', channel: 'freeCodeCamp.org', tags: ['react','reactjs','javascript','frontend','web'] },
  { videoId: 'SqcY0GlETPk', title: 'React Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['react','reactjs','javascript','frontend'] },
  // Node.js
  { videoId: 'TlB_eWDSMt4', title: 'Node.js Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['node','nodejs','javascript','backend','server'] },
  { videoId: 'Oe421EPjeBE', title: 'Node.js and Express.js Full Course', channel: 'freeCodeCamp.org', tags: ['node','nodejs','express','backend','javascript'] },
  // TypeScript
  { videoId: 'BwuLxPH8IDs', title: 'TypeScript Course for Beginners', channel: 'Academind', tags: ['typescript','ts','javascript','programming'] },
  { videoId: 'd56mG7DezGs', title: 'TypeScript Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['typescript','ts','javascript','beginner'] },
  // Java
  { videoId: 'eIrMbAQSU34', title: 'Java Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['java','programming','oop','beginner'] },
  { videoId: 'A74TOX803D0', title: 'Java Full Course', channel: 'Bro Code', tags: ['java','programming','full course'] },
  // C++ / C
  { videoId: 'ZSPZob_1TOk', title: 'C++ Tutorial for Beginners - Full Course', channel: 'freeCodeCamp.org', tags: ['c++','cpp','programming','beginner'] },
  // Data Structures & Algorithms
  { videoId: 'pkYVOmU3MgA', title: 'Data Structures Easy to Advanced Course', channel: 'freeCodeCamp.org', tags: ['data structures','algorithms','dsa','programming'] },
  { videoId: 'RBSGKlAvoiM', title: 'Data Structures - Computer Science Course', channel: 'freeCodeCamp.org', tags: ['data structures','cs','programming','linked list','tree','graph'] },
  { videoId: 'BBpAmxU_NQo', title: 'Algorithms and Data Structures Tutorial', channel: 'freeCodeCamp.org', tags: ['algorithms','dsa','sorting','searching','recursion'] },
  // Git / DevOps
  { videoId: 'RGOj5yH7evk', title: 'Git and GitHub for Beginners - Crash Course', channel: 'freeCodeCamp.org', tags: ['git','github','version control','devops','beginner'] },
  { videoId: 'mJ-qvsxPHpY', title: 'Git Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['git','version control','beginner','devops'] },
  // Docker / Kubernetes
  { videoId: 'pTFZFxd5hgI', title: 'Docker Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['docker','devops','containers','deployment'] },
  { videoId: 'fqMOX6JJhGo', title: 'Docker Tutorial for Beginners - A Full DevOps Course', channel: 'freeCodeCamp.org', tags: ['docker','devops','containers','linux'] },
  // Linux
  { videoId: 'ROjZy1WbCIA', title: 'The 50 Most Popular Linux & Terminal Commands', channel: 'freeCodeCamp.org', tags: ['linux','terminal','command line','bash','shell'] },
  { videoId: 'sWbUDq4S6Y8', title: 'Linux for Hackers (and Everyone)', channel: 'NetworkChuck', tags: ['linux','terminal','hacking','shell','bash'] },
  // Networking
  { videoId: 'qiQR5rTSshw', title: 'Computer Networking Course - Network Engineering', channel: 'freeCodeCamp.org', tags: ['networking','network','tcp','ip','computer science'] },
  // Cybersecurity
  { videoId: 'hXSFdwIOfnE', title: 'Ethical Hacking Full Course', channel: 'freeCodeCamp.org', tags: ['cybersecurity','ethical hacking','hacking','security','penetration testing'] },
  // Mathematics
  { videoId: 'OkmNXy7er84', title: 'Calculus 1 - Full College Course', channel: 'freeCodeCamp.org', tags: ['calculus','maths','mathematics','college','integration','differentiation'] },
  { videoId: 'LbALFZoRrw8', title: 'Statistics - A Full University Course', channel: 'freeCodeCamp.org', tags: ['statistics','maths','probability','data','analysis'] },
  { videoId: 'sVxBVvlnJsM', title: 'Linear Algebra for Machine Learning', channel: 'freeCodeCamp.org', tags: ['linear algebra','maths','machine learning','matrix','vectors'] },
  // Excel / Google Sheets
  { videoId: 'Vl0H-qTclOg', title: 'Excel Tutorial for Beginners', channel: 'Kevin Stratvert', tags: ['excel','spreadsheet','microsoft','beginner','office'] },
  // Software Testing
  { videoId: 'oLc9gVM8FBM', title: 'Software Testing Tutorial', channel: 'SDET- QA Automation', tags: ['software testing','qa','quality assurance','selenium','test'] },
  // Flutter / Mobile
  { videoId: 'VPvVD8t02U8', title: 'Flutter Course for Beginners', channel: 'freeCodeCamp.org', tags: ['flutter','dart','mobile','app development','android','ios'] },
  // Angular
  { videoId: 'k5E2AVpwsko', title: 'Angular Tutorial for Beginners', channel: 'Programming with Mosh', tags: ['angular','typescript','frontend','web','javascript'] },
  // Operating Systems
  { videoId: 'vBURTt97EkA', title: 'Operating Systems: Crash Course Computer Science', channel: 'CrashCourse', tags: ['operating systems','os','computer science','memory','cpu'] },
  // Blockchain
  { videoId: 'SSo_EIwHSd4', title: 'Learn Blockchain, Solidity, and Full Stack Web3', channel: 'freeCodeCamp.org', tags: ['blockchain','web3','solidity','ethereum','crypto'] },
  // General CS
  { videoId: 'zOjov-2OZ0E', title: 'CS50x 2024 - Full Course', channel: 'CS50', tags: ['computer science','cs50','harvard','programming','c','python'] },
];

@Injectable({ providedIn: 'root' })
export class YoutubeService {

  private API_KEYS: string[] = [];
  private keyIndex = 0;
  private get KEY(): string { return this.API_KEYS[this.keyIndex % this.API_KEYS.length]; }
  private get hasApiKey(): boolean { return this.API_KEYS.length > 0; }

  private SEARCH_URL = '/api/youtube-search';
  private VIDEO_URL  = '/api/youtube-details';

  constructor(private http: HttpClient) {
    // Initialize with YouTube API key from environment
    if (environment.youtubeApiKey) {
      this.API_KEYS = [environment.youtubeApiKey];
      console.log('[YouTube Service] API key configured ✓');
    }
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────

  /** Context-aware study topic suggestions based on partial query. */
  getStudySuggestions(query: string): string[] {
    const q = sanitizeUserInput(query, 80).toLowerCase().trim();
    if (!q) return [];

    const topicMap: Record<string, string[]> = {
      data: ['data structures', 'data science', 'database SQL', 'data analysis'],
      machine: ['machine learning', 'machine learning algorithms', 'machine learning python'],
      python: ['python programming', 'python for beginners', 'python data science'],
      java: ['java programming', 'java OOP', 'java data structures'],
      react: ['react tutorial', 'react hooks', 'react native'],
      angular: ['angular tutorial', 'angular components', 'angular routing'],
      test: ['software testing', 'test automation', 'unit testing'],
      web: ['web development', 'web design HTML CSS', 'full stack web development'],
      math: ['calculus', 'linear algebra', 'statistics'],
      ai: ['artificial intelligence', 'AI fundamentals', 'generative AI'],
      cloud: ['cloud computing', 'AWS tutorial', 'docker kubernetes'],
      network: ['computer networking', 'network security', 'TCP IP'],
      struct: ['data structures', 'data structures and algorithms'],
      algo: ['algorithms', 'data structures and algorithms'],
      sql: ['SQL tutorial', 'database SQL', 'MySQL for beginners'],
      js: ['javascript tutorial', 'javascript full course'],
      node: ['node.js tutorial', 'express.js tutorial'],
    };

    const suggestions = new Set<string>();

    for (const [key, values] of Object.entries(topicMap)) {
      if (q.startsWith(key) || key.startsWith(q) || key.includes(q)) {
        values.forEach(v => suggestions.add(v));
      }
    }

    for (const values of Object.values(topicMap)) {
      for (const topic of values) {
        const t = topic.toLowerCase();
        if (t.includes(q) || q.split(' ').every(w => w.length > 1 && t.includes(w))) {
          suggestions.add(topic);
        }
      }
    }

    for (const video of CURATED_VIDEOS) {
      const haystack = `${video.title} ${video.tags.join(' ')}`.toLowerCase();
      if (haystack.includes(q)) {
        suggestions.add(video.title.length > 48 ? `${video.tags[0]} tutorial` : video.title);
      }
      for (const tag of video.tags) {
        if (tag.startsWith(q) || (q.length >= 2 && tag.includes(q))) {
          suggestions.add(tag.includes(' ') ? tag : `${tag} tutorial`);
        }
      }
    }

    return Array.from(suggestions)
      .filter(s => s.toLowerCase() !== q)
      .slice(0, 8);
  }

  searchVideos(query: string): Observable<any> {
    const safeQuery = sanitizeUserInput(query, 200);

    // No valid YouTube Data API key — go straight to AI+curated fallback
    if (!this.hasApiKey) {
      console.warn('[YouTube] No API key configured — using AI+curated fallback.');
      return this.searchWithAIFallback(safeQuery);
    }

    return this.http.get(this.SEARCH_URL, {
      params: { q: safeQuery, type: 'video', maxResults: '12' }
    }).pipe(
      catchError((err) => {
        console.warn('[YouTube] Data API failed:', err?.status, err?.error?.error?.message);
        return this.searchWithAIFallback(safeQuery);
      })
    );
  }

  /**
   * Two-stage fallback when the YouTube Data API key is invalid/quota exceeded:
   *
   * Stage 1 — Curated match: score CURATED_VIDEOS against the query keywords.
   *            Returns instantly, no extra network call.
   *
   * Stage 2 — AI + oEmbed: ask Groq for video IDs, validate each via oEmbed,
   *            keep only IDs that actually exist. Runs in parallel with stage 1
   *            to supplement results.
   */
  private searchWithAIFallback(query: string): Observable<any> {
    const q = query.toLowerCase();
    const keywords = q.split(/\s+/).filter(w => w.length > 1);

    // Score each curated video
    const scored = CURATED_VIDEOS.map(v => {
      const haystack = `${v.title} ${v.channel} ${v.tags.join(' ')}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (haystack.includes(kw)) score += kw.length; // longer keyword match = higher score
      }
      // Exact phrase bonus
      if (haystack.includes(q)) score += 20;
      return { ...v, score };
    })
    .filter(v => v.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

    const toVideoItem = (v: typeof scored[0]) => ({
      id: { videoId: v.videoId },
      snippet: {
        title: v.title,
        channelTitle: v.channel,
        description: '',
        thumbnails: { medium: { url: this.getThumbnail(v.videoId) } }
      },
      _source: 'curated'
    });

    // If we have 6+ curated matches return them immediately
    if (scored.length >= 6) {
      return of({ items: scored.map(toVideoItem), _source: 'curated' });
    }

    // Otherwise supplement with AI-discovered videos via oEmbed validation
    return this.searchViaAIAndOEmbed(query, scored.map(toVideoItem));
  }

  private searchViaAIAndOEmbed(query: string, existingItems: any[]): Observable<any> {
    const GROQ_PROXY_URL = '/api/groq';
    const GROQ_KEY = environment.groqApiKey;

    const existingIds = new Set(existingItems.map(v => v.id.videoId));
    
    // If no Groq key, return curated results only
    if (!GROQ_KEY) {
      return of({ items: existingItems, _source: 'curated' });
    }

    const prompt = `You are a comprehensive YouTube video search assistant.
Search topic: "${query}"

List 15 real, relevant YouTube videos about "${query}".
Include videos from all popular educational and technical channels.
Prioritize:
1. Educational channels: freeCodeCamp.org, Traversy Media, Programming with Mosh, Khan Academy, MIT OpenCourseWare
2. Tech influencers: Fireship, NetworkChuck, Corey Schafer, Academind, TechWorld with Nana
3. Creator channels: Bro Code, CodeWithHarry, Kunal Kushwaha, 3Blue1Brown, Simplilearn
4. Any other popular channel covering the topic
Each video ID must be exactly 11 characters.

Return ONLY a JSON array — no markdown, no explanation:
[{"videoId":"EXACT_11_CHAR_ID","title":"Real Title","channel":"Channel Name"}]`;

    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000
    };

    return this.http.post(GROQ_PROXY_URL, body, {
      withCredentials: false
    }).pipe(
      switchMap((res: any) => {
        const text = res?.choices?.[0]?.message?.content || '';
        let candidates: { videoId: string; title: string; channel: string }[] = [];
        try {
          const m = text.match(/\[[\s\S]*?\]/);
          if (m) candidates = JSON.parse(m[0]);
        } catch {}

        // Filter: valid 11-char IDs, not already in curated list
        const toValidate = candidates
          .filter(c => c.videoId && /^[a-zA-Z0-9_\-]{11}$/.test(c.videoId) && !existingIds.has(c.videoId))
          .slice(0, 15);

        if (!toValidate.length) {
          return of({ items: existingItems, _source: 'curated' });
        }

        // Validate each via oEmbed
        const checks = toValidate.map(c =>
          this.http.get(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${c.videoId}&format=json`
          ).pipe(
            map((oe: any) => ({
              id: { videoId: c.videoId },
              snippet: {
                title: oe.title || c.title,
                channelTitle: oe.author_name || c.channel,
                description: '',
                thumbnails: { medium: { url: this.getThumbnail(c.videoId) } }
              },
              _source: 'ai-validated'
            })),
            catchError(() => of(null))
          )
        );

        return forkJoin(checks).pipe(
          map((results: any[]) => {
            const valid = results.filter(r => r !== null);
            const allItems = [...existingItems, ...valid].slice(0, 12);
            return {
              items: allItems,
              _source: allItems.length > 0 ? 'ai-curated' : 'empty'
            };
          })
        );
      }),
      catchError(() => of({ items: existingItems, _source: 'curated' }))
    );
  }

  getVideoDetails(videoId: string): Observable<any> {
    // No valid key — return empty so callers fall back to oEmbed
    if (!this.hasApiKey) {
      return of({ items: [] });
    }
    return this.http.get(this.VIDEO_URL, {
      params: { id: videoId, part: 'snippet,statistics,contentDetails' }
    }).pipe(
      catchError(() => {
        this.keyIndex++;
        if (!this.hasApiKey) return of({ items: [] });
        return this.http.get(this.VIDEO_URL, {
          params: { id: videoId, part: 'snippet,statistics,contentDetails' }
        }).pipe(catchError(() => of({ items: [] })));
      })
    );
  }

  getOEmbed(videoId: string): Observable<any> {
    return this.http.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    ).pipe(catchError(() => of(null)));
  }

  getFullVideoContext(videoId: string): Observable<string> {
    return this.getVideoDetails(videoId).pipe(
      switchMap((res: any) => {
        const item = res?.items?.[0];
        if (!item) {
          return this.getOEmbed(videoId).pipe(
            map((oe: any) => oe?.title
              ? `VIDEO TITLE: "${oe.title}"\nCHANNEL: ${oe.author_name || ''}`
              : '')
          );
        }
        const s     = item.snippet || {};
        const stats = item.statistics || {};
        const cd    = item.contentDetails || {};
        const title    = s.title || '';
        const channel  = s.channelTitle || '';
        const desc     = s.description || '';
        const tags     = (s.tags || []).join(', ');
        const duration = this.formatDuration(cd.duration || '');
        const views    = this.formatViews(stats.viewCount || '0');
        const chapters = this.extractChapters(desc);
        const descClean = desc.split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 20 && !l.match(/^\d+:\d+/))
          .slice(0, 40).join('\n');

        return of(`VIDEO TITLE: "${title}"
CHANNEL: ${channel}
DURATION: ${duration} | VIEWS: ${views}
TAGS: ${tags}
${chapters ? 'CHAPTERS:\n' + chapters + '\n' : ''}
DESCRIPTION:\n${descClean}`);
      }),
      catchError(() => of(''))
    );
  }

  private extractChapters(description: string): string {
    return description.split('\n')
      .filter(l => l.match(/(\d{1,2}:\d{2}(:\d{2})?)/) && l.trim().length > 3)
      .map(l => l.replace(/[\(\)]/g, '').trim())
      .join('\n');
  }

  getVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  }

  getThumbnail(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  formatDuration(iso: string): string {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    const h = match[1] ? `${match[1]}:` : '';
    const m = match[2] ? match[2].padStart(h ? 2 : 1, '0') : '0';
    const s = (match[3] || '0').padStart(2, '0');
    return `${h}${m}:${s}`;
  }

  formatViews(n: string): string {
    const num = parseInt(n);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000)    return (num / 1000).toFixed(1) + 'K';
    return n;
  }
}
