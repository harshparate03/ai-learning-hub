import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiService } from '../../../core/services/ai.service';
import { YoutubeService } from '../../../core/services/youtube.service';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { PdfLine, PdfService } from '../../../core/services/pdf.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface MindNode {
  id: string;
  label: string;
  level: number;
  orderPath?: string;
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
  /** Original text used to build the map (text mode) — powers node definitions */
  private sourceContent = '';
  private definitionRequestId = 0;

  /** Rich video metadata for YouTube maps — shown in definition panel */
  currentVideoMeta: VideoMeta | null = null;

  savedMaps: { title: string; data: any; date: string }[] = [];
  showSaved = false;

  COLORS = ['#38bdf8','#34d399','#f472b6','#fb923c','#a78bfa','#facc15','#f87171','#4ade80','#22d3ee','#e879f9'];

  constructor(private ai: AiService, private yt: YoutubeService, private pdf: PdfService) {}

  ngOnInit() {
    const s = localStorage.getItem('mindmaps');
    if (s) this.savedMaps = JSON.parse(s);

    const pending = localStorage.getItem('mindmap_load');
    if (pending) {
      try {
        const map = JSON.parse(pending);
        this.rootNode = this.hydrateSavedRoot(map.data);
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
    } catch {
      this.errorMsg = 'Could not read file. Please ensure it is a valid, supported file.';
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
    if (!this.canGenerate || this.loading) return;
    this.loading = true;
    this.errorMsg = '';
    this.rootNode = null;
    this.selectedNode = null;
    this.currentVideoMeta = null;
    this.sourceContent = '';
    this.definitionRequestId++;
    this.progress = 'Starting...';

    try {
      if (this.inputMode === 'file' && this.fileContent) {
        await this.generateFromFile();
      } else if (this.inputMode === 'youtube') {
        await this.generateFromYoutube(sanitizeUserInput(this.youtubeUrl, 500));
      } else {
        await this.generateSingleCall(sanitizeUserInput(this.textInput, 5000), false);
      }
    } catch (e: any) {
      if (!this.errorMsg) {
        this.handleMindMapGenerationFailure(e);
      }
    } finally {
      this.progress = '';
      this.loading = false;
    }
  }

  private handleMindMapGenerationFailure(e: any) {
    if (this.inputMode === 'file' && this.fileContent) {
      const rawTree = this.buildExactDocumentTree(this.fileContent);
      if (rawTree.children.length) {
        this.rootNode = this.sanitizeMindTree(this.initNode(rawTree, 0));
        this.rootNode.expanded = true;
        this.errorMsg = '';
        return;
      }
    }

    if (this.inputMode === 'text' && this.textInput.trim()) {
      this.buildLocalMindMap(sanitizeUserInput(this.textInput, 5000), false);
      this.errorMsg = '';
      return;
    }

    this.errorMsg = this.isAiUnavailableError(e)
      ? 'Could not reach the AI service, so I used local analysis where possible. Please try again if the result is incomplete.'
      : this.ai.proxyErrorMessage(e);
  }

  private isAiUnavailableError(e: any): boolean {
    const message = String(e?.message || e?.error?.message || e || '').toLowerCase();
    return e?.status === 0 ||
      e?.status === 503 ||
      message.includes('all ai models failed') ||
      message.includes('ai service unavailable') ||
      message.includes('internet connection') ||
      message.includes('no ai service available');
  }

  private isErrorLikeText(text: string): boolean {
    const t = String(text || '').toLowerCase();
    return this.isAiUnavailableError(text) ||
      t.includes('ai request failed') ||
      t.includes('could not load') ||
      t.includes('no definition available') ||
      t.includes('api key is invalid') ||
      t.includes('rate limit reached');
  }

  private hasUsableDefinition(node: MindNode): boolean {
    const def = node.definition?.trim() || '';
    return def.length >= 20 && !this.isErrorLikeText(def);
  }

  private getNodeSourceSection(node: MindNode): string {
    const content = this.fileContent || this.sourceContent;
    if (!content) return '';
    return this.extractSection(content, node.label);
  }

  private hydrateSavedRoot(raw: MindNode): MindNode {
    const root = JSON.parse(JSON.stringify(raw)) as MindNode;
    this.refreshNodeMeta(root, 0, '', '#38bdf8');
    root.expanded = true;
    return root;
  }

  private makeLocalNodeDefinition(node: MindNode): string {
    const parts: string[] = [];
    if (node.definition && !this.isErrorLikeText(node.definition)) {
      parts.push(node.definition);
    }
    if (node.children?.length) {
      parts.push(`${node.label} includes ${node.children.map(child => child.label).slice(0, 8).join(', ')}.`);
    }
    if (this.rootNode && node !== this.rootNode) {
      parts.push(`It appears under ${this.rootNode.label} in the uploaded or generated mind map.`);
    }
    return parts.join('\n') || `${node.label} is part of the current mind map structure.`;
  }

  private async generateFromFile() {
    const content = this.fileContent;
    await this.generateSingleCall(content, true);
  }

  private buildExactDocumentTree(content: string): any {
    const cleanContent = this.normalizeText(content);
    const rootLabel = this.inferTitle(cleanContent, this.fileName || 'Document Mind Map');
    const root = {
      id: 'root',
      label: rootLabel,
      level: 0,
      definition: this.makeDefinition(rootLabel, cleanContent),
      children: [] as any[]
    };

    const lines = this.parseDocumentTreeLines(content);
    const stack: { node: any; level: number; kind: 'root' | 'heading' | 'bullet' | 'table' }[] = [
      { node: root, level: 0, kind: 'root' }
    ];

    for (const item of lines) {
      if (item.kind === 'paragraph') {
        const current = stack[stack.length - 1]?.node || root;
        current.definition = this.appendDefinition(current.definition, item.text);
        continue;
      }

      const baseLevel = this.findCurrentSectionLevel(stack);
      const level = item.kind === 'heading'
        ? item.depth
        : Math.min(8, baseLevel + item.depth);

      if (level === 1 && this.normalizeNodeKey(item.label) === this.normalizeNodeKey(rootLabel)) {
        continue;
      }

      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();

      const parent = stack[stack.length - 1]?.node || root;
      const node = {
        id: `doc_${item.index}`,
        label: this.cleanNodeLabel(item.label),
        level,
        definition: item.text,
        children: [] as any[]
      };

      parent.children.push(node);
      stack.push({ node, level, kind: item.kind });
    }

    if (!root.children.length) {
      root.children = this.chunkDocumentIntoSections(cleanContent, rootLabel)
        .map((section, i) => this.buildLocalBranch(section.title, section.body, 1, i));
    }

    this.compactEmptyDocumentBranches(root);
    return root;
  }

  private parseDocumentTreeLines(content: string): {
    kind: 'heading' | 'bullet' | 'paragraph' | 'table';
    label: string;
    text: string;
    depth: number;
    index: number;
  }[] {
    const parsed: {
      kind: 'heading' | 'bullet' | 'paragraph' | 'table';
      label: string;
      text: string;
      depth: number;
      index: number;
    }[] = [];
    const lines = content.replace(/\r/g, '').split('\n');
    let tableRows: string[] = [];

    const flushTable = (index: number) => {
      if (!tableRows.length) return;
      const rows = tableRows.filter(row => row.trim());
      const label = rows[0]?.split('|').map(cell => cell.trim()).filter(Boolean).slice(0, 3).join(' / ') || 'Table';
      parsed.push({
        kind: 'table',
        label: `Table: ${label}`,
        text: rows.join('\n'),
        depth: 1,
        index
      });
      tableRows = [];
    };

    lines.forEach((rawLine, index) => {
      const raw = rawLine.replace(/\t/g, '  ');
      const trimmed = raw.trim();

      if (trimmed === '[TABLE_START]') {
        flushTable(index);
        tableRows = [];
        return;
      }
      if (trimmed === '[TABLE_END]') {
        flushTable(index);
        return;
      }
      if (tableRows.length && !trimmed.includes(' | ')) {
        flushTable(index);
      }
      if (trimmed.includes(' | ')) {
        tableRows.push(trimmed);
        return;
      }
      if (!trimmed) return;

      const structural = this.parseStructuralLine(raw, index);
      parsed.push(structural || {
        kind: 'paragraph',
        label: this.firstWords(trimmed, 'Detail'),
        text: trimmed,
        depth: 1,
        index
      });
    });

    flushTable(lines.length);
    return parsed;
  }

  private parseStructuralLine(rawLine: string, index: number): {
    kind: 'heading' | 'bullet';
    label: string;
    text: string;
    depth: number;
    index: number;
  } | null {
    const trimmed = rawLine.trim();
    const indentDepth = Math.floor((rawLine.match(/^\s*/)?.[0].length || 0) / 2);

    const slide = trimmed.match(/^\[SLIDE\s+\d+\]\s*(.+)$/i);
    if (slide?.[1]) {
      return { kind: 'heading', label: slide[1], text: trimmed, depth: 1, index };
    }

    const markdown = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (markdown?.[2]) {
      return { kind: 'heading', label: markdown[2], text: trimmed, depth: markdown[1].length, index };
    }

    const numbered = trimmed.match(/^(?:chapter|section|unit|module|part)?\s*(\d+(?:\.\d+){0,5})[.)]?\s+(.+)$/i);
    if (numbered?.[2]) {
      const label = numbered[2].trim();
      const sectionDepth = numbered[1].split('.').length;
      const looksLikeHeading = sectionDepth > 1 || /^[A-Z]/.test(label);
      if (looksLikeHeading) {
        return { kind: 'heading', label, text: trimmed, depth: sectionDepth, index };
      }
    }

    const bullet = rawLine.match(/^(\s*)(?:[-*+•·∙◦▪]|\d+[.)]|[a-zA-Z][.)])\s+(.+)$/);
    if (bullet?.[2]) {
      return {
        kind: 'bullet',
        label: bullet[2],
        text: bullet[2],
        depth: Math.max(1, Math.floor((bullet[1]?.length || 0) / 2) + 1),
        index
      };
    }

    const clean = trimmed.replace(/\*\*(.*?)\*\*/g, '$1').trim();
    if (this.isStandaloneHeading(clean)) {
      return { kind: 'heading', label: clean.replace(/[:：]$/, ''), text: trimmed, depth: indentDepth + 1, index };
    }

    return null;
  }

  private isStandaloneHeading(text: string): boolean {
    if (!text || text.length < 3 || text.length > 90 || /[.!?]$/.test(text)) return false;
    if (/[:：]$/.test(text) && text.split(/\s+/).length <= 10) return true;
    if (/^[A-Z][A-Z0-9\s/&-]{4,}$/.test(text)) return true;
    return /^[A-Z][A-Za-z0-9/&-]*(?:\s+[A-Z][A-Za-z0-9/&-]*){1,7}$/.test(text);
  }

  private findCurrentSectionLevel(stack: { level: number; kind: string }[]): number {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind === 'heading' || stack[i].kind === 'table' || stack[i].kind === 'root') {
        return stack[i].level;
      }
    }
    return 0;
  }

  private appendDefinition(existing: string, addition: string): string {
    const cleanAddition = this.cleanMarkdown(addition);
    if (!cleanAddition) return existing || '';
    if (!existing) return cleanAddition;
    if (existing.includes(cleanAddition)) return existing;
    return `${existing}\n${cleanAddition}`;
  }

  private compactEmptyDocumentBranches(root: any) {
    const compact = (node: any) => {
      node.children = (node.children || []).filter((child: any) => {
        compact(child);
        return child.label && (child.definition || child.children?.length);
      });
    };
    compact(root);
  }

  private extractDocumentStructure(content: string): {
    rootLabel: string;
    rootDef: string;
    sections: { title: string; body: string }[];
  } {
    const cleanContent = this.normalizeText(content);
    const fallbackTitle = this.inferTitle(cleanContent, this.fileName || 'Document Mind Map');
    const sections = this.extractStrictDocumentSections(cleanContent, fallbackTitle);
    const usefulSections = sections
      .filter(section => section.title && (section.body.trim().length > 25 || sections.length <= 3))
      .slice(0, 8);

    return {
      rootLabel: fallbackTitle.slice(0, 70),
      rootDef: this.makeDefinition(fallbackTitle, cleanContent),
      sections: usefulSections.length ? usefulSections : this.chunkDocumentIntoSections(cleanContent, fallbackTitle)
    };
  }

  private extractStrictDocumentSections(content: string, fallbackTitle: string): { title: string; body: string }[] {
    const lines = content.split('\n');
    const sections: { title: string; body: string[] }[] = [];
    let current: { title: string; body: string[] } | null = null;

    const flush = () => {
      if (!current) return;
      const body = current.body.join('\n').trim();
      if (body) sections.push(current);
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (current) current.body.push('');
        continue;
      }

      const heading = this.extractStrictDocumentHeading(line);
      if (heading) {
        flush();
        current = { title: heading, body: [] };
        continue;
      }

      if (!current) current = { title: fallbackTitle, body: [] };
      current.body.push(line);
    }
    flush();

    return sections.map(section => ({
      title: this.cleanLocalLabel(section.title),
      body: section.body.join('\n').trim()
    }));
  }

  private extractStrictDocumentHeading(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed || /^[-*+]\s+/.test(trimmed)) return null;

    const slide = trimmed.match(/^\[SLIDE\s+\d+\]\s*(.+)$/i);
    if (slide?.[1]) return slide[1].trim();

    const markdown = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (markdown?.[1]) return markdown[1].trim();

    const numbered = trimmed.match(/^(?:chapter|section|unit|module|part)?\s*\d+(?:\.\d+){0,2}[.)]?\s+(.+)$/i);
    if (numbered?.[1] && numbered[1].length <= 90 && /^[A-Z]/.test(numbered[1].trim())) return numbered[1].trim();

    const clean = trimmed.replace(/\*\*(.*?)\*\*/g, '$1').trim();
    if (clean.length < 3 || clean.length > 90) return null;
    if (/[:：]$/.test(clean) && clean.split(/\s+/).length <= 10) return clean.replace(/[:：]$/, '').trim();
    if (/^[A-Z][A-Z0-9\s/&-]{4,}$/.test(clean)) return clean;
    if (/^[A-Z][A-Za-z0-9/&-]*(?:\s+[A-Z][A-Za-z0-9/&-]*){1,6}$/.test(clean) && !/[.!?]$/.test(clean)) return clean;

    return null;
  }

  private chunkDocumentIntoSections(content: string, fallbackTitle: string): { title: string; body: string }[] {
    const paragraphs = content
      .split(/\n\s*\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 40);

    const chunks = paragraphs.length ? paragraphs : this.splitSentences(content);
    return chunks.slice(0, 6).map((chunk, index) => ({
      title: index === 0 ? fallbackTitle : this.cleanLocalLabel(this.firstWords(chunk, `Topic ${index + 1}`)),
      body: chunk
    }));
  }

  private splitContentIntoSections(content: string, branches: string[]): string[] {
    const normalizedBranches = branches.map(branch => this.cleanBranchCandidate(branch));
    const localSections = this.extractLocalSections(content, normalizedBranches[0] || 'Document');
    const usedLocalSections = new Set<number>();
    const lower = content.toLowerCase();
    const positions: number[] = normalizedBranches.map(branch => this.findTopicPosition(lower, branch));

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

    normalizedBranches.forEach((branch, i) => {
      if (sections[i]) return;
      const branchKey = this.normalizeTopicKey(branch);
      const localIdx = localSections.findIndex((section, idx) => {
        if (usedLocalSections.has(idx)) return false;
        const titleKey = this.normalizeTopicKey(section.title);
        return titleKey === branchKey || titleKey.includes(branchKey) || branchKey.includes(titleKey);
      });
      if (localIdx !== -1) {
        usedLocalSections.add(localIdx);
        sections[i] = `${localSections[localIdx].title}\n${localSections[localIdx].body}`;
      }
    });

    return sections;
  }

  private findTopicPosition(lowerContent: string, topic: string): number {
    const cleanTopic = this.cleanBranchCandidate(topic).toLowerCase();
    if (!cleanTopic) return -1;
    const escaped = cleanTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headingPattern = new RegExp(
      `(^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\d+(?:\\.\\d+)*[.)]?\\s*)?${escaped}(?:\\s*[:\\-–—]?\\s*)(?=\\n|$)`,
      'i'
    );
    const headingMatch = lowerContent.match(headingPattern);
    if (headingMatch?.index !== undefined) return headingMatch.index;
    return lowerContent.indexOf(cleanTopic);
  }

  private cleanBranchCandidate(value: string): string {
    return this.normalizeText(value)
      .replace(/^[#>\s]+/, '')
      .replace(/^(?:[-*+•]|\d+(?:\.\d+)*[.)]?|[A-Za-z][.)])\s+/, '')
      .replace(/\s*[:\-–—]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTopicKey(value: string): string {
    return this.cleanBranchCandidate(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(?:the|a|an|and|or|of|to|in|for|with|on|by)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isGenericBranch(value: string): boolean {
    const key = this.normalizeTopicKey(value);
    if (!key) return true;

    const genericKeys = new Set([
      'overview',
      'introduction',
      'summary',
      'conclusion',
      'contents',
      'table contents',
      'references',
      'bibliography',
      'appendix',
      'notes',
      'slide',
      'section',
      'topic'
    ]);

    return genericKeys.has(key) || key.length < 3 || /^\d+$/.test(key);
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
      } catch {
        parts.push(chunk.slice(0, 400));
      }
    }
    return parts.join('\n\n');
  }

  private async extractRootAndBranches(outline: string): Promise<{ rootLabel: string; rootDef: string; branches: string[] } | null> {
    try {
      // Simple text-based branch extraction (more reliable than Groq JSON parsing)
      const lines = outline.split('\n').filter(l => l.trim().length > 0);
      
      // Find root label: first substantial line
      const rootLabel = this.cleanBranchCandidate(lines.find(l => l.length > 5 && !l.startsWith('##')) || 'Document');
      
      // Extract section headers (lines starting with # or all-caps or numbered)
      const branches: string[] = [];
      const seen = new Set<string>();
      
      for (const line of lines) {
        if (this.getOutlineDepth(line) > 0) continue;
        let section = this.cleanBranchCandidate(line.trim());
        
        // Strip markdown headers
        section = section.replace(/^#+\s+/, '').trim();
        
        // Filter: skip empty, keep if 3-50 chars and looks like a heading
        if (section.length >= 3 && section.length <= 50) {
          const lower = section.toLowerCase();
          const key = this.normalizeTopicKey(section);
          
          // Skip common non-heading patterns
          if (this.isGenericBranch(section) || lower.includes('table') || lower.includes('figure') || lower.includes('page')) {
            continue;
          }
          
          // Likely a heading if: all caps, starts with number, multiple words, or short sentence
          const isHeading = /^[A-Z\s\d]+$/.test(section) || // all caps
                           /^\d+\./.test(section) ||          // numbered
                           section.split(' ').length <= 5;     // short phrase
          
          if (isHeading && key && !seen.has(key) && key !== this.normalizeTopicKey(rootLabel)) {
            branches.push(section);
            seen.add(key);
          }
        }
      }
      
      // If we found < 3 branches, ask Groq for suggestions (minimal JSON)
      if (branches.length < 3) {
        try {
          const res: any = await this.ai.generateWithGroq(
            `List 5 main topics from this document in a simple format:\n\n${outline.slice(0, 3000)}\n\nRespond with one topic per line, no numbers or bullets.`
          ).toPromise();
          const suggestions = this.extractTextFromResponse(res)
            ?.split('\n')
            ?.map(t => t.replace(/^[\d\.\-•]\s+/, '').trim())
            ?.filter(t => t.length > 3 && t.length < 50) || [];
          branches.push(...suggestions.slice(0, 5 - branches.length));
        } catch {
          // fallback to text-based extraction only
        }
      }
      
      // Ensure we have at least 2 branches
      if (branches.length < 2) {
        branches.push('Overview', 'Details', 'Conclusion');
      }
      
      // Limit to 8 branches
      const uniqueBranches = Array.from(new Set(branches.map(b => b.toLowerCase())))
        .slice(0, 8)
        .map(b => branches.find(br => br.toLowerCase() === b)!);
      
      return {
        rootLabel: rootLabel.slice(0, 50),
        rootDef: rootLabel,
        branches: uniqueBranches
      };
    } catch {
      return null;
    }
  }

  private getOutlineDepth(line: string): number {
    const match = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+/);
    if (!match) return 0;
    return Math.floor(match[1].replace(/\t/g, '  ').length / 2);
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
    
    // Early exit for empty sections
    if (!section || section.trim().length < 20) {
      return { id: `branch_${colorIdx}_${Math.random().toString(36).slice(2)}`, label: branchName, level: 1, definition: '', children: [], color, expanded: false };
    }
    
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
- Preserve the document hierarchy exactly: section heading -> subheading -> nested points
- Do not repeat "${branchName}" as a child node. Its direct children must be the next-level subtopics from this section.
- If a line is a subtopic in the document, keep it under its parent instead of promoting it to a branch.
- Each concept must appear ONCE — merge duplicates
- Labels: exact terms from content, max 6 words
- Labels must not include numbering, bullets, dots, dashes, or list prefixes
- Keep children in the correct reading order. The app adds numbering automatically.
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
      const parsed = JSON.parse(json);
      if (!parsed.label) throw new Error('missing label in parsed JSON');
      return this.initNodeWithColor(parsed, color, `branch_${colorIdx}`);
    } catch {
      return this.initNodeWithColor(this.buildLocalBranch(branchName, section, 1), color, `branch_${colorIdx}`);
    }
  }

  // ── SINGLE CALL (text / youtube) ─────────────────────────────────────────────
  private async generateSingleCall(content: string, isContentBased: boolean) {
    this.sourceContent = content;
    this.progress = 'Building mind map...';

    // Short topic = keyword(s) typed by user (e.g. "Software Testing", "Machine Learning")
    const isShortTopic = !isContentBased && content.trim().split(/\s+/).length <= 20;

    const topicPrompt = `Create a JSON mind map for: "${content}"

Output ONLY valid JSON starting with { — no markdown, no explanation.

Rules:
- 8 primary branches (level 1) covering: Types/Categories, Core Concepts, Key Techniques, Tools/Technologies, Process/Workflow, Benefits/Advantages, Challenges/Limitations, Best Practices
- 4-5 children per branch (level 2), 2-3 children per level-2 node (level 3)
- Labels: 2-4 words, domain keywords only, no numbering
- Definitions: 2 sentences each — what it is and why it matters
- Strict parent→child hierarchy

JSON format:
{"root":{"id":"root","label":"${content}","level":0,"definition":"What ${content} is and its core purpose.","children":[{"id":"b1","label":"Types","level":1,"definition":"The main categories within this topic.","children":[{"id":"b1a","label":"Example Type","level":2,"definition":"What this type is and when it is used.","children":[{"id":"b1a1","label":"Specific Detail","level":3,"definition":"A specific aspect of this type.","children":[]}]}]}]}}

Now generate the complete 8-branch map with real content for "${content}". Return complete JSON only.`;

    const contentPrompt = `You are an expert Visual Knowledge Architect and Information Structuring Expert.

Analyze the content below and build a mind map that STRICTLY follows what is written in it.

CONTENT:
${content.slice(0, 12000)}

STRICT RULES:
- Root label = the main topic/title found in the content
- Primary branches = actual main sections, themes, or major headings FROM THE CONTENT
- All labels must use exact terms, headings, or concepts from the content
- All definitions must use ONLY information from the content — no external knowledge added
- DO NOT invent topics not in the content
- Labels: 2-4 words maximum, use exact terminology from the content
- Definitions: 3-5 sentences using only information from the content above
- Structure: at least 6 primary branches, each with 3-6 secondary branches
- Maintain parent-child logic: children must be sub-topics of their parent

Return ONLY valid JSON (no markdown, no code fences):
{
  "root": {
    "id": "root",
    "label": "Main Topic from Content",
    "level": 0,
    "definition": "3-5 sentence overview based on the content.",
    "children": [
      {
        "id": "b1",
        "label": "Section from Content",
        "level": 1,
        "definition": "3-5 sentences directly from the content.",
        "children": [
          {
            "id": "b1a",
            "label": "Subsection from Content",
            "level": 2,
            "definition": "3-5 sentences from the content.",
            "children": [
              { "id": "b1a1", "label": "Detail from Content", "level": 3, "definition": "3-5 sentences.", "children": [] }
            ]
          }
        ]
      }
    ]
  }
}`;

    const prompt = isShortTopic ? topicPrompt : contentPrompt;

    let res: any;
    try {
      res = await this.ai.generateWithGroq(prompt).toPromise();
    } catch {
      this.buildLocalMindMap(content, isContentBased);
      return;
    }

    const text = this.extractTextFromResponse(res);
    if (!text || this.ai.isDemoFallback(text)) {
      this.buildLocalMindMap(content, isContentBased);
      return;
    }
    this.parseRoot(text);
    if (!this.rootNode || this.errorMsg) {
      this.buildLocalMindMap(content, isContentBased);
    }
  }

  private buildLocalMindMap(content: string, isContentBased: boolean) {
    const cleanContent = this.normalizeText(content);
    this.sourceContent = cleanContent;
    const title = isContentBased
      ? this.inferTitle(cleanContent, this.fileName || 'Document Mind Map')
      : this.toTitleCase(cleanContent).slice(0, 70) || 'Mind Map';
    const sections = this.extractLocalSections(cleanContent, title);
    const root = {
      id: 'root',
      label: title,
      level: 0,
      definition: this.makeDefinition(title, cleanContent),
      children: sections.slice(0, 8).map((section, i) =>
        this.buildLocalBranch(section.title, section.body, 1, i)
      )
    };
    this.rootNode = this.sanitizeMindTree(this.initNode(root, 0));
    this.rootNode.expanded = true;
    this.errorMsg = '';
    this.progress = 'Built mind map from local content analysis.';
  }

  private buildLocalBranch(title: string, body: string, level: number, index = 0): any {
    const points = this.extractLocalPoints(body);
    const childGroups = points.length ? points : this.splitSentences(body).slice(0, 5);
    return {
      id: `local_${level}_${index}`,
      label: this.cleanLocalLabel(title || `Section ${index + 1}`),
      level,
      definition: this.makeDefinition(title, body),
      children: childGroups.slice(0, 6).map((point, i) => {
        const detailSource = this.findContextForPoint(body, point);
        const details = this.extractLocalPoints(detailSource)
          .filter(d => d.toLowerCase() !== point.toLowerCase())
          .slice(0, 4);
        return {
          id: `local_${level + 1}_${index}_${i}`,
          label: this.cleanLocalLabel(point),
          level: level + 1,
          definition: this.makeDefinition(point, detailSource || body),
          children: details.map((detail, di) => ({
            id: `local_${level + 2}_${index}_${i}_${di}`,
            label: this.cleanLocalLabel(detail),
            level: level + 2,
            definition: this.makeDefinition(detail, detailSource || body),
            children: []
          }))
        };
      })
    };
  }

  private extractLocalSections(content: string, fallbackTitle: string): { title: string; body: string }[] {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const sections: { title: string; body: string }[] = [];
    let current: { title: string; body: string[] } | null = null;

    const flush = () => {
      if (current) sections.push({ title: current.title, body: current.body.join('\n') });
    };

    for (const line of lines) {
      const heading = this.extractHeading(line);
      if (heading) {
        flush();
        current = { title: heading, body: [] };
      } else if (current) {
        current.body.push(line);
      } else {
        current = { title: fallbackTitle, body: [line] };
      }
    }
    flush();

    if (sections.length > 1) return sections.filter(s => s.body.trim().length > 20 || s.title !== fallbackTitle);

    const paragraphs = content.split(/\n\s*\n|(?<=\.)\s+(?=[A-Z][A-Za-z ]{8,60}:)/).map(p => p.trim()).filter(p => p.length > 30);
    return paragraphs.slice(0, 8).map((p, i) => ({
      title: this.cleanLocalLabel(this.extractHeading(p.split('\n')[0]) || this.firstWords(p, i === 0 ? fallbackTitle : `Topic ${i + 1}`)),
      body: p
    }));
  }

  private extractHeading(line: string): string | null {
    const clean = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .trim();
    if (!clean || clean.length > 90) return null;
    if (/[:：]$/.test(clean)) return clean.replace(/[:：]$/, '');
    if (/^\d+(?:\.\d+)*\s+/.test(clean)) return clean.replace(/^\d+(?:\.\d+)*\s+/, '');
    if (/^[A-Z][A-Z0-9\s/&-]{4,}$/.test(clean)) return clean;
    if (clean.split(/\s+/).length <= 7 && !/[.!?]$/.test(clean)) return clean;
    return null;
  }

  private extractLocalPoints(text: string): string[] {
    const points: string[] = [];
    for (const line of text.split('\n')) {
      const m = line.trim().match(/^(?:[-*+]|\d+[.)])\s+(.+)/);
      if (m) points.push(m[1]);
    }
    if (points.length >= 2) return this.uniqueLabels(points);
    return this.uniqueLabels(this.splitSentences(text).slice(0, 8));
  }

  private splitSentences(text: string): string[] {
    return this.normalizeText(text)
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length >= 20 && s.length <= 220);
  }

  private findContextForPoint(body: string, point: string): string {
    const sentences = this.splitSentences(body);
    const keyWords = point.toLowerCase().split(/\W+/).filter(w => w.length > 3).slice(0, 4);
    const idx = sentences.findIndex(s => keyWords.some(w => s.toLowerCase().includes(w)));
    if (idx === -1) return sentences.slice(0, 3).join(' ');
    return sentences.slice(Math.max(0, idx - 1), idx + 3).join(' ');
  }

  private makeDefinition(label: string, source: string): string {
    const sentences = this.splitSentences(source).slice(0, 3);
    if (sentences.length) return sentences.join(' ');
    return `${this.cleanLocalLabel(label)} is a topic identified from the provided content. It is included in the mind map because the source text presents it as part of the overall structure.`;
  }

  private inferTitle(content: string, fallback: string): string {
    const firstHeading = content.split('\n').map(l => this.extractHeading(l)).find(Boolean);
    return this.cleanLocalLabel(firstHeading || this.firstWords(content, fallback));
  }

  private firstWords(text: string, fallback: string): string {
    const words = this.normalizeText(text).split(/\s+/).filter(Boolean).slice(0, 7).join(' ');
    return words || fallback;
  }

  private cleanLocalLabel(text: string): string {
    return this.cleanNodeLabel(text)
      .replace(/[:：]\s*$/, '')
      .split(/\s+/)
      .slice(0, 8)
      .join(' ')
      .trim() || 'Topic';
  }

  private uniqueLabels(items: string[]): string[] {
    const seen = new Set<string>();
    return items
      .map(i => this.cleanLocalLabel(i))
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

  private toTitleCase(text: string): string {
    return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  /** Generate a demo mind map with proper structure when API fails */
  private generateDemoMindmap(rootLabel: string): string {
    return JSON.stringify({
      root: {
        id: 'root',
        label: rootLabel || 'Main Topic',
        level: 0,
        definition: `This is a demonstration mind map showing how ${rootLabel || 'your topic'} can be structured hierarchically. The structure demonstrates the relationship between main concepts and their supporting details.`,
        children: [
          {
            id: 'b1',
            label: 'Core Concepts',
            level: 1,
            definition: 'The fundamental principles and foundational ideas that form the basis of this topic. Understanding these core concepts is essential for mastery.',
            children: [
              {
                id: 'b1a',
                label: 'Concept 1',
                level: 2,
                definition: 'The first major concept that builds the foundation. This concept introduces key terminology and establishes the basic framework.',
                children: [
                  {
                    id: 'b1a1',
                    label: 'Detail & Application',
                    level: 3,
                    definition: 'Specific details and real-world applications of this concept. This shows how the concept is used in practice.',
                    children: []
                  }
                ]
              },
              {
                id: 'b1b',
                label: 'Concept 2',
                level: 2,
                definition: 'The second important concept that extends the foundation. This builds upon the first concept.',
                children: []
              }
            ]
          },
          {
            id: 'b2',
            label: 'Practical Applications',
            level: 1,
            definition: 'Real-world examples and practical uses of the concepts. This section bridges theory and practice with concrete applications.',
            children: [
              {
                id: 'b2a',
                label: 'Use Case 1',
                level: 2,
                definition: 'A specific practical application demonstrating how these concepts are used in real scenarios.',
                children: []
              }
            ]
          },
          {
            id: 'b3',
            label: 'Advanced Topics',
            level: 1,
            definition: 'More complex ideas and advanced understanding that build upon the core concepts. These topics represent deeper levels of expertise.',
            children: [
              {
                id: 'b3a',
                label: 'Advanced Concept',
                level: 2,
                definition: 'Higher-level ideas that incorporate multiple concepts working together.',
                children: []
              }
            ]
          }
        ]
      }
    });
  }

  // ── TOGGLE / SELECT ──────────────────────────────────────────────────────────
  toggleNode(node: MindNode) {
    const sameNode = this.selectedNode?.id === node.id;
    if (!sameNode) {
      void this.selectNode(node);
      if (node.children.length > 0) node.expanded = true;
    } else if (node.children.length > 0) {
      node.expanded = !node.expanded;
    } else {
      void this.selectNode(node);
    }
  }

  async selectNode(node: MindNode) {
    this.selectedNode = node;
    if (this.hasUsableDefinition(node)) return;

    const hasFileSource = !!this.fileContent?.trim();
    const hasYoutubeSource = !!this.youtubeVideoUrl;
    if (!hasFileSource && !hasYoutubeSource) {
      node.definition = this.makeLocalNodeDefinition(node);
      return;
    }

    const requestId = ++this.definitionRequestId;
    this.loadingDefinition = true;

    const root = this.rootNode?.label || 'this subject';
    const section = this.getNodeSourceSection(node);
    const hasTable = section.includes('[TABLE_START]');
    const hasSlide = section.includes('[SLIDE');
    const cleanSection = section
      .replace(/\[TABLE_START\]/g, '\n[TABLE]\n')
      .replace(/\[TABLE_END\]/g, '\n[/TABLE]\n')
      .slice(0, 5000);

    const visualNote = (hasTable || hasSlide)
      ? `\n\nThis content includes ${hasTable ? 'a table/chart ([TABLE]...[/TABLE])' : ''}${hasSlide ? ' slide content' : ''}. Present any table data as a markdown pipe table:\n| Header 1 | Header 2 |\n|----------|----------|\n| Value    | Value    |`
      : '';

    const ctx = cleanSection ? `\n\nSource content:\n${cleanSection}` : '';

    try {
      if (hasYoutubeSource && !cleanSection.trim()) {
        const videoId = this.yt.getVideoId(this.youtubeVideoUrl) || '';
        const context = videoId ? await this.yt.getFullVideoContext(videoId).toPromise() as string : '';
        if (requestId !== this.definitionRequestId) return;

        const defPrompt = `Based on this YouTube video data, write a detailed explanation for "${node.label}".

VIDEO DATA:
${context || 'Video: ' + this.youtubeVideoUrl}

Write 3 paragraphs:
1. What "${node.label}" is, based on the video context
2. Key details, steps, or characteristics from the video
3. Why it matters or a specific example from the video

Only use information from the video data above.`;
        const res: any = await this.ai.generateWithGroq(defPrompt).toPromise();
        if (requestId !== this.definitionRequestId) return;
        const text = this.extractTextFromResponse(res);
        node.definition = text && !this.ai.isDemoFallback(text)
          ? text
          : this.makeLocalNodeDefinition(node);
        return;
      }

      if (!ctx.trim()) {
        node.definition = this.makeLocalNodeDefinition(node);
        return;
      }

      const prompt = `You are an expert in "${root}". Write a clear, accurate explanation for "${node.label}" based strictly on the source content below.${visualNote}

Paragraph 1 — What it is: Define "${node.label}" precisely using the source content.
Paragraph 2 — Key details: Explain the mechanism, data, or key characteristics.
Paragraph 3 — Significance/Example: Explain why it matters or give a concrete example from the content.${ctx}

Rules: Based ONLY on source content. Use markdown pipe table for any tabular data. Plain paragraphs otherwise.`;

      const res: any = await this.ai.generateWithGroq(prompt).toPromise();
      if (requestId !== this.definitionRequestId) return;
      const text = this.extractTextFromResponse(res);
      node.definition = text && !this.ai.isDemoFallback(text)
        ? text
        : this.makeLocalNodeDefinition(node);
    } catch {
      if (requestId !== this.definitionRequestId) return;
      node.definition = this.makeLocalNodeDefinition(node);
    } finally {
      if (requestId === this.definitionRequestId) {
        this.loadingDefinition = false;
      }
    }
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
   *  Handles: ```json fences, bare JSON, JSON with trailing text, incomplete JSON. */
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
    let foundEnd = false;
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
          foundEnd = true;
          break;
        }
      }
    }
    
    // 3. Try to fix incomplete JSON by finding all {...} patterns
    if (!foundEnd) {
      const allMatches = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (allMatches) {
        for (const match of allMatches) {
          try { JSON.parse(match); return match; } catch {}
        }
      }
    }

    // 4. Last resort — try the whole text trimmed
    const trimmed = text.trim();
    try { JSON.parse(trimmed); return trimmed; } catch {}

    return null;
  }

  parseRoot(text: string) {
    try {
      const json = this.extractJson(text);
      if (!json) {
        this.errorMsg = 'Could not parse response. Please try again.';
        return;
      }
      const data = JSON.parse(json);
      const rawNode = data.root ?? data;
      if (!rawNode || typeof rawNode !== 'object' || !rawNode.label) {
        this.errorMsg = 'Could not parse response. Please try again.';
        return;
      }
      this.rootNode = this.sanitizeMindTree(this.initNode(rawNode, 0));
      this.rootNode.expanded = true;
    } catch {
      this.errorMsg = 'Could not parse response. Please try again.';
    }
  }

  private initNode(raw: any, colorIdx: number): MindNode {
    return this.initNodeWithColor(raw, raw.level === 0 ? '#38bdf8' : this.COLORS[colorIdx % this.COLORS.length], 'root');
  }

  /** Comprehensive markdown cleaning for labels and definitions */
  private cleanMarkdown(text: string): string {
    return (text || '')
      // Remove markdown headers (#### heading → heading)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers (handle all variations, greedy)
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      // Remove list item bullets and asterisks at start of lines
      .replace(/^\s*[-*+]\s+/gm, '')
      // Remove remaining emphasis asterisks/underscores (non-greedy)
      .replace(/[*_]([^*_]+)[*_]/g, '$1')
      // Remove code blocks and inline code
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove strikethrough
      .replace(/~~(.+?)~~/g, '$1')
      // Remove HTML tags if any
      .replace(/<[^>]+>/g, '')
      // Clean up multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Trim
      .trim();
  }

  private cleanNodeLabel(text: string): string {
    const cleaned = this.cleanMarkdown(text)
      .replace(/^[\s"'`([{]*((\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]|\d+(?:\.\d+)+\.?|\d+\s+|[-*+•·∙◦▪➔➜])\s*/g, '')
      .replace(/^[\s"'`([{]*((\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]|\d+(?:\.\d+)+\.?|\d+\s+|[-*+•·∙◦▪➔➜])\s*/g, '')
      .replace(/^\s*[:.)-]+\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return cleaned || 'Untitled';
  }

  private initNodeWithColor(raw: any, color: string, parentId = '', orderPath = ''): MindNode {
    const cleanLabel = this.cleanNodeLabel(raw.label || '');
    const cleanDef = this.cleanMarkdown(raw.definition || '');
    const node: MindNode = {
      id: `${parentId}_${cleanLabel.replace(/\s+/g, '_').slice(0, 20)}_${Math.random().toString(36).slice(2, 6)}`,
      label: cleanLabel,
      level: raw.level ?? 0,
      orderPath,
      definition: cleanDef,
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
            node.id,
            orderPath ? `${orderPath}.${i + 1}` : `${i + 1}`
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
  private sanitizeMindTree(root: MindNode): MindNode {
    const sanitizeNode = (node: MindNode, ancestors: Set<string>): MindNode => {
      const currentKey = this.normalizeNodeKey(node.label);
      const nextAncestors = new Set(ancestors);
      if (currentKey) nextAncestors.add(currentKey);

      const merged = new Map<string, MindNode>();
      const ordered: MindNode[] = [];

      for (const rawChild of node.children || []) {
        const child = sanitizeNode(rawChild, nextAncestors);
        const childKey = this.normalizeNodeKey(child.label);
        if (!childKey) continue;

        if (childKey === currentKey || ancestors.has(childKey)) {
          for (const grandChild of child.children || []) {
            const grandKey = this.normalizeNodeKey(grandChild.label);
            if (!grandKey || grandKey === currentKey || ancestors.has(grandKey)) continue;
            const existingGrand = merged.get(grandKey);
            if (existingGrand) this.mergeMindNodes(existingGrand, grandChild);
            else {
              merged.set(grandKey, grandChild);
              ordered.push(grandChild);
            }
          }
          continue;
        }

        const existing = merged.get(childKey);
        if (existing) this.mergeMindNodes(existing, child);
        else {
          merged.set(childKey, child);
          ordered.push(child);
        }
      }

      node.children = ordered;
      return node;
    };

    const sanitized = sanitizeNode(root, new Set<string>());
    this.refreshNodeMeta(sanitized, 0, '', '#38bdf8');
    return sanitized;
  }

  private mergeMindNodes(target: MindNode, source: MindNode) {
    if (!target.definition && source.definition) target.definition = source.definition;
    for (const child of source.children || []) {
      const key = this.normalizeNodeKey(child.label);
      if (!key) continue;
      const existing = target.children.find(c => this.normalizeNodeKey(c.label) === key);
      if (existing) this.mergeMindNodes(existing, child);
      else target.children.push(child);
    }
  }

  private refreshNodeMeta(node: MindNode, level: number, orderPath: string, color: string) {
    node.level = level;
    node.orderPath = orderPath;
    node.color = color;
    node.children.forEach((child, i) => {
      const childOrder = orderPath ? `${orderPath}.${i + 1}` : `${i + 1}`;
      const childColor = level === 0 ? this.COLORS[i % this.COLORS.length] : color;
      this.refreshNodeMeta(child, level + 1, childOrder, childColor);
    });
  }

  private normalizeNodeKey(label: string): string {
    return this.cleanNodeLabel(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

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
        // Parse table: extract ALL rows (header + data) without filtering
        const rows = tableLines
          .map(l => l.split('|')
            .map(c => this.renderMarkdown(c.trim()))
            .filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''))
          )
          // Keep ALL valid rows - only filter separator rows (------)
          .filter(r => r.length > 0 && !r.every(c => /^[-:=_\s]+$/.test(c)));
        
        // Only push if we have at least header + 1 data row
        if (rows.length >= 2) {
          flushPara();
          blocks.push({ type: 'table', content: '', rows });
        } else {
          // Not enough rows for a table - treat as paragraph
          paraLines.push(...tableLines);
        }
      } else {
        // Less than 2 lines - treat as paragraph
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
    return this.cleanMarkdown(text)
      // Also handle links [text](url) → text and ![alt](url) → [image]
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '[image]')
      // Clean up multiple newlines
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
    const date = new Date().toLocaleDateString();
    const exists = this.savedMaps.findIndex(m => m.title === title);
    if (exists !== -1) this.savedMaps.splice(exists, 1);
    this.savedMaps.unshift({
      title,
      data: JSON.parse(JSON.stringify(this.rootNode)),
      date,
      ...(this.currentVideoMeta ? { videoMeta: this.currentVideoMeta } : {})
    } as any);
    localStorage.setItem('mindmaps', JSON.stringify(this.savedMaps.slice(0, 20)));
    this.progress = `✓ Saved: "${title}"`;
    setTimeout(() => this.progress = '', 2000);
  }

  downloadPDF() {
    // Only export the currently selected node, or root if nothing selected
    const nodeToExport = this.selectedNode || this.rootNode;
    if (!nodeToExport) return;

    const lines: PdfLine[] = [];

    const renderNode = (node: MindNode, depth: number) => {
      // Render node label based on depth - NO BULLETS, only headings and paragraphs
      if (depth === 0) {
        lines.push({ type: 'heading', text: node.label });
      } else if (depth === 1) {
        lines.push({ type: 'subheading', text: node.label });
      } else {
        // Use subheading for all nested levels instead of bullets
        lines.push({ type: 'subheading', text: node.label });
      }

      // Add COMPLETE definition content including all block types
      if (node.definition && node.definition.trim().length > 0) {
        const defBlocks = this.parseDefinition(node.definition);
        for (const block of defBlocks) {
          if (block.type === 'para') {
            lines.push({ type: 'para', text: block.content });
          } else if (block.type === 'heading') {
            lines.push({ type: 'subheading', text: block.content });
          } else if (block.type === 'list' && block.items) {
            // Convert list items to paragraphs instead of bullets
            block.items.forEach(item => {
              lines.push({ type: 'para', text: item });
            });
          } else if (block.type === 'table' && block.rows && block.rows.length >= 2) {
            // Export COMPLETE table with ALL rows (no truncation)
            lines.push({ type: 'table', rows: block.rows });
          } else if (block.type === 'code') {
            lines.push({ type: 'code', text: block.content, label: 'code' });
          } else if (block.type === 'divider') {
            lines.push({ type: 'divider' });
          }
        }
      }

      // Recursively render ALL children (ensure no branches are skipped)
      if (node.children && node.children.length > 0) {
        node.children.forEach(c => renderNode(c, depth + 1));
      }
    };

    // Render selected node or root (starting depth 0 for the main node being exported)
    renderNode(nodeToExport, 0);

    // Generate filename based on selected node
    const nodeLabel = nodeToExport.label.replace(/\s+/g, '-').toLowerCase();
    const subtitle = this.currentVideoMeta?.title
      ? `${nodeLabel} · ${this.currentVideoMeta.channel || 'YouTube'}`
      : `${nodeLabel} · ${new Date().toLocaleDateString()}`;
    
    this.pdf.save(
      `${nodeLabel}.pdf`,
      nodeToExport.label,
      subtitle,
      lines,
      { template: 'study' }
    );
  }

  loadSaved(map: any) {
    try {
      this.rootNode = this.hydrateSavedRoot(map.data);
      this.showSaved = false;
      this.selectedNode = null;
      this.errorMsg = '';
      this.sourceContent = '';
      this.fileContent = '';
      this.youtubeVideoUrl = '';
      this.currentVideoMeta = map.videoMeta || null;
      this.progress = `✓ Loaded: "${map.title}"`;
      setTimeout(() => this.progress = '', 2000);
    } catch {
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
        this.sourceContent = context || videoMeta.description || '';
      }
    } catch {
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
      } catch {
        // oEmbed fallback failed, continue without title
      }
    }

    if (!videoMeta?.title) {
      this.errorMsg = 'Could not fetch video info. Please check the URL and try again.';
      return;
    }

    this.progress = 'Building mind map...';

    const prompt = context && context.trim().length > 50
      ? `You are an expert Visual Knowledge Architect, Mind Mapping Specialist, and Learning Designer.

Build a highly detailed, professionally structured mind map using the YouTube video data below.

STRUCTURE RULES:
1. Root label = exact VIDEO TITLE from the data
2. If CHAPTERS exist → each chapter = one level-1 branch, with subtopics from that chapter's content
3. If no chapters → create 8-10 branches from the TAGS, DESCRIPTION, and video topic
4. Under each branch: 4-6 secondary branches, 2-3 tertiary branches where needed
5. All content must come ONLY from the video data — no external knowledge

NODE RULES:
- Labels: 2-4 words max, concise keywords only — NO numbering, NO bullets
- Definitions: 3-5 sentences — what it covers, key points, why it matters with a specific example from the video
- Maintain strict parent → child hierarchy: children are sub-topics of their parent
- Group related sub-concepts under the same parent

--- VIDEO DATA ---
${context}
--- END ---

Return ONLY valid JSON (no markdown, no code fences):
{
  "root": {
    "id": "root",
    "label": "<exact video title>",
    "level": 0,
    "definition": "3-5 sentences covering what this video is about, who it is for, and what the viewer will learn.",
    "children": [
      {
        "id": "b1",
        "label": "<chapter or topic from video>",
        "level": 1,
        "definition": "3-5 sentences about this section of the video.",
        "children": [
          {
            "id": "b1a",
            "label": "<subtopic>",
            "level": 2,
            "definition": "3-5 sentences about this subtopic.",
            "children": [
              { "id": "b1a1", "label": "<specific detail>", "level": 3, "definition": "3-5 sentences.", "children": [] }
            ]
          }
        ]
      }
    ]
  }
}`
      : `You are an expert Visual Knowledge Architect, Mind Mapping Specialist, and Learning Designer.

Create a highly detailed, professionally structured mind map for this YouTube video.

VIDEO TITLE: "${videoMeta!.title}"
${videoMeta!.channel ? `CHANNEL: ${videoMeta!.channel}` : ''}
${videoMeta!.tags?.length ? `TAGS: ${videoMeta!.tags.slice(0, 12).join(', ')}` : ''}
VIDEO URL: ${this.youtubeVideoUrl}

STRUCTURE RULES:
1. Root label = exactly: "${videoMeta!.title}"
2. Create 8-10 primary branches covering ALL major dimensions of this video's subject
3. Under each branch: 4-6 secondary branches, 2-3 tertiary where relevant
4. Cover: Core Concepts, Key Components, Processes, Tools, Examples, Benefits, Challenges, Best Practices, Real-world Applications, Future Trends (pick most relevant for this topic)

NODE RULES:
- Labels: 2-4 words, precise domain terminology — NO numbering, NO bullets
- Definitions: 3-5 complete sentences — what it is, how it works, why it matters, real example
- Strict parent → child hierarchy
- Group related concepts together

Return ONLY valid JSON (no markdown, no code fences):
{
  "root": {
    "id": "root",
    "label": "${videoMeta!.title}",
    "level": 0,
    "definition": "3-5 sentences about what this video topic covers, its purpose, and key takeaways.",
    "children": [
      {
        "id": "b1",
        "label": "Core Concepts",
        "level": 1,
        "definition": "3-5 sentences about foundational concepts in this topic.",
        "children": [
          {
            "id": "b1a",
            "label": "Specific Concept",
            "level": 2,
            "definition": "3-5 sentences about this concept.",
            "children": [
              { "id": "b1a1", "label": "Detail Point", "level": 3, "definition": "3-5 sentences.", "children": [] }
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
      if (context) this.sourceContent = context;
      if (!this.rootNode || this.errorMsg) {
        this.buildLocalYoutubeMindMap(videoMeta, context);
      }
    } catch {
      if (this.errorMsg) return;
      this.buildLocalYoutubeMindMap(videoMeta, context);
    }
  }

  private buildLocalYoutubeMindMap(videoMeta: VideoMeta, context: string) {
    const title = videoMeta.title || 'YouTube Video';
    const chapterText = videoMeta.chapters.map(c => `${c.title}. ${c.time}`).join('\n');
    const tagText = videoMeta.tags.join('\n');
    const source = [context, videoMeta.description, chapterText, tagText].filter(Boolean).join('\n\n');
    this.sourceContent = source;
    const sectionSeed = videoMeta.chapters.length
      ? videoMeta.chapters.map(c => ({ title: c.title, body: source }))
      : this.extractLocalSections(source || title, title);

    const root = {
      id: 'root',
      label: title,
      level: 0,
      definition: [
        videoMeta.channel ? `This video is from ${videoMeta.channel}.` : '',
        videoMeta.description ? videoMeta.description.slice(0, 350) : `This mind map is built from the available metadata for "${title}".`
      ].filter(Boolean).join(' '),
      children: sectionSeed.slice(0, 7).map((section, i) =>
        this.buildLocalBranch(section.title, section.body || source || title, 1, i)
      )
    };

    this.rootNode = this.initNode(root, 0);
    this.rootNode.expanded = true;
    this.errorMsg = '';
    this.progress = 'Built YouTube mind map from available video metadata.';
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
