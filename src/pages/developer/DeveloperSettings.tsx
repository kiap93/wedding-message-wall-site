import React, { useEffect, useState, useCallback } from 'react';
import { Save, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { developerApi, PlatformSettingsState } from '../../lib/developerApi';
import { ErrorAlert, formatDateTimeShort } from '../../components/developer/DeveloperShared';

const INITIAL_SETTINGS: PlatformSettingsState = {
  platform_name: 'EventFrame',
  support_email: 'support@eventframe.io',
  allow_public_registration: true,
  maintenance_mode: false,
  default_event_price_usd: 5,
  default_event_duration_months: 12,
};

export default function DeveloperSettings() {
  const [form, setForm] = useState<PlatformSettingsState>(INITIAL_SETTINGS);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await developerApi.getSettings();
      setForm(res.settings);
      setUpdatedAt(res.updatedAt);
      setUpdatedBy(res.updatedBy);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const res = await developerApi.updateSettings(form);
      setForm(res.settings);
      setUpdatedAt(res.updatedAt);
      setUpdatedBy(res.updatedBy);
      setSavedNotice('Platform settings saved and recorded in audit logs.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update platform settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Platform Settings</h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Persisted platform configuration stored in <code className="font-mono">platform_settings</code> with
          mandatory audit trail logging.
        </p>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadSettings} />}

      {savedNotice && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#15803D]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {loading ? (
        <div className="h-72 bg-white border border-[#E8E8E5] rounded-lg animate-pulse" />
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-[#E8E8E5] rounded-lg divide-y divide-[#EFEFEA]">
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#555555] mb-1.5">
                Platform Name
              </label>
              <input
                type="text"
                required
                value={form.platform_name}
                onChange={(e) => setForm((prev) => ({ ...prev, platform_name: e.target.value }))}
                className="w-full h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#555555] mb-1.5">
                Support Email
              </label>
              <input
                type="email"
                required
                value={form.support_email}
                onChange={(e) => setForm((prev) => ({ ...prev, support_email: e.target.value }))}
                className="w-full h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#555555] mb-1.5">
                Default Event Price (USD)
              </label>
              <input
                type="number"
                min={1}
                step={0.01}
                required
                value={form.default_event_price_usd}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    default_event_price_usd: Math.max(1, Number(e.target.value) || 5),
                  }))
                }
                className="w-full h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs tabular-nums text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
              />
              <p className="mt-1 text-[11px] text-[#777777]">
                Standard pay-per-event pricing reference (default $5.00 USD).
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#555555] mb-1.5">
                Default Event Duration (Months)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                required
                value={form.default_event_duration_months}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    default_event_duration_months: Math.max(1, parseInt(e.target.value, 10) || 12),
                  }))
                }
                className="w-full h-9 px-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded-md text-xs tabular-nums text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#252525]"
              />
            </div>
          </div>

          <div className="p-5 space-y-4">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-[#1A1A1A]">Allow Public Registration</div>
                <div className="text-[11px] text-[#777777]">
                  Permits new agencies and users to register via email or Google OAuth.
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.allow_public_registration}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, allow_public_registration: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 accent-[#252525]"
              />
            </label>

            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-[#1A1A1A]">Maintenance Mode</div>
                <div className="text-[11px] text-[#777777]">
                  Flags platform configuration for scheduled operational maintenance windows.
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.maintenance_mode}
                onChange={(e) => setForm((prev) => ({ ...prev, maintenance_mode: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[#252525]"
              />
            </label>
          </div>

          <div className="px-5 py-4 bg-[#FAF9F7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-lg">
            <div className="text-[11px] text-[#777777] tabular-nums">
              {updatedAt ? (
                <>
                  Last updated <span className="text-[#252525] font-medium">{formatDateTimeShort(updatedAt)}</span>
                  {updatedBy ? ` by ${updatedBy}` : ''}
                </>
              ) : (
                'Default baseline configuration'
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 bg-[#252525] text-white rounded-md text-xs font-medium hover:bg-[#3A3A3A] disabled:opacity-50 inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Server-Side Security Posture Summary */}
      <div className="bg-white border border-[#E8E8E5] rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#1A1A1A]">
          <ShieldCheck className="w-4 h-4 text-[#15803D]" />
          <span>Active Security Controls</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#555555]">
          <div className="p-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded">
            <div className="font-medium text-[#1A1A1A]">Server-Side Developer Enforcement</div>
            <div className="text-[11px] mt-0.5">
              Every <code className="font-mono">/api/developer/*</code> route validates the session JWT and queries{' '}
              <code className="font-mono">users_auth.is_developer = true</code> directly from the database.
            </div>
          </div>
          <div className="p-3 bg-[#F7F7F5] border border-[#E8E8E5] rounded">
            <div className="font-medium text-[#1A1A1A]">Suspension Enforcement</div>
            <div className="text-[11px] mt-0.5">
              Suspended accounts are blocked on login, session check, and workspace mutations while preserving
              organization data.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
