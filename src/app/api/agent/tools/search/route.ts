import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { canUseSearch, recordSearchUsage } from '@/lib/agent/search-quota';
import { isTrustedOrigin } from '@/lib/security';

const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL ?? 'gpt-4.1-mini';
const systemPrompt = `You are a concise research aide. Always call the web_search tool first and return JSON with an array named results (title,url,snippet). Limit to top three items.`;

const schema = z.object({
  query: z.string().min(4, 'Query is too short').max(200)
});

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const payload = schema.parse(await request.json());
    const quota = canUseSearch(userId);

    if (!quota.allowed) {
      return NextResponse.json(
        { error: 'Daily search limit reached', remaining: 0 },
        { status: 429 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // @ts-expect-error: web_search is a valid tool type
    const response = await openai.responses.create({
      model: SEARCH_MODEL,
      max_output_tokens: 600,
      tools: [{ type: 'web_search' }],
      input: [
        {
          role: 'system',
          content: [{ type: 'text', text: systemPrompt }]
        },
        {
          role: 'user',
          content: [{ type: 'text', text: payload.query }]
        }
      ]
    });

    const rawText = Array.isArray(response.output_text)
      ? response.output_text.join('\n')
      : '';

    let parsed: unknown = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {}

    const { remaining } = recordSearchUsage(userId);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as any).results)
    ) {
      return NextResponse.json({
        results: [],
        remaining,
        note: 'Search completed but response format was unexpected.'
      });
    }

    return NextResponse.json({
      ...(parsed as Record<string, unknown>),
      remaining
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 422 }
      );
    }

    console.error('Search tool error', error);
    return NextResponse.json(
      { error: 'Failed to run search' },
      { status: 500 }
    );
  }
}
