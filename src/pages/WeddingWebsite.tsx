import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, Heart, ArrowLeft, Eye, ExternalLink, Calendar, MapPin, Share2, Check, Lock, Sparkles } from 'lucide-react';
import { WeddingEvent } from '../types';
import { WebsiteConfig } from '../website-builder/types';
import { createDefaultWebsiteConfig } from '../website-builder/presets';
import { WeddingWebsiteRenderer } from '../website-builder/WeddingWebsiteRenderer';
import { TranslationProvider } from '../lib/i18n/TranslationContext';
import { API_BASE } from '../lib/config';
import { PageSEO } from '../components/SEO';
import { SEO_CONFIG } from '../seo/config';
import { getWeddingEventSchema } from '../seo/structuredData';

interface WebsiteDataResponse {
  status: 'draft' | 'published' | 'unpublished';
  published: boolean;
  isPreview: boolean;
  isPasswordProtected?: boolean;
  config?: WebsiteConfig;
  project?: WeddingEvent;
  error?: string;
}

export default function WeddingWebsite() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const previewToken = searchParams.get('token');

  const [project, setProject] = useState<WeddingEvent | null>(null);
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [publicationStatus, setPublicationStatus] = useState<'draft' | 'published' | 'unpublished'>('draft');
  const [isPreview, setIsPreview] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function fetchEventWebsite() {
      if (!slug) {
        setErrorMessage('No wedding event slug provided.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        // Include preview token and session if available
        const queryParams = new URLSearchParams();
        if (previewToken) queryParams.set('token', previewToken);

        const token = localStorage.getItem('wedding_session_token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const endpoint = `${API_BASE}/api/events/${slug}/website-data${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const response = await fetch(endpoint, {
          headers,
          credentials: 'include'
        });

        if (!response.ok && response.status === 404) {
          throw new Error('We could not locate this wedding celebration.');
        }

        const data: WebsiteDataResponse = await response.json();

        setPublicationStatus(data.status || 'draft');
        setIsPreview(Boolean(data.isPreview));
        setIsPasswordProtected(Boolean(data.isPasswordProtected));

        if (data.project) {
          setProject(data.project);
        }

        if (data.error && !data.published && !data.isPreview) {
          // Event exists but is unpublished or draft to public guests
          setErrorMessage(data.error);
          setIsLoading(false);
          return;
        }

        // Parse or fallback config
        let resolvedConfig: WebsiteConfig;
        if (data.config) {
          resolvedConfig = typeof data.config === 'string'
            ? JSON.parse(data.config)
            : data.config;

          if (!resolvedConfig.sections || resolvedConfig.sections.length === 0) {
            resolvedConfig = createDefaultWebsiteConfig(data.project);
          }
        } else {
          resolvedConfig = createDefaultWebsiteConfig(data.project);
        }

        setConfig(resolvedConfig);
      } catch (err: any) {
        console.error('Error loading wedding website:', err);
        setErrorMessage(err.message || 'Unable to load wedding website.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEventWebsite();
  }, [slug, previewToken]);

  const seoConfig = config?.seo || {};
  const groom = project?.groom_name || 'Lucas';
  const bride = project?.bride_name || 'Sofia';
  const coupleDisplayName = `${groom} & ${bride}`;
  const defaultTitle = `${coupleDisplayName} — Wedding Website | EventFrame`;
  const rawPageTitle = seoConfig.pageTitle || seoConfig.title || defaultTitle;
  const effectiveTitle = isPreview ? `[Preview] ${rawPageTitle}` : rawPageTitle;
  const effectiveDescription =
    seoConfig.metaDescription ||
    seoConfig.description ||
    `Celebrate the wedding of ${coupleDisplayName}. View event details, wedding schedule, venue directions, and submit your RSVP online.`;
  const effectiveOgImage = seoConfig.ogImage || project?.image_url || SEO_CONFIG.defaultOgImage;
  const effectiveCanonical =
    seoConfig.canonicalUrl ||
    (project?.slug ? `${SEO_CONFIG.productionDomain}/${encodeURIComponent(project.slug)}/website` : undefined);
  const isIndexableWebsite = Boolean(
    !isLoading &&
      project &&
      config &&
      publicationStatus === 'published' &&
      !isPreview &&
      !isPasswordProtected &&
      seoConfig.noIndex !== true &&
      project.slug !== 'demo'
  );
  const eventJsonLd =
    isIndexableWebsite && project && effectiveCanonical
      ? [
          getWeddingEventSchema({
            name: rawPageTitle,
            description: effectiveDescription,
            url: effectiveCanonical,
            image: effectiveOgImage,
            startDate: project.wedding_date || undefined,
            location: project.location || undefined,
          }),
        ]
      : undefined;

  const handleCopyPreviewLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-6 text-center">
        <PageSEO
          title="Wedding Website | EventFrame"
          description="Loading wedding celebration details."
          noindex={true}
          nofollow={true}
          disableMarketingHreflang={true}
        />
        <div className="w-12 h-12 rounded-full border border-stone-200 bg-white flex items-center justify-center shadow-xs mb-4">
          <Loader2 className="w-5 h-5 text-stone-600 animate-spin" />
        </div>
        <div className="text-xs font-mono uppercase tracking-widest text-stone-500">
          Preparing Wedding Celebration
        </div>
      </div>
    );
  }

  // State 1: Unpublished or Private Draft Screen (Visible to public guests when site is not live)
  if (errorMessage && !isPreview && (!config || publicationStatus !== 'published')) {
    const coupleName = project?.groom_name && project?.bride_name
      ? `${project.groom_name} & ${project.bride_name}`
      : project?.name || 'Wedding Celebration';

    const isUnpublished = publicationStatus === 'unpublished';

    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-6 text-center antialiased selection:bg-amber-100">
        <PageSEO
          title={`${coupleName} — Private Wedding Website | EventFrame`}
          description="This wedding website is currently private or unpublished."
          noindex={true}
          nofollow={true}
          disableMarketingHreflang={true}
        />
        <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200/80 shadow-subtle p-8 sm:p-10 space-y-6">
          <div className="w-16 h-16 rounded-full border border-stone-200 bg-[#FAF9F7] flex items-center justify-center mx-auto text-stone-500">
            {isUnpublished ? <Lock className="w-7 h-7 text-stone-400" /> : <Sparkles className="w-7 h-7 text-amber-600" />}
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-stone-400 block">
              {isUnpublished ? 'Website Temporarily Offline' : 'Private Wedding Preview'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 tracking-tight">
              {coupleName}
            </h1>
          </div>

          {project && (
            <div className="py-3 px-4 bg-[#FAF9F7] rounded-xl border border-stone-150 space-y-1.5 text-xs text-stone-600">
              {project.wedding_date && (
                <div className="flex items-center justify-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>{new Date(project.wedding_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                </div>
              )}
              {project.location && (
                <div className="flex items-center justify-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>{project.location}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
            <p>
              {isUnpublished
                ? 'This wedding website has been temporarily taken offline by the hosts. Please check back later or contact the couple directly.'
                : 'This wedding website is currently in private preparation and has not yet been published to wedding guests.'}
            </p>
            <p className="text-[11px] text-stone-400 pt-1">
              If you are the event host or planner, log into your EventFrame Workspace or Studio to publish your site.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>EventFrame Home</span>
            </Link>
            {project?.id && (
              <button
                onClick={() => navigate(`/website-studio/${project.id}`)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
              >
                <span>Host Login</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 text-[11px] font-mono text-stone-400">
          Powered by EventFrame.io
        </div>
      </div>
    );
  }

  // Not found or unexpected error
  if (!project || !config) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-6 text-center">
        <PageSEO
          title="Wedding Celebration Not Found | EventFrame"
          description="The requested wedding website could not be found."
          noindex={true}
          nofollow={true}
          disableMarketingHreflang={true}
        />
        <div className="w-14 h-14 rounded-full border border-stone-200 bg-white flex items-center justify-center shadow-sm mb-4 text-stone-400">
          <Heart className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-serif text-stone-900 mb-2">Event Celebration Not Found</h1>
        <p className="text-xs text-stone-500 max-w-sm mb-6 leading-relaxed">
          {errorMessage || 'The wedding celebration you are looking for may have been updated or moved.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </Link>
      </div>
    );
  }

  // State 2 & 3: Render Wedding Website (Published or Private Preview Mode)
  return (
    <div className="min-h-screen w-full bg-[#FAF9F7] antialiased selection:bg-amber-200 selection:text-stone-900">
      <PageSEO
        title={effectiveTitle}
        description={effectiveDescription}
        keywords={seoConfig.keywords}
        canonical={effectiveCanonical}
        noindex={!isIndexableWebsite}
        nofollow={!isIndexableWebsite}
        ogImage={effectiveOgImage}
        ogImageAlt={`${coupleDisplayName} Wedding Website`}
        ogType="website"
        disableMarketingHreflang={true}
        customSchemas={eventJsonLd}
      />
      {/* Sticky Top Banner for Private Preview Mode */}
      {isPreview && (
        <aside aria-label="Website preview banner" className="sticky top-0 z-50 w-full bg-stone-900 text-white px-4 py-2.5 shadow-md border-b border-stone-800">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-medium border border-amber-500/30">
                <Eye className="w-3 h-3" />
                <span>PRIVATE DRAFT PREVIEW</span>
              </span>
              <span className="text-stone-300 hidden md:inline">
                This is a secret draft preview link. Uninvited guests cannot see this page until you publish.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPreviewLink}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors"
                title="Copy secret preview link to share with VIPs or planner"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3 text-stone-400" />}
                <span>{copiedLink ? 'Copied Preview Link' : 'Copy Preview Link'}</span>
              </button>

              <button
                onClick={() => navigate(`/website-studio/${project.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-white text-stone-900 hover:bg-stone-100 transition-colors shadow-xs"
              >
                <span>Edit in Studio</span>
                <ExternalLink className="w-3 h-3 text-stone-600" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Shared Wedding Website Renderer with Translation Context */}
      <TranslationProvider eventId={project.id} isEditor={isPreview}>
        <WeddingWebsiteRenderer
          config={config}
          project={project}
          isEditor={false}
        />
      </TranslationProvider>
    </div>
  );
}
