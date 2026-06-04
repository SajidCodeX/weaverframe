import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Star, ShieldAlert, CheckCircle2, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import { submitClientReview } from '@/lib/dashboard';

export const Route = createFileRoute('/feedback')({
  component: FeedbackPage,
});

function FeedbackPage() {
  const [inviteId, setInviteId] = useState('');
  const [rating, setRating] = useState(3);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('inviteId') || params.get('id') || '';
      const r = parseInt(params.get('rating') || '3');
      setInviteId(id);
      if (!isNaN(r) && r >= 1 && r <= 5) {
        setRating(r);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteId) {
      setErrorMessage('Invalid review invitation link. Please request a new invite.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await submitClientReview({
        data: {
          id: inviteId,
          rating,
          feedback,
          platform: rating >= 4 ? 'Google Business' : undefined,
        },
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setErrorMessage('Could not save feedback. The invitation may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] bg-radial-gradient text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">


      <div className="w-full max-w-lg z-10">
        {/* Sleek App Branding */}
        <div className="flex justify-center items-center gap-2 mb-8 select-none">
          <div className="size-7 bg-[#0A84FF] rounded-md flex items-center justify-center font-bold text-sm tracking-tighter text-black">
            A
          </div>
          <span className="text-sm font-semibold tracking-widest uppercase text-foreground/80 font-mono">
            Your Company Care
          </span>
        </div>

        {isSubmitted ? (
          /* Glowing Success/Thank you Screen */
          <div className="bg-[#0B0B0C]/80 border border-success/30 rounded-xl p-8 text-center backdrop-blur-xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="mx-auto size-14 bg-success/15 border border-success/30 rounded-full flex items-center justify-center mb-6 text-success animate-bounce">
              <CheckCircle2 className="size-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white mb-3">
              Feedback Received Privately
            </h1>
            
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto mb-8">
              Thank you for sharing your experience. Your comments have been delivered directly to our executive management. We take all constructive criticism seriously to improve our home building services.
            </p>

            <div className="border-t border-border/40 pt-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                Gated Safeguard Active
              </div>
            </div>
          </div>
        ) : (
          /* Premium Review Form */
          <div className="bg-[#0B0B0C]/80 border border-white/[0.06] rounded-xl p-8 backdrop-blur-xl relative overflow-hidden">
            
            <div className="flex items-start gap-4 mb-6">
              <div className="size-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary shrink-0">
                <ShieldAlert className="size-5 text-[#BF5AF2]" />
              </div>
              <div>
                <h1 className="text-md font-bold text-white tracking-tight">Your Company Customer Care</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  We strive for absolute 5-star custom craftsmanship. Your direct feedback helps us resolve any construction bottlenecks immediately.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star Selection Component */}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-bold">
                  Confirm Rating Selection
                </label>
                <div className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      className="p-1 transition-transform duration-100 hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`size-8 transition-colors duration-100 ${
                          star <= (hoveredStar ?? rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-foreground/30 fill-transparent'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <div className="text-center mt-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground font-mono">
                    {rating === 5 && '🌟 Perfect Custom Craftsmanship'}
                    {rating === 4 && '👍 Great Build Experience'}
                    {rating === 3 && '⚠️ Average / Some Minor Glitches'}
                    {rating === 2 && '👎 Disappointed / Needs Attention'}
                    {rating === 1 && '🚨 Action Required Immediately'}
                  </span>
                </div>
              </div>

              {/* Feedback Textarea */}
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-bold">
                  What went wrong or can be improved? *
                </label>
                <textarea
                  required
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us about your home build details: drywall finishes, cabinetry, foundation, timelines, communication issues..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/20 rounded-lg p-3 text-xs text-white placeholder-muted-foreground focus:outline-none focus:ring-0 resize-none leading-relaxed"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[11px] flex items-center gap-2">
                  <span className="font-bold font-mono">Error:</span> {errorMessage}
                </div>
              )}

              {/* Action Button */}
              <button
                type="submit"
                disabled={isSubmitting || !feedback.trim()}
                className="w-full bg-[#BF5AF2] text-black font-semibold text-xs py-3 rounded-lg hover:bg-[#BF5AF2]/90 hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-black" /> Processing Feedback...
                  </>
                ) : (
                  <>
                    Submit Secure Private Feedback <ArrowRight className="size-3.5 text-black" />
                  </>
                )}
              </button>
            </form>

            <div className="border-t border-border/30 mt-6 pt-5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>Secure Encrypted Submission</span>
              <span className="text-[#BF5AF2] font-semibold">Gated Safe-box</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
