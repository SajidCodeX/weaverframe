import { createFileRoute } from '@tanstack/react-router';
import { handleGoogleOAuthCallback } from '@/lib/dashboard';
import { z } from 'zod';

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute('/api/auth/google/callback')({
  validateSearch: (search) => callbackSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const code = deps.code || '';
    const state = deps.state || '';
    const error = deps.error || undefined;

    const res = await handleGoogleOAuthCallback({
      data: { code, state, error }
    });

    return new Response(null, {
      status: 302,
      headers: { Location: res.redirectUrl }
    });
  }
});
