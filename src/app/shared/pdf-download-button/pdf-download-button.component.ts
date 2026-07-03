import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfDownloadService, Section, PdfDownloadOptions } from '../../core/services/pdf-download.service';
import { PdfLine } from '../../core/services/pdf.service';

/**
 * PDF Download Button Component
 * Add this to any section to enable PDF download functionality
 * 
 * Usage:
 * <app-pdf-download-button
 *   [mainTitle]="'Learning Hub - Angular'"
 *   [sectionTitle]="'Summary'"
 *   [content]="summaryBlocks"
 *   [bulletStyle]="'unicode'"
 * ></app-pdf-download-button>
 */

@Component({
  selector: 'app-pdf-download-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pdf-download-container">
      <!-- Download Button -->
      <button
        class="btn-download-section"
        (click)="downloadSection()"
        [disabled]="isDownloading"
        title="Download this section as PDF"
      >
        <span class="icon">📥</span>
        <span class="text">
          {{ isDownloading ? 'Generating PDF...' : 'Download Section' }}
        </span>
      </button>

      <!-- Alternative: Download All -->
      <button
        *ngIf="showDownloadAll"
        class="btn-download-all"
        (click)="downloadAll()"
        [disabled]="isDownloading"
        title="Download entire content as PDF"
      >
        <span class="icon">📄</span>
        <span class="text">Download All</span>
      </button>

      <!-- Bullet Style Selector -->
      <div *ngIf="showStyleSelector" class="bullet-style-selector">
        <label>Bullet Style:</label>
        <select [(ngModel)]="bulletStyle" class="style-select">
          <option value="unicode">Unicode (●◦▪)</option>
          <option value="emoji">Emoji (🔹⭕🔲)</option>
          <option value="mixed">Mixed (●◦☒✔️)</option>
        </select>
      </div>

      <!-- Status Message -->
      <div *ngIf="statusMessage" class="status-message" [class.success]="statusSuccess">
        {{ statusMessage }}
      </div>
    </div>
  `,
  styles: [`
    .pdf-download-container {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px;
      background: linear-gradient(135deg, #f5f7fa 0%, #f0f1f5 100%);
      border-radius: 8px;
      border: 1px solid #e0e2e9;
      flex-wrap: wrap;
      margin: 16px 0;
    }

    .btn-download-section,
    .btn-download-all {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    .btn-download-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .btn-download-section:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
    }

    .btn-download-all {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
    }

    .btn-download-all:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(245, 87, 108, 0.4);
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .icon {
      font-size: 16px;
    }

    .bullet-style-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: white;
      border-radius: 6px;
      border: 1px solid #d0d2db;
    }

    .bullet-style-selector label {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
    }

    .style-select {
      padding: 6px 10px;
      border: 1px solid #d0d2db;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      background: white;
      color: #333;
    }

    .style-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
    }

    .status-message {
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      background-color: #fee2e2;
      color: #b91c1c;
      border-left: 3px solid #dc2626;
    }

    .status-message.success {
      background-color: #dcfce7;
      color: #166534;
      border-left-color: #22c55e;
    }

    @media (max-width: 640px) {
      .pdf-download-container {
        flex-direction: column;
        gap: 10px;
      }

      .btn-download-section,
      .btn-download-all {
        width: 100%;
        justify-content: center;
      }

      .bullet-style-selector {
        width: 100%;
        justify-content: space-between;
      }
    }
  `]
})
export class PdfDownloadButtonComponent implements OnInit {
  @Input() mainTitle = 'AI Learning Hub';
  @Input() sectionTitle = 'Section';
  @Input() content: PdfLine[] = [];
  @Input() showDownloadAll = false;
  @Input() showStyleSelector = true;
  @Input() bulletStyle: 'unicode' | 'emoji' | 'mixed' = 'unicode';
  @Input() allSections?: Section[];
  @Input() options: PdfDownloadOptions = {};

  isDownloading = false;
  statusMessage = '';
  statusSuccess = false;

  constructor(private pdfDownloadService: PdfDownloadService) {}

  ngOnInit(): void {
    // Any initialization if needed
  }

  /**
   * Download current section
   */
  downloadSection(): void {
    if (!this.content || this.content.length === 0) {
      this.showStatus('No content to download', false);
      return;
    }

    this.isDownloading = true;
    this.statusMessage = 'Generating PDF...';

    try {
      this.pdfDownloadService.downloadSection(
        this.sectionTitle,
        this.content,
        this.mainTitle,
        {
          ...this.options,
          bulletStyle: this.bulletStyle
        }
      ).then(() => {
        this.showStatus(
          `✓ Downloaded: ${this.sectionTitle}`,
          true
        );
      }).catch(() => {
        this.showStatus('Failed to download PDF', false);
      }).finally(() => {
        this.isDownloading = false;
      });
    } catch {
      this.showStatus('Error generating PDF', false);
      this.isDownloading = false;
    }
  }

  /**
   * Download all sections (if available)
   */
  downloadAll(): void {
    if (!this.allSections || this.allSections.length === 0) {
      this.showStatus('No sections to download', false);
      return;
    }

    this.isDownloading = true;
    this.statusMessage = 'Generating complete PDF...';

    try {
      this.pdfDownloadService.downloadComplete(
        this.mainTitle,
        `Complete Content - ${new Date().toLocaleDateString()}`,
        this.allSections,
        {
          ...this.options,
          bulletStyle: this.bulletStyle,
          includeToc: true
        }
      ).then(() => {
        this.showStatus(
          `✓ Downloaded: Complete PDF (${this.allSections?.length || 0} sections)`,
          true
        );
      }).catch(() => {
        this.showStatus('Failed to download PDF', false);
      }).finally(() => {
        this.isDownloading = false;
      });
    } catch {
      this.showStatus('Error generating PDF', false);
      this.isDownloading = false;
    }
  }

  /**
   * Show status message
   */
  private showStatus(message: string, success: boolean): void {
    this.statusMessage = message;
    this.statusSuccess = success;
    
    // Auto-clear after 4 seconds
    setTimeout(() => {
      this.statusMessage = '';
    }, 4000);
  }
}

/**
 * Alternative: Simpler Download Button (Minimal UI)
 */
@Component({
  selector: 'app-pdf-download-simple',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="btn-simple"
      (click)="downloadSection()"
      [disabled]="isDownloading"
      [title]="'Download ' + sectionTitle"
    >
      📥 {{ isDownloading ? '...' : 'PDF' }}
    </button>
  `,
  styles: [`
    .btn-simple {
      padding: 8px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .btn-simple:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .btn-simple:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  `]
})
export class PdfDownloadSimpleComponent implements OnInit {
  @Input() mainTitle = 'AI Learning Hub';
  @Input() sectionTitle = 'Section';
  @Input() content: PdfLine[] = [];
  @Input() bulletStyle: 'unicode' | 'emoji' | 'mixed' = 'unicode';

