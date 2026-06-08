import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiService } from '../../../core/services/ai.service';
import { YoutubeService } from '../../../core/services/youtube.service';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface MindNode {
  id: string;
  label: string;
  level: number;
  definition: string;
  children: MindNode[];
  color: string;
  expanded: boolean;
}

/** Structured block types for rich definition rendering */
export interface DefinitionBlock {
  type: 'para' | 'table' | 'heading' | 'list' | 'code' | 'divider';
  content: string;
  rows?: string[][];   // for table
  items?: string[];    // for list
}

/** Video metadata stored for YouTube maps */
export interface VideoMeta {
  title: string;
  channel: string;
  duration: string;
  views: string;
  uploadDate: string;
  description: string;
  tags: string[];
  chapters: { time: string; title: string }[];
  thumbnailUrl: string;
  videoUrl: string;
}

import { AiSparkComponent } from '../../../shared/ai-spark/ai-spark.component';
import { LogoComponent } from '../../../shared/logo/logo.component';
import { sanitizeUserInput } from '../../../core/utils/sanitize.util';

@Component({
  selector: 'app-generate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AiSparkComponent, LogoComponent],
  templateUrl: './generate.component.html',
  styleUrls: ['./generate.component.css']
})
export class GenerateComponent implements OnInit {

  inputMode: 'text' | 'youtube' | 'file' = 'text';
  textInput = '';
  youtubeUrl = '';
  youtubeVideoUrl = '';
  fileName = '';
  fileContent = '';
  fileType = '';

  loading = false;
  errorMsg = '';
  progress = '';

  rootNode: MindNode | null = null;
  selectedNode: MindNode | null = null;
  loadingDefinition = false;

  /** Rich video metadata for YouTube maps — shown in definition panel */
  currentVideoMeta: VideoMeta | null = null;

  savedMaps: { title: string; data: any; date: string }[] = [];
  showSaved = false;

  COLORS = ['#38bdf8','#34d399','#f472b6','#fb923c','#a78bfa','#facc15','#f87171','#4ade80','#22d3ee','#e879f9'];

  constructor(private ai: AiService, private yt: YoutubeService) {}

  ngOnInit() {
    const s = localStorage.getItem('mindmaps');
    if (s) this.savedMaps = JSON.parse(s);

    const pending = localStorage.getItem('mindmap_load');
    if (pending) {
      try {
        const map = JSON.parse(pending);
        this.rootNode = this.initNode(map.data, 0);
        this.rootNode.expanded = true;
        // Restore video meta if saved
        if (map.videoMeta) this.currentVideoMeta = map.videoMeta;
      } catch {}
      localStorage.removeItem('mindmap_load');
    }
  }

  switchMode(m: 'text' | 'youtube' | 'file') {
    this.inputMode = m;
    this.errorMsg = '';
  }

  // ── FILE READING ─────────────────────────────────────────────────────────────
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.fileName = file.name;
    this.fileContent = '';
    this.fileType = '';
    this.errorMsg = '';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    this.fileType = ext;
    this.progress = `Reading ${ext.toUpperCase()} file...`;

