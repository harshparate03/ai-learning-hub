import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { AiService } from '../../../core/services/ai.service';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType, TableCell, TableRow, Table,
  WidthType, convertInchesToTwip, UnderlineType, ImageRun
} from 'docx';
import pptxgen from 'pptxgenjs';
import { PdfService, PdfLine, determineBulletStyle } from '../../../core/services/pdf.service';
import { BRAND_LOGO_B64, BRAND_LOGO_WIDTH, BRAND_LOGO_HEIGHT } from '../../../core/services/brand-logo-b64';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface SubTopic {
  title: string;
  explanation: string;
  bullets: string[];
}

export interface TopicBlock {
  title: string;
  explanation: string;
  subtopics: SubTopic[];
  bullets: string[];
  codes: { lang: string; code: string }[];
  image: string;
}

export interface QABlock {
  q: string;
  a: string;
  steps: string[];
  image: string;
}

import { AiSparkComponent } from '../../../shared/ai-spark/ai-spark.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, AiSparkComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent implements OnInit {

  mode: 'text' | 'file' = 'text';
  inputText: string = '';
  fileContent: string = '';
  fileName: string = '';
  pdfImages: { pageNum: number; dataUrl: string }[] = [];
  pdfArrayBuffer: ArrayBuffer | null = null;

  topics: TopicBlock[] = [];
  questions: QABlock[] = [];
  loading: boolean = false;
  errorMsg: string = '';
  progress: string = '';
  chunkResults: string[] = [];
  downloadFormat: string = 'pdf';
  copiedIndex: number = -1;
  detectedSubject: string = '';
  savedMsg: string = '';

  constructor(private ai: AiService, private pdf: PdfService) {}

  ngOnInit() {
    const pending = localStorage.getItem('summary_history_load');
    if (!pending) return;
    try {
      const saved = JSON.parse(pending);
      if (saved.topics?.length) {
        this.topics = saved.topics;
        this.questions = saved.questions || [];
        this.detectedSubject = saved.title || '';
        this.fileName = saved.title || 'Saved Notes';
      } else if (saved.content) {
        this.inputText = this.cleanPdfText(String(saved.content));
        this.mode = 'text';
      }
    } catch (e) {
      console.error('[Upload History Load Error]', e);
    }
    localStorage.removeItem('summary_history_load');
  }

  switchMode(m: 'text' | 'file') {
    this.mode = m;
    this.reset();
  }

  reset() {
    this.inputText = '';
    this.fileContent = '';
    this.fileName = '';
    this.pdfImages = [];
    this.pdfArrayBuffer = null;
    this.topics = [];
    this.questions = [];
    this.errorMsg = '';
    this.progress = '';
    this.chunkResults = [];
    this.detectedSubject = '';
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.reset();
    this.fileName = file.name;
    this.progress = 'Reading file...';

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'txt') {
      this.fileContent = await file.text();
      this.progress = '';
    }

    if (ext === 'pdf') {
      this.pdfArrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(this.pdfArrayBuffer as ArrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        this.progress = `Reading page ${i} of ${pdf.numPages}...`;
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        if (text) text += '\n\n';
        text += this.extractPdfPageText(content.items as any[]) + '\n';
      }
      this.fileContent = this.cleanPdfText(text);
      this.progress = '';
    }

    if (ext === 'docx') {
      const buf = await file.arrayBuffer();
      const result = await (mammoth as any).extractRawText({ arrayBuffer: buf });
      this.fileContent = result.value || '';
      this.progress = '';
    }

    if (ext === 'pptx' || ext === 'ppt') {
      const buf = await file.arrayBuffer();
      const zip = await (JSZip as any).loadAsync(buf);
      const slideFiles = Object.keys(zip.files)
        .filter((name: string) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
        .sort();
      let text = '';
      for (const sf of slideFiles) {
        const xml = await zip.files[sf].async('string');
        const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
        const slideText = textMatches
          .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
          .filter((t: string) => t.length > 0)
          .join(' ');
        if (slideText) text += slideText + '\n\n';
      }
      this.fileContent = text;
      this.progress = '';
    }
  }

  get canGenerate(): boolean {
    return this.mode === 'text'
      ? this.inputText.trim().length > 0
      : this.fileContent.length > 0;
  }

  chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let current = '';
    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length > size && current) {
        chunks.push(current.trim());
        current = para;
      } else {
        current = current ? current + '\n\n' + para : para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [text];
  }


  private extractPdfPageText(items: any[]): string {
    const positioned = (items || [])
      .map(item => ({
        text: String(item.str || '').trim(),
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0)
      }))
      .filter(item => item.text);

    positioned.sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);

    const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
    for (const item of positioned) {
      const line = lines.find(l => Math.abs(l.y - item.y) <= 2);
      if (line) {
        line.parts.push({ x: item.x, text: item.text });
      } else {
        lines.push({ y: item.y, parts: [{ x: item.x, text: item.text }] });
      }
    }

    return lines
      .map(line => line.parts.sort((a, b) => a.x - b.x).map(part => part.text).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }
  async extractPdfImages() {
    if (!this.pdfArrayBuffer) return;
    try {
      const typedArray = new Uint8Array(this.pdfArrayBuffer as ArrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const ops = await page.getOperatorList();
        const hasImage = ops.fnArray.some((fn: any) =>
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintImageMaskXObject
        );
        if (hasImage) {
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          this.pdfImages.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.75) });
        }
      }
    } catch {}
  }

  async generateAI() {
    if (!this.canGenerate) return;

    this.loading = true;
    this.errorMsg = '';
    this.topics = [];
    this.questions = [];
    this.pdfImages = [];
    this.chunkResults = [];
    this.detectedSubject = '';

    const content = this.cleanPdfText(this.mode === 'text' ? this.inputText : this.fileContent);
    // Use larger chunks to reduce number of API calls (fewer = less rate limiting)
    const chunks = this.chunkText(content, 7000);

    this.extractPdfImages();

    try {
      for (let i = 0; i < chunks.length; i++) {
        this.progress = `Processing section ${i + 1} of ${chunks.length}...`;

        const prompt = `You are an expert academic note-taker. Analyze the content and extract comprehensive study notes as JSON.

Output ONLY valid JSON, no markdown, no explanation:
{"topics":[{"title":"Topic Title","explanation":"4-6 sentence explanation with key concepts.","subtopics":[{"title":"Subtopic","explanation":"3-4 sentence explanation.","bullets":["key point 1","key point 2","key point 3"]}],"bullets":["important point 1","important point 2"],"codes":[{"lang":"language","code":"code here"}],"image":"diagram description or empty string"}]}

Rules:
- Extract ALL topics from the content (minimum 3, maximum 8 per chunk)
- Each topic needs at least 2-3 subtopics
- Only include codes array if actual code exists in content, otherwise use empty array []
- image field: describe any diagram/figure mentioned, or empty string ""
- Use **bold** for key terms in explanations and bullets

CONTENT:
${chunks[i]}

Output complete JSON now:`;

        let text = '';
        try {
          const res: any = await lastValueFrom(this.ai.generateWithGroq(prompt, 2048));
          text = res?.choices?.[0]?.message?.content || '';
        } catch (chunkErr: any) {
          const s = chunkErr?.status;
          if (s === 429) {
            // Rate limited — wait longer and retry once with smaller output
            this.progress = `Rate limited — waiting 15s before retrying section ${i + 1}...`;
            await new Promise(r => setTimeout(r, 15000));
            try {
              const retryRes: any = await lastValueFrom(this.ai.generateWithGroq(prompt, 1536));
              text = retryRes?.choices?.[0]?.message?.content || '';
            } catch {
              // If still fails, use local fallback for this chunk
              text = this.buildLocalChunkJson(chunks[i]);
            }
          } else {
            throw chunkErr; // re-throw non-429 errors
          }
        }

        if (text) this.chunkResults.push(text);
        this.parseTopics(this.chunkResults.join('\n\n'));
        this.progress = `Section ${i + 1} of ${chunks.length} done — ${this.topics.length} topics found...`;

        // Inter-chunk delay to avoid hitting rate limits on next call
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      this.detectedSubject = this.topics.slice(0, 3).map(t => t.title.replace(/\*\*/g, '')).join(', ');
      this.progress = 'Generating Exam Q&A...';

      const topicList = this.topics.map((t, idx) => `${idx + 1}. ${t.title.replace(/\*\*/g, '')}`).join('\n');

      const qaPrompt = `Generate 8 exam questions as JSON. Output ONLY valid JSON:
{"questions":[{"q":"Question text?","a":"Detailed answer introduction.","steps":["Step 1 explanation","Step 2 explanation","Step 3 explanation"],"image":""}]}

Topics covered: ${topicList}
Content: ${this.chunkResults.join('\n\n').slice(0, 5000)}

Output JSON now:`;

      let qaText = '';
      try {
        const qaRes: any = await lastValueFrom(this.ai.generateWithGroq(qaPrompt, 2048));
        qaText = qaRes?.choices?.[0]?.message?.content || '';
      } catch (qaErr: any) {
        if (qaErr?.status === 429) {
          // Rate limited on Q&A — wait and retry
          this.progress = 'Rate limited — waiting 15s for Q&A generation...';
          await new Promise(r => setTimeout(r, 15000));
          try {
            const retryQaRes: any = await lastValueFrom(this.ai.generateWithGroq(qaPrompt, 1536));
            qaText = retryQaRes?.choices?.[0]?.message?.content || '';
          } catch {
            // Build basic Q&A from topics if AI fails
            qaText = this.buildLocalQAJson();
          }
        } else {
          qaText = this.buildLocalQAJson(); // fallback for any Q&A error
        }
      }

      this.parseQuestions(qaText);
      this.progress = '';
      this.loading = false;

    } catch (err: any) {
      const status = err?.status;
      const msg = err?.error?.error?.message || err?.message || 'AI processing failed.';
      if (status === 401 || status === 403) {
        this.errorMsg = 'API key is not valid. Please check the API key configuration.';
      } else if (status === 429) {
        this.errorMsg = 'Rate limit reached. Please wait 1-2 minutes and try again. Your API key has a usage limit per minute.';
      } else if (status === 503 || /all ai models failed/i.test(msg)) {
        this.errorMsg = 'AI service temporarily unavailable. Please try again in a moment.';
      } else if (status === 0 || !status) {
        this.errorMsg = 'Network error. Please check your internet connection and try again.';
      } else {
        this.errorMsg = msg || 'AI processing failed. Please try again.';
      }
      this.progress = '';
      this.loading = false;
    }
  }

  /** Build a minimal JSON response from raw text when AI is unavailable */
  private buildLocalChunkJson(chunk: string): string {
    const lines = chunk.split('\n').filter(l => l.trim().length > 20).slice(0, 30);
    const title = lines[0]?.trim().slice(0, 60) || 'Study Content';
    const bullets = lines.slice(1, 6).map(l => l.trim().replace(/^[-*•]\s*/, ''));
    return JSON.stringify({
      topics: [{
        title,
        explanation: lines.slice(0, 3).join(' ').slice(0, 300),
        subtopics: [],
        bullets,
        codes: [],
        image: ''
      }]
    });
  }

  /** Build basic Q&A from existing topics when AI is unavailable */
  private buildLocalQAJson(): string {
    const questions = this.topics.slice(0, 6).map(t => ({
      q: `What is ${t.title.replace(/\*\*/g, '')}?`,
      a: t.explanation.replace(/\*\*/g, '').slice(0, 200),
      steps: t.bullets.slice(0, 4).map(b => b.replace(/\*\*/g, '')),
      image: ''
    }));
    return JSON.stringify({ questions });
  }


  private buildLocalSummary(content: string) {
    const cleanContent = this.normalizeText(content);
    const sections = this.extractLocalSections(cleanContent);
    this.topics = sections.map((section, i) => ({
      title: section.title || `Topic ${i + 1}`,
      explanation: this.makeLocalParagraph(section.title, section.body),
      subtopics: this.extractLocalSubtopics(section.body).slice(0, 5).map(sub => {
        const context = this.findContext(section.body, sub);
        return {
          title: sub,
          explanation: this.makeLocalParagraph(sub, context || section.body),
          bullets: this.extractLocalBullets(context || section.body).slice(0, 5)
        };
      }),
      bullets: this.extractLocalBullets(section.body).slice(0, 6),
      codes: this.extractCodeBlocks(section.body),
      image: ''
    })).slice(0, 12);

    if (!this.topics.length && cleanContent) {
      this.topics = [{
        title: this.firstWords(cleanContent, 'Overview'),
        explanation: this.makeLocalParagraph('Overview', cleanContent),
        subtopics: [],
        bullets: this.splitSentences(cleanContent).slice(0, 6),
        codes: [],
        image: ''
      }];
    }

    this.questions = this.topics.slice(0, 10).map(topic => ({
      q: `Explain ${topic.title.replace(/\*\*/g, '')}.`,
      a: topic.explanation,
      steps: [
        ...topic.bullets.slice(0, 3),
        ...topic.subtopics.slice(0, 2).map(s => `${s.title}: ${s.explanation}`)
      ].slice(0, 5),
      image: ''
    }));

    this.detectedSubject = this.topics.slice(0, 3).map(t => t.title.replace(/\*\*/g, '')).join(', ');
    this.errorMsg = '';
    this.progress = `Built local notes from content - ${this.topics.length} topics found.`;
  }

  private extractLocalSections(content: string): { title: string; body: string }[] {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const sections: { title: string; body: string[] }[] = [];
    let current: { title: string; body: string[] } | null = null;
    const flush = () => { if (current) sections.push(current); };

    for (const line of lines) {
      const heading = this.extractHeading(line);
      if (heading) {
        flush();
        current = { title: heading, body: [] };
      } else if (current) {
        current.body.push(line);
      } else {
        current = { title: this.firstWords(content, this.fileName || 'Study Notes'), body: [line] };
      }
    }
    flush();

    const mapped = sections
      .map(s => ({ title: s.title, body: s.body.join('\n') }))
      .filter(s => s.body.trim().length > 20);
    if (mapped.length) return mapped;

    return content
      .split(/\n\s*\n|(?<=\.)\s+(?=[A-Z][A-Za-z ]{8,70}:)/)
      .map((p, i) => ({ title: this.firstWords(p, `Topic ${i + 1}`), body: p.trim() }))
      .filter(s => s.body.length > 30)
      .slice(0, 12);
  }

  private extractHeading(line: string): string | null {
    const clean = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .trim();
    if (!clean || clean.length > 90) return null;
    if (/^---\s*Page\s+\d+\s*---$/i.test(clean)) return null;
    if (/[:：]$/.test(clean)) return clean.replace(/[:：]$/, '');
    if (/^\d+(?:\.\d+)*\s+/.test(clean)) return clean.replace(/^\d+(?:\.\d+)*\s+/, '');
    if (/^[A-Z][A-Z0-9\s/&-]{4,}$/.test(clean)) return clean;
    if (clean.split(/\s+/).length <= 8 && !/[.!?]$/.test(clean)) return clean;
    return null;
  }

  private extractLocalSubtopics(text: string): string[] {
    const headings = text.split('\n').map(l => this.extractHeading(l)).filter((h): h is string => !!h);
    if (headings.length) return this.uniqueLabels(headings);
    return this.uniqueLabels(this.extractLocalBullets(text).slice(0, 8));
  }

  private extractLocalBullets(text: string): string[] {
    const bullets = text.split('\n')
      .map(l => l.trim().match(/^(?:[-*+]|\d+[.)])\s+(.+)/)?.[1] || '')
      .filter(Boolean);
    if (bullets.length) return this.uniqueLabels(bullets);
    return this.uniqueLabels(this.splitSentences(text).slice(0, 8));
  }

  private splitSentences(text: string): string[] {
    return this.normalizeText(text)
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length >= 20 && s.length <= 260);
  }

  private findContext(body: string, label: string): string {
    const sentences = this.splitSentences(body);
    const words = label.toLowerCase().split(/\W+/).filter(w => w.length > 3).slice(0, 4);
    const idx = sentences.findIndex(s => words.some(w => s.toLowerCase().includes(w)));
    if (idx === -1) return sentences.slice(0, 3).join(' ');
    return sentences.slice(Math.max(0, idx - 1), idx + 3).join(' ');
  }

  private makeLocalParagraph(label: string, source: string): string {
    const sentences = this.splitSentences(source).slice(0, 3);
    if (sentences.length) return sentences.join(' ');
    return `${label || 'This topic'} was identified from the provided content and is included as part of the study structure.`;
  }

  private extractCodeBlocks(text: string): { lang: string; code: string }[] {
    const codes: { lang: string; code: string }[] = [];
    const re = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[2].trim().length > 5) codes.push({ lang: match[1] || 'code', code: match[2].trim() });
    }
    return codes;
  }

  private firstWords(text: string, fallback: string): string {
    return this.normalizeText(text).split(/\s+/).filter(Boolean).slice(0, 8).join(' ') || fallback;
  }

  private uniqueLabels(items: string[]): string[] {
    const seen = new Set<string>();
    return items
      .map(i => i.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^[\d.)\-\s]+/, '').trim())
      .filter(i => {
        const key = i.toLowerCase();
        if (key.length < 3 || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private normalizeText(text: string): string {
    return (text || '').replace(/\r/g, '').replace(/[ \t]{2,}/g, ' ').trim();
  }
  private normalizeSummaryMarkers(text: string): string {
    return (text || '')
      .replace(/\r/g, '')
      .replace(/(^|\n)\s*(#{0,2}TOPIC##)/gi, '$1##TOPIC##')
      .replace(/(^|\n)\s*(#{0,2}EXPLANATION##)/gi, '$1##EXPLANATION##')
      .replace(/(^|\n)\s*(#{0,2}SUBTOPICS##)/gi, '$1##SUBTOPICS##')
      .replace(/(^|\n)\s*(#{0,2}BULLETS##)/gi, '$1##BULLETS##')
      .replace(/(^|\n)\s*(#{0,2}CODE##)/gi, '$1##CODE##')
      .replace(/(^|\n)\s*(#{0,2}ENDCODE##)/gi, '$1##ENDCODE##')
      .replace(/(^|\n)\s*(#{0,2}IMAGE##)/gi, '$1##IMAGE##')
      .replace(/(^|\n)\s*(#{0,2}END##)/gi, '$1##END##')
      .replace(/(^|\n)\s*(#{0,3}SUB###)/gi, '$1###SUB###')
      .replace(/(^|\n)\s*(#{0,3}SUBEXP###)/gi, '$1###SUBEXP###')
      .replace(/(^|\n)\s*(#{0,3}SUBBULLETS###)/gi, '$1###SUBBULLETS###')
      .replace(/(^|\n)\s*(#{0,3}SUBEND###|ENDSUB)/gi, '$1###SUBEND###')
      .replace(/(^|\n)\s*(#{0,2}Q##)/gi, '$1##Q##')
      .replace(/(^|\n)\s*(#{0,2}A##)/gi, '$1##A##')
      .replace(/(^|\n)\s*(#{0,2}STEPS##)/gi, '$1##STEPS##')
      .replace(/(^|\n)\s*(#{0,2}QIMAGE##)/gi, '$1##QIMAGE##')
      .replace(/(^|\n)\s*(#{0,2}QEND##)/gi, '$1##QEND##');
  }

  private cleanStructuredText(text: string): string {
    return (text || '')
      .replace(/#{2,3}(?:TOPIC|EXPLANATION|SUBTOPICS|BULLETS|CODE|ENDCODE|IMAGE|END|SUB|SUBEXP|SUBBULLETS|SUBEND|Q|A|STEPS|QIMAGE|QEND)#{2,3}/gi, '')
      .replace(/\b(?:SUBTOPICS|SUBBULLETS|SUBEXP|SUBEND|ENDSUB|BULLETS|IMAGE|END)#{0,3}\b/gi, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^[\s#:\-]+|[\s#:\-]+$/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  parseTopics(text: string) {
    // Try JSON parsing first
    try {
      const jsonMatch = text.match(/\{[\s\S]*"topics"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.topics?.length) {
          this.topics = [...this.topics, ...parsed.topics.map((t: any) => ({
            title: t.title || '',
            explanation: t.explanation || '',
            subtopics: (t.subtopics || []).map((s: any) => ({
              title: s.title || '',
              explanation: s.explanation || '',
              bullets: s.bullets || []
            })),
            bullets: t.bullets || [],
            codes: t.codes || [],
            image: t.image || ''
          }))].filter(t => t.title);
          return;
        }
      }
    } catch {}
    // Fallback to marker parsing
    this.topics = [];
    const normalizedText = this.normalizeSummaryMarkers(text);
    const blocks = normalizedText.split('##TOPIC##').filter(b => b.trim());

    for (const block of blocks) {
      const titleMatch = block.match(/^([\s\S]*?)##EXPLANATION##/);
      const explanationMatch = block.match(/##EXPLANATION##([\s\S]*?)(?:##SUBTOPICS##|##BULLETS##|##END##)/);
      const bulletsMatch = block.match(/##BULLETS##([\s\S]*?)(?:##CODE##|##IMAGE##|##END##)/);
      const imageMatch = block.match(/##IMAGE##([\s\S]*?)##END##/);

      const title = titleMatch ? this.cleanStructuredText(titleMatch[1]) : '';
      const explanation = explanationMatch ? this.cleanStructuredText(explanationMatch[1]) : '';
      const bulletsRaw = bulletsMatch ? bulletsMatch[1].trim() : '';
      const image = imageMatch ? this.cleanStructuredText(imageMatch[1]) : '';

      const bullets = bulletsRaw.split('\n')
        .map((l: string) => this.cleanStructuredText(l.replace(/^[-*\u2022]\s*/, '')))
        .filter((l: string) => l.length > 2);

      // parse subtopics
      const subtopics: SubTopic[] = [];
      const subBlocks = block.split('###SUB###').slice(1);
      for (const sb of subBlocks) {
        const subTitleMatch = sb.match(/^([\s\S]*?)###SUBEXP###/);
        const subExpMatch = sb.match(/###SUBEXP###([\s\S]*?)(?:###SUBBULLETS###|###SUBEND###)/);
        const subBulletsMatch = sb.match(/###SUBBULLETS###([\s\S]*?)###SUBEND###/);

        const subTitle = subTitleMatch ? this.cleanStructuredText(subTitleMatch[1]) : '';
        const subExp = subExpMatch ? this.cleanStructuredText(subExpMatch[1]) : '';
        const subBulletsRaw = subBulletsMatch ? subBulletsMatch[1].trim() : '';
        const subBullets = subBulletsRaw.split('\n')
        .map((l: string) => this.cleanStructuredText(l.replace(/^[-*\u2022]\s*/, '')))
          .filter((l: string) => l.length > 2);

        if (subTitle) subtopics.push({ title: subTitle, explanation: subExp, bullets: subBullets });
      }

      const codes: { lang: string; code: string }[] = [];
      const codeRegex = /##CODE##\s*(\w*)\n([\s\S]*?)##ENDCODE##/g;
      let codeMatch;
      while ((codeMatch = codeRegex.exec(block)) !== null) {
        const codeContent = codeMatch[2].trim();
        if (codeContent.length > 5) codes.push({ lang: codeMatch[1] || 'code', code: codeContent });
      }

      if (title) {
        const cleanImage = image.trim();
        this.topics.push({ title, explanation, subtopics, bullets, codes,
          image: (!cleanImage || cleanImage.toUpperCase() === 'NONE' || cleanImage.length < 5) ? '' : cleanImage
        });
      }
    }
  }

  parseQuestions(text: string) {
    // Try JSON first
    try {
      const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.questions?.length) {
          this.questions = parsed.questions.map((q: any) => ({
            q: q.q || '',
            a: q.a || '',
            steps: q.steps || [],
            image: q.image || ''
          })).filter((q: any) => q.q);
          return;
        }
      }
    } catch {}
    // Fallback to marker parsing
    this.questions = [];
    text = this.normalizeSummaryMarkers(text);
    const startIdx = text.indexOf('##Q##');
    if (startIdx === -1) return;
    const blocks = text.slice(startIdx).split('##Q##').filter(b => b.trim());

    for (const block of blocks) {
      const qMatch = block.match(/^([\s\S]*?)##A##/);
      const aMatch = block.match(/##A##([\s\S]*?)(?:##STEPS##|##QIMAGE##|##QEND##)/);
      const stepsMatch = block.match(/##STEPS##([\s\S]*?)(?:##QIMAGE##|##QEND##)/);
      const imageMatch = block.match(/##QIMAGE##([\s\S]*?)##QEND##/);

      const q = qMatch ? this.cleanStructuredText(qMatch[1]) : '';
      const a = aMatch ? this.cleanStructuredText(aMatch[1]) : '';
      const stepsRaw = stepsMatch ? stepsMatch[1].trim() : '';
      const image = imageMatch ? imageMatch[1].trim() : '';

      const steps = stepsRaw.split('\n')
        .map((l: string) => this.cleanStructuredText(l.replace(/^[-*\u2022]\s*/, '')))
        .filter((l: string) => l.length > 5);

      if (q) this.questions.push({ q, a, steps, image: image === 'NONE' || !image ? '' : image });
    }
  }

  renderBold(text: string): string {
    // Escape HTML first to prevent XSS, then apply safe bold formatting
    const escaped = (text || '')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();
    return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  copyCode(code: string, index: number) {
    navigator.clipboard.writeText(code);
    this.copiedIndex = index;
    setTimeout(() => this.copiedIndex = -1, 2000);
  }

  download() {
    switch (this.downloadFormat) {
      case 'pdf': this.downloadPDF(); break;
      case 'docx': this.downloadDOCX(); break;
      case 'ppt': this.downloadPPT(); break;
      case 'txt': this.downloadTXT(); break;
    }
  }

  downloadTXT() {
    const title = this.detectedSubject || this.fileName || 'Study Notes';
    const line  = (ch: string, n: number) => ch.repeat(n);
    const clean = (s: string) => (s || '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
    const wrap  = (s: string, indent = 0) => {
      const width = 76 - indent;
      const words = s.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        if ((cur + ' ' + w).trim().length > width) { lines.push(cur.trim()); cur = w; }
        else cur = (cur + ' ' + w).trim();
      }
      if (cur) lines.push(cur);
      return lines.map(l => ' '.repeat(indent) + l).join('\n');
    };

    let out = '';
    out += `AI LEARNING HUB — STUDY NOTES\n`;
    out += line('=', 76) + '\n';
    out += `Topic: ${title}\n`;
    out += `Date : ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}\n`;
    out += `Notes: ${this.topics.length} topics  |  Q&A: ${this.questions.length} questions\n`;
    out += line('=', 76) + '\n\n';

    this.topics.forEach((t, i) => {
      out += `\n${i + 1}. ${clean(t.title).toUpperCase()}\n`;
      out += line('-', 76) + '\n';
      if (t.explanation) out += wrap(clean(t.explanation)) + '\n';

      t.subtopics.forEach(s => {
        out += `\n  ▸ ${clean(s.title)}\n`;
        if (s.explanation) out += wrap(clean(s.explanation), 4) + '\n';
        s.bullets.forEach((b, bi) => {
          const markers = ['  ●', '  ○', '  ▫'];
          out += `${markers[bi % 3]} ${clean(b)}\n`;
        });
      });

      if (t.bullets.length) {
        out += '\n  Key Points:\n';
        t.bullets.forEach((b, bi) => {
          const markers = ['  ★', '  →', '  ◆', '  •', '  ▸'];
          out += `${markers[bi % 5]} ${clean(b)}\n`;
        });
      }

      t.codes.forEach(c => {
        out += `\n  [ ${c.lang.toUpperCase()} CODE ]\n`;
        out += line('-', 40) + '\n';
        c.code.split('\n').forEach(l => out += '  ' + l + '\n');
        out += line('-', 40) + '\n';
      });

      if (t.image) out += `\n  Visual: ${clean(t.image)}\n`;
      out += '\n';
    });

    if (this.questions.length) {
      out += '\n' + line('=', 76) + '\n';
      out += 'EXAM Q&A\n';
      out += line('=', 76) + '\n\n';
      this.questions.forEach((q, i) => {
        out += `Q${i + 1}. ${clean(q.q)}\n`;
        out += line('·', 60) + '\n';
        if (q.a) out += wrap('Answer: ' + clean(q.a)) + '\n';
        q.steps.forEach((s, si) => out += `   ${si + 1}. ${clean(s)}\n`);
        out += '\n';
      });
    }

    out += '\n' + line('=', 76) + '\n';
    out += 'Generated by AI Learning Hub\n';
    this.triggerDownload(new Blob([out], { type: 'text/plain;charset=utf-8' }), 'study-notes.txt');
  }

  downloadPDF() {
    const rawTitle = this.detectedSubject || this.fileName || 'Study Notes';
    const lines: PdfLine[] = [];
    const clean = (s: string) => this.cleanStructuredText(s);
    const pdfTitle = clean(rawTitle).length > 140 ? clean(this.fileName || 'Study Notes') : clean(rawTitle);
    const splitTerm = (s: string): { term: string; detail: string } | null => {
      const m = clean(s).match(/^([^:]{2,80}):\s*(.+)$/);
      return m ? { term: m[1].trim(), detail: m[2].trim() } : null;
    };

    this.topics.forEach((t, i) => {
      lines.push({ type: 'heading', text: `${i + 1}. ${clean(t.title)}` });
      if (t.explanation) lines.push({ type: 'para', text: clean(t.explanation) });

      t.subtopics.forEach(s => {
        lines.push({ type: 'subheading', text: clean(s.title) });
        if (s.explanation) lines.push({ type: 'para', text: clean(s.explanation) });
        s.bullets.forEach((b, bi) => {
          const styles: Array<'dot'|'arrow'|'star'|'square'|'hollow'> = ['hollow','arrow','square'];
          const pair = splitTerm(b);
          if (pair) lines.push({ type: 'bullet', text: `${pair.term}: ${pair.detail}`, bulletStyle: 'hollow', level: 2 });
          else lines.push({ type: 'bullet', text: clean(b), bulletStyle: styles[bi % 3], level: 2 });
        });
      });

      t.bullets.forEach((b, bi) => {
        const styles: Array<'dot'|'arrow'|'star'|'square'|'hollow'> = ['dot','arrow','star','square','hollow'];
        const pair = splitTerm(b);
        if (pair) lines.push({ type: 'bullet', text: `${pair.term}: ${pair.detail}`, bulletStyle: 'dot', level: 1 });
        else lines.push({ type: 'bullet', text: clean(b), bulletStyle: styles[bi % 5], level: 1 });
      });
      t.codes.forEach(c => lines.push({ type: 'code', text: c.code, label: c.lang }));
      lines.push({ type: 'divider' });
    });

    if (this.questions.length) {
      lines.push({ type: 'heading', text: 'Exam Q&A' });
      this.questions.forEach((q, i) => {
        lines.push({ type: 'qa-q', text: `Q${i + 1}: ${clean(q.q)}` });
        if (q.a) lines.push({ type: 'qa-a', text: clean(q.a) });
        q.steps.forEach((step, si) => {
          const pair = splitTerm(step);
          lines.push({
            type: 'step',
            label: String(si + 1),
            state: pair ? `${pair.term}: ${pair.detail}` : clean(step)
          });
        });
      });
    }

    this.pdf.save(
      `study-notes-${(this.fileName || 'notes').replace(/\s+/g, '-').toLowerCase()}.pdf`,
      pdfTitle,
      `${this.topics.length} topics - ${this.questions.length} Q&A`,
      lines,
      { template: 'study' }
    );
  }

  getThemeFromContent(title: string, topics: any[]): 'modern-tech' | 'academic' | 'technical' {
    const text = `${title} ${topics.map(t => t.title + ' ' + (t.explanation || '')).join(' ')}`.toLowerCase();
    if (/artificial intelligence|machine learning|ai\/ml|neural network|deep learning|generative ai|llm|chatgpt|openai|groq|nlp|computer vision/i.test(text)) {
      return 'modern-tech';
    }
    if (/math|calculus|algebra|statistic|probability|physics|chemistry|biology|science|geometry|theorem|equation|formula/i.test(text)) {
      return 'academic';
    }
    if (/software|engineering|code|programming|develop|database|sql|git|docker|kubernetes|linux|network|architecture|system design|aws|cloud/i.test(text)) {
      return 'technical';
    }
    return 'modern-tech'; // Default theme
  }

  private getThemeColors(themeType: 'modern-tech' | 'academic' | 'technical') {
    const THEME_PALETTES = {
      'modern-tech': {
        primary: '4338CA',       // Indigo
        secondary: '7C3AED',     // Purple
        accent: '06B6D4',        // Cyan
        lightBg: 'F5F7FF',
        darkBg: '1E1B4B',        // Dark Indigo
        textColor: '1E293B',
        textMuted: '64748B'
      },
      'academic': {
        primary: '064E3B',       // Dark Green
        secondary: '047857',     // Emerald
        accent: 'B45309',        // Amber
        lightBg: 'FCFDF9',
        darkBg: '064E3B',        // Dark Green
        textColor: '1F2937',
        textMuted: '6B7280'
      },
      'technical': {
        primary: '0F172A',       // Slate 900
        secondary: '475569',     // Slate 600
        accent: '0284C7',        // Sky Blue
        lightBg: 'F8FAFC',
        darkBg: '0F172A',        // Slate 900
        textColor: '1E293B',
        textMuted: '64748B'
      }
    };
    return THEME_PALETTES[themeType];
  }

  async downloadDOCX() {
    const title = this.detectedSubject || this.fileName || 'Study Notes';
    const clean = (s: string) => (s || '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
    const TN = 'Times New Roman';
    const sp = (n: number) => ({ before: n, after: 0 });

    const themeType = this.getThemeFromContent(title, this.topics);
    const theme = this.getThemeColors(themeType);

    const BULLET_SYMBOLS: Record<string, string> = {
      'square': '▪', '▪': '▪', 'solid-square': '▪',
      'hollow': '◦', '◦': '◦', 'hollow-circle': '◦',
      '▫': '▫', 'hollow-square': '▫',
      '—': '—', 'em-dash': '—',
      '–': '–', 'en-dash': '–',
      '‣': '‣', 'triangle': '‣',
      '■': '■', 'large-square': '■',
      '›': '›', 'chevron': '›',
      '»': '»', 'double-chevron': '»',
      '➔': '➔', 'arrow': '➔',
      '♦': '♦', 'diamond': '♦',
      '✔': '✔', 'checkmark': '✔',
      '✘': '✘', 'crossmark': '✘',
      '★': '★', 'star': '★',
      '✦': '✦', 'sparkle': '✦',
      '•': '•', 'dot': '•'
    };

    // helper: bold+coloured TextRun for terms in "Term: detail" bullets
    const bulletRun = (raw: string, color: string): TextRun[] => {
      const m = raw.match(/^([^:]+):\s*(.+)$/);
      if (m) return [
        ...parseBoldMarkdown(m[1] + ': ', { bold: true, color, font: TN, size: 22 }),
        ...parseBoldMarkdown(m[2], { font: TN, size: 22 })
      ];
      return parseBoldMarkdown(raw, { font: TN, size: 22 });
    };

    const children: Paragraph[] = [];

    // Add branding logo to the cover page of Word document
    let logoBytes: Uint8Array | null = null;
    try {
      const rawBase64 = BRAND_LOGO_B64.split(';base64,').pop() || '';
      const binaryString = window.atob(rawBase64);
      const len = binaryString.length;
      logoBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        logoBytes[i] = binaryString.charCodeAt(i);
      }
    } catch (e) {
      console.error('[DOCX Logo Error]', e);
    }

    if (logoBytes) {
      const logoW = 160;
      const logoH = Math.round(logoW / (BRAND_LOGO_WIDTH / BRAND_LOGO_HEIGHT));
      children.push(new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: logoBytes,
            transformation: {
              width: logoW,
              height: logoH
            }
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 360 }
      }));
    }

    // ─ Cover title
    children.push(new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 52, color: theme.primary, font: TN })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      border: { bottom: { style: BorderStyle.THICK, size: 6, color: theme.secondary, space: 4 } }
    }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Topics: ${this.topics.length}  \u00b7  Q&A: ${this.questions.length}  \u00b7  `, font: TN, size: 20, color: theme.textMuted }),
        new TextRun({ text: new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), font: TN, size: 20, color: theme.textMuted, italics: true })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 480 }
    }));

    this.topics.forEach((t, i) => {
      // Topic heading
      children.push(new Paragraph({
        children: [new TextRun({ text: `${i + 1}.  ${clean(t.title)}`, bold: true, size: 32, color: theme.primary, font: TN })],
        heading: HeadingLevel.HEADING_1,
        spacing: sp(360),
        border: { left: { style: BorderStyle.THICK, size: 12, color: theme.secondary, space: 8 } },
        indent: { left: convertInchesToTwip(0.15) }
      }));

      // Explanation
      if (t.explanation) {
        children.push(new Paragraph({
          children: parseBoldMarkdown(t.explanation, { font: TN, size: 22, color: theme.textColor }),
          spacing: { before: 80, after: 160 },
          indent: { left: convertInchesToTwip(0.2) }
        }));
      }

      // Subtopics
      t.subtopics.forEach(s => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `\u25b8  ${clean(s.title)}`, bold: true, size: 26, color: theme.secondary, font: TN })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
          indent: { left: convertInchesToTwip(0.3) }
        }));
        if (s.explanation) {
          children.push(new Paragraph({
            children: parseBoldMarkdown(s.explanation, { font: TN, size: 22, color: theme.textColor }),
            spacing: { before: 60, after: 80 },
            indent: { left: convertInchesToTwip(0.5) }
          }));
        }
        s.bullets.forEach((b) => {
          const sym = BULLET_SYMBOLS[determineBulletStyle(b)] || '•';
          children.push(new Paragraph({
            children: [new TextRun({ text: `${sym}  `, color: theme.primary, bold: true, font: TN, size: 22 }), ...bulletRun(b, theme.primary)],
            spacing: { before: 40, after: 40 },
            indent: { left: convertInchesToTwip(0.6), hanging: convertInchesToTwip(0.15) }
          }));
        });
      });

      // Key points bullets — varied markers
      if (t.bullets.length) {
        children.push(new Paragraph({
          children: [new TextRun({ text: '\u261e  Key Points', bold: true, size: 24, color: theme.accent, font: TN })],
          spacing: { before: 200, after: 80 },
          indent: { left: convertInchesToTwip(0.3) }
        }));
        t.bullets.forEach((b) => {
          const sym = BULLET_SYMBOLS[determineBulletStyle(b)] || '•';
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${sym}  `, bold: true, color: theme.secondary, font: TN, size: 22 }),
              ...bulletRun(b, theme.secondary)
            ],
            spacing: { before: 40, after: 40 },
            indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.15) }
          }));
        });
      }

      // Code blocks (Enforcing Times New Roman as per user spec)
      t.codes.forEach(c => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `  ${c.lang.toUpperCase()} `, bold: true, size: 18, color: 'FFFFFF', highlight: 'darkBlue', font: TN })],
          spacing: { before: 200, after: 0 },
          indent: { left: convertInchesToTwip(0.3) }
        }));
        c.code.split('\n').forEach(cl => {
          children.push(new Paragraph({
            children: [new TextRun({ text: cl || ' ', font: TN, size: 18, color: 'A5B4FC' })],
            spacing: { before: 0, after: 0 },
            shading: { type: ShadingType.SOLID, color: '0D1117', fill: '0D1117' },
            indent: { left: convertInchesToTwip(0.3), right: convertInchesToTwip(0.3) }
          }));
        });
        children.push(new Paragraph({ text: '', spacing: { before: 80, after: 0 } }));
      });

      // Spacer between topics
      children.push(new Paragraph({ text: '', spacing: { before: 240, after: 0 } }));
    });

    // Q&A section
    if (this.questions.length) {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Exam Q&A', bold: true, size: 36, color: theme.primary, font: TN })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 480, after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.secondary, space: 4 } }
      }));
      this.questions.forEach((q, i) => {
        children.push(new Paragraph({
          children: parseBoldMarkdown(`Q${i + 1}.  ${q.q}`, { bold: true, size: 24, color: theme.textColor, font: TN }),
          spacing: { before: 280, after: 80 },
          shading: { type: ShadingType.SOLID, color: theme.lightBg, fill: theme.lightBg },
          indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) }
        }));
        if (q.a) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: 'Answer:  ', bold: true, color: theme.accent, font: TN, size: 22 }),
              ...parseBoldMarkdown(q.a, { font: TN, size: 22, color: theme.textColor })
            ],
            spacing: { before: 80, after: 80 },
            indent: { left: convertInchesToTwip(0.3) }
          }));
        }
        q.steps.forEach((s, si) => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${si + 1}.  `, bold: true, color: theme.secondary, font: TN, size: 22 }),
              ...parseBoldMarkdown(s, { font: TN, size: 22, color: theme.textColor })
            ],
            spacing: { before: 40, after: 40 },
            indent: { left: convertInchesToTwip(0.5) }
          }));
        });
      });
    }

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: TN, size: 22 } }
        }
      },
      sections: [{ children }]
    });
    const blob = await Packer.toBlob(doc);
    this.triggerDownload(blob, 'study-notes.docx');
  }

  downloadPPT() {
    const title = this.detectedSubject || this.fileName || 'Study Notes';
    const clean = (s: string) => (s || '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
    const pptx  = new pptxgen();

    const themeType = this.getThemeFromContent(title, this.topics);
    const theme = this.getThemeColors(themeType);
    const TN = 'Times New Roman';
    const WHITE = 'FFFFFF';
    const rawLogoData = BRAND_LOGO_B64.split(';base64,').pop() || '';

    const BULLET_SYMBOLS: Record<string, string> = {
      'square': '▪', '▪': '▪', 'solid-square': '▪',
      'hollow': '◦', '◦': '◦', 'hollow-circle': '◦',
      '▫': '▫', 'hollow-square': '▫',
      '—': '—', 'em-dash': '—',
      '–': '–', 'en-dash': '–',
      '‣': '‣', 'triangle': '‣',
      '■': '■', 'large-square': '■',
      '›': '›', 'chevron': '›',
      '»': '»', 'double-chevron': '»',
      '➔': '➔', 'arrow': '➔',
      '♦': '♦', 'diamond': '♦',
      '✔': '✔', 'checkmark': '✔',
      '✘': '✘', 'crossmark': '✘',
      '★': '★', 'star': '★',
      '✦': '✦', 'sparkle': '✦',
      '•': '•', 'dot': '•'
    };

    pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches
    pptx.theme  = { headFontFace: TN, bodyFontFace: TN };

    // ── COVER SLIDE ──
    const cover = pptx.addSlide();
    // Full dark background
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: theme.darkBg } });
    // Accent bar top
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.18, fill: { color: theme.primary } });
    // Accent bar bottom
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 7.32, w: '100%', h: 0.18, fill: { color: theme.secondary } });
    // Decorative side bar
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: '100%', fill: { color: theme.primary } });
    
    // Add branding logo to cover (extracting raw base64 data only)
    const pptLogoW = 1.8;
    const pptLogoH = pptLogoW / (BRAND_LOGO_WIDTH / BRAND_LOGO_HEIGHT);
    cover.addImage({ data: rawLogoData, x: 0.6, y: 0.6, w: pptLogoW, h: pptLogoH });

    // Title
    cover.addText(title, {
      x: 0.6, y: 2.2, w: 12, h: 2.2,
      fontSize: 40, bold: true, color: WHITE, fontFace: TN,
      align: 'left', valign: 'middle', wrap: true
    });
    // Subtitle line
    cover.addShape(pptx.ShapeType.rect, { x: 0.6, y: 4.6, w: 2.5, h: 0.05, fill: { color: theme.primary } });
    cover.addText(`Topics: ${this.topics.length}  |  Q&A: ${this.questions.length}`, {
      x: 0.6, y: 4.8, w: 10, h: 0.5,
      fontSize: 14, color: theme.accent, fontFace: TN, align: 'left'
    });
    cover.addText(new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), {
      x: 0.6, y: 5.4, w: 10, h: 0.4,
      fontSize: 11, color: theme.secondary, fontFace: TN, align: 'left', italic: true
    });

    // ── TOPIC SLIDES ──
    this.topics.forEach((t, i) => {
      const sl = pptx.addSlide();
      // Light bg
      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: theme.lightBg } });
      // Top accent bar
      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: theme.primary } });
      // Left accent bar
      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: '100%', fill: { color: theme.primary } });
      
      // Add branding logo to content slides
      sl.addImage({ data: rawLogoData, x: 11.2, y: 0.25, w: 1.5, h: 1.5 / (BRAND_LOGO_WIDTH / BRAND_LOGO_HEIGHT) });

      // Topic number circle
      sl.addShape(pptx.ShapeType.ellipse, { x: 0.2, y: 0.2, w: 0.55, h: 0.55, fill: { color: theme.primary }, line: { color: theme.primary } });
      sl.addText(`${i + 1}`, { x: 0.2, y: 0.2, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: TN });
      
      // Title
      sl.addText(clean(t.title), {
        x: 0.9, y: 0.18, w: 10, h: 0.7,
        fontSize: 24, bold: true, color: theme.primary, fontFace: TN, align: 'left'
      });
      // Divider
      sl.addShape(pptx.ShapeType.rect, { x: 0.9, y: 0.95, w: 11.8, h: 0.02, fill: { color: theme.secondary } });

      let bodyY = 1.1;
      const bodyX = 0.9;
      const bodyW = 11.8;

      // Explanation
      if (t.explanation && bodyY < 6.5) {
        sl.addText(clean(t.explanation), {
          x: bodyX, y: bodyY, w: bodyW, h: 0.6,
          fontSize: 13, color: theme.textColor, fontFace: TN, wrap: true, valign: 'top'
        });
        bodyY += 0.7;
      }

      // Bullets with varied markers
      const allBullets = [
        ...t.bullets,
        ...t.subtopics.flatMap(s => [
          (s.title ? `${clean(s.title)}` : ''),
          ...s.bullets
        ]).filter(Boolean)
      ].slice(0, 8);

      allBullets.forEach((b) => {
        if (bodyY > 6.8) return;
        const sym = BULLET_SYMBOLS[determineBulletStyle(b)] || '•';
        sl.addText([
          { text: sym + '  ', options: { bold: true, color: theme.secondary, fontSize: 13, fontFace: TN } },
          { text: clean(b), options: { color: theme.textColor, fontSize: 12, fontFace: TN } }
        ], { x: bodyX, y: bodyY, w: bodyW, h: 0.38, valign: 'top', wrap: true });
        bodyY += 0.4;
      });

      // Code snippet (if any) — compact (Using Times New Roman for all text on slide)
      if (t.codes.length && bodyY < 6.0) {
        const snippet = t.codes[0].code.split('\n').slice(0, 5).join('\n');
        sl.addShape(pptx.ShapeType.rect, { x: bodyX, y: bodyY, w: bodyW, h: 0.8, fill: { color: '0D1117' }, line: { color: '30363D', pt: 1 }, rounding: true } as any);
        sl.addText(snippet, {
          x: bodyX + 0.1, y: bodyY + 0.05, w: bodyW - 0.2, h: 0.7,
          fontSize: 9, color: 'A5B4FC', fontFace: TN, valign: 'top', wrap: true
        });
        bodyY += 0.95;
      }

      // Slide number bottom right
      sl.addText(`${i + 1} / ${this.topics.length + (this.questions.length ? 1 : 0)}`, {
        x: 12.5, y: 7.1, w: 0.8, h: 0.3, fontSize: 9, color: theme.textMuted, align: 'right', fontFace: TN
      });
    });

    // ── Q&A SLIDES (grouped 3 per slide) ──
    for (let qi = 0; qi < this.questions.length; qi += 3) {
      const sl   = pptx.addSlide();
      const batch = this.questions.slice(qi, qi + 3);

      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: theme.lightBg } });
      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: theme.primary } });
      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: '100%', fill: { color: theme.secondary } });
      
      // Add branding logo to Q&A slides
      sl.addImage({ data: rawLogoData, x: 11.2, y: 0.25, w: 1.5, h: 1.5 / (BRAND_LOGO_WIDTH / BRAND_LOGO_HEIGHT) });

      sl.addText('Exam Q&A', {
        x: 0.3, y: 0.15, w: 5, h: 0.6,
        fontSize: 22, bold: true, color: theme.primary, fontFace: TN
      });

      let qy = 0.9;
      batch.forEach((q, bi) => {
        const qNum = qi + bi + 1;
        if (qy > 6.8) return;
        // Question card bg
        sl.addShape(pptx.ShapeType.rect, { x: 0.3, y: qy, w: 12.8, h: 0.45, fill: { color: themeType === 'modern-tech' ? 'E0E7FF' : themeType === 'academic' ? 'E6F4EA' : 'E2E8F0' }, rounding: true } as any);
        sl.addText([
          { text: `Q${qNum}  `, options: { bold: true, color: WHITE, fontSize: 12, fontFace: TN,
            highlight: theme.primary } },
          { text: clean(q.q), options: { bold: true, color: theme.primary, fontSize: 12, fontFace: TN } }
        ], { x: 0.35, y: qy + 0.04, w: 12.7, h: 0.38, wrap: true, valign: 'top' });
        qy += 0.5;
        if (q.a && qy < 6.8) {
          sl.addText([
            { text: 'A:  ', options: { bold: true, color: theme.accent, fontSize: 11, fontFace: TN } },
            { text: clean(q.a).slice(0, 200), options: { color: theme.textColor, fontSize: 11, fontFace: TN } }
          ], { x: 0.5, y: qy, w: 12.6, h: 0.45, wrap: true, valign: 'top' });
          qy += 0.55;
        }
        qy += 0.12;
      });
    }

    pptx.writeFile({ fileName: 'study-notes.pptx' });
  }

  triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  saveToHistory() {
    if (!this.topics.length) return;
    const title = this.detectedSubject || this.fileName || 'Study Notes';
    const history = JSON.parse(localStorage.getItem('summarizer_history') || '[]');
    history.unshift({
      type: 'summary',
      title,
      date: new Date().toLocaleDateString(),
      preview: this.topics[0]?.explanation?.replace(/\*\*(.*?)\*\*/g, '$1')?.slice(0, 100) || '',
      content: this.topics.map(t => `${t.title.replace(/\*\*(.*?)\*\*/g,'')}: ${t.explanation.replace(/\*\*(.*?)\*\*/g,'$1')}`).join('\n'),
      topics: JSON.parse(JSON.stringify(this.topics)),
      questions: JSON.parse(JSON.stringify(this.questions))
    });
    localStorage.setItem('summarizer_history', JSON.stringify(history.slice(0, 50)));
    this.savedMsg = 'Saved!';
    setTimeout(() => this.savedMsg = '', 2500);
  }

  private cleanPdfText(text: string): string {
    return (text || '')
      .replace(/\n---\s*Page\s+\d+\s*---\n/gi, '\n\n')
      .replace(/^---\s*Page\s+\d+\s*---\n?/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export function parseBoldMarkdown(text: string, options: any): TextRun[] {
  const TN = 'Times New Roman';
  if (!text) return [new TextRun({ font: TN, size: 22, ...options, text: '' })];
  
  // Split by ** to extract bold sections
  const parts = text.split('**');
  const runs: TextRun[] = [];
  
  for (let idx = 0; idx < parts.length; idx++) {
    let part = parts[idx];
    // Remove any remaining single * or _ markdown characters
    part = part.replace(/[\*_]/g, '');
    
    if (!part) continue; // Skip empty parts
    
    const isBold = idx % 2 !== 0; // Odd indices are bold (after split by **)
    runs.push(new TextRun({
      font: TN,
      size: 22,
      ...options,
      text: part,
      bold: isBold || options.bold || false
    }));
  }
  
  return runs.length > 0 ? runs : [new TextRun({ font: TN, size: 22, ...options, text: '' })];
}



