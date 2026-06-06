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

  private readonly GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly GROQ_KEY   = environment.groqApiKey;
  private readonly GROQ_MODEL_PRIMARY  = 'meta-llama/llama-4-scout-17b-16e-instruct';
  private readonly GROQ_MODEL_FALLBACK = 'llama-3.3-70b-versatile';

  private readonly GEMINI_KEYS = environment.geminiApiKeys;
  private geminiKeyIdx = 0;
  private get GEMINI_KEY(): string {
    const k = this.GEMINI_KEYS[this.geminiKeyIdx % this.GEMINI_KEYS.length];
    this.geminiKeyIdx++;
    return k;
  }
  private readonly GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(private http: HttpClient) {}

  // ── Groq ──────────────────────────────────────────────────────────────────

  private groqReq(model: string, messages: GroqChatMessage[]): Observable<any> {
    return this.http.post(this.GROQ_URL, {
      model,
      messages,
      temperature: 0.3,
      max_tokens: 8192
    }, {
      headers: { Authorization: `Bearer ${this.GROQ_KEY}` },
      withCredentials: false
    });
  }

  private groqChatReq(model: string, messages: GroqChatMessage[]): Observable<any> {
    return this.http.post(this.GROQ_URL, {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048
    }, {
      headers: { Authorization: `Bearer ${this.GROQ_KEY}` },
      withCredentials: false
    });
  }

  /**
   * generateWithGroq:
   *  1. Try primary model
   *  2. On 429 (rate-limit) → wait 4 s and retry with fallback model
   *  3. On other errors → immediately try fallback model
   *  4. If fallback also fails → try Gemini
   */
  generateWithGroq(prompt: string): Observable<any> {
    const safePrompt = sanitizeUserInput(prompt, 50000);
    return this.groqReq(this.GROQ_MODEL_PRIMARY, [{ role: 'user', content: safePrompt }]).pipe(
      catchError(err => {
        const status = err?.status;
        const isRateLimit = status === 429;
        const delay$ = isRateLimit ? timer(4000) : timer(0);

        if (isRateLimit) {
          console.warn('[Groq] Rate-limited (429). Retrying with fallback model in 4 s...');
        } else {
          console.warn(`[Groq] Primary model failed (${status}). Trying fallback...`);
        }

        return delay$.pipe(
          switchMap(() => this.groqReq(this.GROQ_MODEL_FALLBACK, [{ role: 'user', content: safePrompt }]))
        );
      }),
      catchError(err2 => {
        console.warn(`[Groq] Fallback model failed (${err2?.status}). Trying Gemini...`);
        return this.generateWithGemini(safePrompt);
      })
    );
  }

  /** Multi-turn chat for the navbar chatbot. */
  chatWithGroq(messages: GroqChatMessage[]): Observable<string> {
    const safeMessages: GroqChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful AI study assistant for students. Structure every answer for easy learning:

FORMATTING RULES (always follow):
- Start with a brief 1-2 sentence summary
- Use ## for main section headings
- Use ### for sub-section headings
- Use bullet points (- item) for lists of concepts, steps, or tips
- Use numbered lists (1. item) for sequential steps
- Use markdown tables (| Col1 | Col2 |) when comparing items or showing data
- Use \`\`\` code blocks for code examples
- Use \`\`\` ASCII art diagrams inside code blocks when a visual helps (flowcharts, trees, graphs)
- Keep paragraphs short (2-4 sentences max)
- End with a key takeaway or quick recap when helpful

Use plain text markdown only — no HTML tags. Be accurate, educational, and easy to understand.`
      },
      ...messages.map(m => ({
        role: m.role,
        content: sanitizeUserInput(m.content, 4000)
      }))
    ];

    return this.groqChatReq(this.GROQ_MODEL_PRIMARY, safeMessages).pipe(
      map(res => this.extractTextFromResponse(res)),
      catchError(err => {
        if (err?.status === 429) {
          return timer(3000).pipe(
            switchMap(() => this.groqChatReq(this.GROQ_MODEL_FALLBACK, safeMessages)),
            map(res => this.extractTextFromResponse(res))
          );
        }
        return throwError(() => err);
      })
    );
  }

  // ── Gemini ────────────────────────────────────────────────────────────────

  generateWithGemini(prompt: string): Observable<any> {
    const safePrompt = sanitizeUserInput(prompt, 50000);
    const body = { contents: [{ parts: [{ text: safePrompt }] }] };
    return this.http.post(
      `${this.GEMINI_BASE}/gemini-2.0-flash:generateContent`,
      body,
      { headers: { 'X-goog-api-key': this.GEMINI_KEY } }
    ).pipe(
      catchError(err => {
        console.error('[Gemini] Failed:', err?.status, err?.error?.error?.message);
        return throwError(() => err);
      })
    );
  }

  generateWithGeminiVideo(prompt: string, videoUrl: string): Observable<any> {
    const safePrompt = sanitizeUserInput(`${prompt}\n\nYouTube Video URL: ${videoUrl}`, 50000);
    const body = { contents: [{ parts: [{ text: safePrompt }] }] };
    return this.http.post(
      `${this.GEMINI_BASE}/gemini-2.0-flash:generateContent`,
      body,
      { headers: { 'X-goog-api-key': this.GEMINI_KEY } }
    ).pipe(
      catchError(() => {
        return this.http.post(
          `${this.GEMINI_BASE}/gemini-2.0-flash:generateContent`,
          body,
          { headers: { 'X-goog-api-key': this.GEMINI_KEY } }
        );
      })
    );
  }

  generateAI(prompt: string, useGemini = false): Observable<any> {
    return useGemini ? this.generateWithGemini(prompt) : this.generateWithGroq(prompt);
  }

  private extractTextFromResponse(res: any): string {
    if (!res) return '';
    const groq = res?.choices?.[0]?.message?.content;
    if (groq && typeof groq === 'string') return groq;
    const gemini = res?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (gemini && typeof gemini === 'string') return gemini;
    const parts = res?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      return parts.map((p: any) => p.text || '').join('');
    }
    return '';
  }
}
