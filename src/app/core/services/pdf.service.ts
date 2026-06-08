import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { BRAND_LOGO_B64 } from './brand-logo-b64';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  indigo:     [99,  102, 241] as const,
  indigoDk:   [67,  56,  202] as const,
  purple:     [139, 92,  246] as const,
  purpleLt:   [167, 139, 250] as const,
  cyan:       [6,   182, 212] as const,
  green:      [16,  185, 129] as const,
  greenLt:    [52,  211, 153] as const,
  amber:      [251, 191, 36]  as const,
  red:        [248, 113, 113] as const,
  textH:      [14,  14,  24]  as const,
  textB:      [36,  36,  52]  as const,
  textM:      [106, 106, 128] as const,
  pageBg:     [250, 250, 255] as const,
  headerBg:   [243, 244, 255] as const,
  cardBg:     [246, 246, 254] as const,
  codeBg:     [13,  17,  23]  as const,
  codeHdr:    [22,  27,  34]  as const,
  codeText:   [165, 180, 252] as const,
  borderLt:   [220, 220, 238] as const,
  borderMd:   [190, 190, 220] as const,
  white:      [255, 255, 255] as const,
  indigoTint: [235, 237, 255] as const,
  greenTint:  [232, 252, 242] as const,
  purpleTint: [243, 240, 255] as const,
  chatUserBg: [99,  102, 241] as const,
  chatAiBg:   [241, 242, 255] as const,
};

type RGB = readonly [number, number, number];
const v = (c: RGB): [number, number, number] => [c[0], c[1], c[2]];

export interface PdfLine {
  type: 'heading' | 'subheading' | 'para' | 'bullet' |
        'definition' | 'code' | 'table' | 'divider' |
        'step' | 'kp' | 'qa-q' | 'qa-a' | 'chat-user' | 'chat-ai';
  text?: string;
  term?: string;
  def?: string;
  rows?: string[][];
  label?: string;
  state?: string;
  bulletStyle?: 'dot' | 'arrow' | 'star' | 'square' | 'hollow';
}

@Injectable({ providedIn: 'root' })
export class PdfService {

  private doc!: jsPDF;
  private y = 0;
  private pn = 1;
  private docTitle = '';
  private isChat = false;

  // A4 layout constants
  private readonly W   = 210;
  private readonly H   = 297;
  private readonly ML  = 15;
  private readonly MR  = 15;
  private readonly CW  = 180;
  private readonly BTM = 272;

  // ─── Public API ───────────────────────────────────────────────────────────

  save(filename: string, title: string, subtitle: string, lines: PdfLine[], options?: { template: 'chat' | 'study' }) {
    const isChat = options?.template === 'chat';
    this.build(title, subtitle, lines, isChat).save(filename);
  }

  saveChat(filename: string, title: string, subtitle: string, lines: PdfLine[]) {
    this.build(title, subtitle, lines, true).save(filename);
  }

  build(title: string, subtitle: string, lines: PdfLine[], chat = false): jsPDF {
    this.doc      = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.pn       = 1;
    this.docTitle = title;
    this.isChat   = chat;
    this.y        = 0;

    if (chat) this.drawChatCover(title, subtitle);
    else      this.drawStudyCover(title, subtitle);

    for (const ln of lines) this.renderLine(ln);

    const total = (this.doc as any).internal.pages.length - 1;
    for (let p = 1; p <= total; p++) {
      this.doc.setPage(p);
      this.drawFooter(p, total);
    }
    return this.doc;
  }

  // ─── STUDY PDF cover ─────────────────────────────────────────────────────

