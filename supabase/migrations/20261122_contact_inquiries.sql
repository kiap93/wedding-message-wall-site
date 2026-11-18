-- Contact Us Public Enquiries Table
-- Stores customer enquiries submitted from https://eventframe.io/contact
-- Accessed exclusively via server-side API (service_role) and Super Admin Developer Console (/developer/contact-enquiries)

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  enquiry_type text NOT NULL CHECK (enquiry_type IN ('general', 'technical_support', 'partnerships', 'billing')),
  subject text NOT NULL,
  event_name text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  internal_notes text,
  admin_notification_sent boolean NOT NULL DEFAULT false,
  customer_ack_sent boolean NOT NULL DEFAULT false,
  notification_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at
  ON public.contact_inquiries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status
  ON public.contact_inquiries (status);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_enquiry_type
  ON public.contact_inquiries (enquiry_type);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_email_lower
  ON public.contact_inquiries (lower(email));

CREATE OR REPLACE FUNCTION public.set_contact_inquiries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER trg_contact_inquiries_updated_at
  BEFORE UPDATE ON public.contact_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contact_inquiries_updated_at();

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "Service role full access on contact_inquiries"
  ON public.contact_inquiries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.contact_inquiries FROM anon, authenticated;