    try {
      if (ext === 'txt' || ext === 'md') {
        this.fileContent = await file.text();
      } else if (ext === 'pdf') {
        this.fileContent = await this.readPdf(file);
      } else if (ext === 'docx') {
        this.fileContent = await this.readDocx(file);
      } else if (ext === 'pptx' || ext === 'ppt') {
        this.fileContent = await this.readPptx(file);
      } else if (ext === 'csv') {
        this.fileContent = await this.readCsv(file);
      } else {
        this.errorMsg = 'Unsupported file type. Use PDF, DOCX, PPTX, TXT, CSV.';
      }
    } catch (e) {
      this.errorMsg = `Could not read file: ${(e as any)?.message || 'Unknown error'}`;
      console.error('[File Read Error]', e);
    }
    this.progress = '';
  }

  // ── PDF READER ───────────────────────────────────────────────────────────────
  private async readPdf(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      this.progress = `Reading PDF (${i}/${pdf.numPages} pages)...`;
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      text += this.reconstructPageContent(c.items as any[]) + '\n\n';
    }
    return text;
  }

  private reconstructPageContent(items: any[]): string {
    if (!items.length) return '';
    const rows: Map<number, { x: number; text: string }[]> = new Map();
    const Y_TOL = 3;
    for (const item of items) {
      const y = Math.round(item.transform[5] / Y_TOL) * Y_TOL;
      const x = item.transform[4];
      const text = item.str?.trim();
      if (!text) continue;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, text });
    }
    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);
    const lines: string[] = [];
    let tableBuffer: string[] = [];

    const flushTable = () => {
      if (tableBuffer.length >= 2) {
        lines.push('[TABLE_START]', ...tableBuffer, '[TABLE_END]');
      } else {
        lines.push(...tableBuffer);
      }
      tableBuffer = [];
    };

    for (const y of sortedYs) {
      const rowItems = rows.get(y)!.sort((a, b) => a.x - b.x);
      if (rowItems.length >= 3) {
        tableBuffer.push(rowItems.map(r => r.text).join(' | '));
      } else {
        flushTable();
        lines.push(rowItems.map(r => r.text).join(' '));
      }
    }
    flushTable();
    return lines.join('\n');
  }

  // ── DOCX READER ──────────────────────────────────────────────────────────────
  private async readDocx(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value || '';
  }

  // ── PPTX READER ──────────────────────────────────────────────────────────────
  private async readPptx(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] || '0');
        const nb = parseInt(b.match(/\d+/)?.[0] || '0');
        return na - nb;
      });

    let text = '';
    for (let i = 0; i < slideFiles.length; i++) {
      this.progress = `Reading slide ${i + 1}/${slideFiles.length}...`;
      const xml = await zip.files[slideFiles[i]].async('string');
      text += this.extractPptxSlideText(xml, i + 1) + '\n\n';
    }
    return text;
  }

  private extractPptxSlideText(xml: string, slideNum: number): string {
    const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    const texts = textMatches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 0);
    if (!texts.length) return '';

    const title = texts[0];
    const body = texts.slice(1).join('\n');
    const hasTable = this.detectTableInSlide(xml);
    if (hasTable) {
      return `[SLIDE ${slideNum}] ${title}\n${this.extractPptxTable(xml)}`;
    }
    return `[SLIDE ${slideNum}] ${title}\n${body}`;
  }

  private detectTableInSlide(xml: string): boolean {
    return xml.includes('<a:tbl>') || xml.includes('<p:graphicFrame>');
  }

  private extractPptxTable(xml: string): string {
    const rowMatches = xml.match(/<a:tr[\s\S]*?<\/a:tr>/g) || [];
    if (!rowMatches.length) return '';
    const rows = rowMatches.map(row => {
      const cells = row.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
      return cells.map(c => c.replace(/<[^>]+>/g, '').trim()).filter(t => t).join(' | ');
    }).filter(r => r);
    if (rows.length < 2) return rows.join('\n');
    return '[TABLE_START]\n' + rows.join('\n') + '\n[TABLE_END]';
  }

  // ── CSV READER ───────────────────────────────────────────────────────────────
  private async readCsv(file: File): Promise<string> {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (!lines.length) return '';
    return '[TABLE_START]\n' + lines.map(l => l.split(',').join(' | ')).join('\n') + '\n[TABLE_END]';
  }

  get canGenerate() {
    if (this.inputMode === 'text') return sanitizeUserInput(this.textInput, 5000).length > 0;
    if (this.inputMode === 'youtube') return sanitizeUserInput(this.youtubeUrl, 500).length > 0;
    return this.fileContent.length > 0;
  }

  // ── MAIN GENERATE ────────────────────────────────────────────────────────────
  async generate() {
    if (!this.canGenerate) return;
    this.loading = true;
    this.errorMsg = '';
    this.rootNode = null;
    this.selectedNode = null;
    this.currentVideoMeta = null;

    try {
      if (this.inputMode === 'file' && this.fileContent) {
        await this.generateFromFile();
      } else if (this.inputMode === 'youtube') {
        await this.generateFromYoutube(sanitizeUserInput(this.youtubeUrl, 500));
      } else {
        await this.generateSingleCall(sanitizeUserInput(this.textInput, 5000), false);
      }
    } catch (e: any) {
      // Only set generic message if a more specific one wasn't already set
      if (!this.errorMsg) {
        console.error('[Generate Error]', e);
        this.errorMsg = 'Generation failed. Please try again.';
      }
    }

    this.progress = '';
    this.loading = false;
  }

  // ── FILE: TWO-PHASE GENERATION ───────────────────────────────────────────────
  private async generateFromFile() {
    const content = this.fileContent;

    this.progress = 'Extracting document structure...';
    const outline = await this.extractFullOutline(content);

    this.progress = 'Identifying main sections...';
    const rootData = await this.extractRootAndBranches(outline);
    if (!rootData) {
      this.errorMsg = 'Could not parse document structure. Please try again.';
      console.error('[File Parse Error] extractRootAndBranches returned null');
      return;
    }

    this.rootNode = {
      id: 'root', label: rootData.rootLabel, level: 0,
      definition: rootData.rootDef, children: [], color: '#38bdf8', expanded: true
    };

    const sections = this.splitContentIntoSections(content, rootData.branches);

    for (let i = 0; i < rootData.branches.length; i++) {
      const branchName = rootData.branches[i];
      this.progress = `Building branch ${i + 1}/${rootData.branches.length}: "${branchName}"...`;
      const section = sections[i] || content.slice(0, 4000);
      const branchNode = await this.buildBranchSubtree(branchName, section, i, rootData.rootLabel);
      this.rootNode.children.push(branchNode);
    }
  }

  private splitContentIntoSections(content: string, branches: string[]): string[] {
    const lower = content.toLowerCase();
    const positions: number[] = branches.map(branch => {
      const words = branch.toLowerCase().split(' ');
      for (let len = words.length; len >= 1; len--) {
        const idx = lower.indexOf(words.slice(0, len).join(' '));
        if (idx !== -1) return idx;
      }
      return -1;
    });

    const indexed = positions
      .map((pos, i) => ({ pos, i }))
      .filter(x => x.pos !== -1)
      .sort((a, b) => a.pos - b.pos);

    const sections: string[] = new Array(branches.length).fill('');

    for (let k = 0; k < indexed.length; k++) {
      const start = Math.max(0, indexed[k].pos - 100);
      const end = k + 1 < indexed.length
        ? Math.min(content.length, indexed[k + 1].pos)
        : content.length;
      // Increase section max size — use full section, not truncated
      sections[indexed[k].i] = content.slice(start, end);
    }

    branches.forEach((_, i) => {
      if (!sections[i]) sections[i] = content.slice(0, 6000);
    });

    return sections;
  }

  private async extractFullOutline(content: string): Promise<string> {
    const chunkSize = 6000;
    const parts: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      const pct = Math.round((i / content.length) * 100);
      this.progress = `Analyzing document ${pct}%...`;
      const hasVisual = chunk.includes('[TABLE_START]') || chunk.includes('[SLIDE');
      const instruction = hasVisual
        ? `This document contains slides, tables, or charts. For each:
- [SLIDE N] Title: extract the slide title and all bullet points as a structured outline
- [TABLE_START]...[TABLE_END]: identify what the table represents, extract column headers, row labels, key values, and findings
For all other text: extract headings, topics, subtopics exactly as they appear.`
        : `Extract a structured outline. List ALL headings, topics, subtopics, and key points EXACTLY as they appear.\n- Main topic\n  - Subtopic\n    - Detail`;
      try {
        const res: any = await this.ai.generateWithGroq(`${instruction}\n\nTEXT:\n${chunk}`).toPromise();
        const text = this.extractTextFromResponse(res);
        parts.push(text || chunk.slice(0, 400));
      } catch (e) {
        console.error('[Outline Chunk Error]', e);
        parts.push(chunk.slice(0, 400));
      }
    }
    return parts.join('\n\n');
  }

  private async extractRootAndBranches(outline: string): Promise<{ rootLabel: string; rootDef: string; branches: string[] } | null> {
    try {
      const res: any = await this.ai.generateWithGroq(
        `From this document outline, identify the main subject and its primary top-level sections.\n\nOUTLINE:\n${outline.slice(0, 8000)}\n\nReturn ONLY valid JSON (no markdown, no code fences):\n{\n  "rootLabel": "Main Document Subject",\n  "rootDef": "2-sentence overview of what this document covers.",\n  "branches": ["Section 1", "Section 2", "Section 3"]\n}\n\nRules: rootLabel = main title/subject. branches = primary top-level sections exactly as in outline. 4-8 branches max. No invented names.`
      ).toPromise();
      const text = this.extractTextFromResponse(res);
      if (!text) { console.error('[Branches Error] empty AI response'); return null; }
      const json = this.extractJson(text);
      if (!json) { console.error('[Branches Error] no JSON in response:', text.slice(0, 200)); return null; }
      return JSON.parse(json);
    } catch (e) {
      console.error('[Branches Parse Error]', e);
      return null;
    }
  }

  private extractSection(content: string, branchName: string): string {
    const lower = content.toLowerCase();
    const words = branchName.toLowerCase().split(' ');
    let idx = -1;
    for (let len = words.length; len >= 1; len--) {
      idx = lower.indexOf(words.slice(0, len).join(' '));
      if (idx !== -1) break;
    }
    // Return up to 8000 chars from match — full section
    if (idx === -1) return content.slice(0, 8000);
    return content.slice(Math.max(0, idx - 200), Math.min(content.length, idx + 10000));
  }

  private async buildBranchSubtree(branchName: string, section: string, colorIdx: number, rootLabel: string): Promise<MindNode> {
    const color = this.COLORS[colorIdx % this.COLORS.length];
    const hasTable = section.includes('[TABLE_START]');
    const hasSlide = section.includes('[SLIDE');
    const cleanSection = section.replace(/\[TABLE_START\]/g, '\n[TABLE]\n').replace(/\[TABLE_END\]/g, '\n[/TABLE]\n');

    const visualNote = (hasTable || hasSlide) ? `
VISUAL CONTENT RULES:
${hasSlide ? '- Each [SLIDE N] title = one level-2 child node. Its bullet points = level-3 children.' : ''}
${hasTable ? `- Each [TABLE]...[/TABLE] block = one level-2 child node labeled with what the table shows.
  Under it, create level-3 nodes for column headers and each key row with values in the definition.
  Explain what the table data means in plain language.` : ''}
- If the text describes a diagram, flowchart, or process: create a node named after it, with children for each step/component/element.` : '';

    try {
      const res: any = await this.ai.generateWithGroq(
        `You are extracting a COMPLETE, NON-DUPLICATE hierarchical tree from a document section.

DOCUMENT SECTION for "${branchName}" (from "${rootLabel}"):
${cleanSection.slice(0, 7000)}
END OF SECTION
${visualNote}

RULES:
- Extract ONLY content from this section — no external knowledge
- Each concept must appear ONCE — merge duplicates
- Labels: exact terms from content, max 6 words
- Definitions: 2-4 sentences, factual, strictly from the section content

Return ONLY valid JSON (no markdown, no code fences):
{
  "label": "${branchName}",
  "level": 1,
  "definition": "2-4 sentence summary of this section.",
  "children": [
    {
      "label": "unique point from content",
      "level": 2,
      "definition": "2-4 sentence explanation from content.",
      "children": [
        {
          "label": "unique sub-point",
          "level": 3,
          "definition": "2-3 sentence explanation.",
          "children": []
        }
      ]
    }
  ]
}`
      ).toPromise();
      const text = this.extractTextFromResponse(res);
      const json = this.extractJson(text);
      if (!json) throw new Error('no JSON in branch response');
      return this.initNodeWithColor(JSON.parse(json), color, `branch_${colorIdx}`);
    } catch (e) {
      console.error(`[Branch Build Error] "${branchName}":`, e);
      return { id: `branch_${colorIdx}_${Math.random().toString(36).slice(2)}`, label: branchName, level: 1, definition: '', children: [], color, expanded: false };
    }
  }

  // ── SINGLE CALL (text / youtube) ─────────────────────────────────────────────
  private async generateSingleCall(content: string, isContentBased: boolean) {
    this.progress = 'Building mind map...';
    const sourceRule = isContentBased
      ? `STRICT: Extract ONLY topics from this content.\n\nCONTENT:\n${content.slice(0, 10000)}\n\nEND`
      : `Generate a professional mind map for: "${content}"`;

    const prompt = `You are a professional knowledge architect. ${sourceRule}

Build a complete 3-level mind map:
- Level 0: 1 root node (the main subject)
- Level 1: 4–6 main branches
- Level 2: 3–5 subtopics per branch
- Level 3: 2–4 detail points per subtopic

CRITICAL — Every "definition" field MUST be 3–5 complete sentences explaining:
1. What this concept is
2. How it works or its key characteristics
3. Why it matters with a real example
NEVER leave "definition" empty or as a placeholder.

Return ONLY valid JSON — no markdown fences, no code blocks, no extra text.
The JSON must follow this exact shape:
{
  "root": {
    "id": "root",
    "label": "Main Subject",
    "level": 0,
    "definition": "Full 3-5 sentence overview of the main subject.",
    "children": [
      {
        "id": "b1",
        "label": "Branch Name",
        "level": 1,
        "definition": "Full 3-5 sentence explanation of this branch.",
        "children": [
          {
            "id": "b1a",
            "label": "Subtopic Name",
            "level": 2,
            "definition": "Full 3-5 sentence explanation of this subtopic.",
            "children": [
              {
                "id": "b1a1",
                "label": "Detail Point",
                "level": 3,
                "definition": "Full 3-5 sentence explanation of this detail.",
                "children": []
              }
            ]
          }
        ]
      }
    ]
  }
}`;

    let res: any;
    try {
      res = await this.ai.generateWithGroq(prompt).toPromise();
    } catch (e: any) {
      const status = e?.status;
      const msg = e?.error?.error?.message || e?.message || '';
      console.error('[AI Request Failed]', status, msg);
      if (status === 401 || status === 403) {
        this.errorMsg = 'API key is invalid or expired. Please update the API key in ai.service.ts.';
      } else if (status === 429) {
        this.errorMsg = 'Rate limit reached. Please wait a moment and try again.';
      } else if (status === 0 || status === undefined) {
        this.errorMsg = 'Network error — check your internet connection and try again.';
      } else {
        this.errorMsg = `AI service error (${status || 'unknown'}). Please try again.`;
      }
      return;
    }

    const text = this.extractTextFromResponse(res);
    if (!text) {
      console.error('[AI] Empty response received:', JSON.stringify(res).slice(0, 200));
      this.errorMsg = 'AI returned an empty response. Please try again.';
      return;
    }
    this.parseRoot(text);
  }

  // ── TOGGLE / SELECT ──────────────────────────────────────────────────────────
  async toggleNode(node: MindNode) {
    await this.selectNode(node);
    if (node.children.length > 0) node.expanded = !node.expanded;
  }

  async selectNode(node: MindNode) {
    this.selectedNode = node;
    if (node.definition && node.definition.trim().length >= 40) return;

    this.loadingDefinition = true;

    const root = this.rootNode?.label || 'this subject';
    const section = this.fileContent ? this.extractSection(this.fileContent, node.label) : '';
    const hasTable = section.includes('[TABLE_START]');
    const hasSlide = section.includes('[SLIDE');
    const cleanSection = section
      .replace(/\[TABLE_START\]/g, '\n[TABLE]\n')
      .replace(/\[TABLE_END\]/g, '\n[/TABLE]\n')
      .slice(0, 5000);  // increased from 3000

    const visualNote = (hasTable || hasSlide)
      ? `\n\nThis content includes ${hasTable ? 'a table/chart ([TABLE]...[/TABLE])' : ''}${hasSlide ? ' slide content' : ''}. Present any table data as a markdown pipe table:\n| Header 1 | Header 2 |\n|----------|----------|\n| Value    | Value    |`
      : '';

    const ctx = cleanSection ? `\n\nSource content:\n${cleanSection}` : '';

    // YouTube map — use video context for definitions
    if (this.youtubeVideoUrl && !cleanSection) {
      try {
        const videoId = this.yt.getVideoId(this.youtubeVideoUrl) || '';
        const context = videoId ? await this.yt.getFullVideoContext(videoId).toPromise() as string : '';
        const defPrompt = `Based on this YouTube video data, write a detailed explanation for "${node.label}".

VIDEO DATA:
${context || 'Video: ' + this.youtubeVideoUrl}

Write 3 paragraphs:
1. What "${node.label}" is, based on the video context
2. Key details, steps, or characteristics from the video
3. Why it matters or a specific example from the video

Only use information from the video data above.`;
        const res: any = await this.ai.generateWithGroq(defPrompt).toPromise();
        node.definition = this.extractTextFromResponse(res) || 'No definition available.';
      } catch (e) {
        console.error('[YouTube Definition Error]', e);
        node.definition = 'Could not load definition.';
      }
      this.loadingDefinition = false;
      return;
    }

    const prompt = `You are an expert in "${root}". Write a clear, accurate explanation for "${node.label}" based strictly on the source content below.${visualNote}

Paragraph 1 — What it is: Define "${node.label}" precisely using the source content.
Paragraph 2 — Key details: Explain the mechanism, data, or key characteristics.
Paragraph 3 — Significance/Example: Explain why it matters or give a concrete example from the content.${ctx}

Rules: Based ONLY on source content. Use markdown pipe table for any tabular data. Plain paragraphs otherwise.`;

    try {
      const res: any = await this.ai.generateWithGroq(prompt).toPromise();
      node.definition = this.extractTextFromResponse(res) || 'No definition available.';
    } catch (e) {
      console.error('[Definition Error]', e);
      node.definition = 'Could not load definition.';
    }
    this.loadingDefinition = false;
  }

  // ── PARSE ────────────────────────────────────────────────────────────────────

  /** Robustly extract text from either Groq or Gemini response shapes */
  private extractTextFromResponse(res: any): string {
    if (!res) return '';
    // Groq: choices[0].message.content
    const groq = res?.choices?.[0]?.message?.content;
    if (groq && typeof groq === 'string') return groq;
    // Gemini: candidates[0].content.parts[0].text
    const gemini = res?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (gemini && typeof gemini === 'string') return gemini;
    // Gemini alt: parts array directly
    const parts = res?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      return parts.map((p: any) => p.text || '').join('');
    }
    return '';
  }

  /** Extract the first valid JSON object from AI text output.
   *  Handles: ```json fences, bare JSON, JSON with trailing text. */
  private extractJson(text: string): string | null {
    if (!text) return null;

    // 1. Strip markdown code fences: ```json ... ``` or ``` ... ```
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/s);
    if (fenceMatch) {
      const candidate = fenceMatch[1].trim();
      try { JSON.parse(candidate); return candidate; } catch {}
    }

    // 2. Find the outermost {...} — scan for matching braces
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try { JSON.parse(candidate); return candidate; } catch {}
          break;
        }
      }
    }

    // 3. Last resort — try the whole text trimmed
    const trimmed = text.trim();
    try { JSON.parse(trimmed); return trimmed; } catch {}

    return null;
  }

  parseRoot(text: string) {
    try {
      const json = this.extractJson(text);
      if (!json) {
        console.error('[ParseRoot] No valid JSON found in response:', text.slice(0, 300));
        this.errorMsg = 'Could not parse response. Please try again.';
        return;
      }
      const data = JSON.parse(json);

      // Handle both {root: {...}} and direct node {...} shapes
      const rawNode = data.root ?? data;

      if (!rawNode || typeof rawNode !== 'object' || !rawNode.label) {
        console.error('[ParseRoot] Unexpected JSON shape:', JSON.stringify(data).slice(0, 200));
        this.errorMsg = 'Could not parse response. Please try again.';
        return;
      }

      this.rootNode = this.initNode(rawNode, 0);
      this.rootNode.expanded = true;
    } catch (e) {
      console.error('[ParseRoot Error]', e);
      this.errorMsg = 'Could not parse response. Please try again.';
    }
  }

  private initNode(raw: any, colorIdx: number): MindNode {
    return this.initNodeWithColor(raw, raw.level === 0 ? '#38bdf8' : this.COLORS[colorIdx % this.COLORS.length], 'root');
  }

  private initNodeWithColor(raw: any, color: string, parentId = ''): MindNode {
    const cleanLabel = (raw.label || '')
      .replace(/^#{1,6}\s+/, '')
      .replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '').trim();
    const node: MindNode = {
      id: `${parentId}_${cleanLabel.replace(/\s+/g, '_').slice(0, 20)}_${Math.random().toString(36).slice(2, 6)}`,
      label: cleanLabel,
      level: raw.level ?? 0,
      definition: raw.definition || '',
      children: [],
      color,
      expanded: false
    };
    if (raw.children?.length) {
      const seen = new Set<string>();
      node.children = raw.children
        .map((c: any, i: number) =>
          this.initNodeWithColor(
            { ...c, level: c.level ?? node.level + 1 },
            node.level === 0 ? this.COLORS[i % this.COLORS.length] : color,
            node.id
          )
        )
        .filter((child: MindNode) => {
          const key = child.label.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
    return node;
  }

  // ── DEFINITION PARSER ─────────────────────────────────────────────────────────
  /** Parse definition text into structured blocks for rich rendering */
  parseDefinition(text: string): DefinitionBlock[] {
    const blocks: DefinitionBlock[] = [];
    const lines = text.split('\n');
    let tableLines: string[] = [];
    let listItems: string[] = [];
    let paraLines: string[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushPara = () => {
      const t = paraLines.join('\n').trim();
      if (t) blocks.push({ type: 'para', content: this.renderMarkdown(t) });
      paraLines = [];
    };

    const flushList = () => {
      if (listItems.length > 0) {
        flushPara();
        blocks.push({ type: 'list', content: '', items: listItems.map(i => this.renderMarkdown(i)) });
        listItems = [];
      }
    };

    const flushCode = () => {
      const code = codeLines.join('\n').trim();
      if (code) blocks.push({ type: 'code', content: code });
      codeLines = [];
    };

    const flushTable = () => {
      if (tableLines.length >= 2) {
        const rows = tableLines
          .map(l => l.split('|')
            .map(c => this.renderMarkdown(c.trim()))
            .filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''))
          )
          .filter(r => r.length > 0 && !r.every(c => /^[-:]+$/.test(c)));
        if (rows.length >= 2) {
          flushPara();
          blocks.push({ type: 'table', content: '', rows });
        } else {
          paraLines.push(...tableLines);
        }
      } else {
        paraLines.push(...tableLines);
      }
      tableLines = [];
    };

    for (const line of lines) {
      // Code fence toggle
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          flushCode();
        } else {
          inCodeBlock = true;
          flushPara();
          flushList();
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(line.trim())) {
        flushPara(); flushList(); flushTable();
        blocks.push({ type: 'divider', content: '' });
        continue;
      }

      // Headings (# ## ###)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        flushPara(); flushList(); flushTable();
        blocks.push({ type: 'heading', content: headingMatch[2].replace(/\*\*/g, '').trim() });
        continue;
      }

      // List items (- * + or numbered)
      const listMatch = line.match(/^(\s*[-*+]|\s*\d+\.)\s+(.+)/);
      if (listMatch) {
        if (tableLines.length) flushTable();
        if (paraLines.length) flushPara();
        listItems.push(listMatch[2]);
        continue;
      }

      // Table rows
      const isTableRow = line.includes('|') && (line.trim().startsWith('|') || line.split('|').length >= 3);
      if (isTableRow) {
        if (listItems.length) flushList();
        if (paraLines.length) flushPara();
        tableLines.push(line);
        continue;
      }

      // Empty line — flush accumulations
      if (line.trim() === '') {
        if (tableLines.length) flushTable();
        if (listItems.length) flushList();
        flushPara();
        continue;
      }

      // Regular text
      if (tableLines.length) flushTable();
      if (listItems.length) flushList();
      paraLines.push(line);
    }

    // Flush remaining
    if (inCodeBlock) flushCode();
    if (tableLines.length) flushTable();
    if (listItems.length) flushList();
    flushPara();

    return blocks;
  }

  private renderMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_{2}(.+?)_{2}/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  hasChildren(node: MindNode): boolean { return node.children.length > 0; }

  getLevelLabel(level: number): string {
    const labels: Record<number, string> = { 0: 'Root', 1: 'Branch', 2: 'Subtopic', 3: 'Detail', 4: 'Sub-detail', 5: 'Point' };
    return labels[level] ?? `Level ${level}`;
  }

  getBreadcrumb(node: MindNode): string {
    return this.rootNode ? `${this.rootNode.label} › ${node.label}` : node.label;
  }

  countAllNodes(node: MindNode): number {
    return 1 + node.children.reduce((s, c) => s + this.countAllNodes(c), 0);
  }

  // ── SAVE / LOAD ──────────────────────────────────────────────────────────────
  saveMindMap() {
    if (!this.rootNode) return;
    const title = this.rootNode.label;
    const exists = this.savedMaps.findIndex(m => m.title === title);
    if (exists !== -1) this.savedMaps.splice(exists, 1);
    this.savedMaps.unshift({
      title,
      data: JSON.parse(JSON.stringify(this.rootNode)),
      date: new Date().toLocaleDateString(),
      ...(this.currentVideoMeta ? { videoMeta: this.currentVideoMeta } : {})
    } as any);
    localStorage.setItem('mindmaps', JSON.stringify(this.savedMaps.slice(0, 20)));
    this.progress = `✓ Saved: "${title}"`;
    setTimeout(() => this.progress = '', 2000);
  }

  loadSaved(map: any) {
    try {
      const root = JSON.parse(JSON.stringify(map.data)) as MindNode;
      this.rootNode = this.initNode(root, 0);
      this.rootNode.expanded = true;
      this.showSaved = false;
      this.selectedNode = null;
      this.errorMsg = '';
      this.currentVideoMeta = map.videoMeta || null;
      this.progress = `✓ Loaded: "${map.title}"`;
      setTimeout(() => this.progress = '', 2000);
    } catch (e) {
      console.error('[Load Saved Error]', e);
      this.errorMsg = 'Could not load saved map.';
    }
  }

  deleteSaved(i: number) {
    this.savedMaps.splice(i, 1);
    localStorage.setItem('mindmaps', JSON.stringify(this.savedMaps));
  }

  // ── EXPORT NOTES ─────────────────────────────────────────────────────────────
  exportNotes() {
    if (!this.rootNode) return;
    const lines: string[] = [];
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    lines.push(`# ${this.rootNode.label}`);
    lines.push(`*Generated on ${date}*\n`);
    if (this.rootNode.definition) { lines.push('## Overview'); lines.push(this.rootNode.definition); lines.push(''); }
    lines.push('---\n');
    this.rootNode.children.forEach((branch, i) => {
      lines.push(`## ${i + 1}. ${branch.label}`);
      if (branch.definition) { lines.push(branch.definition); lines.push(''); }
      branch.children.forEach(sub => {
        lines.push(`### ${sub.label}`);
        if (sub.definition) { lines.push(sub.definition); lines.push(''); }
        sub.children.forEach(detail => {
          lines.push(`**${detail.label}**`);
          if (detail.definition) lines.push(detail.definition);
          lines.push('');
        });
      });
      lines.push('---\n');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.rootNode.label.replace(/\s+/g, '-').toLowerCase()}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── YOUTUBE ──────────────────────────────────────────────────────────────────
  private async generateFromYoutube(url: string) {
    this.progress = 'Processing YouTube URL...';

    const videoId = this.yt.getVideoId(url.trim());
    if (!videoId) { this.errorMsg = 'Invalid YouTube URL.'; return; }
    this.youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Fetch full metadata
    let context = '';
    let videoMeta: VideoMeta | null = null;
    try {
      this.progress = 'Fetching video metadata...';
      const details: any = await this.yt.getVideoDetails(videoId).toPromise();
      const item = details?.items?.[0];
      if (item) {
        const s = item.snippet || {};
        const stats = item.statistics || {};
        const cd = item.contentDetails || {};
        videoMeta = {
          title: s.title || '',
          channel: s.channelTitle || '',
          duration: this.yt.formatDuration(cd.duration || ''),
          views: this.yt.formatViews(stats.viewCount || '0'),
          uploadDate: s.publishedAt ? new Date(s.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
          description: (s.description || '').slice(0, 1500),
          tags: (s.tags || []).slice(0, 15),
          chapters: this.extractChaptersList(s.description || ''),
          thumbnailUrl: this.yt.getThumbnail(videoId),
          videoUrl: this.youtubeVideoUrl
        };
        this.currentVideoMeta = videoMeta;
        context = await this.yt.getFullVideoContext(videoId).toPromise() as string || '';
      }
    } catch (e) {
      console.error('[YouTube Metadata Error]', e);
      context = '';
    }

    // Fallback to oEmbed
    if (!videoMeta?.title) {
      try {
        this.progress = 'Fetching video title (fallback)...';
        const oEmbed: any = await this.yt.getOEmbed(videoId).toPromise();
        if (oEmbed?.title) {
          videoMeta = {
            title: oEmbed.title,
            channel: oEmbed.author_name || '',
            duration: '', views: '', uploadDate: '',
            description: '',
            tags: [],
            chapters: [],
            thumbnailUrl: this.yt.getThumbnail(videoId),
            videoUrl: this.youtubeVideoUrl
          };
          this.currentVideoMeta = videoMeta;
        }
      } catch (e) {
        console.error('[oEmbed Error]', e);
      }
    }

    if (!videoMeta?.title) {
      this.errorMsg = 'Could not fetch video info. Please check the URL and try again.';
      return;
    }

    this.progress = 'Building mind map...';

    const prompt = context && context.trim().length > 50
      ? `You are a mind map expert. Build a comprehensive mind map using the YouTube video data below.

CRITICAL RULES:
- Root label MUST be the exact VIDEO TITLE from the data
- If CHAPTERS exist, each chapter = one level-1 branch
- If no chapters, use TAGS and DESCRIPTION topics for branches
- All content must come from the video data — no generic topics
- Definitions: 3-4 sentences based on video data

--- VIDEO DATA ---
${context}
--- END ---

Return ONLY valid JSON (no markdown, no code fences):
{
  "root": {
    "id": "root", "label": "<exact video title>", "level": 0,
    "definition": "<what this video covers based on description>",
    "children": [
      { "id": "b1", "label": "<branch from chapters/tags>", "level": 1, "definition": "<explanation from video data>",
        "children": [
          { "id": "b1a", "label": "<subtopic>", "level": 2, "definition": "<explanation>",
            "children": [
              { "id": "b1a1", "label": "<detail>", "level": 3, "definition": "<specific fact>", "children": [] }
            ]
          }
        ]
      }
    ]
  }
}`
      : `You are a mind map expert. Create a comprehensive mind map for this YouTube video.

VIDEO TITLE: "${videoMeta.title}"
VIDEO URL: ${this.youtubeVideoUrl}

CRITICAL RULES:
- Root label MUST be exactly: "${videoMeta.title}"
- Create branches covering the specific subject matter
- Definitions: 3-5 sentences, detailed and specific
- 5-7 branches, 3-4 subtopics each, 2-3 details each

Return ONLY valid JSON (no markdown, no code fences):
{
  "root": {
    "id": "root", "label": "${videoMeta.title}", "level": 0,
    "definition": "<overview specific to this video topic>",
    "children": [
      { "id": "b1", "label": "<specific branch>", "level": 1, "definition": "<detailed explanation>",
        "children": [
          { "id": "b1a", "label": "<subtopic>", "level": 2, "definition": "<explanation>",
            "children": [
              { "id": "b1a1", "label": "<detail>", "level": 3, "definition": "<specific fact>", "children": [] }
            ]
          }
        ]
      }
    ]
  }
}`;

    try {
      const res: any = await this.ai.generateWithGroq(prompt).toPromise();
      const text = this.extractTextFromResponse(res);
      if (!text) throw new Error('empty response');
      this.parseRoot(text);
    } catch (e: any) {
      if (this.errorMsg) return; // already set a specific message
      const status = e?.status;
      console.error('[YouTube Mind Map Error]', status, e);
      if (status === 401 || status === 403) {
        this.errorMsg = 'API key is invalid or expired. Please update the API key in ai.service.ts.';
      } else if (status === 429) {
        this.errorMsg = 'Rate limit reached. Please wait a moment and try again.';
      } else {
        this.errorMsg = 'Mind map generation failed. Try again.';
      }
    }
  }

  /** Extract chapters as structured list from description text */
  private extractChaptersList(description: string): { time: string; title: string }[] {
    const chapters: { time: string; title: string }[] = [];
    const lines = description.split('\n');
    for (const line of lines) {
      const match = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+)/);
      if (match && match[2].trim().length > 1) {
        chapters.push({ time: match[1], title: match[2].trim() });
      }
    }
    return chapters;
  }
}
