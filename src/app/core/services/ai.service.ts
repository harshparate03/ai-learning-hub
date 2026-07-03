import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, map, switchMap, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { sanitizeUserInput } from '../utils/sanitize.util';

export interface GroqChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Active Groq models with their context window and safe max_tokens
interface GroqModel {
  id: string;
  contextTokens: number;  // total context window
  maxOutputTokens: number; // safe output limit
}

@Injectable({ providedIn: 'root' })
export class AiService {

  private readonly GROQ_DIRECT_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly GROQ_PROXY_URL  = '/api/groq';
  private readonly API_KEY  = environment.groqApiKey || '';

  // Only active, non-deprecated Groq models (verified 2025)
  private readonly GROQ_MODELS: GroqModel[] = [
    { id: 'llama-3.3-70b-versatile',  contextTokens: 128000, maxOutputTokens: 8192 },
    { id: 'llama-3.1-8b-instant',     contextTokens: 128000, maxOutputTokens: 8192 },
    { id: 'llama-3.2-3b-preview',     contextTokens: 8192,   maxOutputTokens: 4096 },
    { id: 'llama-3.2-1b-preview',     contextTokens: 8192,   maxOutputTokens: 4096 },
  ];

  static readonly PROXY_ERROR =
    'AI service unavailable. Please check your internet connection and try again.';

  constructor(private http: HttpClient) {}

  isDemoFallback(text: string): boolean {
    if (!text) return false;
    const t = text.trim();
    return t.includes('demonstration response') || t.includes('demonstration mind map');
  }

  private groqReq(model: GroqModel, messages: GroqChatMessage[], maxOutputTokens: number): Observable<any> {
    const body = { model: model.id, messages, temperature: 0.3, max_tokens: maxOutputTokens };
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.API_KEY}`,
      'Content-Type': 'application/json'
    });
    // Use direct Groq API when key is available, proxy as fallback
    if (this.API_KEY) {
      return this.http.post(this.GROQ_DIRECT_URL, body, { headers }).pipe(
        catchError(directErr => {
          // On network error only, try proxy
          if (directErr?.status === 0) {
            return this.http.post(this.GROQ_PROXY_URL, body);
          }
          return throwError(() => directErr);
        })
      );
    }
    // No key — try proxy
    return this.http.post(this.GROQ_PROXY_URL, body);
  }

  // Rough chars-to-tokens ratio (1 token ≈ 4 chars for English)
  private charsToTokens(chars: number): number { return Math.ceil(chars / 4); }

  // Trim messages so total input tokens fit within the model's context window
  private fitToContext(messages: GroqChatMessage[], model: GroqModel, maxOutputTokens: number): GroqChatMessage[] {
    const budget = model.contextTokens - maxOutputTokens - 200; // 200 token safety margin
    let total = 0;
    const result: GroqChatMessage[] = [];

    // Always keep system message first
    const system = messages.find(m => m.role === 'system');
    if (system) {
      const sysTokens = this.charsToTokens(system.content.length);
      if (sysTokens < budget) {
        result.push(system);
        total += sysTokens;
      } else {
        // Truncate system message to fit
        const maxChars = budget * 4 * 0.7; // use 70% of budget for system
        result.push({ ...system, content: system.content.slice(0, maxChars) });
        total += Math.ceil(maxChars / 4);
      }
    }

    // Add non-system messages from newest to oldest, then reverse
    const nonSystem = messages.filter(m => m.role !== 'system').reverse();
    const kept: GroqChatMessage[] = [];
    for (const m of nonSystem) {
      const t = this.charsToTokens(m.content.length);
      if (total + t > budget) break;
      kept.push(m);
      total += t;
    }
    return [...result, ...kept.reverse()];
  }

  private groqWithAllModels(messages: GroqChatMessage[], maxOutputTokens = 4096): Observable<any> {
    const tryModel = (idx: number): Observable<any> => {
      if (idx >= this.GROQ_MODELS.length) {
        return throwError(() => ({
          status: 503,
          message: 'All AI models are currently unavailable. Please try again later.'
        }));
      }
      const model = this.GROQ_MODELS[idx];
      const safeOutput = Math.min(maxOutputTokens, model.maxOutputTokens);
      const fittedMessages = this.fitToContext(messages, model, safeOutput);

      return this.groqReq(model, fittedMessages, safeOutput).pipe(
        timeout(60000),
        catchError(err => {
          const status   = err?.status;
          const groqMsg: string = err?.error?.error?.message || '';
          console.warn('[Groq] Model failed, trying next...');

          // Auth failure — stop immediately
          if (status === 401 || status === 403) return throwError(() => err);
          // Network error — stop immediately
          if (status === 0) return throwError(() => err);
          // Any 400 — try next model (could be deprecation, context limit, or model-specific issue)
          // Everything else (429, 5xx, 400) — try next model
          const wait$ = status === 429 ? timer(3000) : timer(300);
          return wait$.pipe(switchMap(() => tryModel(idx + 1)));
        })
      );
    };
    return tryModel(0);
  }

  generateWithGroq(prompt: string): Observable<any> {
    return this.groqWithAllModels([{ role: 'user', content: sanitizeUserInput(prompt, 50000) }], 8192);
  }

  chatWithGroq(messages: GroqChatMessage[], options?: { skipDefaultSystem?: boolean }): Observable<string> {
    const sanitize = (m: GroqChatMessage): GroqChatMessage => ({
      ...m,
      content: sanitizeUserInput(m.content, 60000) // sanitize only, no aggressive truncation
    });

    const safeMessages: GroqChatMessage[] = options?.skipDefaultSystem
      ? messages.map(sanitize)
      : [
          {
            role: 'system',
            content: `You are a helpful AI study assistant. Structure every answer for easy learning:
- Start with a brief summary
- Use ## headings, ### sub-headings, bullet points, numbered lists
- Use markdown tables when comparing items; use \`\`\` code blocks for code
- Keep paragraphs short; end with a key takeaway
Use plain markdown only — no HTML.`
          },
          ...messages.map(sanitize)
        ];

    return this.groqWithAllModels(safeMessages, 4096).pipe(
      map(res => {
        const text = this.extractTextFromResponse(res);
        if (this.isDemoFallback(text)) throw { status: 0, message: AiService.PROXY_ERROR };
        return text;
      }),
      catchError(err => {
        if (err?.name === 'TimeoutError') {
          return throwError(() => ({ status: 408, message: 'Request timed out. Please try again.' }));
        }
        if (err?.status === 0) {
          return throwError(() => ({ status: 0, message: 'Network error. Please check your internet connection.' }));
        }
        return throwError(() => err);
      })
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

  proxyErrorMessage(err: any): string {
    const groqMsg: string = err?.error?.error?.message || '';
    if (err?.status === 401 || err?.status === 403) return 'API key is invalid. Please check your Groq API key.';
    if (err?.status === 429) return 'Rate limit reached. Please wait a moment and try again.';
    if (err?.status === 408 || err?.name === 'TimeoutError') return 'Request timed out. Please try again.';
    if (err?.status === 0) return 'Network error. Please check your internet connection.';
    if (err?.status === 400) return 'Request was too large. Please try a shorter message.';
    if (err?.status === 503) return 'All AI models are currently unavailable. Please try again later.';
    return err?.message || 'AI request failed. Please try again.';
  }
}
