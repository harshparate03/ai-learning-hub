import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * AiLoaderComponent
 *
 * Animated 4-pointed star used everywhere AI is processing.
 *
 * Usage:
 *   <!-- Default (56px, centered, with text) -->
 *   <app-ai-loader message="AI is processing..."></app-ai-loader>
 *
 *   <!-- Small inline (28px, horizontal) -->
 *   <app-ai-loader class="sm" message="Analyzing..."></app-ai-loader>
 *
 *   <!-- Inline row (icon + text side by side) -->
 *   <app-ai-loader class="inline" message="Building..."></app-ai-loader>
 *
 *   <!-- Large panel loading (80px) -->
 *   <app-ai-loader class="lg" message="Generating mind map..."></app-ai-loader>
 *
 *   <!-- No text — icon only -->
 *   <app-ai-loader></app-ai-loader>
 */
@Component({
  selector: 'app-ai-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-loader.component.html',
  styleUrls: ['./ai-loader.component.css']
})
export class AiLoaderComponent {
  @Input() message: string = '';
}
