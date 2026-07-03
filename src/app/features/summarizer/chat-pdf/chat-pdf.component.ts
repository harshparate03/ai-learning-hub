import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as pdfjsLib from 'pdfjs-dist';
import { AiService, GroqChatMessage } from '../../../core/services/ai.service';
import { PdfService, PdfLine } from '../../../core/services/pdf.service';
import { jsPDF } from 'jspdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

import { AiSparkComponent } from '../../../shared/ai-spark/ai-spark.component';

@Component({
  selector: 'app-chat-pdf',
  standalone: true,
  imports: [CommonModule, FormsModule, AiSparkComponent],
  templateUrl: './chat-pdf.component.html',
  styleUrls: ['./chat-pdf.component.css']
})
export class ChatPdfComponent implements OnInit {

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  pdfText   = '';
  fileName  = '';
  question  = '';
  loading   = false; // AI is responding
  uploading = false; // PDF is being read
  savedMsg = '';

  messages: { role: 'user' | 'ai'; text: string; typing?: boolean }[] = [];

  constructor(private aiService: AiService, private pdf: PdfService) {}

  ngOnInit() {
    const pending = localStorage.getItem('chat_history_load');
    if (!pending) return;
    try {
      const saved = JSON.parse(pending);
      this.fileName = saved.title?.replace(/^Chat:\s*/i, '') || 'Saved Chat';
      const messages = saved.messages as { role: string; text: string }[] | undefined;
      if (messages?.length) {
        this.messages = messages.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'ai' as const,
          text: m.text
        }));
        this.pdfText = 'Restored from history. Re-upload the PDF to ask new questions.';
      } else if (saved.content) {
        this.messages = String(saved.content).split('\n').reduce((acc, line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('Q:')) {
            acc.push({ role: 'user' as const, text: trimmed.replace(/^Q:\s*/, '') });
          } else if (trimmed.startsWith('A:')) {
            acc.push({ role: 'ai' as const, text: trimmed.replace(/^A:\s*/, '') });
          }
          return acc;
        }, [] as { role: 'user' | 'ai'; text: string }[]);
        this.pdfText = 'Restored from history. Re-upload the PDF to ask new questions.';
      }
    } catch (e) {
      console.error('[Chat History Load Error]', e);
    }
    localStorage.removeItem('chat_history_load');
  }

  /** Upload and parse PDF */
  async onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.messages.push({ role: 'ai', text: 'Please upload a valid PDF file.' });
      this.scrollToBottom();
      return;
    }

    // Validate file size (50 MB max)
    if (file.size > 50 * 1024 * 1024) {
      this.messages.push({ role: 'ai', text: 'File is too large. Please upload a PDF under 50 MB.' });
      this.scrollToBottom();
      return;
    }

    this.uploading = true;
    this.fileName  = file.name;
    this.pdfText   = '';
    this.messages  = [];

    try {
      const buf = await file.arrayBuffer();

      // Validate PDF magic bytes (%PDF)
      const header = new Uint8Array(buf.slice(0, 5));
      const magic = String.fromCharCode(...header);
      if (!magic.startsWith('%PDF')) {
        throw new Error('Not a valid PDF file — missing PDF header.');
      }

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        useWorkerFetch: false,
        isEvalSupported: false
      }).promise;

      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + ' ';
      }
      this.pdfText = text.trim();

      if (!this.pdfText) {
        this.messages.push({
          role: 'ai',
          text: `"${file.name}" loaded (${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}), but no text was extracted. This PDF may be image-based (scanned). Try a text-based PDF.`
        });
      } else {
        this.messages.push({
          role: 'ai',
          text: `"${file.name}" loaded (${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}). Ask me anything about it.`
        });
      }
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('password') || msg.includes('encrypted')) {
        this.messages.push({ role: 'ai', text: 'This PDF is password-protected. Please upload an unlocked PDF.' });
      } else if (msg.includes('Not a valid PDF')) {
        this.messages.push({ role: 'ai', text: msg });
      } else {
        console.error('[PDF Error]', e);
        this.messages.push({ role: 'ai', text: 'Could not read the PDF. Please ensure it is a valid, non-encrypted PDF file and try again.' });
      }
    }

    this.uploading = false;
    this.scrollToBottom();
  }

  /** Enter key handler — send on Enter, newline on Shift+Enter */
  onChatEnter(event: Event) {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      event.preventDefault();
      if (this.pdfText && this.question.trim() && !this.loading) {
        this.askQuestion();
      }
    }
  }

  /** Convert markdown to rich HTML — handles headings, bullets, numbered lists,
   *  tables, code fences, inline code, bold, italic, horizontal rules. */
  renderMarkdown(text: string): string {
    if (!text) return '';

    const lines = text.split('\n');
    const out: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trimEnd();

      // ── Fenced code block ```
      if (line.trimStart().startsWith('```')) {
        const lang = line.replace(/^\s*```/, '').trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
          codeLines.push(
            lines[i].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          );
          i++;
        }
        const langLabel = lang ? `<span class="md-code-lang">${lang}</span>` : '';
        out.push(`<div class="md-code-block">${langLabel}<pre class="md-pre"><code>${codeLines.join('\n')}</code></pre></div>`);
        i++; continue;
      }

      // ── Markdown table  | col | col |
      if (line.includes('|') && line.trim().startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        // Filter out separator rows  |---|---|
        const rows = tableLines
          .filter(l => !l.trim().replace(/[|:\-\s]/g, '').length === false)
          .map(l =>
            l.trim()
             .replace(/^\|/, '').replace(/\|$/, '')
             .split('|')
             .map(c => this.inlineFormat(c.trim()))
          )
          .filter(r => !r.every(c => /^[-:\s]+$/.test(c)));

        if (rows.length >= 2) {
          const head = rows[0].map(c => `<th>${c}</th>`).join('');
          const body = rows.slice(1).map(r =>
            `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`
          ).join('');
          out.push(`<div class="md-table-wrap"><table class="md-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
        }
        continue;
      }

      // ── Headings
      const h3 = line.match(/^###\s+(.+)/);
      const h2 = line.match(/^##\s+(.+)/);
      const h1 = line.match(/^#\s+(.+)/);
      if (h3) { out.push(`<h4 class="md-h4">${this.inlineFormat(h3[1])}</h4>`); i++; continue; }
      if (h2) { out.push(`<h3 class="md-h3">${this.inlineFormat(h2[1])}</h3>`); i++; continue; }
      if (h1) { out.push(`<h2 class="md-h2">${this.inlineFormat(h1[1])}</h2>`); i++; continue; }

      // ── Horizontal rule
      if (/^[-*_]{3,}\s*$/.test(line.trim())) {
        out.push('<hr class="md-hr">'); i++; continue;
      }

      // ── Unordered list
      if (/^[\s]*[-*+]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[\s]*[-*+]\s+/.test(lines[i])) {
          items.push(`<li>${this.inlineFormat(lines[i].replace(/^[\s]*[-*+]\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ul class="md-ul">${items.join('')}</ul>`);
        continue;
      }

      // ── Ordered list
      if (/^[\s]*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
          items.push(`<li>${this.inlineFormat(lines[i].replace(/^[\s]*\d+\.\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ol class="md-ol">${items.join('')}</ol>`);
        continue;
      }

      // ── Empty line — paragraph break
      if (!line.trim()) { i++; continue; }

      // ── Regular paragraph — collect consecutive non-special lines
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trimStart().startsWith('#') &&
        !lines[i].trimStart().startsWith('```') &&
        !lines[i].trimStart().startsWith('|') &&
        !/^[-*+]\s+/.test(lines[i]) &&
        !/^\d+\.\s+/.test(lines[i]) &&
        !/^[-*_]{3,}\s*$/.test(lines[i].trim())
      ) {
        paraLines.push(this.inlineFormat(lines[i].trimEnd()));
        i++;
      }
      if (paraLines.length) {
        out.push(`<p class="md-p">${paraLines.join('<br>')}</p>`);
      }
    }

    return out.join('\n');
  }

  /** Apply inline formatting: bold, italic, inline-code, links */
  private inlineFormat(text: string): string {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  }

  /** Ask a question about the loaded PDF */
  askQuestion() {
    if (!this.pdfText || !this.question.trim() || this.loading) return;

    const q = this.question.trim();
    this.question = '';

    this.messages.push({ role: 'user', text: q });

    // Show typing indicator
    this.loading = true;
    this.messages.push({ role: 'ai', text: '', typing: true });
    this.scrollToBottom();

    // Keep last 4 non-typing messages for history, strip HTML tags
    const history: GroqChatMessage[] = this.messages
      .filter(m => !m.typing && m.text.trim() && !m.text.startsWith('⚠️'))
      .slice(-4)
      .map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text.replace(/<[^>]*>/g, '').slice(0, 800)
      }));

    // Safe PDF context — 10k chars keeps total tokens well within all model limits
    const pdfContext = this.pdfText.slice(0, 10000);

    const systemPrompt = `You are a document assistant. Answer ONLY using the document below. If the answer is not in the document, say: "I couldn't find that in the document."

DOCUMENT:
${pdfContext}

Format answers with ## headings, bullet points, and \`\`\` code blocks where relevant.`;

    this.aiService.chatWithGroq([
      { role: 'system', content: systemPrompt },
      ...history
    ], { skipDefaultSystem: true }).subscribe({
      next: (answer: string) => {
        this.replaceTypingMessage(answer || 'Sorry, I could not generate a response.');
      },
      error: (err: any) => {
        this.replaceTypingMessage(`⚠️ ${this.aiService.proxyErrorMessage(err)}`);
      }
    });
  }

  private replaceTypingMessage(text: string) {
    let typingIdx = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].typing) { typingIdx = i; break; }
    }
    if (typingIdx !== -1) {
      this.messages[typingIdx] = { role: 'ai', text };
    } else {
      this.messages.push({ role: 'ai', text });
    }
    this.loading = false;
    this.scrollToBottom();
  }

  private stripMarkdownForPdf(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/g, '').replace(/```/g, '').trim())
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '- ')
      .replace(/\|/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private splitForPdf(text: string, maxChars = 900): string[] {
    const clean = this.stripMarkdownForPdf(text);
    if (clean.length <= maxChars) return [clean];

    const chunks: string[] = [];
    let remaining = clean;
    while (remaining.length > maxChars) {
      const slice = remaining.slice(0, maxChars);
      const breakAt = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf(' ')
      );
      const idx = breakAt > maxChars * 0.45 ? breakAt + (slice[breakAt] === '.' ? 1 : 0) : maxChars;
      chunks.push(remaining.slice(0, idx).trim());
      remaining = remaining.slice(idx).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  private scrollToBottom() {
    setTimeout(() => {
      try {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      } catch {}
    }, 60);
  }

  clearChat() {
    this.messages = [];
    this.pdfText  = '';
    this.fileName = '';
  }

  downloadPDF() {
    if (!this.messages.length) return;
    const lines: PdfLine[] = [];

    this.messages
      .filter(m => !m.typing && m.text.trim())
      .forEach(m => {
        this.splitForPdf(m.text).forEach((chunk, idx) => {
          lines.push({
            type: m.role === 'user' ? 'chat-user' : 'chat-ai',
            text: idx === 0 ? chunk : `(continued)\n${chunk}`
          });
        });
      });

    this.pdf.saveChat(
      `chat-${this.fileName.replace('.pdf', '') || 'document'}.pdf`,
      `AI Study Chat — ${this.fileName || 'Document'}`,
      `${this.messages.filter(m => m.role === 'user').length} questions · ${new Date().toLocaleDateString()}`,
      lines
    );
  }

  saveChat() {
    if (!this.messages.length || !this.fileName) return;
    const history = JSON.parse(localStorage.getItem('summarizer_history') || '[]');
    const cleanMessages = this.messages
      .filter(m => !m.typing)
      .map(m => ({ role: m.role, text: m.text.replace(/<[^>]*>/g, '') }));
    history.unshift({
      type: 'qa',
      title: `Chat: ${this.fileName}`,
      date: new Date().toLocaleDateString(),
      preview: cleanMessages.find(m => m.role === 'user')?.text?.slice(0, 100) || '',
      content: cleanMessages.map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.text}`).join('\n'),
      messages: cleanMessages
    });
    localStorage.setItem('summarizer_history', JSON.stringify(history.slice(0, 50)));
    this.savedMsg = '✓ Saved to History';
    setTimeout(() => this.savedMsg = '', 2000);
  }
}
