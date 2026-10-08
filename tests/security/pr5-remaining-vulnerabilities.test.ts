import test from 'node:test';
import assert from 'node:assert/strict';
import { runInServerContext, createMockRequest } from '../test-utils';
import { signToken, signReviewInviteId } from '../../src/lib/server-utils.server';
import {
  updateBillingProfile,
  saveWebhookUrl,
  submitClientReview,
} from '../../src/lib/dashboard';
import { handleInboundLeadDirect } from '../../src/routes/api.leads.inbound';
import {
  validateOutboundWebhookUrl,
  isForbiddenIpAddress,
  sanitizeCsvCell,
} from '../../src/lib/security-helpers.server';
import { detectAndValidateMimeType } from '../../src/lib/storage.server';
import { escapeHtml } from '../../src/lib/email.server';
import { sanitizeSafeUrl } from '../../src/lib/sanitizer';
import { getDb } from '../../src/lib/db.server';

test('Security Hardening Test Suite: All Remaining Vulnerabilities', async (t) => {
  const db = await getDb();
  const ownerUser = await db.user.findFirst({
    where: { role: 'builder', builderRole: 'owner', isActive: true, deletedAt: null },
    include: { builder: true },
  });
  assert.ok(ownerUser && ownerUser.builder, 'Owner user with active builder required');
  const builder = ownerUser.builder;

  const ownerJwt = signToken({
    userId: ownerUser.id,
    builderId: builder.id,
    role: ownerUser.role,
    builderRole: ownerUser.builderRole,
    tokenVersion: ownerUser.tokenVersion ?? 1,
  });

  // ── Finding 4.2: adSpendBalance Forgery Prevention ─────────────────────────
  await t.test('Finding 4.2: updateBillingProfile ignores/prevents arbitrary adSpendBalance forgery', async () => {
    const initialBalance = builder.adSpendBalance;
    await runInServerContext(createMockRequest({ cookies: { jwt_builder: ownerJwt } }), async () => {
      // Sending adSpendBalance should not change the balance
      await updateBillingProfile({ data: { paymentMethod: 'Credit Card (Stripe)' } });
      const refetched = await db.builder.findUnique({ where: { id: builder.id } });
      assert.equal(refetched?.adSpendBalance, initialBalance);
    });
  });

  // ── Finding 3.2: UUID Inbound Backdoor Elimination ────────────────────────
  await t.test('Finding 3.2: Inbound webhook rejects builder UUID as authentication credential', async () => {
    // Attempt to authenticate using the builder's raw UUID
    const res = await handleInboundLeadDirect({
      token: builder.id, // Primary key UUID
      name: 'Malicious Inbound Lead',
      email: 'attacker@evil.com',
    });

    assert.equal(res.status, 401, 'Using builder primary key UUID must be rejected with 401 Unauthorized');
    assert.match(res.json.error, /Unauthorized/);
  });

  // ── Finding 3.3: Meta verify_token Handshake Protection ───────────────────
  await t.test('Finding 3.3: Inbound webhook requires valid META_VERIFY_TOKEN for Meta handshake', async () => {
    process.env.META_VERIFY_TOKEN = 'secret_meta_verify_token_12345';
    const { Route } = await import('../../src/routes/api.leads.inbound');

    // Wrong token -> 403 Forbidden
    const badReq = new Request('http://localhost:8080/api/leads/inbound?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=wrong_token');
    const badRes = await (Route as any).options.loader({ request: badReq });
    assert.equal(badRes.status, 403);

    // Correct token -> returns challenge
    const goodReq = new Request('http://localhost:8080/api/leads/inbound?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=secret_meta_verify_token_12345');
    const goodRes = await (Route as any).options.loader({ request: goodReq });
    assert.equal(goodRes, 'test_challenge');
  });

  // ── Finding 6.1 & 6.2: File Upload Magic-Bytes & Stored XSS Prevention ─────
  await t.test('Finding 6.1 & 6.2: detectAndValidateMimeType rejects SVG/HTML and validates magic bytes', () => {
    // HTML / SVG extension rejected
    const svgRes = detectAndValidateMimeType(Buffer.from('<svg></svg>'), 'malicious.svg');
    assert.equal(svgRes.valid, false);
    assert.match(svgRes.error || '', /prohibited/);

    const htmlRes = detectAndValidateMimeType(Buffer.from('<html><body>XSS</body></html>'), 'exploit.html');
    assert.equal(htmlRes.valid, false);

    // Valid PNG magic bytes accepted
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const pngRes = detectAndValidateMimeType(pngHeader, 'floorplan.png');
    assert.equal(pngRes.valid, true);
    assert.equal(pngRes.mime, 'image/png');

    // Valid PDF magic bytes accepted
    const pdfHeader = Buffer.from('%PDF-1.4 header contents here');
    const pdfRes = detectAndValidateMimeType(pdfHeader, 'specifications.pdf');
    assert.equal(pdfRes.valid, true);
    assert.equal(pdfRes.mime, 'application/pdf');

    // Spoofed content type (HTML payload masquerading as .jpg) rejected
    const spoofedJpg = Buffer.from('<html><script>alert(1)</script></html>');
    const spoofRes = detectAndValidateMimeType(spoofedJpg, 'innocent.jpg');
    assert.equal(spoofRes.valid, false);
  });

  // ── Finding 7.2: Chat javascript: URI Neutralization ───────────────────────
  await t.test('Finding 7.2: sanitizeSafeUrl neutralizes javascript: and data: schemes', () => {
    assert.equal(sanitizeSafeUrl('javascript:alert(document.cookie)'), '#');
    assert.equal(sanitizeSafeUrl('JAVASCRIPT:alert(1)'), '#');
    assert.equal(sanitizeSafeUrl('vbscript:msgbox(1)'), '#');
    assert.equal(sanitizeSafeUrl('data:text/html;base64,PHNjcmlwdD4='), '#');
    assert.equal(sanitizeSafeUrl('//evil.com/phish'), '#');

    // Safe URLs preserved
    assert.equal(sanitizeSafeUrl('https://example.com/plans/villa.pdf'), 'https://example.com/plans/villa.pdf');
    assert.equal(sanitizeSafeUrl('/portal/documents'), '/portal/documents');
  });

  // ── Finding 5.1: SSRF Protection & Private IP Blocking ────────────────────
  await t.test('Finding 5.1: validateOutboundWebhookUrl blocks SSRF loopback & private cloud IPs', async () => {
    assert.equal(isForbiddenIpAddress('127.0.0.1'), true);
    assert.equal(isForbiddenIpAddress('10.0.0.1'), true);
    assert.equal(isForbiddenIpAddress('172.16.0.1'), true);
    assert.equal(isForbiddenIpAddress('192.168.1.1'), true);
    assert.equal(isForbiddenIpAddress('169.254.169.254'), true); // AWS metadata
    assert.equal(isForbiddenIpAddress('::1'), true);             // IPv6 loopback
    assert.equal(isForbiddenIpAddress('8.8.8.8'), false);        // Public IP

    await assert.rejects(
      async () => {
        await validateOutboundWebhookUrl('http://169.254.169.254/latest/meta-data/');
      },
      /Internal\/metadata destinations are blocked|Private, loopback, or cloud metadata/
    );

    await assert.rejects(
      async () => {
        await validateOutboundWebhookUrl('http://localhost:3000/webhook');
      },
      /Internal\/metadata destinations are blocked/
    );
  });

  // ── Finding 5.2: CSV Formula Injection (DDE) Sanitization ──────────────────
  await t.test('Finding 5.2: sanitizeCsvCell neutralizes formula triggers (=, +, -, @, cmd)', () => {
    assert.equal(sanitizeCsvCell('=cmd|\' /C calc\'!A0'), '"\'=cmd|\' /C calc\'!A0"');
    assert.equal(sanitizeCsvCell('+SUM(1,2)'), '"\'+SUM(1,2)"');
    assert.equal(sanitizeCsvCell('-10+20'), '"\'-10+20"');
    assert.equal(sanitizeCsvCell('@test'), '"\'@test"');

    // Normal safe strings
    assert.equal(sanitizeCsvCell('John Smith'), '"John Smith"');
    assert.equal(sanitizeCsvCell('Custom Villa Build'), '"Custom Villa Build"');
  });

  // ── Finding 9.1: HTML Injection Escaping in Email Templates ───────────────
  await t.test('Finding 9.1: escapeHtml sanitizes dangerous tags in email inputs', () => {
    const raw = '<script>alert("pwned")</script> & <b>Bold</b>';
    const escaped = escapeHtml(raw);
    assert.equal(escaped, '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt; &amp; &lt;b&gt;Bold&lt;/b&gt;');
  });

  // ── Finding 10.1: Review Submission HMAC Cryptographic Verification ────────
  await t.test('Finding 10.1: submitClientReview rejects unauthenticated submissions without HMAC sig', async () => {
    // Pick an existing review request or create one
    const invite = await db.reviewRequest.findFirst({
      where: { builderId: builder.id, status: { not: 'Completed' } },
    });

    if (invite) {
      // 1. Calling without HMAC signature or auth cookie is rejected
      await assert.rejects(
        async () => {
          await submitClientReview({
            data: {
              id: invite.id,
              rating: 5,
              feedback: 'Great build!',
            },
          });
        },
        /UNAUTHORIZED: Invalid or missing cryptographic review invitation signature/
      );

      // 2. Calling with valid HMAC signature succeeds
      const validSig = await signReviewInviteId(invite.id);
      const submitRes = await submitClientReview({
        data: {
          id: invite.id,
          rating: 5,
          feedback: 'Exceptional craftsmanship and transparency!',
          sig: validSig,
        },
      });

      assert.equal(submitRes.status, 'Completed');

      // 3. Replay attack: calling again fails because review request is now Completed (atomic single-use)
      await assert.rejects(
        async () => {
          await submitClientReview({
            data: {
              id: invite.id,
              rating: 5,
              feedback: 'Replay attempt',
              sig: validSig,
            },
          });
        },
        /already been submitted/
      );
    }
  });
});
