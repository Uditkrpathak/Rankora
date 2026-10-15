import { ENV } from '../../config/env';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  messages: LlmMessage[];
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmCompletionResult {
  text: string;
  usage: LlmUsage;
  model: string;
}

export interface LlmProvider {
  readonly providerName: string;
  generateCompletion(options: LlmCompletionOptions): Promise<LlmCompletionResult>;
}

/**
 * Checks whether an error is transient and eligible for a single retry:
 * - HTTP 429 (Rate Limit), 500, 502, 503, 504 (Server Errors)
 * - Network timeout / AbortError / connection resets
 */
export function isTransientError(err: any): boolean {
  if (!err) return false;
  const status = err.statusCode || err.status || err.response?.status;
  if (status && [429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const msg = (err.message || '').toLowerCase();
  const name = (err.name || '').toLowerCase();
  if (
    name === 'aborterror' ||
    name === 'timeouterror' ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  ) {
    return true;
  }
  return false;
}

/**
 * Production OpenAI LLM Provider for Rankora:
 * - Uses gpt-4o-mini by default (from ENV.AI_MODEL)
 * - Temperature: 0.1
 * - Max Tokens: 250
 * - Timeout: 10 seconds
 * - Exactly one retry on transient errors only
 */
export class OpenAiLlmProvider implements LlmProvider {
  public readonly providerName = 'openai';

  public async generateCompletion(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const apiKey = ENV.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment.');
    }

    const model = options.model || ENV.AI_MODEL || 'gpt-4o-mini';
    const temperature = options.temperature ?? 0.1;
    const maxTokens = options.maxTokens ?? 250;
    const totalBudgetMs = options.timeoutMs ?? 10000; // Bounded total budget across attempt + retry
    const deadline = Date.now() + totalBudgetMs;

    let lastError: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const remainingTimeMs = deadline - Date.now();
      if (remainingTimeMs <= 50) {
        const timeoutErr: any = new Error(`LLM total time budget of ${totalBudgetMs}ms exhausted.`);
        timeoutErr.name = 'TimeoutError';
        throw timeoutErr;
      }

      let timer: NodeJS.Timeout | null = null;
      try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), remainingTimeMs);

        const res = await fetch(`${ENV.AI_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: options.messages,
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const error: any = new Error(`OpenAI HTTP ${res.status}: ${errBody}`);
          error.status = res.status;
          error.statusCode = res.status;
          throw error;
        }

        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim() || '';

        const usage: LlmUsage = {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        };

        return {
          text,
          usage,
          model,
        };
      } catch (err: any) {
        lastError = err;
        const transient = isTransientError(err);
        if (attempt === 1 && transient) {
          const backoffMs = 200; // Short backoff
          const timeAfterBackoff = deadline - Date.now() - backoffMs;
          if (timeAfterBackoff <= 50) {
            // Not enough time left in total budget to retry
            throw lastError;
          }
          console.warn(`[OpenAiLlmProvider] Transient error on attempt 1 (${err.message}). Retrying once after ${backoffMs}ms...`);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        // Non-transient or retry exhausted -> throw
        throw lastError;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    throw lastError;
  }
}

// Singleton / Mock Injection Support for Testing
let activeProvider: LlmProvider = new OpenAiLlmProvider();

export function getLlmProvider(): LlmProvider {
  return activeProvider;
}

export function setLlmProviderForTest(provider: LlmProvider): void {
  activeProvider = provider;
}

export function resetLlmProviderForTest(): void {
  activeProvider = new OpenAiLlmProvider();
}
