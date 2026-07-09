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
  private readonly ON_DEMAND_TOKEN_LIMIT = 28000; // safe budget per request (Groq free: 30k TPM)

  // Two API keys — primary and fallback
  private readonly API_KEYS: string[] = [
    environment.groqApiKey || '',
    (environment as any).groqApiKeyFallback || '',
  ].filter(k => !!k);

  private currentKeyIndex = 0;
  private get API_KEY(): string {
    return this.API_KEYS[this.currentKeyIndex % this.API_KEYS.length] || '';
  }
  private rotateKey() {
    if (this.API_KEYS.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.API_KEYS.length;
    }
  }

  // Current Groq production models — verified working July 2026
  private readonly GROQ_MODELS: GroqModel[] = [
    { id: 'llama-3.3-70b-versatile',              contextTokens: 131072, maxOutputTokens: 3072 },
    { id: 'llama-3.1-8b-instant',                 contextTokens: 131072, maxOutputTokens: 3072 },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', contextTokens: 131072, maxOutputTokens: 3072 },
    { id: 'qwen/qwen3-32b',                       contextTokens: 131072, maxOutputTokens: 3072 },
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
    const key = this.API_KEY;

    const directCall = (authKey: string) => {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${authKey}`,
        'Content-Type': 'application/json'
      });
      return this.http.post(this.GROQ_DIRECT_URL, body, { headers });
    };

    if (key) {
      return directCall(key).pipe(
        catchError(directErr => {
          const s = directErr?.status;

          // 429: rotate key, wait 8s, retry with new key
          if (s === 429) {
            this.rotateKey();
            return timer(8000).pipe(
              switchMap(() => directCall(this.API_KEY).pipe(
                catchError(retryErr => {
                  if (retryErr?.status === 429) {
                    // Still rate limited — try proxy
                    return timer(5000).pipe(
                      switchMap(() => this.http.post(this.GROQ_PROXY_URL, body))
                    );
                  }
                  return throwError(() => retryErr);
                })
              ))
            );
          }

          // 401: rotate key and retry once
          if (s === 401 && this.API_KEYS.length > 1) {
            this.rotateKey();
            return directCall(this.API_KEY).pipe(
              catchError(() => throwError(() => directErr))
            );
          }

          // Network error (status 0) or any other — try proxy as fallback
          if (s === 0 || s == null) {
            return this.http.post(this.GROQ_PROXY_URL, body).pipe(
              catchError(() => throwError(() => directErr))
            );
          }

          return throwError(() => directErr);
        })
      );
    }

    // No key — use proxy directly
    return this.http.post(this.GROQ_PROXY_URL, body);
  }

  // Rough chars-to-tokens ratio (1 token ≈ 4 chars for English)
  private charsToTokens(chars: number): number { return Math.ceil(chars / 4); }

  // Trim messages so total input tokens fit within the model's context window
  private fitToContext(messages: GroqChatMessage[], model: GroqModel, maxOutputTokens: number): GroqChatMessage[] {
    const budget = Math.max(500, Math.min(model.contextTokens - maxOutputTokens - 200, this.ON_DEMAND_TOKEN_LIMIT - maxOutputTokens));
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

    // Add non-system messages from newest to oldest. Truncate the newest message if needed.
    const nonSystem = messages.filter(m => m.role !== 'system').reverse();
    const kept: GroqChatMessage[] = [];
    for (const m of nonSystem) {
      const remaining = budget - total;
      if (remaining <= 0) break;
      const t = this.charsToTokens(m.content.length);
      if (t > remaining) {
        if (!kept.length) {
          kept.push({ ...m, content: m.content.slice(0, Math.max(1000, remaining * 4)) });
        }
        break;
      }
      kept.push(m);
      total += t;
    }
    return [...result, ...kept.reverse()];
  }

  private groqWithAllModels(messages: GroqChatMessage[], maxOutputTokens = 4096): Observable<any> {
    let lastErr: any = null;

    const tryModel = (idx: number): Observable<any> => {
      if (idx >= this.GROQ_MODELS.length) {
        // All models failed — last attempt via proxy with first model
        const model = this.GROQ_MODELS[0];
        const safeOutput = Math.min(maxOutputTokens, model.maxOutputTokens);
        const fittedMessages = this.fitToContext(messages, model, safeOutput);
        const body = { model: model.id, messages: fittedMessages, temperature: 0.3, max_tokens: safeOutput };
        return this.http.post(this.GROQ_PROXY_URL, body).pipe(
          timeout(60000),
          catchError(() => throwError(() => lastErr || {
            status: 503,
            message: 'All AI models are currently unavailable. Please try again later.'
          }))
        );
      }

      const model = this.GROQ_MODELS[idx];
      const safeOutput = Math.min(maxOutputTokens, model.maxOutputTokens);
      const fittedMessages = this.fitToContext(messages, model, safeOutput);

      return this.groqReq(model, fittedMessages, safeOutput).pipe(
        timeout(90000),
        catchError(err => {
          const status = err?.status;
          lastErr = err;
          console.warn(`[Groq] ${model.id} failed (${status ?? 'unknown'}), trying next model...`);

          // Hard stops — bad key, don't loop further
          if (status === 401 || status === 403) return throwError(() => err);

          // 429: rotate key, wait, then try next model
          if (status === 429) {
            this.rotateKey();
            return timer(12000).pipe(switchMap(() => tryModel(idx + 1)));
          }

          // status 0 = network unreachable — try next model after short wait
          // (don't stop the chain; proxy might still work)
          const wait$ = status === 0 ? timer(1000) : timer(500);
          return wait$.pipe(switchMap(() => tryModel(idx + 1)));
        })
      );
    };
    return tryModel(0);
  }

  generateWithGroq(prompt: string, maxOutputTokens = 1536): Observable<any> {
    return this.groqWithAllModels([{ role: 'user', content: sanitizeUserInput(prompt, 24000) }], maxOutputTokens);
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
    const groqMsg: string = err?.error?.error?.message || err?.error?.message || err?.message || '';
    const status = err?.status ?? err?.error?.status;
    if (status === 401 || status === 403) return 'API key is invalid or blocked. Please check your Groq API key.';
    if (status === 429) return groqMsg || 'Groq rate limit reached. Please wait a moment and try again.';
    if (status === 408 || err?.name === 'TimeoutError') return 'Request timed out. Please try again.';
    if (status === 0) return 'Network error. Please check your internet connection.';
    if (status === 400) return groqMsg || 'Request was too large or invalid. Please try a shorter video/context.';
    if (status === 503) return groqMsg || 'AI service is temporarily unavailable. Please try again later.';
    return groqMsg || 'AI request failed. Please try again.';
  }
}

