import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../core/services/ai.service';
import { sanitizeUserInput } from '../../core/utils/sanitize.util';
import { parseChatContent, ChatBlock } from '../../core/utils/chat-format.util';
import { AiSparkComponent } from '../ai-spark/ai-spark.component';
import { LogoComponent } from '../logo/logo.component';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, AiSparkComponent, LogoComponent],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotComponent implements AfterViewChecked {

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('messagesEnd') messagesEnd?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI study assistant.\n\nAsk me about any topic — I\'ll give you:\n- Clear explanations\n- Bullet-point summaries\n- Tables and diagrams when helpful\n\nWhat would you like to learn?',
      timestamp: new Date()
    }
  ];

  inputText = '';
  loading = false;
  errorMsg = '';
  private shouldScroll = false;

  constructor(private ai: AiService) {}

  parseMessage(text: string): ChatBlock[] {
    return parseChatContent(text);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  close(): void {
    this.closed.emit();
  }

  send(): void {
    const text = sanitizeUserInput(this.inputText, 4000);
    if (!text || this.loading) return;

    this.inputText = '';
    this.errorMsg = '';
    this.messages.push({ role: 'user', content: text, timestamp: new Date() });
    this.loading = true;
    this.shouldScroll = true;

    const history = this.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content }));

    this.ai.chatWithGroq(history).subscribe({
      next: (reply) => {
        this.messages.push({
          role: 'assistant',
          content: reply || 'I could not generate a response. Please try again.',
          timestamp: new Date()
        });
        this.loading = false;
        this.shouldScroll = true;
      },
      error: () => {
        this.errorMsg = 'Failed to get a response. Please try again.';
        this.loading = false;
        this.shouldScroll = true;
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  clearChat(): void {
    this.messages = [{
      role: 'assistant',
      content: 'Chat cleared. What would you like to learn about?',
      timestamp: new Date()
    }];
    this.errorMsg = '';
  }

  private scrollToBottom(): void {
    const el = this.messagesEnd?.nativeElement;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}
