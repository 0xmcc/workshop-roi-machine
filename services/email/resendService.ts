import { Resend } from 'resend';

/**
 * Resend email service.
 * 
 * SECURITY NOTE: In production, email sending should be done via a backend
 * (e.g., Supabase Edge Function) to avoid exposing the API key in client code.
 * This implementation is for development/demo purposes.
 * 
 * Set VITE_RESEND_API_KEY in your environment to enable email sending.
 * Set VITE_RESEND_FROM_EMAIL to customize the sender (default: onboarding@resend.dev)
 */

let _resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (_resend) return _resend;
  
  const apiKey = import.meta.env.VITE_RESEND_API_KEY as string | undefined;
  if (!apiKey) {
    return null;
  }
  
  _resend = new Resend(apiKey);
  return _resend;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Check if Resend is configured and available.
 */
export function isResendConfigured(): boolean {
  return !!import.meta.env.VITE_RESEND_API_KEY;
}

/**
 * Get the configured "from" email address.
 */
export function getFromEmail(): string {
  return (import.meta.env.VITE_RESEND_FROM_EMAIL as string) || 'Workshop ROI <onboarding@resend.dev>';
}

/**
 * Send an email via Resend.
 * Returns success: false if Resend is not configured (allows graceful degradation).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const resend = getResendClient();
  
  if (!resend) {
    console.warn('[ResendService] VITE_RESEND_API_KEY not configured. Email not sent.');
    return {
      success: false,
      error: 'Email service not configured. Set VITE_RESEND_API_KEY to enable.'
    };
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: params.to,
      subject: params.subject,
      text: params.body,
      replyTo: params.replyTo
    });
    
    if (error) {
      console.error('[ResendService] Failed to send email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
    
    return {
      success: true,
      messageId: data?.id
    };
  } catch (err: any) {
    console.error('[ResendService] Exception sending email:', err);
    return {
      success: false,
      error: err?.message || 'Unexpected error sending email'
    };
  }
}
