/**
 * Complete Example: PDF Download Integration
 * 
 * This file demonstrates how to implement PDF download functionality
 * in an existing component (e.g., Summarizer, Study Hub, etc.)
 * 
 * File: src/app/features/summarizer/summary-with-pdf/summary-with-pdf.component.ts
 */

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfDownloadButtonComponent, PdfDownloadSimpleComponent } from '../../../shared/pdf-download-button/pdf-download-button.component';
import { PdfDownloadService, Section, PdfDownloadOptions } from '../../../core/services/pdf-download.service';
import { PdfLine } from '../../../core/services/pdf.service';

/**
 * Example Component: Summarizer with PDF Download
 * 
 * This component demonstrates:
 * 1. Section-specific PDF downloads
 * 2. Complete content PDF download
 * 3. Custom bullet point styling
 * 4. Multiple sections (Summary, Key Points, Visual, Quiz)
 */
@Component({
  selector: 'app-summary-with-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PdfDownloadButtonComponent,
    PdfDownloadSimpleComponent
  ],
  template: `
    <div class="summary-container">
      <!-- Header -->
      <header class="header">
        <h1>{{ topic }}</h1>
        <p class="subtitle">Comprehensive Study Material with PDF Export</p>
      </header>

      <!-- ───── SUMMARY SECTION ───── -->
      <section class="summary-section">
        <div class="section-header">
          <h2>📝 Summary</h2>
          <p class="section-description">Key concepts and overview</p>
        </div>

        <!-- Download Button for Summary -->
        <app-pdf-download-button
          [mainTitle]="topic"
          [sectionTitle]="'Summary'"
          [content]="summaryContent"
          [bulletStyle]="bulletStyle"
          [showDownloadAll]="true"
          [allSections]="allSections"
          [showStyleSelector]="true"
        ></app-pdf-download-button>

        <!-- Summary Content -->
        <div class="summary-content">
          <p>{{ summary }}</p>
          <div class="bullet-list">
            <div *ngFor="let item of summaryPoints" class="bullet-item">
              <span class="bullet-symbol">•</span>
              <span>{{ item }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ───── KEY POINTS SECTION ───── -->
      <section class="keypoints-section">
        <div class="section-header">
          <h2>⭐ Key Points</h2>
          <p class="section-description">Essential concepts you must remember</p>
        </div>

        <!-- Download Button for Key Points -->
        <app-pdf-download-button
          [mainTitle]="topic"
          [sectionTitle]="'Key Points'"
          [content]="keypointsContent"
          [bulletStyle]="bulletStyle"
          [showDownloadAll]="true"
          [allSections]="allSections"
          [showStyleSelector]="false"
        ></app-pdf-download-button>

        <!-- Key Points Content -->
        <div class="keypoints-grid">
          <div *ngFor="let point of keyPoints; let i = index" class="kp-card">
            <div class="kp-number">{{ i + 1 }}</div>
            <h3>{{ point.title }}</h3>
            <p>{{ point.description }}</p>
          </div>
        </div>
      </section>

      <!-- ───── VISUAL DIAGRAMS SECTION ───── -->
      <section class="visual-section">
        <div class="section-header">
          <h2>🎨 Visual Diagrams</h2>
          <p class="section-description">Visual representations and architecture</p>
        </div>

        <!-- Download Button for Visuals -->
        <app-pdf-download-simple
          [mainTitle]="topic"
          [sectionTitle]="'Visual Diagrams'"
          [content]="visualContent"
          [bulletStyle]="bulletStyle"
        ></app-pdf-download-simple>

        <!-- Visual Content -->
        <div class="visual-grid">
          <div *ngFor="let diagram of diagrams" class="diagram-card">
            <div class="diagram-placeholder">📊 {{ diagram }}</div>
          </div>
        </div>
      </section>

      <!-- ───── PRACTICE QUIZ SECTION ───── -->
      <section class="quiz-section">
        <div class="section-header">
          <h2>❓ Practice Quiz</h2>
          <p class="section-description">Test your understanding</p>
        </div>

        <!-- Download Button for Quiz -->
        <app-pdf-download-button
          [mainTitle]="topic"
          [sectionTitle]="'Practice Quiz'"
          [content]="quizContent"
          [bulletStyle]="bulletStyle"
          [showDownloadAll]="false"
          [showStyleSelector]="false"
        ></app-pdf-download-button>

        <!-- Quiz Content -->
        <div class="quiz-list">
          <div *ngFor="let q of quiz; let i = index" class="quiz-item">
            <h4>Q{{ i + 1 }}: {{ q.question }}</h4>
            <p class="answer">{{ q.answer }}</p>
          </div>
        </div>
      </section>

      <!-- ───── DOWNLOAD ALL SECTION ───── -->
      <section class="download-all-section">
        <div class="section-header">
          <h2>📥 Download Complete Study Material</h2>
        </div>

        <div class="download-options">
          <button (click)="downloadCompleteContent()" class="btn-primary">
            📄 Download All Content ({{ allSections.length }} Sections)
          </button>

          <div class="bullet-style-selector">
            <label>Choose Bullet Style:</label>
            <select [(ngModel)]="bulletStyle" (change)="updateBulletStyle()">
              <option value="unicode">Unicode • · ∙ ◦</option>
              <option value="emoji">Emoji 🔹 🟠 ⭕</option>
              <option value="mixed">Mixed • · ◦ ✔</option>
            </select>
          </div>

          <p class="info-text">
            Download all sections including Summary, Key Points, Visuals, and Quiz in a single PDF
            with professional formatting and chosen bullet symbols.
          </p>
        </div>
      </section>

      <!-- Status Messages -->
      <div *ngIf="statusMessage" [class.success]="statusSuccess" class="status-banner">
        {{ statusMessage }}
      </div>
    </div>
  `,
  styles: [`
    .summary-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(to bottom, #f9fafb, #ffffff);
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 2px solid #e5e7eb;
    }

    .header h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px 0;
    }

    .subtitle {
      font-size: 16px;
      color: #6b7280;
      margin: 0;
    }

    section {
      margin: 40px 0;
      padding: 32px;
      background: white;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #f3f4f6;
    }

    .section-header h2 {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px 0;
    }

    .section-description {
      font-size: 14px;
      color: #9ca3af;
      margin: 0;
    }

    .bullet-list {
      margin-top: 20px;
    }

    .bullet-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
    }

    .bullet-symbol {
      flex-shrink: 0;
      color: #667eea;
      font-weight: 600;
    }

    .keypoints-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .kp-card {
      padding: 20px;
      background: linear-gradient(135deg, #f0f4ff 0%, #f9f5ff 100%);
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .kp-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 50%;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .kp-card h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #1f2937;
    }

    .kp-card p {
      margin: 0;
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }

    .visual-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .diagram-card {
      padding: 40px 20px;
      background: linear-gradient(135deg, #f0f9ff 0%, #f0f4ff 100%);
      border-radius: 8px;
      border: 2px dashed #cbd5e1;
      text-align: center;
      font-size: 48px;
    }

    .diagram-placeholder {
      font-size: 32px;
      color: #94a3b8;
    }

    .quiz-list {
      margin-top: 20px;
    }

    .quiz-item {
      padding: 20px;
      margin-bottom: 16px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 4px solid #f5576c;
    }

    .quiz-item h4 {
      margin: 0 0 12px 0;
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
    }

    .answer {
      margin: 0;
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
    }

    .download-all-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
    }

    .download-all-section .section-header {
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }

    .download-all-section h2 {
      color: white;
    }

    .download-options {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 20px;
    }

    .btn-primary {
      padding: 14px 24px;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    }

    .bullet-style-selector {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .bullet-style-selector label {
      font-weight: 600;
      white-space: nowrap;
    }

    .bullet-style-selector select {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: white;
      font-size: 14px;
      cursor: pointer;
    }

    .bullet-style-selector select option {
      color: #1f2937;
      background: white;
    }

    .info-text {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
      line-height: 1.6;
    }

    .status-banner {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 16px 24px;
      background: #10b981;
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease;
    }

    .status-banner.success {
      background: #10b981;
    }

    .status-banner:not(.success) {
      background: #ef4444;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .summary-container {
        padding: 16px;
      }

      section {
        padding: 20px;
      }

      .header h1 {
        font-size: 24px;
      }

      .keypoints-grid,
      .visual-grid {
        grid-template-columns: 1fr;
      }

      .bullet-style-selector {
        flex-direction: column;
        align-items: stretch;
      }

      .status-banner {
        left: 16px;
        right: 16px;
        bottom: 16px;
      }
    }
  `]
})
export class SummaryWithPdfComponent implements OnInit {
  @Input() topic = 'Angular Fundamentals';

