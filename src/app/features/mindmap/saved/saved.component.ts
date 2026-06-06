import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-saved',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './saved.component.html',
  styleUrl: './saved.component.css'
})
export class SavedComponent {

  savedMaps: { title: string; data: any; date: string }[] = [];
  confirmDeleteIndex: number | null = null;

  constructor(private router: Router) {
    this.load();
  }

  load() {
    const saved = localStorage.getItem('mindmaps');
    this.savedMaps = saved ? JSON.parse(saved) : [];
  }

  openMap(map: { title: string; data: any; date: string }) {
    // Store selected map for generator to pick up
    localStorage.setItem('mindmap_load', JSON.stringify(map));
    this.router.navigate(['/mindmap']);
  }

  confirmDelete(i: number) {
    this.confirmDeleteIndex = i;
  }

  cancelDelete() {
    this.confirmDeleteIndex = null;
  }

  delete(i: number) {
    this.savedMaps.splice(i, 1);
    localStorage.setItem('mindmaps', JSON.stringify(this.savedMaps));
    this.confirmDeleteIndex = null;
  }

  deleteAll() {
    if (!confirm('Delete all saved mind maps?')) return;
    this.savedMaps = [];
    localStorage.removeItem('mindmaps');
  }

  getBranchCount(map: any): number {
    try { return map.data?.children?.length || 0; } catch { return 0; }
  }

  getNodeCount(node: any): number {
    if (!node) return 0;
    return 1 + (node.children || []).reduce((s: number, c: any) => s + this.getNodeCount(c), 0);
  }
}
