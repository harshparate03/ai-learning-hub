import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * AI loading indicator — uses assets/ai-loading.svg (built-in SMIL sparkle animation).
 * Do not stack CSS spin/pulse on top; the SVG animates on its own.
 */
@Component({
  selector: 'app-ai-spark',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img
      src="assets/ai-loading.svg"
      [width]="size"
      [height]="size"
      class="ai-spark-img"
      alt=""
      aria-hidden="true" />
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
      overflow: hidden;
    }

    .ai-spark-img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
  `]
})
export class AiSparkComponent {
  @Input() size: number = 40;
  /** @deprecated SVG has built-in animation — kept for API compat, ignored */
  @Input() spin: boolean = false;
  /** @deprecated SVG has built-in animation — kept for API compat, ignored */
  @Input() pulse: boolean = false;

  @HostBinding('style.width.px') get hostWidth() { return this.size; }
  @HostBinding('style.height.px') get hostHeight() { return this.size; }
}
