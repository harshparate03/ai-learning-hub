import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { YoutubeService } from '../../../core/services/youtube.service';
import { AiService } from '../../../core/services/ai.service';
import { SafeUrlPipe } from '../../../core/pipes/safe-url.pipe';
import { PdfService, PdfLine } from '../../../core/services/pdf.service';

interface ContentBlock {
  type: 'heading' | 'subheading' | 'para' | 'bullet' | 'table' | 'diagram' | 'definition' | 'divider' | 'code' | 'visual' | 'step-visual';
  content?: string;
  rows?: string[][];
  steps?: string[];
  term?: string;
  def?: string;
  lang?: string;
  frames?: { label: string; state: string }[];
}

type CodeLanguageId = 'python' | 'javascript' | 'typescript' | 'java' | 'csharp';

import { AiSparkComponent } from '../../../shared/ai-spark/ai-spark.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe, AiSparkComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent {

  query = '';
  urlInput = '';
  activeTab: 'search' | 'url' = 'search';
  suggestions: string[] = [];
  showSuggestions = false;

  videos: any[] = [];
  selectedVideo: any = null;
  videoDetails: any = null;
  videoUrl = '';
  isTechTopic = false;
  isStudyRelated = true;
  contentWarning = '';

  loading = false;
  loadingAI = false;
  errorMsg = '';
  searchInfo = '';   // shows corrected query or fallback notice

  summaryBlocks: ContentBlock[] = [];
  keyPoints: { title: string; detail: string }[] = [];
  notesBlocks: ContentBlock[] = [];
  visualBlocks: ContentBlock[] = [];
  quiz: { q: string; a: string; open: boolean }[] = [];
  activeAITab: 'summary' | 'keypoints' | 'notes' | 'visual' | 'quiz' = 'summary';
  copiedIndex = -1;
  savedMsg = '';

  /** User-chosen language for “Code + Visuals” (one block, not Python-by-default). */
  codeLanguage: CodeLanguageId = 'javascript';
  readonly codeLanguageOptions: { id: CodeLanguageId; label: string; hint: string }[] = [
    { id: 'python',     label: 'Python',     hint: 'pytest, Selenium' },
    { id: 'javascript', label: 'JavaScript', hint: 'Jest, Cypress' },
    { id: 'typescript', label: 'TypeScript', hint: 'Playwright, Vitest' },
    { id: 'java',       label: 'Java',       hint: 'JUnit 5, TestNG' },
    { id: 'csharp',     label: 'C#',         hint: 'NUnit, xUnit' }
  ];

  /** QA / testing topics: reorder chips and default language (title-first; ignore generic Python mentions in descriptions). */
  isLikelyQATopic(): boolean {
    if (!this.selectedVideo) return false;
    const title = this.selectedVideo?.snippet?.title || '';
    const tags = (this.videoDetails?.snippet?.tags || []).join(' ');
    const desc = (this.videoDetails?.snippet?.description || this.selectedVideo?.snippet?.description || '').slice(0, 700);
    const topic = `${title} ${tags} ${desc}`.toLowerCase();
    if (/array|linked list|\btree\b|\bgraph\b|dynamic programming|bfs|dfs|binary search|time complexity|big ?o|leetcode/i.test(topic)) {
      return false;
    }
    return /\bstlc\b|\bsdlc\b|software testing life|software testing|quality assurance|manual testing|test automation|test case|test plan|test lifecycle|selenium|cypress|playwright|jest|junit|testng|\bpytest\b|postman|karate|rest assured|\bsdet\b|\bqa\b/i.test(topic);
  }

  get codeLanguageChips(): { id: CodeLanguageId; label: string; hint: string; suggested: boolean }[] {
    const qa = this.isLikelyQATopic();
    const order: CodeLanguageId[] = qa
      ? ['javascript', 'typescript', 'java', 'python', 'csharp']
      : ['python', 'javascript', 'typescript', 'java', 'csharp'];
    return order.map(id => {
      const o = this.codeLanguageOptions.find(x => x.id === id)!;
      return { ...o, suggested: qa && id === 'javascript' };
    });
  }

  private visualGroqRules(): string {
    return `${this.englishOutputPreamble()}STRICT FORMAT (read before writing):
- Every ##FRAME## line must be ONE physical line: ##FRAME## Label ||| then your prose (never start a new line before finishing that frame).
- After ||| write 1–2 real sentences (minimum ~18 words) about the actual video topic (STLC, QA, testing, etc.). Be specific; use concrete testing terms. All of that prose must be English only (see OUTPUT LANGUAGE above).
- Never output square brackets [ ], angle brackets as placeholders, the words "placeholder", "TODO", "TBD", or echo any meta-instructions.
- ##VISUAL## … ##VISUALEND## must contain real multi-line ASCII art (4–10 lines) using characters like + - | / * ; describe build→test→release or similar. No bracket-only lines.`;
  }

  /**
   * Study UI is English-only. Titles like "… in Hindi" must not switch the model to Hindi.
   */
  private englishOutputPreamble(): string {
    return `OUTPUT LANGUAGE (mandatory): Write everything in English only: headings, paragraphs, bullets, definitions, table cells, quiz questions and answers, diagram labels, text after each ##FRAME## |||, and all code comments. Do not use Hindi, Urdu, Devanagari script, or Hinglish for explanations, even if the video title or description says "in Hindi" or is written in another language. You may state once in English that the video is Hindi-medium, but all teaching content must be English.

`;
  }

  constructor(public yt: YoutubeService, private ai: AiService, private pdf: PdfService) {}

  onQueryInput(): void {
    if (this.query.trim().length > 1) {
      this.suggestions = this.yt.getStudySuggestions(this.query);
      this.showSuggestions = this.suggestions.length > 0 && this.activeTab === 'search';
    } else {
      this.suggestions = [];
      this.showSuggestions = false;
    }
  }

  applySuggestion(suggestion: string): void {
    this.query = suggestion;
    this.showSuggestions = false;
    this.suggestions = [];
    this.search();
  }

  hideSuggestions(): void {
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  search() {
    if (!this.query.trim()) return;
    this.showSuggestions = false;
    this.loading = true;
    this.errorMsg = '';
    this.searchInfo = '';
    this.videos = [];
    this.selectedVideo = null;
    this.clearAI();

    const rawQuery = this.query.trim();

    this.yt.searchVideos(rawQuery).subscribe({
      next: (res: any) => {
        this.videos = res.items || [];
        if ((res._source === 'curated' || res._source === 'ai-curated') && this.videos.length) {
          this.searchInfo = `Showing curated results for "${rawQuery}" (live YouTube API unavailable)`;
        }
        if (!this.videos.length) {
          this.errorMsg = `No results found for "${rawQuery}". Try different keywords or paste a URL directly.`;
        }
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMsg = err?.status === 0
          ? 'YouTube API unavailable. Run "npm start" to launch the app with the API proxy, then try again.'
          : 'Search failed. Try pasting a video URL using the Paste URL tab.';
        this.loading = false;
      }
    });
  }

  loadFromUrl() {
    const videoId = this.yt.getVideoId(this.urlInput.trim());
    if (!videoId) { this.errorMsg = 'Invalid YouTube URL'; return; }
    this.loading = true; this.errorMsg = ''; this.clearAI();
    this.videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    this.yt.getVideoDetails(videoId).subscribe({
      next: (res: any) => {
        const item = res.items?.[0];
        if (item) {
          this.videoDetails = item;
          this.selectedVideo = { id: { videoId: item.id }, snippet: item.snippet };
          const tags = (item.snippet?.tags || []).join(' ');
          this.applyVideoAnalysis(
            item.snippet?.title || '',
            tags,
            item.snippet?.description || '',
            item.snippet?.categoryId,
            item.snippet?.channelTitle || ''
          );
          this.loading = false;
        } else {
          this.loadFromOEmbed(videoId);
        }
      },
      error: () => this.loadFromOEmbed(videoId)
    });
  }

  private loadFromOEmbed(videoId: string) {
    this.yt.getOEmbed(videoId).subscribe({
      next: (oe: any) => {
        const title = oe?.title || 'YouTube Video';
        this.selectedVideo = {
          id: { videoId },
          snippet: {
            title,
            channelTitle: oe?.author_name || 'Unknown Channel',
            description: '',
            thumbnails: { medium: { url: this.yt.getThumbnail(videoId) } }
          }
        };
        this.videoDetails = null;
        this.applyVideoAnalysis(title, '', '', undefined, oe?.author_name || '');
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Could not load video. Check the URL and try again.';
        this.loading = false;
      }
    });
  }

  selectVideo(video: any) {
    this.selectedVideo = video; this.clearAI();
    const videoId = video.id?.videoId || video.id;
    this.videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    this.yt.getVideoDetails(videoId).subscribe({
      next: (res: any) => {
        this.videoDetails = res.items?.[0] || null;
        const title = this.selectedVideo?.snippet?.title || '';
        const tags  = (this.videoDetails?.snippet?.tags || []).join(' ');
        const desc  = this.videoDetails?.snippet?.description || '';
        const categoryId = this.videoDetails?.snippet?.categoryId;
        this.applyVideoAnalysis(title, tags, desc, categoryId, this.selectedVideo?.snippet?.channelTitle || '');
      },
      error: () => {
        this.videoDetails = null;
        this.applyVideoAnalysis(
          this.selectedVideo?.snippet?.title || '',
          '',
          '',
          undefined,
          this.selectedVideo?.snippet?.channelTitle || ''
        );
      }
    });
  }

  clearAI() {
    this.summaryBlocks = []; this.keyPoints = [];
    this.notesBlocks = []; this.visualBlocks = []; this.quiz = [];
    this.isTechTopic = false;
    this.isStudyRelated = true;
    this.contentWarning = '';
    this.searchInfo = '';
  }

  private applyVideoAnalysis(title: string, tags: string, desc: string, categoryId?: string, channel = '') {
    const analysis = this.analyzeVideoContent(title, tags, desc, categoryId, channel);
    this.isStudyRelated = analysis.isStudyRelated;
    this.isTechTopic = analysis.isTechTopic;
    this.contentWarning = analysis.warning;
    if (this.isTechTopic) {
      this.inferCodeLanguageFromVideo(title, tags, desc);
    }
  }

  /** Guess code language from title/tags first; QA/STLC defaults to JS unless the title names a language (avoids picking Python from long course descriptions). */
  private inferCodeLanguageFromVideo(title: string, tags: string, desc: string): void {
    const titleTags = `${title} ${tags}`.toLowerCase();
    const head = `${title} ${tags} ${desc.slice(0, 900)}`.toLowerCase();

    const qaPrimary = /\bstlc\b|\bsdlc\b|software testing life|software testing\b|quality assurance|manual testing|test planning|test lifecycle|test automation\b|\bqa\b (?:engineer|tutorial|training|course|interview|full)/i.test(head);

    const inTitleTags = (re: RegExp) => re.test(titleTags);

    if (inTitleTags(/\bc#\b|c#|\.net|dotnet|\bnunit\b|\bxunit\b/)) {
      this.codeLanguage = 'csharp';
      return;
    }
    if (inTitleTags(/typescript|\bts\b.*(?:tutorial|course|test)|playwright/)) {
      this.codeLanguage = 'typescript';
      return;
    }
    if (inTitleTags(/\bjava\b/) && !/javascript|typescript/.test(titleTags)) {
      this.codeLanguage = 'java';
      return;
    }
    if (inTitleTags(/\bpython\b|pytest|django|flask/)) {
      this.codeLanguage = 'python';
      return;
    }
    if (inTitleTags(/javascript|\bjs\b|node\.?js|jest|cypress/)) {
      this.codeLanguage = 'javascript';
      return;
    }

    if (qaPrimary) {
      this.codeLanguage = 'javascript';
      if (inTitleTags(/\bpython\b|pytest/)) this.codeLanguage = 'python';
      else if (inTitleTags(/\bjava\b|junit|testng/)) this.codeLanguage = 'java';
      else if (inTitleTags(/typescript|playwright/)) this.codeLanguage = 'typescript';
      else if (inTitleTags(/\bc#\b|c#|nunit|xunit/)) this.codeLanguage = 'csharp';
      return;
    }

    if (/\bc#\b|c#|\.net|dotnet|\bnunit\b|\bxunit\b/i.test(head)) {
      this.codeLanguage = 'csharp';
      return;
    }
    if (/typescript|playwright|\.tsx?\b/i.test(head)) {
      this.codeLanguage = 'typescript';
      return;
    }
    if (/\bjava\b/i.test(head) && !/javascript|typescript/i.test(head)) {
      this.codeLanguage = 'java';
      return;
    }
    if (/python|pytest|django|flask/i.test(head)) {
      this.codeLanguage = 'python';
      return;
    }
    if (/javascript|\bjs\b|jest|node\.js|\bnode\b|cypress|mocha|npm|vitest/i.test(head)) {
      this.codeLanguage = 'javascript';
      return;
    }
    this.codeLanguage = 'javascript';
  }

  /** Map ##CODE## marker → display label in UI */
  displayCodeLang(marker: string): string {
    const k = (marker || '').trim().toLowerCase();
    const map: Record<string, string> = {
      python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript', java: 'Java', csharp: 'C#', code: 'Code'
    };
    return map[k] || marker || 'Code';
  }

  private codeGroqMarker(lang: CodeLanguageId): string {
    return lang === 'csharp' ? 'csharp' : lang;
  }

  private testingEcosystemHint(lang: CodeLanguageId): string {
    const h: Record<CodeLanguageId, string> = {
      python: 'Use pytest or unittest; if web automation fits, Selenium-style Python is OK.',
      javascript: 'Use Jest (describe/it) or plain Node assert; Cypress/Playwright-style steps may appear in comments.',
      typescript: 'Use TypeScript + Jest/Vitest or Playwright-style patterns.',
      java: 'Use JUnit 5 (@Test, assertions).',
      csharp: 'Use NUnit or xUnit ([Test], Assert).'
    };
    return h[lang];
  }

  setCodeLanguage(id: CodeLanguageId): void {
    if (this.loadingAI) return;
    this.codeLanguage = id;
  }

  private analyzeVideoContent(title: string, tags: string, desc: string, categoryId: string | undefined, channel: string): {
    isStudyRelated: boolean;
    isTechTopic: boolean;
    warning: string;
  } {
    // Include channel: titles often omit "recipe" while the channel is clearly food (e.g. "Swad recipes").
    const text = `${title} ${channel} ${tags} ${desc.slice(0, 800)}`.toLowerCase();

    // Word boundaries on short tokens avoid false positives (e.g. "example" matching "exam").
    const studyPattern = /\btutorial\b|\blecture\b|\bcourse\b|\blearn(?:ing)?\b|\beducation(?:al)?\b|study\s|university|college|\bexplained\b|introduction to|fundamentals|\bbasics\b|\blesson\b|syllabus|certification|interview prep|data structures?|algorithm|programming|machine learning|physics|chemistry|biology|mathematics|calculus|statistics|\bhistory\b of|geography|economics|engineering|medical|anatomy|\bneet\b|\bjee\b|\bgate\b|\bupsc\b|cbse|ncert|homework|textbook|revision|whiteboard|professor|\bteacher\b|coding|software develop|web dev|deep learning|neural network|\bexam\b|\bexams\b/i;

    const foodLifestylePattern = /recipe|recipes|cook(?:ing)?|baker|baking|kitchen|chef|foodie|mukbang|pizza|burger|sandwich|snacks?|desserts?|breakfast ideas|lunch ideas|meal prep|ingredients|yummy|delicious|tasty|food vlog|street food|how to make (?:a |the )?(?:cake|pizza|bread|curry|dosa|idli|biryani|noodles|pasta)|mayonnaise|bread pizza|restaurant style|cookbook|cuisine/i;

    const entertainmentPattern = /asmr(?:\s+eating)?|music video|official video|lyrics video|movie trailer|\btrailer\b|prank|day in (?:my|the) life|unboxing|reaction video|funny moments|meme|tiktok compilation|dance challenge|makeup tutorial|grwm|get ready with me|haul|gaming highlights|let'?s play|fortnite|minecraft (?:survival|gameplay)|sports highlights|football goals|wrestling|love story|drama episode|k-?drama|anime episode|vlog|travel vlog|concert|live performance|comedy sketch|stand[- ]?up comedy|podcast clip|celebrity|gossip|fashion week|nail art|hair tutorial|skincare routine/i;

    const techPattern = /\barray\b|linked list|\btree\b|\bgraph\b|\bsort\b|\bsearch\b|\bstack\b|\bqueue\b|\bhash\b|\bheap\b|dynamic programming|recursion|algorithm|data structure|bfs|dfs|binary|complexity|big.?o|python|javascript|java|c\+\+|c#|typescript|react|angular|vue|node|html|css|sql|\bapi\b|\bfunction\b|\bclass\b|\bobject\b|\bloop\b|variable|code|coding|programming|software|web dev|backend|frontend|machine learning|deep learning|neural|tensorflow|pytorch|git|docker|kubernetes|database|mongodb|mysql|rest api|graphql|flutter|swift|kotlin|rust|golang|php|ruby|software testing|quality assurance|test automation|manual testing|integration test|unit test|test case|test plan|\bsdet\b|selenium|cypress|playwright|jest|mocha|junit|testng|pytest|postman|karate|rest assured|jmeter|load test|regression test|gherkin|\bbdd\b|\btdd\b|qa engineer|\bqa\b|robot framework/i;

    const strongEduOverride = /university\s+lecture|credit course|degree program|board exam|class\s*(?:10|12|11|9|8)|\bncert\b|\bcbse\b|\biit\b|\bupsc\b|\bgate\b\s*(?:exam|preparation)|\bjee\b\s*(?:main|advanced|prep)|\bneet\b\s*(?:prep|ug)?|python (?:for )?beginners|javascript (?:for )?beginners|data structures and algorithms|machine learning (?:course|tutorial)|deep learning (?:course|tutorial)/i;

    const eduCategoryIds = new Set(['27', '28']); // Education, Science & Technology
    const entertainmentCategoryIds = new Set(['10', '23', '24']); // Music, Comedy, Entertainment

    const hasStudySignals = studyPattern.test(text) || techPattern.test(text)
      || (categoryId != null && eduCategoryIds.has(categoryId));
    const hasFoodLifestyle = foodLifestylePattern.test(text);
    const hasNonStudySignals = foodLifestylePattern.test(text) || entertainmentPattern.test(text)
      || (categoryId != null && entertainmentCategoryIds.has(categoryId) && !studyPattern.test(text));

    if (hasFoodLifestyle && !strongEduOverride.test(text)) {
      return {
        isStudyRelated: false,
        isTechTopic: false,
        warning: 'This looks like food, cooking, or lifestyle content — not study material. Use lectures, courses, or subject tutorials so notes stay accurate.'
      };
    }

    if (categoryId === '26' && /recipe|cooking|bake|food|chef|kitchen|pizza|snack|meal/i.test(text)
        && !/(programming|coding|install|repair|electronics|math|science|physics|chemistry|biology)/i.test(text)) {
      return {
        isStudyRelated: false,
        isTechTopic: false,
        warning: 'This looks like a how-to or lifestyle video (category: How-to & style), not academic study content. Try a lecture or course instead.'
      };
    }

    if (hasNonStudySignals && !hasStudySignals) {
      return {
        isStudyRelated: false,
        isTechTopic: false,
        warning: 'This video does not appear to be educational. AI Learning Hub works best with tutorials, lectures, and study content — not entertainment, recipes, or vlogs.'
      };
    }

    return {
      isStudyRelated: true,
      isTechTopic: techPattern.test(text),
      warning: ''
    };
  }

  getVideoId(video: any): string { return video?.id?.videoId || video?.id || ''; }
  getThumbnail(video: any): string {
    return video?.snippet?.thumbnails?.medium?.url || this.yt.getThumbnail(this.getVideoId(video));
  }

  // ── GENERATE ─────────────────────────────────────────────────────────────
  generateAI(type: 'summary' | 'keypoints' | 'notes' | 'visual' | 'quiz') {
    if (!this.selectedVideo) return;
    if (!this.isStudyRelated) {
      this.errorMsg = this.contentWarning || 'This video is not suitable for study notes. Please choose an educational video.';
      return;
    }
    this.errorMsg = '';
    this.loadingAI = true;
    this.activeAITab = type;

    const title    = this.selectedVideo?.snippet?.title || '';
    const channel  = this.selectedVideo?.snippet?.channelTitle || '';
    const desc     = (this.videoDetails?.snippet?.description || this.selectedVideo?.snippet?.description || '').slice(0, 2000);
    const tags     = (this.videoDetails?.snippet?.tags || []).slice(0, 30).join(', ');
    const duration = this.videoDetails?.contentDetails?.duration
      ? this.yt.formatDuration(this.videoDetails.contentDetails.duration) : '';
    const chapters = this.extractChapters(this.videoDetails?.snippet?.description || '');

    const context = `${this.englishOutputPreamble()}VIDEO TITLE: "${title}"
CHANNEL: ${channel}
DURATION: ${duration}
TAGS: ${tags}
${chapters ? 'CHAPTERS:\n' + chapters + '\n' : ''}
DESCRIPTION:
${desc}`;

    if (type === 'visual') {
      this.generateVisualNotes(title, tags, desc, chapters);
      return;
    }

    const prompts: Record<string, string> = {

      summary: `You are an expert content analyst. Based on the YouTube video data below, write a detailed, accurate summary.

${context}

Use EXACTLY these markers:

##HEADING## Video Overview
##PARA## [What this video covers based on title, description and chapters]

##HEADING## Topics Covered
##BULLET## [topic from tags/description/chapters]
##BULLET## [topic from tags/description/chapters]
##BULLET## [topic from tags/description/chapters]
##BULLET## [topic from tags/description/chapters]
##BULLET## [topic from tags/description/chapters]

##HEADING## Detailed Summary
##PARA## [First major section based on chapters/description]
##PARA## [Second major section]
##PARA## [Third major section — conclusions or key outcomes]

##HEADING## Key Concepts
##TABLE##
Concept | Explanation | Why It Matters
[term from video data] | [explanation] | [importance]
[term from video data] | [explanation] | [importance]
[term from video data] | [explanation] | [importance]
##TABLEEND##

##HEADING## Key Takeaways
##BULLET## [takeaway from video content]
##BULLET## [takeaway from video content]
##BULLET## [takeaway from video content]`,

      keypoints: `You are an expert content analyst. Extract key points from this YouTube video data.

${context}

Use EXACTLY this format:

##KP## [Key point title from video data]
##KD## [3-5 sentences: detailed explanation based on the video title, description, chapters and tags. Be specific and informative.]
##KPEND##

Extract 8-10 key points covering all major topics shown in the video data.`,

      notes: `You are an expert note-taker. Create comprehensive study notes from this YouTube video data.

${context}

Use EXACTLY these markers:

##HEADING## [Main topic from video]

##SUBHEADING## [Subtopic]
##PARA## [Detailed explanation based on video data]

##DEFINITION## [Term from video] ||| [Definition based on context]

##BULLET## [specific detail from video data]
##BULLET## [specific detail from video data]

For any process or workflow in the video:
##DIAGRAM## [Process name]
##STEP## [Step 1]
##STEP## [Step 2]
##STEP## [Step 3]
##DIAGRAMEND##

For comparisons or data:
##TABLE##
Header1 | Header2 | Header3
value | value | value
##TABLEEND##

##DIVIDER##

Create sections for every major topic. Minimum 5 sections.`,

      quiz: `Create 6 quiz questions based on this YouTube video data.

${context}

Use EXACTLY this format:
##Q## [Question about the video topic]
##A## [Detailed answer based on video data]
##QEND##`
    };

    this.ai.generateWithGroq(prompts[type]).subscribe({
      next: (res: any) => {
        const text = res?.choices?.[0]?.message?.content || '';
        if (!text || this.ai.isDemoFallback(text)) {
          this.errorMsg = this.ai.proxyErrorMessage({ status: 0 });
          this.loadingAI = false;
          return;
        }
        if (type === 'summary')   this.summaryBlocks = this.parseBlocks(text);
        if (type === 'keypoints') this.parseKeyPoints(text);
        if (type === 'notes')     this.notesBlocks = this.parseBlocks(text);
        if (type === 'quiz')      this.parseQuiz(text);
        this.loadingAI = false;
      },
      error: (err: any) => {
        this.errorMsg = this.ai.proxyErrorMessage(err);
        this.loadingAI = false;
      }
    });
  }

  // ── VISUAL NOTES ────────────────────────────────────────────────────────────────────
  private buildVisualCodePrompt(
    mode: 'dsa' | 'qa' | 'programming',
    title: string,
    tags: string,
    desc: string,
    lang: CodeLanguageId
  ): string {
    const marker = this.codeGroqMarker(lang);
    const human = this.displayCodeLang(marker);
    const tagSnippet = (tags || '').slice(0, 350);
    const descSnippet = (desc || '').slice(0, 650);

    if (mode === 'dsa') {
      return `${this.englishOutputPreamble()}You are an algorithms expert. Implement the main idea behind "${title}" as working ${human} code only.
Use ONLY these markers (exactly one code block, language ${human}):
##CODE## ${marker}
Between this line and ##CODEEND## output only valid ${human} source: full implementation with brief comments; add time/space complexity in comments where relevant.
##CODEEND##

Context:
Tags: ${tagSnippet || 'none'}
Description excerpt: ${descSnippet || 'none'}

Rules: No text outside markers. Do NOT output Python/Java/other languages — only ${human}.`;
    }

    if (mode === 'qa') {
      return `${this.englishOutputPreamble()}You are a senior SDET / QA engineer.
Video topic: "${title}"
Tags: ${tagSnippet || 'none'}
Description excerpt: ${descSnippet || 'none'}

Produce ONE focused example in ${human} only. Match software testing (unit, API, or automation skeleton) to the topic.
If the topic is STLC, SDLC, or lifecycle theory (little or no coding in the video), still output valid ${human} that illustrates one idea: e.g. a tiny unit test with comments mapping phases (plan/design/execute/report/close) to what the assertions represent—keep it short and syntactically correct for ${human}.

Stack hint: ${this.testingEcosystemHint(lang)}

Output ONLY (no other languages, no extra ##CODE## blocks). The code block marker language must be exactly: ${marker}
##CODE## ${marker}
Between this line and ##CODEEND## output only valid ${human} source code with short comments.
##CODEEND##`;
    }

    return `${this.englishOutputPreamble()}You are a senior developer.
Topic: "${title}"
Tags: ${tagSnippet || 'none'}
Description excerpt: ${descSnippet || 'none'}

Write ONE practical ${human} example aligned with the topic. Use only ${human} — not Python by default.

Output ONLY:
##CODE## ${marker}
Between this line and ##CODEEND## output only valid ${human} source code with comments.
##CODEEND##`;
  }

  private async generateVisualNotes(title: string, tags: string, desc: string, chapters: string) {
    const topic = `${title} ${tags} ${desc.slice(0, 400)}`.toLowerCase();
    const lang = this.codeLanguage;

    const isDSA = /array|linked list|tree|graph|sort|search|stack|queue|hash|heap|dp|dynamic programming|recursion|algorithm|data structure|bfs|dfs|binary search|pointer|complexity|big.?o|time complexity/i.test(topic);
    const isQA = !isDSA && /\bstlc\b|\bsdlc\b|software testing|quality assurance|test automation|manual testing|integration test|unit test|test case|test plan|\bsdet\b|selenium|cypress|playwright|jest|mocha|junit|testng|pytest|postman|karate|rest assured|jmeter|load test|regression test|gherkin|\bbdd\b|\btdd\b|qa engineer|\bqa\b|robot framework|api testing|performance test/i.test(topic);
    const isProgramming = !isDSA && !isQA && /python|javascript|java|c\+\+|react|angular|node|html|css|sql|api|function|class|object|loop|variable|code|programming|software|web dev|backend|frontend/i.test(topic);

    this.visualBlocks = [];

    const infoPrompt = `${this.englishOutputPreamble()}Create educational study notes for: "${title}"
${tags ? 'Tags: ' + tags : ''}
${chapters ? 'Chapters: ' + chapters : ''}
${desc ? 'Description: ' + desc.slice(0, 500) : ''}

Use ONLY these markers. Use plain text in bullets (no markdown **bold** markers).
##HEADING## ${title}
##PARA## [2-3 sentence overview]
##DEFINITION## [key term 1] ||| [definition]
##DEFINITION## [key term 2] ||| [definition]
##HEADING## Key Concepts
##BULLET## [concept 1]
##BULLET## [concept 2]
##BULLET## [concept 3]
##BULLET## [concept 4]
##BULLET## [concept 5]
##DIVIDER##
##HEADING## Important Details
##BULLET## [detail 1]
##BULLET## [detail 2]
##BULLET## [detail 3]`;

    let codePrompt = '';
    let visualPrompt = '';

    if (isDSA) {
      codePrompt = this.buildVisualCodePrompt('dsa', title, tags, desc, lang);
      visualPrompt = `${this.visualGroqRules()}

Draw ASCII + step frames for: "${title}"
${desc ? 'Context: ' + desc.slice(0, 450) : ''}

Output ONLY (complete every ##FRAME## on a single line; real content after each |||):

##VISUAL## ${title} — Structure
##VISUALEND##

##STEPVISUAL## ${title} — Worked example
##FRAME## Initial state |||
##FRAME## After step 1 |||
##FRAME## After step 2 |||
##FRAME## After step 3 |||
##FRAME## Final result |||
##STEPVISUALEND##`;

    } else if (isQA) {
      codePrompt = this.buildVisualCodePrompt('qa', title, tags, desc, lang);
      visualPrompt = `${this.visualGroqRules()}

Software testing / QA topic: "${title}"
${desc ? 'Description excerpt:\n' + desc.slice(0, 700) + '\n' : ''}

Map frames to STLC-style phases when relevant (requirements, planning, design, execution, reporting, closure). Use concrete QA vocabulary.

Output ONLY (each ##FRAME## is exactly one line ending with real prose after |||):

##STEPVISUAL## ${title} — QA / STLC workflow
##FRAME## Requirements & scope |||
##FRAME## Test planning |||
##FRAME## Test design |||
##FRAME## Environment & data setup |||
##FRAME## Execution & logging |||
##FRAME## Defects & reporting |||
##FRAME## Closure & metrics |||
##STEPVISUALEND##

##VISUAL## ${title} — Build → test → release (ASCII)
##VISUALEND##`;

    } else if (isProgramming) {
      codePrompt = this.buildVisualCodePrompt('programming', title, tags, desc, lang);
      visualPrompt = `${this.visualGroqRules()}

Process diagram for: "${title}"
${desc ? 'Context: ' + desc.slice(0, 400) : ''}

Output ONLY:

##STEPVISUAL## ${title} — How it works
##FRAME## Step 1 |||
##FRAME## Step 2 |||
##FRAME## Step 3 |||
##FRAME## Step 4 |||
##FRAME## Result |||
##STEPVISUALEND##`;

    } else {
      codePrompt = `${this.englishOutputPreamble()}Create a structured concept breakdown for: "${title}"
${desc ? 'Context: ' + desc.slice(0, 300) : ''}

Output ONLY:
##HEADING## Core Concepts
##BULLET## [main concept 1 with brief explanation]
##BULLET## [main concept 2 with brief explanation]
##BULLET## [main concept 3 with brief explanation]
##BULLET## [main concept 4 with brief explanation]
##HEADING## Key Facts
##TABLE##
Aspect | Details | Significance
[aspect 1] | [detail] | [why it matters]
[aspect 2] | [detail] | [why it matters]
[aspect 3] | [detail] | [why it matters]
##TABLEEND##`;

      visualPrompt = `${this.visualGroqRules()}

Timeline / process for: "${title}"
${desc ? 'Context: ' + desc.slice(0, 300) : ''}

Output ONLY:

##STEPVISUAL## ${title} — Key stages
##FRAME## Stage 1 |||
##FRAME## Stage 2 |||
##FRAME## Stage 3 |||
##FRAME## Stage 4 |||
##FRAME## Outcome |||
##STEPVISUALEND##`;
    }

    try {
      // Sequential calls avoid Groq rate limits from 3 parallel requests.
      const infoText = await this.groqText(infoPrompt);
      const codeText = await this.groqText(codePrompt);
      const visualText = await this.groqText(visualPrompt);

      this.visualBlocks = [
        ...this.parseBlocks(infoText),
        ...this.parseBlocks(codeText),
        ...this.parseBlocks(visualText)
      ];

      if (!this.visualBlocks.length) {
        this.errorMsg = 'AI returned empty content. Try again.';
      }
    } catch (e: any) {
      this.errorMsg = e?.message || 'Generation failed. Try again.';
    } finally {
      this.loadingAI = false;
    }
  }

  private async groqText(prompt: string): Promise<string> {
    try {
      const res = await firstValueFrom(this.ai.generateWithGroq(prompt));
      return res?.choices?.[0]?.message?.content?.trim() || '';
    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;
      if (status === 401 || status === 403) {
        throw new Error('API key is invalid. Check GROQ_API_KEY in your .env file.');
      }
      if (status === 429) {
        throw new Error('Rate limit reached. Wait a few seconds and try again.');
      }
      throw new Error('Generation failed. Try again.');
    }
  }

  private extractChapters(description: string): string {
    const lines = description.split('\n');
    const chapters: string[] = [];
    for (const line of lines) {
      if (line.match(/(\d{1,2}:\d{2}(:\d{2})?)/)) {
        const clean = line.replace(/[\(\)]/g, '').trim();
        if (clean.length > 3) chapters.push(clean);
      }
    }
    return chapters.join('\n');
  }

  // ── PARSERS ───────────────────────────────────────────────────────────────
  parseBlocks(text: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const lines = text.split('\n');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.startsWith('##HEADING##')) {
        blocks.push({ type: 'heading', content: line.replace('##HEADING##', '').trim() });
      } else if (line.startsWith('##SUBHEADING##')) {
        blocks.push({ type: 'subheading', content: line.replace('##SUBHEADING##', '').trim() });
      } else if (line.startsWith('##PARA##')) {
        blocks.push({ type: 'para', content: line.replace('##PARA##', '').trim() });
      } else if (line.startsWith('##BULLET##')) {
        blocks.push({ type: 'bullet', content: line.replace('##BULLET##', '').trim() });
      } else if (line.startsWith('##DIVIDER##')) {
        blocks.push({ type: 'divider' });
      } else if (line.startsWith('##DEFINITION##')) {
        const parts = line.replace('##DEFINITION##', '').split('|||');
        blocks.push({ type: 'definition', term: parts[0]?.trim(), def: parts[1]?.trim() });
      } else if (line.startsWith('##CODE##')) {
        const lang = line.replace('##CODE##', '').trim() || 'code';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('##CODEEND##')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'code', lang, content: codeLines.join('\n') });
      } else if (line.startsWith('##VISUAL##')) {
        const title = line.replace('##VISUAL##', '').trim();
        const vizLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('##VISUALEND##')) {
          vizLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'visual', content: title, steps: vizLines });
      } else if (line.startsWith('##STEPVISUAL##')) {
        const title = line.replace('##STEPVISUAL##', '').trim();
        const frames: { label: string; state: string }[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('##STEPVISUALEND##')) {
          const fl = lines[i].trim();
          if (fl.startsWith('##FRAME##')) {
            const parts = fl.replace('##FRAME##', '').split('|||');
            frames.push({ label: parts[0]?.trim() || '', state: parts[1]?.trim() || '' });
          }
          i++;
        }
        blocks.push({ type: 'step-visual', content: title, frames });
      } else if (line.startsWith('##TABLE##')) {
        const rows: string[][] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('##TABLEEND##')) {
          const row = lines[i].trim();
          if (row) rows.push(row.split('|').map(c => c.trim()).filter(c => c));
          i++;
        }
        if (rows.length >= 2) blocks.push({ type: 'table', rows });
      } else if (line.startsWith('##DIAGRAM##')) {
        const name = line.replace('##DIAGRAM##', '').trim();
        const steps: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('##DIAGRAMEND##')) {
          const s = lines[i].trim();
          if (s.startsWith('##STEP##')) steps.push(s.replace('##STEP##', '').trim());
          i++;
        }
        if (steps.length) blocks.push({ type: 'diagram', content: name, steps });
      }
      i++;
    }
    return blocks;
  }

  parseKeyPoints(text: string) {
    this.keyPoints = [];
    const blocks = text.split('##KP##').filter(b => b.trim());
    for (const block of blocks) {
      const titleMatch = block.match(/^([\s\S]*?)##KD##/);
      const detailMatch = block.match(/##KD##([\s\S]*?)##KPEND##/);
      const title = titleMatch?.[1]?.trim() || '';
      const detail = detailMatch?.[1]?.trim() || '';
      if (title) this.keyPoints.push({ title, detail });
    }
  }

  parseQuiz(text: string) {
    this.quiz = [];
    const blocks = text.split('##Q##').filter(b => b.trim());
    for (const block of blocks) {
      const qMatch = block.match(/^([\s\S]*?)##A##/);
      const aMatch = block.match(/##A##([\s\S]*?)##QEND##/);
      const q = qMatch?.[1]?.trim() || '';
      const a = aMatch?.[1]?.trim() || '';
      if (q && a) this.quiz.push({ q, a, open: false });
    }
  }

  toggleQuiz(i: number) { this.quiz[i].open = !this.quiz[i].open; }

  copyCode(code: string, idx: number) {
    navigator.clipboard.writeText(code).then(() => {
      this.copiedIndex = idx;
      setTimeout(() => this.copiedIndex = -1, 2000);
    });
  }

  saveNotes() {
    const title = this.selectedVideo?.snippet?.title || 'YouTube Notes';
    const tab = this.activeAITab;
    const lines: string[] = [`# ${title}\n`];

    // Helper: serialize a ContentBlock array to markdown lines
    const blocksToMd = (blocks: ContentBlock[]) => {
      blocks.forEach(b => {
        if (b.type === 'heading')    lines.push(`\n## ${b.content}`);
        if (b.type === 'subheading') lines.push(`\n### ${b.content}`);
        if (b.type === 'para')       lines.push(`\n${b.content}`);
        if (b.type === 'bullet')     lines.push(`- ${b.content}`);
        if (b.type === 'definition') lines.push(`\n**${b.term}**: ${b.def}`);
        if (b.type === 'divider')    lines.push('\n---');
        if (b.type === 'diagram') {
          lines.push(`\n### ${b.content}`);
          b.steps?.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
        }
        if (b.type === 'table' && b.rows) {
          lines.push('\n' + b.rows[0].join(' | '));
          lines.push(b.rows[0].map(() => '---').join(' | '));
          b.rows.slice(1).forEach(r => lines.push(r.join(' | ')));
        }
        if (b.type === 'code') {
          lines.push(`\n\`\`\`${b.lang || ''}`);
          lines.push(b.content || '');
          lines.push('```');
        }
        if (b.type === 'visual') {
          lines.push(`\n### ${b.content}`);
          lines.push('```');
          b.steps?.forEach(s => lines.push(s));
          lines.push('```');
        }
        if (b.type === 'step-visual') {
          lines.push(`\n### ${b.content}`);
          b.frames?.forEach((f, i) => lines.push(`${i + 1}. **${f.label}** — ${f.state}`));
        }
      });
    };

    // Download only what is visible on the active tab
    if (tab === 'summary') {
      lines.push('## Summary\n');
      blocksToMd(this.summaryBlocks);
    } else if (tab === 'keypoints') {
      lines.push('## Key Points\n');
      this.keyPoints.forEach((kp, i) => lines.push(`\n### ${i + 1}. ${kp.title}\n${kp.detail}`));
    } else if (tab === 'notes') {
      lines.push('## Study Notes\n');
      blocksToMd(this.notesBlocks);
    } else if (tab === 'visual') {
      lines.push('## Code + Visuals\n');
      blocksToMd(this.visualBlocks);
    } else if (tab === 'quiz') {
      lines.push('## Quiz\n');
      this.quiz.forEach((qa, i) => lines.push(`\n### Q${i + 1}: ${qa.q}\n**Answer:** ${qa.a}`));
    }

    const suffix = tab === 'summary' ? 'summary'
      : tab === 'keypoints' ? 'key-points'
      : tab === 'notes' ? 'notes'
      : tab === 'visual' ? 'code-visuals'
      : 'quiz';

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${suffix}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadPDF() {
    const title = this.selectedVideo?.snippet?.title || 'YouTube Notes';
    const channel = this.selectedVideo?.snippet?.channelTitle || '';
    const tab = this.activeAITab;

    const lines: PdfLine[] = [];
    let subtitle = `${channel ? channel + ' · ' : ''}`;
    let filename = `${title.replace(/\s+/g, '-').toLowerCase()}`;

    // Export ONLY the active tab content (not all sections combined)
    if (tab === 'summary') {
      subtitle += 'Video Summary';
      if (this.summaryBlocks.length) {
        this.blocksToLines(this.summaryBlocks).forEach(l => lines.push(l));
      }
      filename += '-summary.pdf';
    } 
    else if (tab === 'keypoints') {
      subtitle += 'Key Points';
      if (this.keyPoints.length) {
        this.keyPoints.forEach((kp, i) => {
          lines.push({ type: 'kp', text: `${i + 1}. ${kp.title}`, def: kp.detail });
        });
      }
      filename += '-key-points.pdf';
    } 
    else if (tab === 'notes') {
      subtitle += 'Study Notes';
      if (this.notesBlocks.length) {
        this.blocksToLines(this.notesBlocks).forEach(l => lines.push(l));
      }
      filename += '-notes.pdf';
    } 
    else if (tab === 'visual') {
      subtitle += 'Code + Visuals';
      if (this.visualBlocks.length) {
        this.blocksToLines(this.visualBlocks).forEach(l => lines.push(l));
      }
      filename += '-code-visuals.pdf';
    } 
    else if (tab === 'quiz') {
      subtitle += 'Quiz';
      if (this.quiz.length) {
        this.quiz.forEach((qa, i) => {
          lines.push({ type: 'qa-q', text: `Q${i + 1}: ${qa.q}` });
          lines.push({ type: 'qa-a', text: qa.a });
        });
      }
      filename += '-quiz.pdf';
    }

    this.pdf.save(
      filename,
      title,
      subtitle,
      lines,
      { template: 'study' }
    );
  }

  private blockToPdfLine(b: any): PdfLine {
    if (b.type === 'heading')    return { type: 'heading',    text: b.content };
    if (b.type === 'subheading') return { type: 'subheading', text: b.content };
    if (b.type === 'para')       return { type: 'para',       text: b.content };
    if (b.type === 'bullet')     return { type: 'bullet',     text: b.content };
    if (b.type === 'definition') return { type: 'definition', term: b.term, def: b.def };
    if (b.type === 'divider')    return { type: 'divider' };
    if (b.type === 'code')       return { type: 'code', text: b.content, label: b.lang };
    if (b.type === 'table')      return { type: 'table', rows: b.rows };
    return { type: 'para', text: b.content || '' };
  }

  private blocksToLines(blocks: any[]): PdfLine[] {
    const out: PdfLine[] = [];
    for (const b of blocks) {
      if (b.type === 'step-visual' && b.frames) {
        out.push({ type: 'subheading', text: b.content });
        b.frames.forEach((f: any) => out.push({ type: 'step', label: f.label, state: f.state }));
      } else if (b.type === 'visual' && b.steps) {
        out.push({ type: 'subheading', text: b.content });
        out.push({ type: 'code', text: b.steps.join('\n'), label: 'ascii' });
      } else if (b.type === 'diagram' && b.steps) {
        out.push({ type: 'subheading', text: b.content });
        b.steps.forEach((s: string, i: number) => out.push({ type: 'bullet', text: `${i + 1}. ${s}` }));
      } else {
        out.push(this.blockToPdfLine(b));
      }
    }
    return out;
  }

  saveToHistory() {
    const title = this.selectedVideo?.snippet?.title || 'YouTube Notes';
    const tab = this.activeAITab;
    let preview = '';
    if (tab === 'summary' && this.summaryBlocks.length)   preview = this.summaryBlocks.find(b => b.type === 'para')?.content?.slice(0, 100) || '';
    if (tab === 'keypoints' && this.keyPoints.length)     preview = this.keyPoints[0]?.title?.slice(0, 100) || '';
    if (tab === 'notes' && this.notesBlocks.length)       preview = this.notesBlocks.find(b => b.type === 'para')?.content?.slice(0, 100) || '';
    if (tab === 'quiz' && this.quiz.length)               preview = this.quiz[0]?.q?.slice(0, 100) || '';
    const history = JSON.parse(localStorage.getItem('summarizer_history') || '[]');
    history.unshift({
      type: 'notes',
      title: `${title} — ${tab}`,
      date: new Date().toLocaleDateString(),
      preview,
      videoId: this.getVideoId(this.selectedVideo)
    });
    localStorage.setItem('summarizer_history', JSON.stringify(history.slice(0, 50)));
    this.savedMsg = '✓ Saved to History';
    setTimeout(() => this.savedMsg = '', 2500);
  }
}
