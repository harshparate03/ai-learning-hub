import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as pdfjsLib from 'pdfjs-dist';
import { AiService } from '../../../core/services/ai.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

import { AiSparkComponent } from '../../../shared/ai-spark/ai-spark.component';

@Component({
  selector: 'app-chat-pdf',
  standalone: true,
  imports: [CommonModule, FormsModule, AiSparkComponent],
  templateUrl: './chat-pdf.component.html',
  styleUrls: ['./chat-pdf.component.css']
})
export class ChatPdfComponent {

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  pdfText   = '';
  fileName  = '';
  question  = '';
  loading   = false; // AI is responding
  uploading = false; // PDF is being read

  messages: { role: 'user' | 'ai'; text: string; typing?: boolean }[] = [];

  constructor(private aiService: AiService) {}

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

    const prompt = `You are a helpful document assistant. Answer the question using ONLY the content from the document below.

FORMATTING RULES (strictly follow):
- Use ## for main section headings, ### for sub-headings
- Use **bold** for key terms and important values
- Use bullet points (- item) for lists of items, features, or facts
- Use numbered lists (1. item) for steps, procedures, or ranked content
- Use markdown tables (| Header | Header |) when the answer involves comparing items, showing data, figures, statistics, or structured information from the document
- Use fenced code blocks (\`\`\`language ... \`\`\`) for any code, formulas, or structured data
- Keep paragraphs short (2-3 sentences max)
- Separate sections with a blank line
- If the answer is not in the document, say exactly: "I couldn't find that in the document."

DOCUMENT CONTENT:
${this.pdfText.slice(0, 12000)}

QUESTION: ${q}

Answer clearly and completely using proper formatting. Use a table if the data suits one.`;


    this.aiService.generateWithGroq(prompt).subscribe({
      next: (res: any) => {
        const answer =
          res?.choices?.[0]?.message?.content ||
          res?.candidates?.[0]?.content?.parts?.[0]?.text ||
          'Sorry, I could not generate a response.';

        // Replace typing indicator with real answer
        let typingIdx = -1;
        for (let i = this.messages.length - 1; i >= 0; i--) {
          if (this.messages[i].typing) { typingIdx = i; break; }
        }
        if (typingIdx !== -1) {
          this.messages[typingIdx] = { role: 'ai', text: answer };
        } else {
          this.messages.push({ role: 'ai', text: answer });
        }
        this.loading = false;
        this.scrollToBottom();
      },
      error: () => {
        let typingIdx = -1;
        for (let i = this.messages.length - 1; i >= 0; i--) {
          if (this.messages[i].typing) { typingIdx = i; break; }
        }
        if (typingIdx !== -1) {
          this.messages[typingIdx] = { role: 'ai', text: 'AI request failed. Please try again.' };
        }
        this.loading = false;
        this.scrollToBottom();
      }
    });
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
}
