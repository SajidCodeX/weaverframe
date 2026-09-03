import { createFileRoute } from '@tanstack/react-router';
import { handleGoogleOAuthCallback } from '@/lib/dashboard';

export const Route = createFileRoute('/api/auth/google/callback')({
  loader: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const error = url.searchParams.get('error') || undefined;

    const res = await handleGoogleOAuthCallback({
      data: { code, state, error }
    });

    return new Response(null, {
      status: 302,
      headers: { Location: res.redirectUrl }
    });
  }
});
