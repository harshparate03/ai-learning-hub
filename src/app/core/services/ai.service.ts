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

  // ── Groq ──────────────────────────────────────────────────────────────────
  private readonly GROQ_URL  = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly GROQ_KEY  = environment.groqApiKey;

  // All free Groq models — tried in order when one fails/rate-limits
  private readonly GROQ_MODELS = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
  ];

  // ── Gemini ────────────────────────────────────────────────────────────────
  private readonly GEMINI_KEYS = (environment.geminiApiKeys || []).filter(k => k && k.length > 10);
  private geminiKeyIdx = 0;
  private get GEMINI_KEY(): string {
    if (!this.GEMINI_KEYS.length) return '';
    const k = this.GEMINI_KEYS[this.geminiKeyIdx % this.GEMINI_KEYS.length];
    this.geminiKeyIdx++;
    return k;
  }
  private readonly GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  // ── Guards ────────────────────────────────────────────────────────────────
  private get hasGroq(): boolean   { return !!(this.GROQ_KEY && this.GROQ_KEY.length > 10); }
  private get hasGemini(): boolean { return this.GEMINI_KEYS.length > 0; }

  constructor(private http: HttpClient) {}

  // ── Private helpers ───────────────────────────────────────────────────────

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

  /** Try every Groq model in order — waits 3 s on 429, instant retry on other errors */
  private groqWithAllModels(messages: GroqChatMessage[], maxTokens = 8192): Observable<any> {
    const tryModel = (idx: number): Observable<any> => {
      if (idx >= this.GROQ_MODELS.length) {
        return throwError(() => new Error('All Groq models failed'));
      }
      return this.groqReq(this.GROQ_MODELS[idx], messages, maxTokens).pipe(
        catchError(err => {
          const wait$ = err?.status === 429 ? timer(3000) : timer(0);
          console.warn(`[Groq] ${this.GROQ_MODELS[idx]} failed (${err?.status}), trying next model...`);
          return wait$.pipe(switchMap(() => tryModel(idx + 1)));
        })
      );
    };
    return tryModel(0);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Used by every feature — tries all 4 Groq models then Gemini */
  generateWithGroq(prompt: string): Observable<any> {
    const safe = sanitizeUserInput(prompt, 50000);

    if (!this.hasGroq) {
      console.warn('[AI] No Groq key — using Gemini.');
      return this.generateWithGemini(safe);
    }

    return this.groqWithAllModels([{ role: 'user', content: safe }]).pipe(
      catchError(err => {
        if (this.hasGemini) {
          console.warn('[AI] All Groq models failed — using Gemini.');
          return this.generateWithGemini(safe);
        }
        return throwError(() => err);
      })
    );
  }

  /** Navbar chatbot — multi-turn with system prompt */
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

    // Gemini needs plain text (no system role)
    const geminiPrompt = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeUserInput(m.content, 4000)}`)
      .join('\n');

    if (!this.hasGroq) {
      return this.generateWithGemini(geminiPrompt).pipe(
        map(res => this.extractTextFromResponse(res))
      );
    }

    return this.groqWithAllModels(safeMessages, 2048).pipe(
      map(res => this.extractTextFromResponse(res)),
      catchError(err => {
        if (this.hasGemini) {
          console.warn('[Chat] All Groq models failed — using Gemini.');
          return this.generateWithGemini(geminiPrompt).pipe(
            map(res => this.extractTextFromResponse(res))
          );
        }
        return throwError(() => err);
      })
    );
  }

  // ── Gemini ────────────────────────────────────────────────────────────────

  generateWithGemini(prompt: string): Observable<any> {
    const safe = sanitizeUserInput(prompt, 50000);
    if (!this.hasGemini) {
      return throwError(() => new Error('No Gemini API key configured.'));
    }
    const body = { contents: [{ parts: [{ text: safe }] }] };
    const key  = this.GEMINI_KEY;
    return this.http.post(
      `${this.GEMINI_BASE}/gemini-2.0-flash:generateContent`,
      body,
      { headers: { 'X-goog-api-key': key } }
    ).pipe(
      catchError(err => {
        console.error('[Gemini] Failed:', err?.status, err?.error?.error?.message);
        if (this.GEMINI_KEYS.length > 1) {
          return this.http.post(
            `${this.GEMINI_BASE}/gemini-2.0-flash:generateContent`,
            body,
            { headers: { 'X-goog-api-key': this.GEMINI_KEY } }
          );
        }
        return throwError(() => err);
      })
    );
  }

  generateWithGeminiVideo(prompt: string, videoUrl: string): Observable<any> {
    return this.generateWithGemini(`${prompt}\n\nYouTube Video URL: ${videoUrl}`);
  }

  generateAI(prompt: string, useGemini = false): Observable<any> {
    return useGemini ? this.generateWithGemini(prompt) : this.generateWithGroq(prompt);
  }

  extractTextFromResponse(res: any): string {
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
