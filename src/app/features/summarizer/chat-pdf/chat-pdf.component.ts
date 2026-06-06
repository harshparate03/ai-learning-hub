import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as pdfjsLib from 'pdfjs-dist';
import { AiService } from '../../../core/services/ai.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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

    this.uploading = true;
    this.fileName  = file.name;
    this.pdfText   = '';
    this.messages  = [];

    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + ' ';
      }
      this.pdfText = text.trim();
      this.messages.push({
        role: 'ai',
        text: `"${file.name}" loaded (${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}). Ask me anything about it.`
      });
    } catch (e) {
      this.messages.push({ role: 'ai', text: 'Could not read the PDF. Please try a different file.' });
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

  /** Convert markdown text to safe HTML for display in the chat bubble */
  renderMarkdown(text: string): string {
    if (!text) return '';

    let html = text
      // Escape any raw HTML first for safety
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

      // Headings  ## Heading  →  <h3>
      .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
      .replace(/^## (.+)$/gm,  '<h3 class="md-h3">$1</h3>')
      .replace(/^# (.+)$/gm,   '<h2 class="md-h2">$1</h2>')

      // Bold + italic  ***text***
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // Bold  **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic  *text*  or  _text_
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')

      // Inline code  `code`
      .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')

      // Horizontal rule  ---
      .replace(/^---+$/gm, '<hr class="md-hr">')

      // Unordered list items  * item  or  - item
      .replace(/^[\*\-\+] (.+)$/gm, '<li>$1</li>')

      // Numbered list items  1. item
      .replace(/^\d+\. (.+)$/gm, '<li class="md-ol-item">$1</li>');

    // Wrap consecutive <li> into <ul> or <ol>
    html = html
      .replace(/((<li>(?!class)[^]*?<\/li>\n?)+)/g, (match) => {
        if (match.includes('class="md-ol-item"')) {
          return '<ol class="md-ol">' + match.replace(/ class="md-ol-item"/g, '') + '</ol>';
        }
        return '<ul class="md-ul">' + match + '</ul>';
      });

    // Paragraphs — wrap double-newline separated blocks
    // (only non-block elements)
    const blocks = html.split(/\n{2,}/);
    html = blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Already a block element — don't wrap
      if (/^<(h[2-4]|ul|ol|hr|pre|div|blockquote)/.test(trimmed)) return trimmed;
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
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

FORMATTING RULES (always follow):
- Use ## for main section headings
- Use **bold** for key terms and important phrases
- Use bullet points (- item) for lists of items
- Use numbered lists (1. item) for steps or ordered content
- Keep paragraphs short (2-3 sentences max)
- Separate sections with a blank line
- If the answer is not in the document, say "I couldn't find that in the document."

DOCUMENT CONTENT:
${this.pdfText.slice(0, 12000)}

QUESTION: ${q}

Give a well-structured, easy-to-read answer using the formatting rules above.`;

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
