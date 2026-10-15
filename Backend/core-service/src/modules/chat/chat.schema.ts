import { z } from 'zod';

/**
 * Strips ASCII control characters except standard whitespace (\t, \n, \r)
 * Removes null bytes, bell characters, backspaces, and other non-printable chars.
 */
export function sanitizeChatString(input: string): string {
  // Strip control chars: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F
  // and zero-width spaces (\u200B-\u200D, \uFEFF)
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Zod validation schema for incoming chat requests.
 * - Message: trimmed string, 1-300 characters after stripping control characters.
 * - ConversationHistory: untrusted, max 6 turns, role user/assistant, each turn max 500 characters.
 */
export const ChatRequestSchema = z.object({
  message: z
    .string({ required_error: 'A chat message is required.' })
    .transform(sanitizeChatString)
    .pipe(
      z
        .string()
        .min(1, { message: 'Chat message cannot be empty.' })
        .max(300, { message: 'Chat message must not exceed 300 characters.' })
    ),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant'], {
          errorMap: () => ({ message: 'Conversation role must be either user or assistant.' }),
        }),
        content: z
          .string()
          .transform(sanitizeChatString)
          .pipe(z.string().max(500, { message: 'History turn must not exceed 500 characters.' })),
      })
    )
    .max(6, { message: 'Conversation history is limited to the last 6 turns.' })
    .optional()
    .default([]),
});

export type ValidatedChatRequest = z.infer<typeof ChatRequestSchema>;
