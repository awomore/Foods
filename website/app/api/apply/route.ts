import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, partner_type, location, fleet_size } = await req.json();

    if (!name || !email || !partner_type) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    await resend.emails.send({
      from: 'FOODSbyme Website <onboarding@resend.dev>',
      to: 'partnerships@foodsbyme.com',
      replyTo: email,
      subject: `Fleet partner application — ${partner_type}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111827;">
          <div style="background:#111827;border-radius:12px;padding:32px 28px;margin-bottom:28px;">
            <p style="font-size:18px;font-weight:600;color:#FAFAFA;margin:0;">FOODSbyme</p>
            <p style="font-size:13px;color:#FF6B35;margin:8px 0 0;text-transform:uppercase;letter-spacing:.15em;">New Fleet Partner Application</p>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:13px;width:140px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:500;">${name}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:13px;">Email</td><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:500;">${email}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:13px;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:500;">${phone || '—'}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:13px;">Partner type</td><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:500;">${partner_type}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:13px;">Location</td><td style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:500;">${location || '—'}</td></tr>
            <tr><td style="padding:10px 0;color:#6B7280;font-size:13px;">Fleet size</td><td style="padding:10px 0;font-size:14px;font-weight:500;">${fleet_size || '—'}</td></tr>
          </table>
          <p style="margin-top:28px;font-size:13px;color:#6B7280;">Reply directly to this email to reach the applicant at ${email}.</p>
          <p style="margin-top:4px;font-size:11px;color:#9CA3AF;">Submitted via foodsbyme.com/fleet/apply</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[apply] email error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to send' }, { status: 500 });
  }
}