  // Summary Section
  summary = 'Angular is a comprehensive JavaScript framework for building web applications. It provides a complete toolkit for creating dynamic, single-page applications with powerful features like dependency injection, reactive forms, and built-in HTTP client.';
  
  summaryPoints = [
    'Angular is a full-featured framework with built-in tools',
    'Component-based architecture for reusable UI',
    'Strong typing with TypeScript support',
    'RxJS integration for reactive programming',
    'Powerful CLI for scaffolding and building'
  ];

  // Key Points
  keyPoints = [
    {
      title: 'Components',
      description: 'Reusable building blocks with templates, styles, and logic'
    },
    {
      title: 'Services',
      description: 'Business logic and data management in separate classes'
    },
    {
      title: 'Dependency Injection',
      description: 'Built-in DI system for managing dependencies'
    },
    {
      title: 'Reactive Forms',
      description: 'Form validation and state management'
    },
    {
      title: 'HTTP Client',
      description: 'Built-in service for making HTTP requests'
    },
    {
      title: 'Routing',
      description: 'Client-side routing for multi-page-like experience'
    }
  ];

  // Visual Diagrams
  diagrams = [
    'Component Architecture',
    'Data Flow Diagram',
    'Dependency Injection',
    'RxJS Pipeline',
    'Routing Structure',
    'Module Hierarchy'
  ];

