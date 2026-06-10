import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PdfService, PdfLine } from './pdf.service';

/**
 * Enhanced PDF Download Service
 * Supports section-specific downloads with custom bullet formatting
 * 
 * Features:
 * - Download entire content or specific section only
 * - Custom bullet point symbols
 * - Well-formatted output with proper styling
 */

export interface Section {
  title: string;
  content: PdfLine[];
  type?: 'summary' | 'keypoints' | 'notes' | 'visual' | 'quiz' | 'custom';
}

export interface PdfDownloadOptions {
  sectionOnly?: boolean;
  bulletStyle?: 'unicode' | 'emoji' | 'mixed';
  includeHeader?: boolean;
  includeToc?: boolean;
  compress?: boolean;
}

const BULLET_SYMBOLS = {
  // Unicode symbols
  unicode: {
    dot: '•',
    circle: '◦',
    square: '◼',
    solidSquare: '▪',
    hollowSquare: '☑',
    check: '✔',
    cross: '✘',
    diamond: '◆',
    triangle: '▶',
    arrow: '➔',
    doubleArrow: '➙',
    chevron: '➜',
    star: '✅',
    warning: '⚠️',
    custom1: '•',
    custom2: '·',
    custom3: '∙',
    custom4: '◦',
    custom5: '❖',
    custom6: '☒',
    custom7: '☑',
    custom8: '⇢',
    custom9: '➔',
    custom10: '➙',
    custom11: '➜',
    custom12: '✅'
  },
  emoji: {
    dot: '🔹',
    circle: '⭕',
    square: '🔲',
    solidSquare: '🔳',
    hollowSquare: '☑️',
    check: '✅',
    cross: '❌',
    diamond: '💎',
    triangle: '📍',
    arrow: '➡️',
    doubleArrow: '⤳',
    chevron: '👉',
    star: '⭐',
    warning: '⚠️',
    custom1: '🟠',
    custom2: '🟡',
    custom3: '🟢',
    custom4: '🔵',
    custom5: '🟣',
    custom6: '⬜',
    custom7: '⬛',
    custom8: '🟫',
    custom9: '✔️',
    custom10: '🎯',
    custom11: '📌',
    custom12: '💫'
  },
  mixed: {
    dot: '•',
    circle: '◦',
    square: '☐',
    solidSquare: '▪',
    hollowSquare: '☒',
    check: '✔',
    cross: '✘',
    diamond: '◆',
    triangle: '▶',
    arrow: '➔',
    doubleArrow: '➙',
    chevron: '➜',
    star: '⭐',
    warning: '⚠️',
    custom1: '•',
    custom2: '·',
    custom3: '∙',
    custom4: '◦',
    custom5: '❖',
    custom6: '✔',
    custom7: '☒',
    custom8: '⇢',
    custom9: '➔',
    custom10: '➙',
    custom11: '➜',
    custom12: '✅'
  }
};

@Injectable({ providedIn: 'root' })
export class PdfDownloadService {
  constructor(private pdfService: PdfService) {}

  /**
   * Download specific section to PDF
   * @param sectionTitle Title of the section
   * @param sectionContent PdfLine array for the section
   * @param mainTitle Main document title
   * @param options Download options
   */
  downloadSection(
    sectionTitle: string,
    sectionContent: PdfLine[],
    mainTitle: string,
    options: PdfDownloadOptions = {}
  ): Promise<void> {
    const {
      bulletStyle = 'unicode',
      includeHeader = true,
      compress = true
    } = options;

    // Enhance content with bullet symbols
    const enhancedContent = this.enhanceBullets(sectionContent, bulletStyle);

    const filename = this.generateFilename(sectionTitle, 'section');
    
    return this.pdfService.save(
      filename,
      mainTitle,
      `Section: ${sectionTitle}`,
      [
        ...(includeHeader ? this.generateSectionHeader(sectionTitle, mainTitle) : []),
        ...enhancedContent
      ]
    );
  }

  /**
   * Download entire content to PDF
   * @param mainTitle Main document title
   * @param subtitle Subtitle
   * @param sections Array of sections
   * @param options Download options
   */
  downloadComplete(
    mainTitle: string,
    subtitle: string,
    sections: Section[],
    options: PdfDownloadOptions = {}
  ): Promise<void> {
    const {
      bulletStyle = 'unicode',
      includeToc = true,
      compress = true
    } = options;

    // Flatten all sections and enhance content
    const allContent: PdfLine[] = [];

    if (includeToc) {
      allContent.push(
        { type: 'heading', text: 'Table of Contents' },
        { type: 'divider' },
        ...sections.map((section, index) => ({
          type: 'bullet' as const,
          text: `${index + 1}. ${section.title}`,
          bulletStyle: 'diamond' as const
        })),
        { type: 'divider' }
      );
    }

    // Add all sections
    sections.forEach((section, index) => {
      allContent.push({
        type: 'heading',
        text: `${index + 1}. ${section.title}`
      });

      const enhancedContent = this.enhanceBullets(section.content, bulletStyle);
      allContent.push(...enhancedContent);

      if (index < sections.length - 1) {
        allContent.push({ type: 'divider' });
      }
    });

    const filename = this.generateFilename(mainTitle, 'complete');

    return this.pdfService.save(filename, mainTitle, subtitle, allContent);
  }