  isDownloading = false;

  constructor(private pdfDownloadService: PdfDownloadService) {}

  ngOnInit(): void {}

  downloadSection(): void {
    if (!this.content || this.content.length === 0) {
      alert('No content to download');
      return;
    }

    this.isDownloading = true;

    this.pdfDownloadService.downloadSection(
      this.sectionTitle,
      this.content,
      this.mainTitle,
      { bulletStyle: this.bulletStyle }
    ).then(() => {
      this.isDownloading = false;
    }).catch(() => {
      this.isDownloading = false;
    });
  }
}

/**
 * Context Menu PDF Download (Right-click to download)
 */
@Component({
  selector: 'app-pdf-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="context-trigger"
      (contextmenu)="showMenu($event)"
      [title]="'Right-click to download: ' + sectionTitle"
    >
      <ng-content></ng-content>
      
      <!-- Context Menu -->
      <div
        *ngIf="menuVisible"
        class="context-menu"
        [style.top.px]="menuY"
        [style.left.px]="menuX"
      >
        <button (click)="downloadSection()" class="context-item">
          📥 Download Section
        </button>
        <button (click)="downloadAll()" *ngIf="showAll" class="context-item">
          📄 Download All
        </button>
        <div class="divider"></div>
        <button (click)="closeMenu()" class="context-item">
          ✕ Close
        </button>
      </div>
    </div>
  `,
  styles: [`
    .context-trigger {
      position: relative;
      user-select: none;
    }

    .context-menu {
      position: fixed;
      background: white;
      border: 1px solid #d0d2db;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      z-index: 9999;
      min-width: 200px;
      overflow: hidden;
    }

    .context-item {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: transparent;
      text-align: left;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .context-item:hover {
      background-color: #f5f7fa;
    }

    .divider {
      height: 1px;
      background-color: #e0e2e9;
      margin: 4px 0;
    }
  `]
})
export class PdfContextMenuComponent implements OnInit {
  @Input() mainTitle = 'AI Learning Hub';
  @Input() sectionTitle = 'Section';
  @Input() content: PdfLine[] = [];
  @Input() allContent?: PdfLine[];
  @Input() bulletStyle: 'unicode' | 'emoji' | 'mixed' = 'unicode';
  @Input() showAll = false;

  menuVisible = false;
  menuX = 0;
  menuY = 0;

  constructor(private pdfDownloadService: PdfDownloadService) {}

  ngOnInit(): void {
    document.addEventListener('click', () => this.closeMenu());
  }

  showMenu(event: MouseEvent): void {
    event.preventDefault();
    this.menuX = event.clientX;
    this.menuY = event.clientY;
    this.menuVisible = true;
  }

  closeMenu(): void {
    this.menuVisible = false;
  }

  downloadSection(): void {
    this.pdfDownloadService.downloadSection(
      this.sectionTitle,
      this.content,
      this.mainTitle,
      { bulletStyle: this.bulletStyle }
    );
    this.closeMenu();
  }

  downloadAll(): void {
    if (!this.allContent) return;
    this.pdfDownloadService.downloadSection(
      'All Content',
      this.allContent,
      this.mainTitle,
      { bulletStyle: this.bulletStyle }
    );
    this.closeMenu();
  }
}