  // Quiz
  quiz = [
    {
      question: 'What is the primary building block in Angular?',
      answer: 'Components are the primary building blocks. They consist of a template (HTML), styles (CSS), and logic (TypeScript class).'
    },
    {
      question: 'How do you share data between components?',
      answer: 'You can share data using @Input/@Output decorators for parent-child communication, or using services with observables for sibling communication.'
    },
    {
      question: 'What is dependency injection?',
      answer: 'Dependency injection is a design pattern where dependencies are provided to a class rather than the class creating them itself.'
    },
    {
      question: 'What is RxJS?',
      answer: 'RxJS is a library for reactive programming using observables, allowing you to work with asynchronous data streams.'
    }
  ];

  // Bullet style
  bulletStyle: 'unicode' | 'emoji' | 'mixed' = 'unicode';

  // Status message
  statusMessage = '';
  statusSuccess = false;

  // Content for PDF
  summaryContent: PdfLine[] = [];
  keypointsContent: PdfLine[] = [];
  visualContent: PdfLine[] = [];
  quizContent: PdfLine[] = [];

  // All sections
  allSections: Section[] = [];

  constructor(private pdfDownloadService: PdfDownloadService) {}

  ngOnInit(): void {
    this.initializePdfContent();
  }

  /**
   * Initialize PDF content from component data
   */
  private initializePdfContent(): void {
    // Summary section
    this.summaryContent = [
      { type: 'para', text: this.summary },
      { type: 'heading', text: 'Key Points' },
      ...this.summaryPoints.map(point => ({
        type: 'bullet' as const,
        text: point,
        bulletStyle: 'dot' as const
      }))
    ];

    // Key Points section
    this.keypointsContent = [
      ...this.keyPoints.flatMap((kp, i) => [
        { type: 'subheading' as const, text: `${i + 1}. ${kp.title}` },
        { type: 'para' as const, text: kp.description }
      ])
    ];

    // Visual section
    this.visualContent = [
      { type: 'heading', text: 'Visual Diagrams & Architecture' },
      ...this.diagrams.map(diagram => ({
        type: 'bullet' as const,
        text: diagram,
        bulletStyle: 'triangle' as const
      }))
    ];

    // Quiz section
    this.quizContent = [
      ...this.quiz.flatMap((q, i) => [
        { type: 'qa-q' as const, text: `Q${i + 1}: ${q.question}` },
        { type: 'qa-a' as const, text: q.answer }
      ])
    ];

    // All sections for "Download All"
    this.allSections = [
      { title: 'Summary', content: this.summaryContent, type: 'summary' },
      { title: 'Key Points', content: this.keypointsContent, type: 'keypoints' },
      { title: 'Visual Diagrams', content: this.visualContent, type: 'visual' },
      { title: 'Practice Quiz', content: this.quizContent, type: 'quiz' }
    ];
  }

  /**
   * Download complete content
   */
  downloadCompleteContent(): void {
    this.pdfDownloadService.downloadComplete(
      this.topic,
      `Complete Study Material - ${new Date().toLocaleDateString()}`,
      this.allSections,
      {
        bulletStyle: this.bulletStyle,
        includeToc: true,
        compress: true
      }
    ).then(() => {
      this.showStatus(`✓ Downloaded: Complete Study Material`, true);
    }).catch(error => {
      console.error('Download error:', error);
      this.showStatus('Failed to download PDF', false);
    });
  }

  /**
   * Update bullet style
   */
  updateBulletStyle(): void {
    // Bullets will use the selected style on next download
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
