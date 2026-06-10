/**
 * Complete Example: Comprehensive PDF Export with All Content Types
 * 
 * This example demonstrates exporting ALL content types to PDF:
 * - Summary with bullet points
 * - Key Points with structured data
 * - Study Notes with definitions
 * - Code blocks with syntax highlighting
 * - Visuals/Diagrams
 * - Quiz/Q&A
 * - Tables with proper formatting
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComprehensivePdfExportComponent } from '../shared/comprehensive-pdf-export/comprehensive-pdf-export.component';
import { ComprehensivePdfSection, ComprehensivePdfExportService } from '../core/services/comprehensive-pdf-export.service';

@Component({
  selector: 'app-complete-pdf-example',
  standalone: true,
  imports: [CommonModule, ComprehensivePdfExportComponent],
  template: `
    <div class="example-container">
      <!-- Title -->
      <header class="header">
        <h1>Angular Fundamentals - Complete Study Material</h1>
        <p>Comprehensive guide with Summary, Key Points, Notes, Code, Visuals, and Quiz</p>
      </header>

      <!-- PDF Export Component -->
      <section class="export-section">
        <app-comprehensive-pdf-export
          [title]="'Angular Fundamentals'"
          [subtitle]="'Complete Study Material with All Content Types'"
          [sections]="allSections"
        ></app-comprehensive-pdf-export>
      </section>

      <!-- Preview of Content -->
      <section class="content-preview">
        <h2>📋 Content Overview</h2>
        <div class="section-cards">
          <div *ngFor="let section of allSections" class="section-card">
            <h3>{{ section.title }}</h3>
            <p>{{ section.content.length }} items</p>
            <span class="section-type" [class]="section.type">{{ section.type }}</span>
          </div>
        </div>
      </section>

      <!-- Detailed Content Display -->
      <div *ngFor="let section of allSections" class="section-content">
        <h2>{{ section.title }}</h2>
        <div class="content-items">
          <div *ngFor="let item of section.content | slice:0:5" class="content-item">
            <ng-container [ngSwitch]="item.kind">
              <div *ngSwitchCase="'paragraph'">
                <p>{{ item.text }}</p>
              </div>
              <div *ngSwitchCase="'bullet'">
                <div class="bullet-preview">
                  <span class="bullet-symbol">•</span>
                  <span>{{ item.text }}</span>
                </div>
              </div>
              <div *ngSwitchCase="'heading'">
                <h4>{{ item.text }}</h4>
              </div>
              <div *ngSwitchCase="'table'">
                <div class="table-preview">
                  <strong>Table: {{ item.data.headers.length }} columns, {{ item.data.rows.length }} rows</strong>
                </div>
              </div>
              <div *ngSwitchCase="'code'">
                <div class="code-preview">
                  <strong>Code ({{ item.data.language }}): {{ item.data.code.length }} chars</strong>
                </div>
              </div>
              <div *ngSwitchCase="'qa'">
                <div class="qa-preview">
                  <strong>Q:</strong> {{ item.question }}
                </div>
              </div>
            </ng-container>
          </div>
          <p *ngIf="section.content.length > 5" class="more-items">
            ... and {{ section.content.length - 5 }} more items
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .example-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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

    .header p {
      font-size: 16px;
      color: #6b7280;
      margin: 0;
    }

    .export-section {
      margin-bottom: 40px;
    }

    .content-preview {
      margin-bottom: 40px;
      padding: 24px;
      background: #f9fafb;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .content-preview h2 {
      margin: 0 0 20px 0;
      font-size: 20px;
      color: #1f2937;
    }

    .section-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .section-card {
      padding: 16px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }

    .section-card h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #1f2937;
    }

    .section-card p {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #6b7280;
    }

    .section-type {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: #e0e7ff;
      color: #4338ca;
    }

    .section-type.summary { background: #dbeafe; color: #0369a1; }
    .section-type.keypoints { background: #fef3c7; color: #92400e; }
    .section-type.notes { background: #e9d5ff; color: #6b21a8; }
    .section-type.code { background: #dcfce7; color: #166534; }
    .section-type.visuals { background: #fee2e2; color: #b91c1c; }
    .section-type.quiz { background: #f3e8ff; color: #7e22ce; }

    .section-content {
      margin-bottom: 40px;
      padding: 24px;
      background: white;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .section-content h2 {
      margin: 0 0 20px 0;
      font-size: 24px;
      color: #1f2937;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }

    .content-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .content-item {
      padding: 12px;
      background: #f9fafb;
      border-radius: 6px;
      border-left: 3px solid #667eea;
    }

    .content-item p {
      margin: 0;
      font-size: 14px;
      color: #374151;
      line-height: 1.6;
    }

    .content-item h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    }

    .bullet-preview {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: 14px;
      color: #374151;
    }

    .bullet-symbol {
      color: #667eea;
      font-weight: 600;
      flex-shrink: 0;
    }

    .table-preview,
    .code-preview,
    .qa-preview {
      padding: 12px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-size: 13px;
      color: #374151;
    }

    .table-preview { border-left: 3px solid #06b6d4; }
    .code-preview { border-left: 3px solid #8b5cf6; }
    .qa-preview { border-left: 3px solid #f59e0b; }

    .more-items {
      margin: 12px 0 0 0;
      font-size: 13px;
      color: #9ca3af;
      font-style: italic;
    }

    @media (max-width: 768px) {
      .example-container {
        padding: 16px;
      }

      .header h1 {
        font-size: 24px;
      }

      .section-cards {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CompletePdfExampleComponent implements OnInit {
  allSections: ComprehensivePdfSection[] = [];

  constructor(private pdfService: ComprehensivePdfExportService) {}

  ngOnInit(): void {
    this.initializeSections();
  }

  /**
   * Initialize all sections with comprehensive content
   */
  private initializeSections(): void {
    this.allSections = [
      // ───── SUMMARY SECTION ─────
      {
        type: 'summary',
        title: 'Summary',
        content: [
          {
            kind: 'paragraph',
            text: 'Angular is a comprehensive framework for building scalable, maintainable web applications. It provides a complete toolkit including TypeScript, reactive forms, HTTP client, routing, and dependency injection out of the box.'
          },
          {
            kind: 'heading',
            text: 'What is Angular?'
          },
          {
            kind: 'bullet',
            text: 'Full-featured JavaScript framework built with TypeScript'
          },
          {
            kind: 'bullet',
            text: 'Component-based architecture for modular development'
          },
          {
            kind: 'bullet',
            text: 'Built-in dependency injection system'
          },
          {
            kind: 'bullet',
            text: 'RxJS integration for reactive programming'
          },
          {
            kind: 'bullet',
            text: 'Powerful CLI for scaffolding and building'
          },
          {
            kind: 'bullet',
            text: 'Strong typing with TypeScript support'
          }
        ]
      },

      // ───── KEY POINTS SECTION ─────
      {
        type: 'keypoints',
        title: 'Key Points',
        content: [
          {
            kind: 'heading',
            text: 'Essential Concepts'
          },
          {
            kind: 'subheading',
            text: '1. Components'
          },
          {
            kind: 'paragraph',
            text: 'Components are the basic building blocks of Angular applications.'
          },
          {
            kind: 'definition',
            term: 'Component',
            definition: 'A class with decorator @Component() that defines a view using template and styles. Components handle user interaction and application logic.'
          },
          {
            kind: 'subheading',
            text: '2. Services'
          },
          {
            kind: 'paragraph',
            text: 'Services contain business logic and can be shared across components.'
          },
          {
            kind: 'definition',
            term: 'Service',
            definition: 'A class with decorator @Injectable() that provides functionality to components and other services through dependency injection.'
          },
          {
            kind: 'subheading',
            text: '3. Dependency Injection'
          },
          {
            kind: 'bullet',
            text: 'Decouples components from services'
          },
          {
            kind: 'bullet',
            text: 'Makes testing easier with mock services'
          },
          {
            kind: 'bullet',
            text: 'Provides singleton services across the app'
          }
        ]
      },

      // ───── STUDY NOTES SECTION ─────
      {
        type: 'notes',
        title: 'Study Notes',
        content: [
          {
            kind: 'heading',
            text: 'Important Concepts to Remember'
          },
          {
            kind: 'note',
            text: 'Always use strong typing with TypeScript - do not use any type'
          },
          {
            kind: 'note',
            text: 'Prefer functional components with OnPush change detection'
          },
          {
            kind: 'warning',
            text: 'Avoid unsubscribing from subscriptions - use async pipe or takeUntilDestroyed'
          },
          {
            kind: 'warning',
            text: 'Do not subscribe in component constructor - use ngOnInit'
          },
          {
            kind: 'heading',
            text: 'Best Practices'
          },
          {
            kind: 'bullet',
            text: 'Use standalone components (Angular 14+)'
          },
          {
            kind: 'bullet',
            text: 'Implement OnDestroy for cleanup'
          },
          {
            kind: 'bullet',
            text: 'Use trackBy in *ngFor loops'
          },
          {
            kind: 'bullet',
            text: 'Lazy load feature modules'
          },
          {
            kind: 'bullet',
            text: 'Use HttpInterceptor for centralized error handling'
          }
        ]
      },

      // ───── CODE SECTION ─────
      {
        type: 'code',
        title: 'Code Examples',
        content: [
          {
            kind: 'heading',
            text: 'Basic Component'
          },
          {
            kind: 'code',
            data: {
              language: 'typescript',
              code: `import { Component } from '@angular/core';

@Component({
  selector: 'app-hello',
  template: '<h1>Hello {{name}}</h1>',
  standalone: true
})
export class HelloComponent {
  name = 'Angular';
}`
            }
          },
          {
            kind: 'heading',
            text: 'Service with HttpClient'
          },
          {
            kind: 'code',
            data: {
              language: 'typescript',
              code: `import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}
  
  getData(): Observable<any> {
    return this.http.get('/api/data');
  }
}`
            }
          },
          {
            kind: 'heading',
            text: 'Component with Form'
          },
          {
            kind: 'code',
            data: {
              language: 'typescript',
              code: `import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form',
  template: '<form [formGroup]="form"><input formControlName="email"></form>',
  standalone: true,
  imports: [ReactiveFormsModule]
})
export class FormComponent {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });
  
  constructor(private fb: FormBuilder) {}
}`
            }
          }
        ]
      },

      // ───── VISUALS SECTION ─────
      {
        type: 'visuals',
        title: 'Visual Diagrams & Architecture',
        content: [
          {
            kind: 'heading',
            text: 'Component Architecture'
          },
          {
            kind: 'figure',
            data: {
              title: 'Angular Component Tree',
              description: 'Hierarchical structure of components in an Angular application',
              type: 'diagram'
            }
          },
          {
            kind: 'heading',
            text: 'Data Flow'
          },
          {
            kind: 'figure',
            data: {
              title: 'Component Communication',
              description: 'Parent-child and service-based communication patterns',
              type: 'diagram'
            }
          },
          {
            kind: 'heading',
            text: 'Module Dependencies'
          },
          {
            kind: 'figure',
            data: {
              title: 'Dependency Injection Graph',
              description: 'How services are provided and injected into components',
              type: 'diagram'
            }
          },
          {
            kind: 'heading',
            text: 'HTTP Request Flow'
          },
          {
            kind: 'figure',
            data: {
              title: 'HttpClient with Interceptors',
              description: 'Request/response interception and error handling',
              type: 'diagram'
            }
          }
        ]
      },

      // ───── QUIZ SECTION ─────
      {
        type: 'quiz',
        title: 'Practice Quiz',
        content: [
          {
            kind: 'heading',
            text: 'Self-Assessment Questions'
          },
          {
            kind: 'qa',
            question: 'What is a component in Angular?',
            answer: 'A component is a class decorated with @Component() that encapsulates a view (template), styles, and component logic. It is the basic building block of Angular applications.'
          },
          {
            kind: 'qa',
            question: 'How do you create a service in Angular?',
            answer: 'Create a class decorated with @Injectable() and provide it in a module or component using the providedIn property. Example: @Injectable({ providedIn: \'root\' })'
          },
          {
            kind: 'qa',
            question: 'What is dependency injection?',
            answer: 'Dependency injection is a design pattern where dependencies are provided to a class from external sources rather than being created internally. Angular provides a built-in DI system.'
          },
          {
            kind: 'qa',
            question: 'What is RxJS and why is it important in Angular?',
            answer: 'RxJS is a library for reactive programming using Observables. It is important in Angular because HttpClient and many other Angular features return Observables for handling asynchronous operations.'
          },
          {
            kind: 'qa',
            question: 'What is the difference between property binding and event binding?',
            answer: 'Property binding uses [property]="value" to set component properties from template. Event binding uses (event)="handler()" to listen for DOM events and execute handlers.'
          },
          {
            kind: 'qa',
            question: 'How do you handle form validation in Angular?',
            answer: 'Use Reactive Forms (FormBuilder, FormGroup, FormControl) with validators. Example: fb.group({ email: [\'\', [Validators.required, Validators.email]] })'
          }
        ]
      },

      // ───── TABLES SECTION ─────
      {
        type: 'summary',
        title: 'Reference Tables',
        content: [
          {
            kind: 'heading',
            text: 'Angular Decorators'
          },
          {
            kind: 'table',
            data: {
              headers: ['Decorator', 'Purpose', 'Example'],
              rows: [
                ['@Component', 'Defines a component', '@Component({ selector: \'app\', template: \'<h1>Hi</h1>\' })'],
                ['@Injectable', 'Marks a class as injectable', '@Injectable({ providedIn: \'root\' })'],
                ['@Input', 'Marks a property as input', '@Input() name: string;'],
                ['@Output', 'Marks a property as output', '@Output() click = new EventEmitter();'],
                ['@Directive', 'Defines an attribute directive', '@Directive({ selector: \'[appHighlight]\' })']
              ]
            }
          },
          {
            kind: 'heading',
            text: 'Change Detection Strategies'
          },
          {
            kind: 'table',
            data: {
              headers: ['Strategy', 'When Used', 'Performance'],
              rows: [
                ['Default', 'Check on every event', 'Slower'],
                ['OnPush', 'Check when inputs change', 'Faster'],
                ['Custom', 'Manual control', 'Most Control']
              ]
            }
          },
          {
            kind: 'heading',
            text: 'Common RxJS Operators'
          },
          {
            kind: 'table',
            data: {
              headers: ['Operator', 'Purpose', 'Use Case'],
              rows: [
                ['map', 'Transform values', 'Converting API responses'],
                ['filter', 'Filter values', 'Conditional processing'],
                ['switchMap', 'Switch to new observable', 'Dependent API calls'],
                ['tap', 'Side effects', 'Logging, debugging'],
                ['debounceTime', 'Delay emission', 'Search input handling']
              ]
            }
          }
        ]
      }
    ];
  }
}