  /**
   * Download section with summary format
   * Perfect for Summary, Notes, KeyPoints sections
   */
  downloadSummarySection(
    title: string,
    items: string[],
    mainTitle: string,
    options: PdfDownloadOptions = {}
  ): Promise<void> {
    const { bulletStyle = 'unicode' } = options;
    const symbolSet = BULLET_SYMBOLS[bulletStyle as keyof typeof BULLET_SYMBOLS];

    const content: PdfLine[] = [
      { type: 'heading', text: title },
      { type: 'divider' },
      ...items.map((item, index) => ({
        type: 'bullet' as const,
        text: item,
        bulletStyle: this.rotateBulletStyle(index) as any
      }))
    ];

    const filename = this.generateFilename(title, 'summary');
    return this.pdfService.save(
      filename,
      mainTitle,
      `Summary: ${title}`,
      content
    );
  }

  /**
   * Download formatted content with title, subtitle, and detailed sections
   */
  downloadFormatted(
    title: string,
    subtitle: string,
    sections: { heading: string; items: string[] }[],
    options: PdfDownloadOptions = {}
  ): Promise<void> {
    const { bulletStyle = 'unicode' } = options;

    const content: PdfLine[] = [
      { type: 'heading', text: title },
      { type: 'para', text: subtitle },
      { type: 'divider' }
    ];

    sections.forEach((section, secIndex) => {
      content.push(
        { type: 'subheading', text: section.heading }
      );

      section.items.forEach((item, itemIndex) => {
        content.push({
          type: 'bullet',
          text: item,
          bulletStyle: this.rotateBulletStyle(itemIndex) as any
        });
      });

      if (secIndex < sections.length - 1) {
        content.push({ type: 'divider' });
      }
    });

    const filename = this.generateFilename(title, 'formatted');
    return this.pdfService.save(filename, title, subtitle, content);
  }

  /**
   * Download quiz format
   */
  downloadQuiz(
    title: string,
    quiz: Array<{ q: string; a: string }>,
    mainTitle: string,
    options: PdfDownloadOptions = {}
  ): Promise<void> {
    const content: PdfLine[] = [
      { type: 'heading', text: title },
      { type: 'divider' }
    ];

    quiz.forEach((item, index) => {
      content.push(
        { type: 'subheading', text: `Q${index + 1}: ${item.q}` },
        { type: 'para', text: `Answer: ${item.a}` }
      );

      if (index < quiz.length - 1) {
        content.push({ type: 'divider' });
      }
    });

    const filename = this.generateFilename(title, 'quiz');
    return this.pdfService.save(
      filename,
      mainTitle,
      `Quiz: ${title}`,
      content
    );
  }

  /**
   * Enhance bullet points with custom symbols
   */
  private enhanceBullets(
    lines: PdfLine[],
    bulletStyle: string
  ): PdfLine[] {
    return lines.map((line, index) => {
      if (line.type === 'bullet') {
        return {
          ...line,
          bulletStyle: this.rotateBulletStyle(index) as any
        };
      }
      return line;
    });
  }

  /**
   * Rotate through different bullet styles
   */
  private rotateBulletStyle(index: number): string {
    const styles = [
      'dot',
      'circle',
      'square',
      'check',
      'arrow',
      'diamond',
      'triangle',
      'chevron',
      'star'
    ];
    return styles[index % styles.length];
  }

  /**
   * Generate section header
   */
  private generateSectionHeader(sectionTitle: string, mainTitle: string): PdfLine[] {
    return [
      { type: 'heading', text: sectionTitle },
      { type: 'para', text: `From: ${mainTitle}` },
      { type: 'para', text: `Downloaded: ${new Date().toLocaleDateString()}` },
      { type: 'divider' }
    ];
  }

  /**
   * Generate filename with timestamp
   */
  private generateFilename(
    name: string,
    type: 'section' | 'complete' | 'summary' | 'formatted' | 'quiz'
  ): string {
    const sanitized = name.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${sanitized}_${type}_${timestamp}.pdf`;
  }

  /**
   * Get available bullet symbols for UI display
   */
  getBulletSymbols(style: 'unicode' | 'emoji' | 'mixed' = 'unicode'): string[] {
    const symbols = BULLET_SYMBOLS[style];
    return Object.values(symbols);
  }

  /**
   * Get bullet symbol by key
   */
  getBulletSymbol(
    key: keyof typeof BULLET_SYMBOLS.unicode,
    style: 'unicode' | 'emoji' | 'mixed' = 'unicode'
  ): string {
    return BULLET_SYMBOLS[style][key as keyof (typeof BULLET_SYMBOLS)[typeof style]];
  }
}
