import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PdfLine, PdfService } from '../../../core/services/pdf.service';

interface HistoryItem {
  id: string;
  type: 'mindmap' | 'summary' | 'qa' | 'notes';
  title: string;
  date: string;
  preview: string;
  data?: any;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit {

  activeTab: 'all' | 'mindmap' | 'summary' | 'qa' = 'all';
  items: HistoryItem[] = [];
  confirmDeleteId: string | null = null;
  exportingId: string | null = null;

  constructor(private router: Router, private pdf: PdfService) {}

  ngOnInit() {
    this.loadHistory();
  }

  loadHistory() {
    const all: HistoryItem[] = [];

    const maps = JSON.parse(localStorage.getItem('mindmaps') || '[]');
    maps.forEach((m: any) => {
      all.push({
        id: `mindmap_${m.title}_${m.date}`,
        type: 'mindmap',
        title: m.title,
        date: m.date,
        preview: `${m.data?.children?.length || 0} branches · ${this.countNodes(m.data)} nodes`,
        data: m
      });
    });

    const summaries = JSON.parse(localStorage.getItem('summarizer_history') || '[]');
    summaries.forEach((s: any) => {
      all.push({
        id: `summary_${s.title}_${s.date}`,
        type: s.type || 'summary',
        title: s.title || 'Untitled',
        date: s.date || '',
        preview: s.preview || s.content?.slice(0, 100) || '',
        data: s
      });
    });

    this.items = all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  get filtered(): HistoryItem[] {
    if (this.activeTab === 'all') return this.items;
    return this.items.filter(i => i.type === this.activeTab);
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      mindmap: '🧠', summary: '📄', qa: '💬', notes: '📝'
    };
    return icons[type] || '📌';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      mindmap: 'Mind Map', summary: 'Summary', qa: 'Q&A', notes: 'Notes'
    };
    return labels[type] || type;
  }

  getTypeBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      mindmap: 'bg-info text-dark', summary: 'bg-success', qa: 'bg-warning text-dark', notes: 'bg-primary'
    };
    return classes[type] || 'bg-secondary';
  }

  openItem(item: HistoryItem) {
    if (item.type === 'mindmap') {
      localStorage.setItem('mindmap_load', JSON.stringify(item.data));
      this.router.navigate(['/mindmap']);
    } else if (item.type === 'qa') {
      localStorage.setItem('chat_history_load', JSON.stringify(item.data));
      this.router.navigate(['/summarizer/chat']);
    } else {
      localStorage.setItem('summary_history_load', JSON.stringify(item.data));
      this.router.navigate(['/summarizer/upload']);
    }
  }

  async exportPdf(item: HistoryItem) {
    this.exportingId = item.id;
    try {
      const lines = this.buildPdfLines(item);
      if (!lines.length) return;

      const safeName = item.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 50);
      const filename = `${safeName || 'history'}.pdf`;

      if (item.type === 'qa') {
        await this.pdf.saveChat(
          filename,
          item.title,
          `${item.date} · Study History Export`,
          lines
        );
      } else {
        await this.pdf.save(
          filename,
          item.title,
          `${item.date} · Study History Export`,
          lines,
          { template: 'study' }
        );
      }
    } finally {
      this.exportingId = null;
    }
  }

  private buildPdfLines(item: HistoryItem): PdfLine[] {
    const data = item.data || {};
    const lines: PdfLine[] = [];

    if (item.type === 'qa') {
      const messages = data.messages as { role: string; text: string }[] | undefined;
      if (messages?.length) {
        for (const m of messages) {
          if (!m.text?.trim()) continue;
          this.splitLongText(m.text).forEach((chunk, idx) => {
            lines.push({
              type: m.role === 'user' ? 'chat-user' : 'chat-ai',
              text: idx === 0 ? chunk : `(continued)\n${chunk}`
            });
          });
        }
        return lines;
      }
      const content = String(data.content || '');
      for (const block of content.split(/\n(?=[QA]:)/)) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('Q:')) {
          this.splitLongText(trimmed.replace(/^Q:\s*/, '')).forEach((chunk, idx) => {
            lines.push({ type: 'chat-user', text: idx === 0 ? chunk : `(continued)\n${chunk}` });
          });
        } else if (trimmed.startsWith('A:')) {
          this.splitLongText(trimmed.replace(/^A:\s*/, '')).forEach((chunk, idx) => {
            lines.push({ type: 'chat-ai', text: idx === 0 ? chunk : `(continued)\n${chunk}` });
          });
        } else {
          lines.push({ type: 'para', text: trimmed });
        }
      }
      return lines;
    }

    if (item.type === 'summary' && data.topics?.length) {
      for (const topic of data.topics) {
        const title = String(topic.title || '').replace(/\*\*(.*?)\*\*/g, '$1');
        lines.push({ type: 'heading', text: title });
        if (topic.explanation) {
          lines.push({ type: 'para', text: String(topic.explanation).replace(/\*\*(.*?)\*\*/g, '$1') });
        }
        for (const sub of topic.subtopics || []) {
          lines.push({ type: 'subheading', text: String(sub.title || '').replace(/\*\*(.*?)\*\*/g, '$1') });
          if (sub.explanation) {
            lines.push({ type: 'para', text: String(sub.explanation).replace(/\*\*(.*?)\*\*/g, '$1') });
          }
          for (const bullet of sub.bullets || []) {
            lines.push({ type: 'para', text: String(bullet).replace(/\*\*(.*?)\*\*/g, '$1') });
          }
        }
        for (const bullet of topic.bullets || []) {
          lines.push({ type: 'para', text: String(bullet).replace(/\*\*(.*?)\*\*/g, '$1') });
        }
        for (const code of topic.codes || []) {
          lines.push({ type: 'code', text: code.code, label: code.lang || 'code' });
        }
        lines.push({ type: 'divider' });
      }
      for (const q of data.questions || []) {
        lines.push({ type: 'qa-q', text: String(q.q || '').replace(/\*\*(.*?)\*\*/g, '$1') });
        if (q.a) lines.push({ type: 'qa-a', text: String(q.a).replace(/\*\*(.*?)\*\*/g, '$1') });
      }
      return lines;
    }

    const content = String(data.content || item.preview || '');
    if (content) {
      content.split(/\n{2,}/).forEach(p => {
        const t = p.trim();
        if (t) lines.push({ type: 'para', text: t });
      });
    }
    return lines;
  }

  private splitLongText(text: string, maxChars = 900): string[] {
    const clean = text.replace(/<[^>]*>/g, '').trim();
    if (clean.length <= maxChars) return [clean];
    const chunks: string[] = [];
    let remaining = clean;
    while (remaining.length > maxChars) {
      const slice = remaining.slice(0, maxChars);
      const breakAt = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('\n'),
        slice.lastIndexOf('. ')
      );
      const idx = breakAt > maxChars * 0.45 ? breakAt + 1 : maxChars;
      chunks.push(remaining.slice(0, idx).trim());
      remaining = remaining.slice(idx).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  confirmDelete(id: string) {
    this.confirmDeleteId = id;
  }

  cancelDelete() {
    this.confirmDeleteId = null;
  }

  deleteItem(item: HistoryItem) {
    if (item.type === 'mindmap') {
      const maps = JSON.parse(localStorage.getItem('mindmaps') || '[]');
      const updated = maps.filter((m: any) => !(m.title === item.title && m.date === item.date));
      localStorage.setItem('mindmaps', JSON.stringify(updated));
    } else {
      const hist = JSON.parse(localStorage.getItem('summarizer_history') || '[]');
      const updated = hist.filter((s: any) => !(s.title === item.title && s.date === item.date));
      localStorage.setItem('summarizer_history', JSON.stringify(updated));
    }
    this.items = this.items.filter(i => i.id !== item.id);
    this.confirmDeleteId = null;
  }

  deleteAll() {
    if (!confirm('Delete all history? This cannot be undone.')) return;
    if (this.activeTab === 'all' || this.activeTab === 'mindmap') {
      localStorage.removeItem('mindmaps');
    }
    if (this.activeTab === 'all' || this.activeTab === 'summary' || this.activeTab === 'qa') {
      localStorage.removeItem('summarizer_history');
    }
    this.loadHistory();
  }

  countByType(type: string): number {
    return this.items.filter(i => i.type === type).length;
  }

  private countNodes(node: any): number {
    if (!node) return 0;
    return 1 + (node.children || []).reduce((s: number, c: any) => s + this.countNodes(c), 0);
  }
}
