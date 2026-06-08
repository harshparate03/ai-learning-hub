import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { sanitizeUserInput } from '../utils/sanitize.util';

export interface GroqChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {

  private readonly GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly GROQ_KEY = environment.groqApiKey;

  private readonly GROQ_MODELS = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
  ];

  constructor(private http: HttpClient) {}

  private groqReq(model: string, messages: GroqChatMessage[], maxTokens = 8192): Observable<any> {
    return this.http.post(this.GROQ_URL, {
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens
    }, {
      headers: { Authorization: `Bearer ${this.GROQ_KEY}` },
      withCredentials: false
    });
  }

  private groqWithAllModels(messages: GroqChatMessage[], maxTokens = 8192): Observable<any> {
    const tryModel = (idx: number): Observable<any> => {
      if (idx >= this.GROQ_MODELS.length) {
        return throwError(() => new Error('All Groq models failed'));
      }
      return this.groqReq(this.GROQ_MODELS[idx], messages, maxTokens).pipe(
        catchError(err => {
          const wait$ = err?.status === 429 ? timer(3000) : timer(0);
          console.warn(`[Groq] ${this.GROQ_MODELS[idx]} failed (${err?.status}), trying next...`);
          return wait$.pipe(switchMap(() => tryModel(idx + 1)));
        })
      );
    };
    return tryModel(0);
  }

  generateWithGroq(prompt: string): Observable<any> {
    return this.groqWithAllModels([{ role: 'user', content: sanitizeUserInput(prompt, 50000) }]);
  }

  chatWithGroq(messages: GroqChatMessage[]): Observable<string> {
    const safeMessages: GroqChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful AI study assistant for students. Structure every answer for easy learning:

FORMATTING RULES:
- Start with a brief 1-2 sentence summary
- Use ## for main headings, ### for sub-headings
- Use bullet points for lists, numbered lists for steps
- Use markdown tables when comparing items
- Use \`\`\` code blocks for code examples
- Keep paragraphs short (2-4 sentences)
- End with a key takeaway

Use plain markdown only — no HTML. Be accurate and easy to understand.`
      },
      ...messages.map(m => ({
        role: m.role,
        content: sanitizeUserInput(m.content, 4000)
      }))
    ];

    return this.groqWithAllModels(safeMessages, 2048).pipe(
      map(res => this.extractTextFromResponse(res))
    );
  }

  generateAI(prompt: string): Observable<any> {
    return this.generateWithGroq(prompt);
  }

  extractTextFromResponse(res: any): string {
    if (!res) return '';
    const text = res?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text : '';
  }
}