  private drawStudyCover(title: string, subtitle: string) {
    const d = this.doc;

    // Page background
    d.setFillColor(...v(C.pageBg));
    d.rect(0, 0, this.W, this.H, 'F');

    // Top gradient bar 7mm
    this.gradBar(0, 7);

    // Header band
    d.setFillColor(...v(C.headerBg));
    d.rect(0, 7, this.W, 22, 'F');

    // Brand image (no text — matches template)
    this.drawBrandLogo(this.ML, 11.5, 48, 8);

    // Date right
    d.setFont('helvetica', 'normal');
    d.setFontSize(8);
    d.setTextColor(...v(C.textM));
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    d.text(date, this.W - this.MR, 16.8, { align: 'right' });

    // Title block starts at y=38
    this.y = 38;
    d.setFont('helvetica', 'bold');
    d.setFontSize(20);
    d.setTextColor(...v(C.textH));
    const tls = d.splitTextToSize(this.clean(title), this.CW);
    tls.forEach((l: string) => { d.text(l, this.ML, this.y); this.y += 9; });

    // Subtitle
    if (subtitle) {
      this.y += 1;
      d.setFont('helvetica', 'normal');
      d.setFontSize(10);
      d.setTextColor(...v(C.textM));
      const sls = d.splitTextToSize(this.clean(subtitle), this.CW);
      sls.forEach((l: string) => { d.text(l, this.ML, this.y); this.y += 5.5; });
    }

    this.y += 3;

    // Accent divider: indigo block + purple block + thin line
    d.setFillColor(...v(C.indigo));  d.rect(this.ML, this.y, 28, 2, 'F');
    d.setFillColor(...v(C.purple));  d.rect(this.ML + 28, this.y, 10, 2, 'F');
    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.25);
    d.line(this.ML + 40, this.y + 1, this.W - this.MR, this.y + 1);

