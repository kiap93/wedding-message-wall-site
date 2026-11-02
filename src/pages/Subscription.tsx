import React, { useState, useEffect } from 'react';
import { Check, Shield, CreditCard, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib/WorkspaceContext';
import { useUser } from '../lib/UserContext';
import { getSupabase } from '../lib/supabase';
import { Agency } from '../types';
import { authenticatedFetch } from '../lib/auth';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../design-system/components/Button';
import PageHeader from '../design-system/components/PageHeader';
import Badge from '../design-system/components/Badge';

export default function Subscription() {
  const { workspace, isLoading } = useWorkspace();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const navigate = useNavigate();

  const { user } = useUser();
  const [userAgency, setUserAgency] = useState<Agency | null>(null);
  const [isLoadingUserAgency, setIsLoadingUserAgency] = useState(!workspace && !!user);

  useEffect(() => {
    const fetchUserAgency = async () => {
      if (!workspace && user) {
        try {
          const supabase = getSupabase();
          const userId = user.id || user.sub;
          const { data } = await supabase
            .from('agencies')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          if (data) setUserAgency(data);
        } catch (err) {
          console.error('Error fetching user agency for subscription:', err);
        } finally {
          setIsLoadingUserAgency(false);
        }
      } else {
        setIsLoadingUserAgency(false);
      }
    };
    fetchUserAgency();
  }, [workspace, user]);

  const activeWorkspace = workspace || userAgency;

  const handleSubscribe = async (planId: string) => {
    setIsRedirecting(true);
    try {
      const response = await authenticatedFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          agencyId: activeWorkspace?.id,
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

  if (isLoading || isLoadingUserAgency) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#252525] animate-spin" />
      </div>
    );
  }

  const isSubscribed = activeWorkspace?.subscription_status === 'active' || 
                      activeWorkspace?.is_demo === true;
  const isCouple = activeWorkspace?.user_role === 'couple';

  return (
    <DashboardLayout activeItem="subscription">
      <div className="max-w-4xl mx-auto space-y-8">
        <PageHeader
          title="Billing & Subscription"
          description="Manage your studio license, billing cycle, and event limits."
          breadcrumbs={[
            { label: 'Workspace', onClick: () => navigate('/workspace') },
            { label: 'Billing' },
          ]}
        />

        {isSubscribed ? (
          <div className="bg-white p-8 rounded-lg border border-[#E8E8E5] shadow-subtle text-center max-w-lg mx-auto space-y-5">
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-block mb-2">
                <Badge variant="success" size="md">Subscription Active</Badge>
              </div>
              <h3 className="text-lg font-semibold text-[#252525]">
                {workspace?.is_demo || user?.email === 'buildsiteasia@gmail.com' 
                  ? 'Unlimited Platform Access' 
                  : isCouple 
                    ? 'Wedding Suite Published' 
                    : 'Agency Pro Active'}
              </h3>
              <p className="text-xs text-[#777777] mt-1 max-w-sm mx-auto leading-relaxed">
                {workspace?.is_demo || user?.email === 'buildsiteasia@gmail.com' 
                  ? 'Your account has full administrative permission to create and manage unlimited weddings.' 
                  : isCouple 
                    ? 'Your wedding site is active and all guest moderation features are unlocked.'
                    : 'Your agency pro plan is active with unlimited events and custom subdomain.'}
              </p>
            </div>
            
            <div className="pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => isCouple ? navigate('/workspace') : handleSubscribe('manage')}
                leftIcon={<CreditCard className="w-4 h-4" />}
                isLoading={isRedirecting}
              >
                {isCouple ? 'Back to Wedding Hub' : 'Manage Stripe Billing'}
              </Button>
            </div>
          </div>
        ) : isCouple ? (
          /* Couple Plan */
          <div className="bg-white p-8 rounded-lg border border-[#E8E8E5] shadow-card text-center max-w-md mx-auto space-y-6">
            <div>
              <span className="text-xs font-semibold text-[#8B806F]">INDIVIDUAL WEDDING</span>
              <h3 className="text-xl font-semibold text-[#252525] mt-1">Single Wedding License</h3>
              <div className="my-4">
                <span className="text-4xl font-semibold font-mono text-[#252525] tabular-nums">$19</span>
                <span className="text-xs text-[#777777]"> / one-time</span>
              </div>
              <p className="text-xs text-[#777777] leading-relaxed">
                Publish your wedding page, unlock live guest messages, and accept unlimited RSVPs.
              </p>
            </div>

            <div className="border-t border-b border-[#E8E8E5] py-4 space-y-2.5 text-xs text-[#555555] text-left">
              {[
                "Full Digital Wedding Site & URL",
                "Unlimited Live Guest Message Wall",
                "Custom RSVP & Dietary Questionnaire",
                "Photo Uploads & Memory Gallery",
                "Lifetime Access to Guestbook Records"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Check className="w-3.5 h-3.5 text-[#8B806F] shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isRedirecting}
              onClick={() => handleSubscribe('price_one_time')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Activate Wedding License
            </Button>
          </div>
        ) : (
          /* Agency Plans */
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Monthly Plan */}
            <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E8E8E5] shadow-subtle flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-[#777777]">MONTHLY BILLING</span>
                <h3 className="text-lg font-semibold text-[#252525] mt-1">Agency Monthly Pro</h3>
                <div className="my-4">
                  <span className="text-3xl font-semibold font-mono text-[#252525] tabular-nums">$49</span>
                  <span className="text-xs text-[#777777]"> / month</span>
                </div>
                <div className="p-2.5 bg-[#FAF9F7] rounded border border-[#E8E8E5] text-xs font-medium text-[#736959] mb-6">
                  Includes 30-day free trial. Cancel anytime.
                </div>

                <div className="space-y-2.5 text-xs text-[#555555] mb-8">
                  {[
                    "Unlimited Wedding Events",
                    "White-label Subdomain",
                    "Custom Client Portals",
                    "Invitation Template Designer",
                    "Export CSV Guest Records"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#8B806F] shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="md"
                className="w-full"
                isLoading={isRedirecting}
                onClick={() => handleSubscribe('price_monthly')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Start 30-Day Free Trial
              </Button>
            </div>

            {/* Yearly Plan */}
            <div className="bg-[#252525] text-white p-6 sm:p-8 rounded-lg border border-[#252525] shadow-card flex flex-col justify-between relative">
              <div className="absolute top-4 right-4 bg-white/10 text-white text-[10px] font-medium px-2 py-0.5 rounded">
                Save 20%
              </div>
              <div>
                <span className="text-xs font-semibold text-[#C5BDAC]">ANNUAL BILLING</span>
                <h3 className="text-lg font-semibold text-white mt-1">Agency Annual Pro</h3>
                <div className="my-4">
                  <span className="text-3xl font-semibold font-mono text-white tabular-nums">$470</span>
                  <span className="text-xs text-white/60"> / year</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded border border-white/10 text-xs text-[#C5BDAC] mb-6">
                  2 months free compared to monthly billing.
                </div>

                <div className="space-y-2.5 text-xs text-white/80 mb-8">
                  {[
                    "Everything in Monthly Plan",
                    "Custom CSS & Styling Support",
                    "Priority Studio Concierge",
                    "Multi-Team Seat Access",
                    "Early Beta Studio Tools"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#C5BDAC] shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="secondary"
                size="md"
                className="w-full !bg-white !text-[#252525] hover:!bg-[#F2EFE9]"
                isLoading={isRedirecting}
                onClick={() => handleSubscribe('price_yearly')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Subscribe Annually
              </Button>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-[#777777]">
          Secure billing processed by Stripe. All transactions encrypted.
        </div>
      </div>
    </DashboardLayout>
  );
}
