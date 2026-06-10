import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComprehensivePdfExportService, ComprehensivePdfSection, ComprehensivePdfOptions } from '../services/comprehensive-pdf-export.service';

/**
 * Comprehensive PDF Export Component
 * 
 * Exports all content types to PDF:
 * - Summary with bullet points
 * - Key Points with structured data
 * - Study Notes with definitions
 * - Code Blocks with syntax
 * - Visuals/Diagrams/Figures
 * - Quiz/Q&A
 * - Tables with proper formatting
 */

@Component({
  selector: 'app-comprehensive-pdf-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="export-container">
      <!-- Header -->
      <div class="export-header">
        <h2>📥 Export Complete Study Material</h2>
        <p>Download all sections including Summary, Key Points, Notes, Code, Visuals, and Quiz</p>
      </div>

      <!-- Export Options -->
      <div class="export-options">
        <!-- Bullet Style Selector -->
        <div class="option-group">
          <label>Bullet Style:</label>
          <select [(ngModel)]="bulletStyle" class="select-control">
            <option value="unicode">Unicode (•·∙◦❖✔☒☑⇢➔➙➜✅⚠️◼️▪)</option>
            <option value="emoji">Emoji (🔹 🟠 ⭕ 🔲 ⬜ ✅ 👉)</option>
            <option value="mixed">Mixed (•·◦☐✔⭐➔⚠️)</option>
          </select>
        </div>

        <!-- Include Options -->
        <div class="option-group">
          <label>
            <input type="checkbox" [(ngModel)]="options.includeTableOfContents" />
            Include Table of Contents
          </label>
          <label>
            <input type="checkbox" [(ngModel)]="options.includeSectionHeaders" />
            Include Section Headers
          </label>
        </div>
      </div>

      <!-- Download Buttons -->
      <div class="button-group">
        <button (click)="downloadComplete()" [disabled]="isExporting" class="btn-export">
          <span *ngIf="!isExporting">📄 Download Complete PDF</span>
          <span *ngIf="isExporting">⏳ Generating...</span>
        </button>

        <button (click)="downloadBySection()" [disabled]="isExporting" class="btn-export-section">
          <span *ngIf="!isExporting">📑 Download by Section</span>
          <span *ngIf="isExporting">⏳ Processing...</span>
        </button>
      </div>

      <!-- Section List -->
      <div *ngIf="showSectionList" class="section-list">
        <h3>Available Sections:</h3>
        <div *ngFor="let section of sections" class="section-item">
          <button (click)="downloadSection(section)" [disabled]="isExporting" class="btn-section-download">
            📥 {{ section.title }}
          </button>
          <span class="section-items">{{ section.content.length }} items</span>
        </div>
      </div>

      <!-- Status Message -->
      <div *ngIf="statusMessage" [class.success]="statusSuccess" class="status-message">
        {{ statusMessage }}
      </div>
    </div>
  `,
  styles: [`
    .export-container {
      padding: 24px;
      background: linear-gradient(135deg, #f5f7fa 0%, #f0f1f5 100%);
      border-radius: 12px;
      border: 1px solid #e0e2e9;
    }

    .export-header {
      margin-bottom: 24px;
      text-align: center;
    }

    .export-header h2 {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px 0;
    }

    .export-header p {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }

    .export-options {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .option-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .option-group label {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }

    .select-control {
      padding: 8px 12px;
      border: 1px solid #d0d2db;
      border-radius: 6px;
      font-size: 13px;
      background: white;
      color: #333;
      cursor: pointer;
    }

    .select-control:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .btn-export,
    .btn-export-section {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    .btn-export {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .btn-export:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
    }

    .btn-export-section {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
    }

    .btn-export-section:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(245, 87, 108, 0.4);
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }

    .section-list {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .section-list h3 {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 12px 0;
    }

    .section-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      background: white;
      border-radius: 6px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
    }

    .btn-section-download {
      padding: 8px 12px;
      background: #f3f4f6;
      border: 1px solid #d0d2db;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      flex: 1;
      text-align: left;
    }

    .btn-section-download:hover:not(:disabled) {
      background: #e5e7eb;
      border-color: #9ca3af;
    }

    .btn-section-download:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .section-items {
      font-size: 12px;
      color: #9ca3af;
      white-space: nowrap;
    }

    .status-message {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
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
      .export-options {
        flex-direction: column;
        gap: 12px;
      }

      .button-group {
        flex-direction: column;
      }

      .btn-export,
      .btn-export-section {
        width: 100%;
      }

      .section-item {
        flex-direction: column;
        align-items: stretch;
      }

      .btn-section-download {
        width: 100%;
      }
    }
  `]
})
export class ComprehensivePdfExportComponent implements OnInit {
  @Input() title = 'Learning Material';
  @Input() subtitle = 'Complete Study Content';
  @Input() sections: ComprehensivePdfSection[] = [];

  isExporting = false;
  showSectionList = false;
  statusMessage = '';
  statusSuccess = false;

  bulletStyle: 'unicode' | 'emoji' | 'mixed' = 'unicode';
  options: ComprehensivePdfOptions = {
    includeTableOfContents: true,
    includeSectionHeaders: true,
    bulletStyle: 'unicode'
  };

  constructor(private pdfService: ComprehensivePdfExportService) {}

  ngOnInit(): void {}

  /**
   * Download complete PDF with all sections
   */
  downloadComplete(): void {
    if (!this.sections || this.sections.length === 0) {
      this.showStatus('No content to export', false);
      return;
    }

    this.isExporting = true;
    this.statusMessage = 'Generating complete PDF...';

    const exportOptions: ComprehensivePdfOptions = {
      ...this.options,
      bulletStyle: this.bulletStyle
    };

    this.pdfService.exportComprehensive(
      this.title,
      this.subtitle,
      this.sections,
      exportOptions
    ).then(() => {
      this.showStatus(
        `✓ Downloaded: ${this.title} (${this.sections.length} sections)`,
        true
      );
    }).catch(error => {
      console.error('Export error:', error);
      this.showStatus('Failed to export PDF', false);
    }).finally(() => {
      this.isExporting = false;
    });
  }

  /**
   * Download by section (show section list)
   */
  downloadBySection(): void {
    this.showSectionList = !this.showSectionList;
  }

  /**
   * Download specific section
   */
  downloadSection(section: ComprehensivePdfSection): void {
    this.isExporting = true;
    this.statusMessage = `Generating ${section.title} PDF...`;

    const exportOptions: ComprehensivePdfOptions = {
      ...this.options,
      bulletStyle: this.bulletStyle
    };

    this.pdfService.exportSection(section, this.title, exportOptions)
      .then(() => {
        this.showStatus(`✓ Downloaded: ${section.title}`, true);
      }).catch(error => {
        console.error('Export error:', error);
        this.showStatus('Failed to export section', false);
      }).finally(() => {
        this.isExporting = false;
      });
  }

  /**
   * Show status message
   */
  private showStatus(message: string, success: boolean): void {
    this.statusMessage = message;
    this.statusSuccess = success;

    setTimeout(() => {
      this.statusMessage = '';
    }, 4000);
  }
}