    this.y += 10;
  }

  // ─── CHAT PDF cover ───────────────────────────────────────────────────────

  private drawChatCover(title: string, subtitle: string) {
    const d = this.doc;

    // Dark navy bg for whole cover area
    d.setFillColor(20, 18, 54);
    d.rect(0, 0, this.W, this.H, 'F');

    // Gradient bar top
    this.gradBar(0, 5);

    // ── Header card ──
    d.setFillColor(30, 28, 70);
    d.roundedRect(this.ML, 10, this.CW, 26, 4, 4, 'F');
    d.setDrawColor(...v(C.indigo)); d.setLineWidth(0.3);
    d.roundedRect(this.ML, 10, this.CW, 26, 4, 4, 'S');

    // Brand image inside header card
    this.drawBrandLogo(this.ML + 4, 14, 52, 9);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...v(C.textM));
    d.text('AI Study Chat · Conversation Export', this.ML + 4, 28);

    // Date right
    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...v(C.textM));
    d.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), this.W - this.MR - 5, 27, { align: 'right' });

    // Title
    this.y = 48;
    d.setFont('helvetica', 'bold');
    d.setFontSize(18);
    d.setTextColor(...v(C.white));
    const tls = d.splitTextToSize(this.clean(title), this.CW);
    tls.forEach((l: string) => { d.text(l, this.ML, this.y); this.y += 8.5; });

    // Subtitle / meta
    if (subtitle) {
      this.y += 1;
      d.setFont('helvetica', 'normal');
      d.setFontSize(9.5);
      d.setTextColor(167, 139, 250);
      const sls = d.splitTextToSize(this.clean(subtitle), this.CW);
      sls.forEach((l: string) => { d.text(l, this.ML, this.y); this.y += 5.5; });
    }

    this.y += 4;

    // Accent rule
    d.setFillColor(...v(C.indigo));  d.roundedRect(this.ML, this.y, 30, 1.8, 0.9, 0.9, 'F');
    d.setFillColor(...v(C.purple));  d.roundedRect(this.ML + 32, this.y, 12, 1.8, 0.9, 0.9, 'F');
    d.setDrawColor(50, 45, 100); d.setLineWidth(0.25);
    d.line(this.ML + 47, this.y + 0.9, this.W - this.MR, this.y + 0.9);

    this.y += 12;

    // Reset to light background for content
    d.setFillColor(...v(C.pageBg));
    d.rect(0, this.y - 2, this.W, this.H, 'F');
    this.y += 2;
  }

  // ─── Continuation header ──────────────────────────────────────────────────

  private drawContinuationHeader() {
    const d = this.doc;

    d.setFillColor(...v(C.pageBg));
    d.rect(0, 0, this.W, this.H, 'F');

    // Thin gradient bar
    this.gradBar(0, 2.5);

    // Mini band
    d.setFillColor(...v(C.headerBg));
    d.rect(0, 2.5, this.W, 13, 'F');

    // Brand image left
    this.drawBrandLogo(this.ML, 5.5, 38, 6.5);

    // Doc title center
    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...v(C.textM));
    d.text(this.clean(this.docTitle).slice(0, 56), this.W / 2, 11, { align: 'center' });

    // Right label for chat
    if (this.isChat) {
      d.setFont('helvetica', 'bold');
      d.setFontSize(7);
      d.setTextColor(...v(C.purple));
      d.text('CHAT EXPORT', this.W - this.MR, 11, { align: 'right' });
    }

    // Rule
    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.25);
    d.line(this.ML, 15.5, this.W - this.MR, 15.5);

    this.y = 20;
  }

  // ─── Footer ───────────────────────────────────────────────────────────────

  private drawFooter(page: number, total: number) {
    const d  = this.doc;
    const fy = this.H - 7;

    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.25);
    d.line(this.ML, fy - 4, this.W - this.MR, fy - 4);

    // Left — brand image
    this.drawBrandLogo(this.ML, fy - 5.5, 34, 5.5);

    // Center — tagline
    d.setFont('helvetica', 'normal');
    d.setFontSize(7);
    d.setTextColor(...v(C.borderMd));
    d.text(
      this.isChat ? 'AI Study Chat Export' : 'Study Smarter · AI Export',
      this.W / 2, fy, { align: 'center' }
    );

    // Right — page number
    d.setFont('helvetica', 'bold');
    d.setFontSize(7.5);
    d.setTextColor(...v(C.textM));
    d.text(`Page ${page} / ${total}`, this.W - this.MR, fy, { align: 'right' });
  }

  // ─── Brand logo image (bg_remove_logo.jpeg) ───────────────────────────────

  private drawBrandLogo(x: number, y: number, w: number, h: number) {
    try {
      this.doc.addImage(BRAND_LOGO_B64, 'JPEG', x, y, w, h);
    } catch {
      // fallback: small indigo mark if image fails
      this.doc.setFillColor(...v(C.indigo));
      this.doc.roundedRect(x, y, h, h, 1.5, 1.5, 'F');
    }
  }

  // ─── Gradient bar helper ──────────────────────────────────────────────────

  private gradBar(y: number, h: number) {
    const d = this.doc;
    for (let i = 0; i < this.W; i++) {
      const t = i / this.W;
      d.setFillColor(
        Math.round(C.indigo[0] + (C.purple[0] - C.indigo[0]) * t),
        Math.round(C.indigo[1] + (C.purple[1] - C.indigo[1]) * t),
        Math.round(C.indigo[2] + (C.purple[2] - C.indigo[2]) * t)
      );
      d.rect(i, y, 1.1, h, 'F');
    }
  }

  // ─── Page overflow guard ──────────────────────────────────────────────────

  private need(mm: number) {
    if (this.y + mm > this.BTM) {
      this.doc.addPage();
      this.pn++;
      this.drawContinuationHeader();
    }
  }

  // ─── Dispatch ─────────────────────────────────────────────────────────────

  private renderLine(ln: PdfLine) {
    switch (ln.type) {
      case 'heading':    this.heading(ln.text!); break;
      case 'subheading': this.subheading(ln.text!); break;
      case 'para':       this.para(ln.text!); break;
      case 'bullet':     this.bullet(ln.text!, ln.bulletStyle); break;
      case 'definition': this.definition(ln.term!, ln.def!); break;
      case 'code':       this.code(ln.text!, ln.label); break;
      case 'table':      if (ln.rows?.length) this.table(ln.rows); break;
      case 'divider':    this.divider(); break;
      case 'step':       this.step(ln.label!, ln.state!); break;
      case 'kp':         this.keyPoint(ln.text!, ln.def!); break;
      case 'qa-q':       this.qaQ(ln.text!); break;
      case 'qa-a':       this.qaA(ln.text!); break;
      case 'chat-user':  this.chatUser(ln.text!); break;
      case 'chat-ai':    this.chatAI(ln.text!); break;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // CONTENT RENDERERS
  // ════════════════════════════════════════════════════════════════════════

  private heading(text: string) {
    const d  = this.doc;
    const ls = d.splitTextToSize(this.clean(text), this.CW - 14);
    const bh = Math.max(ls.length * 7 + 10, 16);
    this.need(bh + 6);

    // Card background
    d.setFillColor(...v(C.indigoTint));
    d.roundedRect(this.ML, this.y, this.CW, bh, 3, 3, 'F');

    // Left accent — indigo/purple split
    d.setFillColor(...v(C.indigo));
    d.roundedRect(this.ML, this.y, 4, bh * 0.55, 2, 2, 'F');
    d.setFillColor(...v(C.purple));
    d.roundedRect(this.ML, this.y + bh * 0.55, 4, bh * 0.45, 2, 2, 'F');

    d.setFont('helvetica', 'bold');
    d.setFontSize(13);
    d.setTextColor(...v(C.indigoDk));
    const ty = this.y + 7;
    ls.forEach((l: string, i: number) => d.text(l, this.ML + 9, ty + i * 7));
    this.y += bh + 6;
  }

  private subheading(text: string) {
    const d  = this.doc;
    const ls = d.splitTextToSize(this.clean(text), this.CW - 10);
    const sh = ls.length * 6.5 + 4;
    this.need(sh + 4);

    d.setFillColor(...v(C.purple));
    d.roundedRect(this.ML, this.y + 1, 3, sh - 2, 1, 1, 'F');

    d.setFont('helvetica', 'bold');
    d.setFontSize(11);
    d.setTextColor(...v(C.purple));
    ls.forEach((l: string, i: number) => {
      this.need(6.5);
      d.text(l, this.ML + 8, this.y + 6 + i * 6.5);
    });
    this.y += sh + 3;
  }

  private para(text: string) {
    const d  = this.doc;
    const ls = d.splitTextToSize(this.clean(text), this.CW);
    this.need(ls.length * 5.5 + 3);
    d.setFont('helvetica', 'normal');
    d.setFontSize(10);
    d.setTextColor(...v(C.textB));
    ls.forEach((l: string) => {
      this.need(5.5);
      d.text(l, this.ML, this.y);
      this.y += 5.5;
    });
    this.y += 2;
  }

  private bullet(text: string, style?: string) {
    const d    = this.doc;
    const ls   = d.splitTextToSize(this.clean(text), this.CW - 12);
    const lnH  = 5.6;
    this.need(ls.length * lnH + 4);

    const cx = this.ML + 3.2;
    const cy = this.y + 3.5;

    d.setDrawColor(...v(C.indigo));
    d.setLineWidth(0.5);

    switch (style) {
      case 'arrow':
        // Solid right-pointing triangle
        d.setFillColor(...v(C.indigo));
        d.triangle(cx - 2, cy - 2.2, cx - 2, cy + 2.2, cx + 2, cy, 'F');
        break;
      case 'star':
        // Outer purple filled circle with white inner dot
        d.setFillColor(...v(C.purple));
        d.circle(cx, cy, 2.3, 'F');
        d.setFillColor(...v(C.white));
        d.circle(cx, cy, 0.9, 'F');
        break;
      case 'square':
        // Solid indigo square
        d.setFillColor(...v(C.indigo));
        d.rect(cx - 1.8, cy - 1.8, 3.6, 3.6, 'F');
        break;
      case 'hollow':
        // Hollow circle outline
        d.setFillColor(...v(C.white));
        d.circle(cx, cy, 1.8, 'FD');
        d.setDrawColor(...v(C.indigo));
        d.circle(cx, cy, 1.8, 'S');
        break;
      default:
        // Solid filled circle
        d.setFillColor(...v(C.indigo));
        d.circle(cx, cy, 1.6, 'F');
    }

    d.setFont('helvetica', 'normal');
    d.setFontSize(10);
    d.setTextColor(...v(C.textB));
    ls.forEach((l: string, i: number) => {
      this.need(lnH);
      d.text(l, this.ML + 9, this.y + 4 + i * lnH);
    });
    this.y += ls.length * lnH + 1.5;
  }

  private definition(term: string, def: string) {
    const d   = this.doc;
    const dls = d.splitTextToSize(this.clean(def), this.CW - 16);
    const h   = dls.length * 5.2 + 18;
    this.need(h + 5);

    d.setFillColor(...v(C.white));
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'F');
    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.2);
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'S');
    d.setFillColor(...v(C.purple));
    d.roundedRect(this.ML, this.y, 4, h, 2, 2, 'F');

    d.setFont('helvetica', 'bold');
    d.setFontSize(9.5);
    d.setTextColor(...v(C.purple));
    d.text(this.clean(term), this.ML + 8, this.y + 8);

    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.2);
    d.line(this.ML + 6, this.y + 11, this.ML + this.CW - 6, this.y + 11);

    d.setFont('helvetica', 'normal');
    d.setFontSize(9.5);
    d.setTextColor(...v(C.textB));
    dls.forEach((l: string, i: number) => d.text(l, this.ML + 8, this.y + 16 + i * 5.2));
    this.y += h + 5;
  }

  private code(src: string, lang?: string) {
    const d     = this.doc;
    const lines = src.split('\n');
    const vis   = lines.slice(0, 28);
    const extra = lines.length - 28;
    const hasH  = !!(lang && lang !== 'code' && lang !== 'ascii');
    const boxH  = Math.min(vis.length * 4.8 + (hasH ? 12 : 7) + 4, 90);
    this.need(Math.min(boxH + 6, 55));

    const bx = this.ML, by = this.y;
    d.setFillColor(...v(C.codeBg));
    d.roundedRect(bx, by, this.CW, boxH, 3, 3, 'F');
    d.setDrawColor(48, 54, 61); d.setLineWidth(0.3);
    d.roundedRect(bx, by, this.CW, boxH, 3, 3, 'S');

    let ty = by;
    if (hasH) {
      d.setFillColor(...v(C.codeHdr));
      d.roundedRect(bx, by, this.CW, 9, 3, 3, 'F');
      d.rect(bx, by + 4, this.CW, 5, 'F');
      ([[6, C.red], [11, C.amber], [16, C.green]] as [number, RGB][]).forEach(([dx, col]) => {
        d.setFillColor(...v(col)); d.circle(bx + dx, by + 4.5, 1.5, 'F');
      });
      d.setFont('helvetica', 'bold'); d.setFontSize(7.5);
      d.setTextColor(...v(C.cyan));
      d.text((lang || '').toUpperCase(), bx + 24, by + 6.5);
      ty = by + 10;
    } else {
      ty = by + 6;
    }

    d.setFont('courier', 'normal'); d.setFontSize(8.2);
    d.setTextColor(...v(C.codeText));
    vis.forEach(l => {
      if (ty > by + boxH - 3) return;
      d.text(l.slice(0, 96), bx + 5, ty + 4);
      ty += 4.8;
    });
    if (extra > 0) {
      d.setFont('helvetica', 'italic'); d.setFontSize(7.5);
      d.setTextColor(...v(C.textM));
      d.text(`… and ${extra} more lines`, bx + 5, ty + 4);
    }
    this.y = by + boxH + 6;
  }

  private table(rows: string[][]) {
    const d    = this.doc;
    const cols = rows[0].length;
    const cw   = this.CW / cols;
    const rh   = 8;
    const tot  = rows.length * rh + 2;
    this.need(Math.min(tot + 6, 55));

    let sy = this.y;
    const sx = this.ML;

    d.setFillColor(...v(C.cardBg));
    d.roundedRect(sx, sy, this.CW, tot, 3, 3, 'F');
    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.25);
    d.roundedRect(sx, sy, this.CW, tot, 3, 3, 'S');

    rows.forEach((row, ri) => {
      const isH = ri === 0;
      if (isH) {
        d.setFillColor(...v(C.indigo));
        d.roundedRect(sx, sy, this.CW, rh, 3, 3, 'F');
        d.rect(sx, sy + 2, this.CW, rh - 2, 'F');
      } else {
        const e = ri % 2 === 0;
        d.setFillColor(e ? 250 : 244, e ? 250 : 247, e ? 255 : 254);
        d.rect(sx, sy, this.CW, rh, 'F');
      }
      d.setFont('helvetica', isH ? 'bold' : 'normal');
      d.setFontSize(isH ? 8.5 : 9);
      d.setTextColor(isH ? 255 : C.textB[0], isH ? 255 : C.textB[1], isH ? 255 : C.textB[2]);
      row.forEach((cell, ci) => {
        if (ci > 0) {
          d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.15);
          d.line(sx + ci * cw, sy, sx + ci * cw, sy + rh);
        }
        d.text(d.splitTextToSize(this.clean(cell), cw - 6)[0] || '', sx + ci * cw + 4, sy + 5.5);
      });
      if (ri < rows.length - 1) {
        d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.15);
        d.line(sx, sy + rh, sx + this.CW, sy + rh);
      }
      sy += rh;
    });
    this.y = sy + 6;
  }

  private divider() {
    this.need(10);
    const d  = this.doc;
    const cx = this.ML + this.CW / 2;
    const cy = this.y + 4;
    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.25);
    d.line(this.ML, cy, cx - 9, cy);
    d.line(cx + 9, cy, this.ML + this.CW, cy);
    d.setFillColor(...v(C.indigo));   d.circle(cx - 5, cy, 1.2, 'F');
    d.setFillColor(...v(C.purple));   d.circle(cx,     cy, 1.2, 'F');
    d.setFillColor(...v(C.indigo));   d.circle(cx + 5, cy, 1.2, 'F');
    this.y += 10;
  }

  private step(label: string, state: string) {
    const d  = this.doc;
    const sl = d.splitTextToSize(this.clean(state), this.CW - 20);
    const h  = sl.length * 5.2 + 16;
    this.need(h + 4);

    d.setFillColor(...v(C.cardBg));
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'F');
    d.setDrawColor(...v(C.borderLt)); d.setLineWidth(0.2);
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'S');

    d.setFillColor(...v(C.indigo));
    d.circle(this.ML + 7.5, this.y + 8, 5, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(9);
    d.setTextColor(...v(C.white));
    d.text('→', this.ML + 5.2, this.y + 9.5);

    d.setFont('helvetica', 'bold'); d.setFontSize(10.5);
    d.setTextColor(...v(C.indigoDk));
    d.text(this.clean(label), this.ML + 17, this.y + 8.5);

    d.setFont('helvetica', 'normal'); d.setFontSize(9.5);
    d.setTextColor(...v(C.textB));
    sl.forEach((l: string, i: number) => d.text(l, this.ML + 17, this.y + 14.5 + i * 5.2));
    this.y += h + 5;
  }

  private keyPoint(title: string, detail: string) {
    const d   = this.doc;
    const tls = d.splitTextToSize(this.clean(title), this.CW - 22);
    const dls = detail ? d.splitTextToSize(this.clean(detail), this.CW - 16) : [];
    const h   = tls.length * 6.5 + dls.length * 5.2 + 14;
    this.need(h + 5);

    d.setFillColor(...v(C.indigoTint));
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'F');
    d.setFillColor(...v(C.indigo));
    d.roundedRect(this.ML, this.y, 4, h, 2, 2, 'F');

    // Star badge
    d.setFillColor(...v(C.indigo));
    d.circle(this.ML + 13, this.y + 8, 4.5, 'F');
    d.setFillColor(...v(C.white));
    d.circle(this.ML + 13, this.y + 8, 1.6, 'F');

    d.setFont('helvetica', 'bold'); d.setFontSize(10.5);
    d.setTextColor(...v(C.textH));
    tls.forEach((l: string, i: number) => d.text(l, this.ML + 22, this.y + 8 + i * 6.5));

    if (detail) {
      const dy = this.y + tls.length * 6.5 + 11;
      d.setFont('helvetica', 'normal'); d.setFontSize(9.5);
      d.setTextColor(...v(C.textM));
      dls.forEach((l: string, i: number) => d.text(l, this.ML + 8, dy + i * 5.2));
    }
    this.y += h + 5;
  }

  private qaQ(text: string) {
    const d  = this.doc;
    const ls = d.splitTextToSize(this.clean(text), this.CW - 20);
    const h  = ls.length * 6.2 + 13;
    this.need(h + 4);

    d.setFillColor(...v(C.indigoTint));
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'F');
    d.setDrawColor(...v(C.indigo)); d.setLineWidth(0.28);
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'S');

    d.setFillColor(...v(C.indigo));
    d.roundedRect(this.ML + 4, this.y + 3.5, 13, 7.5, 2, 2, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(8.5);
    d.setTextColor(...v(C.white));
    d.text('Q', this.ML + 7.7, this.y + 8.8);

    d.setFont('helvetica', 'bold'); d.setFontSize(10);
    d.setTextColor(...v(C.textH));
    ls.forEach((l: string, i: number) => d.text(l, this.ML + 21, this.y + 8.5 + i * 6.2));
    this.y += h + 4;
  }

  private qaA(text: string) {
    const d  = this.doc;
    const ls = d.splitTextToSize(this.clean(text), this.CW - 12);
    const h  = ls.length * 5.4 + 16;
    this.need(Math.min(h + 8, 60));

    d.setFillColor(...v(C.greenTint));
    d.roundedRect(this.ML, this.y, this.CW, h, 3, 3, 'F');

    d.setFillColor(...v(C.green));
    d.roundedRect(this.ML + 4, this.y + 3.5, 22, 7.5, 2, 2, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(7.5);
    d.setTextColor(...v(C.white));
    d.text('Answer', this.ML + 6, this.y + 8.8);

    d.setDrawColor(...v(C.greenLt)); d.setLineWidth(0.7);
    d.line(this.ML + 4, this.y + 13, this.ML + 4, this.y + h - 3);

    d.setFont('helvetica', 'normal'); d.setFontSize(10);
    d.setTextColor(...v(C.textB));
    ls.forEach((l: string, i: number) => {
      if (14 + i * 5.4 < h - 2) d.text(l, this.ML + 10, this.y + 14 + i * 5.4);
    });
    this.y += h + 8;
  }

  // ─── Chat bubbles ─────────────────────────────────────────────────────────
  // Matches ai_chat_export_template.pdf: user RIGHT indigo, AI LEFT light

  private chatUser(text: string) {
    const d   = this.doc;
    const maxW = this.CW * 0.72;
    const ls   = d.splitTextToSize(this.clean(text), maxW - 18);
    const lnH  = 5.6;
    const h    = ls.length * lnH + 18;
    this.need(h + 8);

    const bx = this.ML + this.CW - maxW;
    const by = this.y;

    // Bubble — indigo fill
    d.setFillColor(...v(C.chatUserBg));
    d.roundedRect(bx, by, maxW, h, 6, 6, 'F');

    // Lighter right shimmer
    d.setFillColor(120, 123, 248);
    d.roundedRect(bx + maxW * 0.5, by, maxW * 0.5, h, 6, 6, 'F');

    // Tail — sharp bottom-right corner
    d.setFillColor(...v(C.chatUserBg));
    d.rect(bx + maxW - 6, by + h - 6, 6, 6, 'F');

    // YOU badge
    d.setFillColor(80, 82, 210);
    d.roundedRect(bx + 5, by + 4, 18, 5.5, 1.5, 1.5, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(6);
    d.setTextColor(220, 222, 255);
    d.text('YOU', bx + 7.5, by + 8.2);

    // Message
    d.setFont('helvetica', 'normal'); d.setFontSize(9.5);
    d.setTextColor(...v(C.white));
    ls.forEach((l: string, i: number) => d.text(l, bx + 6, by + 13.5 + i * lnH));

    this.y = by + h + 7;
  }

  private chatAI(text: string) {
    const d    = this.doc;
    const maxW = this.CW * 0.80;
    const ls   = d.splitTextToSize(this.clean(text), maxW - 18);
    const lnH  = 5.6;
    const h    = ls.length * lnH + 18;
    this.need(h + 8);

    const bx = this.ML;
    const by = this.y;

    // Bubble — light fill
    d.setFillColor(...v(C.chatAiBg));
    d.roundedRect(bx, by, maxW, h, 6, 6, 'F');

    // Left accent strip — indigo
    d.setFillColor(...v(C.indigo));
    d.roundedRect(bx, by, 4, h, 3, 3, 'F');

    // Border
    d.setDrawColor(...v(C.borderMd)); d.setLineWidth(0.22);
    d.roundedRect(bx, by, maxW, h, 6, 6, 'S');

    // Tail — sharp bottom-left
    d.setFillColor(...v(C.chatAiBg));
    d.rect(bx, by + h - 6, 6, 6, 'F');

    // AI badge
    d.setFillColor(...v(C.indigo));
    d.roundedRect(bx + 7, by + 4, 12, 5.5, 1.5, 1.5, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(6);
    d.setTextColor(...v(C.white));
    d.text('AI', bx + 10.5, by + 8.2);

    // Message
    d.setFont('helvetica', 'normal'); d.setFontSize(9.5);
    d.setTextColor(...v(C.textB));
    ls.forEach((l: string, i: number) => d.text(l, bx + 8, by + 13.5 + i * lnH));

    this.y = by + h + 7;
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  clean(text: string): string {
    return (text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{3}[\s\S]*?`{3}/g, '[code]')
      .replace(/`(.*?)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
