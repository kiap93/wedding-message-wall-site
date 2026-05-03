import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Zap, Shield, CreditCard, ArrowRight, Loader2 } from 'lucide-react';
import { useWorkspace } from '../lib/WorkspaceContext';
import { useUser } from '../lib/UserContext';

export default function Subscription() {
  const { workspace, isLoading } = useWorkspace();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSubscribe = async (planId: string) => {
    setIsRedirecting(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          agencyId: workspace?.id,
        }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
      </div>
    );
  }

  const { user } = useUser();
  const isSubscribed = workspace?.subscription_status === 'active' || 
                      workspace?.is_demo === true || 
                      user?.email === 'buildsiteasia@gmail.com';
  const isCouple = workspace?.user_role === 'couple';

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-6xl font-serif text-[#2D2424] mb-4">
              {isSubscribed ? 'Everything is Ready' : isCouple ? 'One-Time Payment' : 'Try Pro Free for 30 Days'}
            </h1>
            <p className="text-gray-500 font-medium max-w-xl mx-auto">
              {isSubscribed 
                ? "You're all set! You have full access to your wedding features."
                : isCouple 
                  ? "Unlock your full wedding site, RSVP manager, and live display with a single payment."
                  : "Start your 30-day free trial today. Cancel anytime if you're not satisfied."
              }
            </p>
          </motion.div>
        </div>

        {isSubscribed ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-12 rounded-[3rem] border border-[#C5A059]/10 shadow-2xl text-center max-w-2xl mx-auto"
          >
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-serif mb-2">
              {workspace?.is_demo || user?.email === 'buildsiteasia@gmail.com' ? 'Full Access Active' : isCouple ? 'Wedding Paid' : 'Agency Pro Active'}
            </h2>
            <p className="text-gray-500 mb-8">
              {workspace?.is_demo || user?.email === 'buildsiteasia@gmail.com' 
                ? 'Your account has special access to create unlimited events.' 
                : isCouple 
                  ? 'Your wedding site is live and all premium features are unlocked.'
                  : 'Next billing date: Coming soon'}
            </p>
            
            <button 
              onClick={() => isCouple ? window.history.back() : handleSubscribe('manage')} 
              className="px-10 py-5 bg-gray-100 text-[#2D2424] rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-3 mx-auto"
            >
              {isCouple ? 'Go Back' : <><CreditCard className="w-5 h-5" /> Manage Subscription</>}
            </button>
          </motion.div>
        ) : isCouple ? (
          /* Couple Plan */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-12 rounded-[3rem] border border-[#C5A059]/10 shadow-2xl text-center max-w-xl mx-auto"
          >
            <div className="w-16 h-16 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <Zap className="w-8 h-8 text-[#C5A059]" />
            </div>
            <h3 className="text-3xl font-serif mb-2">Individual Wedding</h3>
            <div className="flex items-baseline justify-center gap-1 mb-8">
              <span className="text-5xl font-serif">$19</span>
              <span className="text-gray-400 text-sm">one-time</span>
            </div>

            <ul className="space-y-4 mb-10 text-left max-w-sm mx-auto">
              {[
                "Full Digital Wedding Site",
                "Unlimited Live Guest Messages",
                "RSVP & Dietary Tracking",
                "Event Background Photo",
                "Lifetime Access to Guestbook"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium text-gray-500">
                  <Check className="w-4 h-4 text-[#C5A059]" />
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              disabled={isRedirecting}
              onClick={() => handleSubscribe('price_one_time')}
              className="w-full py-5 bg-[#C5A059] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#B38D45] transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {isRedirecting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Unlock Premimum"}
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Monthly Plan */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl flex flex-col"
            >
              <div className="mb-8">
                <div className="w-12 h-12 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6 text-[#C5A059]" />
                </div>
                <h3 className="text-2xl font-serif mb-2">Monthly Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-serif">$49</span>
                  <span className="text-gray-400 text-sm">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm font-bold text-[#C5A059] bg-[#C5A059]/5 p-2 rounded-lg">
                  <Zap className="w-4 h-4" />
                  30-Day Free Trial
                </li>
                {[
                  "Unlimited Event Creation",
                  "White-label Dashboard",
                  "Custom Domain Support",
                  "Premium Templates",
                  "Priority Support"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-gray-500">
                    <Check className="w-4 h-4 text-[#C5A059]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button 
                disabled={isRedirecting}
                onClick={() => handleSubscribe('price_monthly')}
                className="w-full py-5 bg-[#C5A059] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#B38D45] transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isRedirecting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Subscribe Monthly"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>

            {/* Yearly Plan */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="bg-[#2D2424] p-10 rounded-[3rem] shadow-2xl text-white flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-6 right-6 px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase tracking-widest">
                Save 20%
              </div>
              <div className="mb-8">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-[#C5A059]" />
                </div>
                <h3 className="text-2xl font-serif mb-2">Yearly Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-serif">$470</span>
                  <span className="opacity-40 text-sm">/year</span>
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm font-bold text-[#C5A059] bg-white/5 p-2 rounded-lg">
                  <Zap className="w-4 h-4" />
                  30-Day Free Trial
                </li>
                {[
                  "Everything in Monthly",
                  "2 Months Free",
                  "Custom CSS Editor",
                  "API Access",
                  "Early Beta Access"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium opacity-60">
                    <Check className="w-4 h-4 text-[#C5A059]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button 
                disabled={isRedirecting}
                onClick={() => handleSubscribe('price_yearly')}
                className="w-full py-5 bg-white text-[#2D2424] rounded-2xl font-black uppercase tracking-widest hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isRedirecting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Subscribe Yearly"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}

        <div className="mt-16 text-center">
          <p className="text-gray-400 text-xs font-medium">
            Secure payments processed by Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
