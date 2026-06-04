import { createFileRoute } from '@tanstack/react-router';

import { z } from 'zod';

const searchSchema = z.object({
  inviteId: z.string().optional(),
  id: z.string().optional(),
  rating: z.coerce.number().optional(),
  sig: z.string().optional(),
});

import { createServerFn } from '@tanstack/react-start';

const handleRateLogic = createServerFn({ method: 'GET' })
  .inputValidator((data: { inviteId?: string; rating?: number; sig?: string }) => data)
  .handler(async ({ data }) => {
    const { inviteId, rating, sig } = data;
    
    let isValidSignature = false;
    if (inviteId && sig) {
      const { verifyReviewInviteSignature } = await import('@/lib/server-utils.server');
      isValidSignature = await verifyReviewInviteSignature(inviteId, sig);
    }

    if (!isValidSignature) {
      return { 
        isResponse: true, 
        status: 403, 
        html: `<html>
          <head>
            <title>Invalid Request — Builder's Edge</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { background: #000; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { border: 1px solid #333; padding: 2rem; border-radius: 8px; background: #0a0a0a; max-width: 400px; }
              h1 { color: #ff453a; font-size: 1.25rem; }
              p { color: #888; font-size: 0.85rem; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Invalid Invite Link</h1>
              <p>This link is invalid, expired, or has been tampered with. Please contact your builder for a new invite link.</p>
            </div>
          </body>
        </html>`
      };
    }

    if (rating === undefined || isNaN(rating)) {
      return { 
        isResponse: true, 
        status: 400, 
        html: `<html>
          <head>
            <title>Invalid Request — Builder's Edge</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { background: #000; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { border: 1px solid #333; padding: 2rem; border-radius: 8px; background: #0a0a0a; max-width: 400px; }
              h1 { color: #ff453a; font-size: 1.25rem; }
              p { color: #888; font-size: 0.85rem; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Missing Star Rating</h1>
              <p>Please click a valid star rating from your invitation email.</p>
            </div>
          </body>
        </html>`
      };
    }

    if (rating < 1 || rating > 5) {
      return { 
        isResponse: true, 
        status: 400, 
        html: `<html>
          <head>
            <title>Invalid Rating — Builder's Edge</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { background: #000; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { border: 1px solid #333; padding: 2rem; border-radius: 8px; background: #0a0a0a; max-width: 400px; }
              h1 { color: #ff453a; font-size: 1.25rem; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Invalid Star Rating</h1>
              <p>Please click a valid star rating from 1 to 5 inside your invitation email.</p>
            </div>
          </body>
        </html>`
      };
    }

    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    try {
      const invite = await db.reviewRequest.findUnique({ where: { id: inviteId } });
      if (!invite) {
        return { 
          isResponse: true, 
          status: 404, 
          html: `<html>
            <head>
              <title>Not Found — Builder's Edge</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { background: #000; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                .card { border: 1px solid #333; padding: 2rem; border-radius: 8px; background: #0a0a0a; max-width: 400px; }
                h1 { color: #ff9f0a; font-size: 1.25rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Invite Code Not Found</h1>
                <p>We could not find this review invitation in our database. It may have been cleaned or replaced.</p>
              </div>
            </body>
          </html>`
        };
      }

      // Update state in database
      const status = rating >= 4 ? 'Completed' : 'Feedback';
      const defaultPlatform = 'Google Business';

      await db.reviewRequest.update({
        where: { id: inviteId },
        data: {
          rating,
          status,
          platform: rating >= 4 ? defaultPlatform : null,
        }
      });

      // Update platform scores if positive
      if (rating >= 4) {
        const platformRecord = await db.reviewPlatform.findFirst({
          where: { name: { contains: defaultPlatform, mode: 'insensitive' } }
        });
        if (platformRecord) {
          const newCount = platformRecord.reviewCount + 1;
          const newRating = parseFloat(((platformRecord.rating * platformRecord.reviewCount + rating) / newCount).toFixed(2));
          await db.reviewPlatform.update({
            where: { id: platformRecord.id },
            data: {
              reviewCount: newCount,
              rating: newRating > 5.0 ? 5.0 : newRating
            }
          });
        }
      }

      // Log Lead Activity
      if (invite.leadId) {
        const activityAction = rating >= 4 
          ? `Client clicked positive ${rating}-Star Review link from email/SMS.`
          : `Client clicked critical ${rating}-Star link. Gated to internal private feedback.`;
        
        await db.activity.create({
          data: {
            builderId: invite.builderId,
            leadId: invite.leadId,
            action: activityAction
          }
        });
      }

      // Redirect client based on Gatekeeper Logic
      if (rating >= 4) {
        // Positive: redirect to Google Business or connected review platform
        const platformRecord = await db.reviewPlatform.findFirst({
          where: { name: { contains: defaultPlatform, mode: 'insensitive' } }
        });

        const ALLOWED_REDIRECT_DOMAINS = [
          'google.com', 'houzz.com', 'facebook.com', 'yelp.com',
          'guildquality.com', 'houzz.pro', 'g.page',
        ];

        const rawUrl = platformRecord?.profileUrl || 'https://google.com';
        let safeRedirectUrl = 'https://google.com';
        try {
          const parsed = new URL(rawUrl);
          const isAllowed = ALLOWED_REDIRECT_DOMAINS.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
          );
          safeRedirectUrl = isAllowed ? rawUrl : 'https://google.com';
        } catch {
          safeRedirectUrl = 'https://google.com';
        }

        return { isRedirect: true, location: safeRedirectUrl };

      } else {
        // Critical: redirect to the internal private feedback page to collect their complaints
        const fallbackFeedbackUrl = `/feedback?inviteId=${inviteId}&rating=${rating}`;
        return { isRedirect: true, location: fallbackFeedbackUrl };
      }
    } catch (error) {
      console.error('Error handling rating click:', error);
      return { isResponse: true, status: 500, html: 'Internal Server Error' };
    }
  });

export const Route = createFileRoute('/api/rate')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const inviteId = deps.inviteId || deps.id;
    const rating = deps.rating;
    const sig = deps.sig;

    const result = await handleRateLogic({ data: { inviteId, rating, sig } });

    if (result.isResponse) {
      return new Response(result.html, {
        status: result.status,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (result.isRedirect) {
      return new Response(null, {
        status: 302,
        headers: { Location: result.location! },
      });
    }
  }
});
