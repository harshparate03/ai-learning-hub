/**
 * Comprehensive PDF Export Service
 * Complete content export from all sections with tables, code, visuals, and comprehensive formatting
 * 
 * Features:
 * - All section types: Summary, Key Points, Study Notes, Code, Visuals, Quiz
 * - Table support with proper borders and formatting
 * - Code blocks with syntax highlighting
 * - Figure/Visual support
 * - Comprehensive bullet point formatting
 * - Professional PDF output
 */

import { Injectable } from '@angular/core';
import { PdfService, PdfLine } from './pdf.service';

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface CodeBlockData {
  language?: string;
  code: string;
  caption?: string;
}

export interface FigureData {
  title: string;
  description?: string;
  type: 'diagram' | 'chart' | 'screenshot' | 'visual';
}

export interface ComprehensivePdfSection {
  type: 'summary' | 'keypoints' | 'notes' | 'code' | 'visuals' | 'quiz';
  title: string;
  content: Array<
    | { kind: 'paragraph'; text: string }
    | { kind: 'bullet'; text: string; style?: string }
    | { kind: 'heading'; text: string }
    | { kind: 'subheading'; text: string }
    | { kind: 'table'; data: TableData }
    | { kind: 'code'; data: CodeBlockData }
    | { kind: 'figure'; data: FigureData }
    | { kind: 'definition'; term: string; definition: string }
    | { kind: 'note'; text: string }
    | { kind: 'warning'; text: string }
    | { kind: 'qa'; question: string; answer: string }
  >;
}

export interface ComprehensivePdfOptions {
  includeTableOfContents?: boolean;
  includeSectionHeaders?: boolean;
  includePageNumbers?: boolean;
  bulletStyle?: 'unicode' | 'emoji' | 'mixed' | 'custom';
  customBulletSymbols?: string[];
  fontSize?: number;
  compress?: boolean;
}

// Extended bullet symbols including user-provided examples
export const COMPREHENSIVE_BULLET_SYMBOLS = {
  unicode: {
    // Primary bullets (from user requirement: •·∙◦❖✔☒☑⇢➔➙➜✅⚠️◼️▪️)
    dot: '•',                    // Main bullet
    dotSmall: '·',               // Small dot
    dotMid: '∙',                 // Middle dot
    circle: '◦',                 // Hollow circle
    fleuron: '❖',                // Decorative
    checkmark: '✔',              // Check
    boxCross: '☒',               // Crossed box
    boxCheck: '☑',               // Checked box
    arrowDouble: '⇢',            // Double arrow
    arrow: '➔',                  // Arrow
    arrowRight: '➙',             // Arrow right
    arrowRightLong: '➜',         // Long arrow
    checkmarkHeavy: '✅',         // Heavy check
    warning: '⚠️',               // Warning
    squareSmall: '◼',            // Small square
    squareSolid: '▪',            // Solid square
    
    // Additional symbols
    star: '★',
    diamond: '◆',
    triangle: '▶',
    chevron: '›',
    dash: '—',
    section: '§'
  },
  emoji: {
    dot: '🔹',
    dotSmall: '◾',
    dotMid: '🟠',
    circle: '⭕',
    fleuron: '🌟',
    checkmark: '✅',
    boxCross: '❌',
    boxCheck: '☑️',
    arrowDouble: '⤳',
    arrow: '➡️',
    arrowRight: '👉',
    arrowRightLong: '🔜',
    checkmarkHeavy: '👍',
    warning: '⚠️',
    squareSmall: '🔲',
    squareSolid: '🟫',
    star: '⭐',
    diamond: '💎',
    triangle: '📍',
    chevron: '›',
    dash: '➖',
    section: '📌'
  },
  mixed: {
    dot: '•',
    dotSmall: '·',
    dotMid: '∙',
    circle: '◦',
    fleuron: '❖',
    checkmark: '✔',
    boxCross: '☒',
    boxCheck: '☑',
    arrowDouble: '⇢',
    arrow: '➔',
    arrowRight: '➙',
    arrowRightLong: '➜',
    checkmarkHeavy: '✅',
    warning: '⚠️',
    squareSmall: '◼',
    squareSolid: '▪',
    star: '⭐',
    diamond: '◆',
    triangle: '▶',
    chevron: '›',
    dash: '—',
    section: '§'
  }
};

@Injectable({ providedIn: 'root' })
export class ComprehensivePdfExportService {
  constructor(private pdfService: PdfService) {}

