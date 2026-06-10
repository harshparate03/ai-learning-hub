import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { sanitizeUserInput } from '../utils/sanitize.util';

export interface GroqChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {

  private readonly GROQ_PROXY_URL  = '/api/groq';
  private readonly GROQ_DIRECT_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly API_KEY         = environment.groqApiKey ||
                                     '';

  // Valid Groq models (2025)
  private readonly GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'mixtral-8x7b-32768'
  ];

  static readonly PROXY_ERROR =
    'AI service unavailable. Please check your internet connection and try again.';

  // Track whether proxy is available so we don't keep retrying it
  private proxyAvailable: boolean | null = null;

  constructor(private http: HttpClient) {}

  isDemoFallback(text: string): boolean {
    if (!text) return false;
    const t = text.trim();
    return t.includes('This is a demonstration response showing how the summarizer structures content when the API is unavailable') ||
           t.includes('demonstration mind map showing how AI Learning Hub');
  }

  checkProxyHealth(): Observable<boolean> {
    return this.http.get<{ status: string }>('/health').pipe(
      map(res => res?.status === 'ok'),
      catchError(() => of(false))
    );
  }

  /** Call Groq â€” always try direct API first when key is available, proxy as fallback */
  private groqReq(model: string, messages: GroqChatMessage[], maxTokens = 8192): Observable<any> {
    const body    = { model, messages, temperature: 0.3, max_tokens: maxTokens };
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.API_KEY}`,
      'Content-Type': 'application/json'
    });

    // If key is available, go direct. Fall back to proxy on network error only.
    if (this.API_KEY) {
      return this.http.post(this.GROQ_DIRECT_URL, body, { headers }).pipe(
        catchError(directErr => {
          const s = directErr?.status;
          // On pure network error (no connection), try proxy
          if (s === 0 || s === undefined) {
            return this.http.post(this.GROQ_PROXY_URL, body).pipe(
              catchError(() => {
                this.proxyAvailable = false;
                return throwError(() => directErr);
              })
            );
          }
          return throwError(() => directErr);
        })
      );
    }

    // No key â€” try proxy first
    if (this.proxyAvailable === false) {
      return throwError(() => ({ status: 503, message: 'No AI service available.' }));
    }
    return this.http.post(this.GROQ_PROXY_URL, body).pipe(
      catchError(proxyErr => {
        const s = proxyErr?.status;
        if (s === 0 || s === undefined || s === 504) {
          this.proxyAvailable = false;
          console.warn('[Groq] Proxy unavailable, using direct API...');
          return this.http.post(this.GROQ_DIRECT_URL, body, { headers });
        }
        return throwError(() => proxyErr);
      })
    );
  }

  private groqWithAllModels(messages: GroqChatMessage[], maxTokens = 8192): Observable<any> {
    const tryModel = (idx: number): Observable<any> => {
      if (idx >= this.GROQ_MODELS.length) {
        return throwError(() => ({
          status: 503,
          message: 'All AI models failed. Please check your internet connection and try again.'
        }));
      }
      return this.groqReq(this.GROQ_MODELS[idx], messages, maxTokens).pipe(
        catchError(err => {
          const status = err?.status;
          if (status === 401 || status === 403) return throwError(() => err);
          const wait$ = status === 429 ? timer(3000) : timer(500);
          console.warn(`[Groq] Model ${this.GROQ_MODELS[idx]} failed (${status}), trying next...`);
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

Use plain markdown only â€” no HTML. Be accurate and easy to understand.`
      },
      ...messages.map(m => ({
        role: m.role,
        content: sanitizeUserInput(m.content, 4000)
      }))
    ];

    return this.groqWithAllModels(safeMessages, 2048).pipe(
      map(res => {
        const text = this.extractTextFromResponse(res);
        if (this.isDemoFallback(text)) {
          throw { status: 0, message: AiService.PROXY_ERROR };
        }
        return text;
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
    if (err?.status === 401 || err?.status === 403) {
      return 'API key is invalid. Please check your Groq API key.';
    }
    if (err?.status === 429) {
      return 'Rate limit reached. Please wait a moment and try again.';
    }
    return err?.message || err?.error?.error?.message || 'AI request failed. Please try again.';
  }
}

