import { createFileRoute } from '@tanstack/react-router';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const searchSchema = z.object({
  inviteId: z.string().optional(),
  id: z.string().optional(),
  rating: z.coerce.number().optional(),
});

export const Route = createFileRoute('/api/rate')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const inviteId = deps.inviteId || deps.id;
    const rating = deps.rating;

    if (!inviteId || rating === undefined || isNaN(rating)) {
      return new Response(
        `<html>
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
              <p>The link you clicked is incomplete or has expired. Please check your invitation message and try again.</p>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (rating < 1 || rating > 5) {
      return new Response(
        `<html>
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
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const db = await getDb();
    try {
      const invite = await db.reviewRequest.findUnique({ where: { id: inviteId } });
      if (!invite) {
        return new Response(
          `<html>
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
          </html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
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

        // Security: only allow redirects to trusted review platform domains
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

        return new Response(null, {
          status: 302,
          headers: { Location: safeRedirectUrl },
        });

      } else {
        // Critical: redirect to the internal private feedback page to collect their complaints
        const fallbackFeedbackUrl = `/feedback?inviteId=${inviteId}&rating=${rating}`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: fallbackFeedbackUrl,
          },
        });
      }
    } catch (error) {
      console.error('Error handling rating click:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
});
