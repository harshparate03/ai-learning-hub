import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { sanitizeUserInput } from '../utils/sanitize.util';
import { environment } from '../../../environments/environment';

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
  { videoId: '8mAITcNt710', title: 'Harvard CS50 â€“ Full Computer Science University Course', channel: 'freeCodeCamp.org', tags: ['computer science','cs50','harvard','fundamentals','cs'] },
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

  private readonly KEY        = environment.youtubeApiKey || '';
  get hasApiKey(): boolean     { return !!this.KEY; }

  private readonly SEARCH_URL = '/api/youtube-search';
  private readonly VIDEO_URL  = '/api/youtube-details';
  private readonly DIRECT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
  private readonly DIRECT_VIDEO_URL  = 'https://www.googleapis.com/youtube/v3/videos';
  private readonly OEMBED_URL = 'https://www.youtube.com/oembed';
  private readonly GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly GROQ_KEY   = environment.groqApiKey || '';

  constructor(private http: HttpClient) {}

  // â”€â”€ SEARCH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Context-aware study topic suggestions based on partial query. */
  getStudySuggestions(query: string): string[] {
    const q = sanitizeUserInput(query, 80).toLowerCase().trim();
    if (!q) return [];

    const topicMap: Record<string, string[]> = {
      bu: ['bubble sort', 'bubble sort algorithm', 'bubble sort in data structures', 'bubble sort gate smashers'],
      bub: ['bubble sort', 'bubble sort algorithm', 'bubble sort dry run', 'bubble sort time complexity'],
      bubble: ['bubble sort', 'bubble sort algorithm', 'bubble sort in c', 'bubble sort in java'],
      bi: ['binary search', 'binary tree', 'binary search tree', 'big o notation'],
      bin: ['binary search', 'binary search algorithm', 'binary search tree', 'binary tree traversal'],
      da: ['data structures', 'data science', 'database SQL', 'data analysis'],
      data: ['data structures', 'data science', 'database SQL', 'data analysis'],
      ds: ['data structures', 'data structures and algorithms', 'dsa full course', 'dsa placement preparation'],
      dsa: ['dsa tutorial', 'dsa full course', 'dsa gatesmashers', 'dsa placement preparation'],
      gate: ['gate computer science', 'gate cse data structures', 'gate smashers dsa', 'gate smashers operating system'],
      gatesmashers: ['gatesmashers dsa', 'gatesmashers operating system', 'gatesmashers dbms', 'gatesmashers computer networks'],
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
      os: ['operating system', 'operating system gate smashers', 'operating system full course'],
      dbms: ['dbms tutorial', 'dbms gate smashers', 'database management system'],
    };

    const learningTopics = [
      'bubble sort', 'selection sort', 'insertion sort', 'merge sort', 'quick sort', 'heap sort',
      'linear search', 'binary search', 'time complexity', 'space complexity', 'big o notation',
      'arrays in data structures', 'linked list', 'stack data structure', 'queue data structure',
      'tree data structure', 'binary tree', 'binary search tree', 'graph data structure',
      'hashing in data structures', 'recursion', 'dynamic programming', 'greedy algorithm',
      'data structures and algorithms', 'dsa full course', 'dsa tutorial', 'dsa gatesmashers',
      'gate smashers dsa', 'gate computer science', 'operating system', 'dbms', 'computer networks',
      'compiler design', 'theory of computation', 'software engineering', 'computer organization',
      'python programming', 'java programming', 'javascript tutorial', 'machine learning',
      'web development', 'software testing', 'sql tutorial', 'react tutorial', 'angular tutorial'
    ];

    const channelTopics = [
      'gate smashers dsa', 'gate smashers operating system', 'gate smashers dbms',
      'neso academy data structures', 'knowledge gate data structures', 'abdul bari algorithms',
      'take u forward dsa', 'striver dsa sheet', 'apna college dsa', 'codewithharry python'
    ];

    const suggestions = new Map<string, number>();
    const words = q.split(/\s+/).filter(Boolean);
    const add = (value: string, score: number) => {
      const clean = value.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!clean || clean === q) return;
      suggestions.set(clean, Math.max(score, suggestions.get(clean) || 0));
    };

    const matchesQuery = (candidate: string): boolean => {
      const c = candidate.toLowerCase();
      if (c.startsWith(q)) return true;
      const candidateWords = c.split(/\s+/);
      return words.every(word =>
        word.length > 1 && candidateWords.some(candidateWord => candidateWord.startsWith(word))
      );
    };

    for (const [key, values] of Object.entries(topicMap)) {
      if (key.startsWith(q) || q.startsWith(key) || words.some(w => key.startsWith(w))) {
        values.forEach(v => add(v, 110));
      }
    }

    for (const topic of learningTopics) {
      if (matchesQuery(topic)) add(topic, topic.startsWith(q) ? 100 : 85);
    }

    for (const topic of channelTopics) {
      if (matchesQuery(topic) || words.some(w => topic.includes(w) && w.length >= 3)) {
        add(topic, 78);
      }
    }

    for (const video of CURATED_VIDEOS) {
      const title = video.title.toLowerCase();
      const tags = video.tags.join(' ').toLowerCase();
      if (matchesQuery(title) || matchesQuery(tags)) {
        add(video.title.length > 58 ? `${video.tags[0]} tutorial` : video.title, 65);
      }
      for (const tag of video.tags) {
        if (matchesQuery(tag)) {
          add(tag.includes(' ') ? tag : `${tag} tutorial`, 60);
        }
      }
    }

    if (q.length >= 4 && suggestions.size < 5) {
      add(`${q} tutorial`, 35);
      add(`${q} full course`, 32);
      add(`${q} lecture`, 30);
      add(`${q} playlist`, 28);
      add(`${q} for beginners`, 25);
    }

    return Array.from(suggestions.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => value)
      .slice(0, 8);
  }

  searchVideos(query: string): Observable<any> {
    const safeQuery = sanitizeUserInput(query, 200);
    return this.http.get(this.SEARCH_URL, {
      params: { q: safeQuery, type: 'video', maxResults: '12' }
    }).pipe(
      catchError(() => this.searchVideosDirect(safeQuery)),
      catchError(() => {
        console.warn('[YouTube] API unavailable, using curated fallback');
        return this.searchWithAIFallback(safeQuery);
      })
    );
  }

  private searchVideosDirect(query: string): Observable<any> {
    if (!this.KEY) throw new Error('YouTube API key missing');
    return this.http.get(this.DIRECT_SEARCH_URL, {
      params: {
        part: 'snippet',
        q: query,
        key: this.KEY,
        maxResults: '12',
        type: 'video',
        videoEmbeddable: 'true',
        order: 'relevance',
        relevanceLanguage: 'en'
      }
    });
  }

  /**
   * Two-stage fallback when the YouTube Data API key is invalid/quota exceeded:
   *
   * Stage 1 â€” Curated match: score CURATED_VIDEOS against the query keywords.
   *            Returns instantly, no extra network call.
   *
   * Stage 2 â€” AI + oEmbed: ask Groq for video IDs, validate each via oEmbed,
   *            keep only IDs that actually exist. Runs in parallel with stage 1
   *            to supplement results.
   */
  private searchWithAIFallback(query: string): Observable<any> {
    const q = query.toLowerCase().trim();
    const keywords = q.split(/\s+/).filter((w: string) => w.length > 1);

    // Score each curated video with improved matching
    const scored = CURATED_VIDEOS.map(v => {
      const haystack = `${v.title} ${v.channel} ${v.tags.join(' ')}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (haystack.includes(kw)) {
          score += kw.length * 2;
        } else {
          const haystackWords = haystack.split(/\s+/);
          for (const hw of haystackWords) {
            if (hw.startsWith(kw) || kw.startsWith(hw)) {
              score += Math.min(kw.length, hw.length);
            }
          }
        }
      }
      if (haystack.includes(q)) score += 30;
      if (v.channel.toLowerCase().includes(q) || q.includes(v.channel.toLowerCase())) score += 15;
      return { ...v, score };
    })
    .filter(v => v.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 12);

    const toVideoItem = (v: any) => ({
      id: { videoId: v.videoId },
      snippet: {
        title: v.title,
        channelTitle: v.channel,
        description: '',
        thumbnails: { medium: { url: this.getThumbnail(v.videoId) } }
      },
      _source: 'curated'
    });

    if (scored.length >= 4) {
      return of({ items: scored.map(toVideoItem), _source: 'curated' });
    }
    return this.searchViaAIAndOEmbed(query, scored.map(toVideoItem));
  }

  private searchViaAIAndOEmbed(query: string, existingItems: any[]): Observable<any> {
    const existingIds = new Set(existingItems.map((v: any) => v.id.videoId));
    const prompt = `List 12 real YouTube educational videos about: "${query}"\nReturn ONLY a JSON array:\n[{"videoId":"EXACT11CHARID","title":"Real Video Title","channel":"Channel Name"}]`;
    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 800
    };
    const groqHeaders = new HttpHeaders({ 'Authorization': `Bearer ${this.GROQ_KEY}`, 'Content-Type': 'application/json' });
    return this.http.post(this.GROQ_URL, body, { headers: groqHeaders }).pipe(
      switchMap((res: any) => {
        const text = res?.choices?.[0]?.message?.content || '';
        let candidates: { videoId: string; title: string; channel: string }[] = [];
        try {
          const m = text.match(/\[[\s\S]*?\]/);
          if (m) candidates = JSON.parse(m[0]);
        } catch {}
        const toValidate = candidates
          .filter((c: any) => c.videoId && /^[a-zA-Z0-9_\-]{11}$/.test(c.videoId) && !existingIds.has(c.videoId))
          .slice(0, 8);
        if (!toValidate.length) {
          return of(this.buildFallbackResponse(existingItems, query));
        }
        const checks = toValidate.map((c: any) =>
          this.getOEmbed(c.videoId).pipe(
            map((oe: any) => oe ? {
              id: { videoId: c.videoId },
              snippet: {
                title: oe.title || c.title,
                channelTitle: oe.author_name || c.channel,
                description: '',
                thumbnails: { medium: { url: this.getThumbnail(c.videoId) } }
              },
              _source: 'ai-validated'
            } : null),
            catchError(() => of(null))
          )
        );
        return forkJoin(checks).pipe(
          map((results: any[]) => {
            const valid = results.filter((r: any) => r !== null);
            const allItems = [...existingItems, ...valid].slice(0, 12);
            if (allItems.length === 0) return this.buildFallbackResponse([], query);
            return { items: allItems, _source: 'ai-curated' };
          })
        );
      }),
      catchError(() => of(this.buildFallbackResponse(existingItems, query)))
    );
  }

  private buildFallbackResponse(existingItems: any[], query: string): any {
    if (existingItems.length > 0) {
      return { items: existingItems, _source: 'curated' };
    }
    const topVideos = CURATED_VIDEOS.slice(0, 8).map(v => ({
      id: { videoId: v.videoId },
      snippet: {
        title: v.title,
        channelTitle: v.channel,
        description: '',
        thumbnails: { medium: { url: this.getThumbnail(v.videoId) } }
      },
      _source: 'curated-popular'
    }));
    return {
      items: topVideos,
      _source: 'curated-popular',
      _fallbackNotice: `No exact results for "${query}". Showing popular educational videos.`
    };
  }
  getVideoDetails(videoId: string): Observable<any> {
    const params = { id: videoId, part: 'snippet,statistics,contentDetails' };
    return this.http.get(this.VIDEO_URL, { params }).pipe(
      catchError(() => this.getVideoDetailsDirect(videoId)),
      catchError(() => of({ items: [] }))
    );
  }

  private getVideoDetailsDirect(videoId: string): Observable<any> {
    if (!this.KEY) throw new Error('YouTube API key missing');
    return this.http.get(this.DIRECT_VIDEO_URL, {
      params: {
        id: videoId,
        part: 'snippet,statistics,contentDetails',
        key: this.KEY
      }
    });
  }

  getOEmbed(videoId: string): Observable<any> {
    return this.http.get(this.OEMBED_URL, {
      params: { url: `https://www.youtube.com/watch?v=${videoId}`, format: 'json' }
    }).pipe(catchError(() => of(null)));
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
    const input = sanitizeUserInput(url, 500).trim();
    if (!input) return null;

    const validId = (value: string | null | undefined): string | null => {
      const id = (value || '').trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    };

    const directId = validId(input);
    if (directId) return directId;

    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;

    try {
      const parsed = new URL(normalized);
      const host = parsed.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
      const pathParts = parsed.pathname.split('/').filter(Boolean);

      if (host === 'youtu.be') {
        return validId(pathParts[0]);
      }

      if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
        const queryId = validId(parsed.searchParams.get('v'));
        if (queryId) return queryId;

        const idRoutes = new Set(['embed', 'shorts', 'live', 'v', 'e']);
        if (pathParts.length >= 2 && idRoutes.has(pathParts[0])) {
          return validId(pathParts[1]);
        }
      }
    } catch {
      // Fall through to regex extraction for pasted text that is not a clean URL.
    }

    const fallback = input.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/|\/e\/)([a-zA-Z0-9_-]{11})/);
    return validId(fallback?.[1]);
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