  /**
   * Export comprehensive PDF with all content types
   */
  exportComprehensive(
    title: string,
    subtitle: string,
    sections: ComprehensivePdfSection[],
    options: ComprehensivePdfOptions = {}
  ): Promise<void> {
    const {
      includeTableOfContents = true,
      includeSectionHeaders = true,
      bulletStyle = 'unicode',
      compress = true
    } = options;

    const pdfLines: PdfLine[] = [];

    // Add Table of Contents
    if (includeTableOfContents && sections.length > 0) {
      pdfLines.push(
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

    // Process each section
    sections.forEach((section, sectionIndex) => {
      // Section header
      if (includeSectionHeaders) {
        pdfLines.push({
          type: 'heading',
          text: `${sectionIndex + 1}. ${section.title}`
        });
      }

      // Section content
      section.content.forEach((item, index) => {
        const pdfLine = this.convertToPdfLine(item, bulletStyle);
        if (pdfLine) {
          pdfLines.push(pdfLine);
        }
      });

      // Section divider
      if (sectionIndex < sections.length - 1) {
        pdfLines.push({ type: 'divider' });
      }
    });

    // Generate filename
    const filename = this.generateFilename(title, 'comprehensive');

    return this.pdfService.save(filename, title, subtitle, pdfLines);
  }

  /**
   * Export focused section PDF
   */
  exportSection(
    section: ComprehensivePdfSection,
    mainTitle: string,
    options: ComprehensivePdfOptions = {}
  ): Promise<void> {
    const { bulletStyle = 'unicode' } = options;

    const pdfLines: PdfLine[] = [
      { type: 'heading', text: section.title },
      { type: 'para', text: `From: ${mainTitle}` },
      { type: 'divider' }
    ];

    section.content.forEach(item => {
      const pdfLine = this.convertToPdfLine(item, bulletStyle);
      if (pdfLine) {
        pdfLines.push(pdfLine);
      }
    });

    const filename = this.generateFilename(section.title, 'section');

    return this.pdfService.save(
      filename,
      mainTitle,
      `Section: ${section.title}`,
      pdfLines
    );
  }

  /**
   * Export all sections separately
   */
  exportAllSections(
    sections: ComprehensivePdfSection[],
    mainTitle: string,
    options: ComprehensivePdfOptions = {}
  ): Promise<void[]> {
    return Promise.all(
      sections.map(section => this.exportSection(section, mainTitle, options))
    );
  }

  /**
   * Convert comprehensive content to PdfLine
   */
  private convertToPdfLine(
    item: ComprehensivePdfSection['content'][0],
    bulletStyle: string
  ): PdfLine | null {
    switch (item.kind) {
      case 'paragraph':
        return { type: 'para', text: item.text };

      case 'bullet':
        return {
          type: 'bullet',
          text: item.text,
          bulletStyle: (item.style || this.getRotatedBullet(bulletStyle)) as any
        };

      case 'heading':
        return { type: 'heading', text: item.text };

      case 'subheading':
        return { type: 'subheading', text: item.text };

      case 'table':
        return { type: 'table', rows: item.data.rows };

      case 'code':
        return {
          type: 'code',
          text: item.data.code,
          label: item.data.language || 'code'
        };

      case 'figure':
        return {
          type: 'para',
          text: `📊 ${item.data.title}${item.data.description ? ': ' + item.data.description : ''}`
        };

      case 'definition':
        return {
          type: 'definition',
          term: item.term,
          def: item.definition
        };

      case 'note':
        return {
          type: 'para',
          text: `📝 Note: ${item.text}`
        };

      case 'warning':
        return {
          type: 'para',
          text: `⚠️ Warning: ${item.text}`
        };

      case 'qa':
        return {
          type: 'qa-q',
          text: item.question
        };

      default:
        return null;
    }
  }

  /**
   * Get rotated bullet style
   */
  private getRotatedBullet(bulletStyle: string): string {
    const styles = [
      'dot',
      'circle',
      'checkmark',
      'arrow',
      'diamond',
      'fleuron',
      'boxCheck'
    ];
    const idx = Math.floor(Math.random() * styles.length);
    return styles[idx];
  }

  /**
   * Generate filename
   */
  private generateFilename(name: string, type: string): string {
    const sanitized = name.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${sanitized}_${type}_${timestamp}.pdf`;
  }

  /**
   * Get bullet symbol
   */
  getBulletSymbol(key: string, style: string = 'unicode'): string {
    const symbols = COMPREHENSIVE_BULLET_SYMBOLS[style as keyof typeof COMPREHENSIVE_BULLET_SYMBOLS];
    return symbols ? symbols[key as keyof typeof symbols] || '•' : '•';
  }

  /**
   * Get all available bullet symbols for a style
   */
  getAllBulletSymbols(style: string = 'unicode'): string[] {
    const symbols = COMPREHENSIVE_BULLET_SYMBOLS[style as keyof typeof COMPREHENSIVE_BULLET_SYMBOLS];
    return symbols ? Object.values(symbols) : [];
  }
}
