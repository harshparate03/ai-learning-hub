import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

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

  constructor(private router: Router) {}

  ngOnInit() {
    this.loadHistory();
  }

  loadHistory() {
    const all: HistoryItem[] = [];

    // Mind maps
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

    // Summarizer history
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

    // Sort by date descending
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
    } else {
      this.router.navigate(['/summarizer/summary']);
    }
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
