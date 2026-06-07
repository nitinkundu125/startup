import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { clearSessionCookie, getSessionUserId } from '@/lib/session';
import { convertFiuDataToCsv, mockFiuData } from '@/lib/aa-parser';
import { importTradebookFromCsv } from '@/lib/import-tradebook';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) {
    if (await getSessionUserId()) await clearSessionCookie();
    return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'request-consent') {
      const phone = body.phone;
      if (!phone || phone.length < 10) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
      }
      // In production, call Setu/Finvu to generate a consent handle
      return NextResponse.json({ success: true, consentId: `mock-consent-${Date.now()}` });
    }

    if (action === 'verify') {
      const { consentId, otp } = body;
      if (!consentId || !otp) {
        return NextResponse.json({ error: 'Missing consentId or OTP' }, { status: 400 });
      }

      if (otp !== '123456') {
        return NextResponse.json({ error: 'Invalid OTP. Please enter 123456 for the mock simulation.' }, { status: 400 });
      }

      // OTP is valid. In production, we would now query Setu's /fi/fetch endpoint
      // and wait for the JSON payload to arrive via Webhook or polling.
      // Here, we use our mock FIU data:
      const csvData = convertFiuDataToCsv(mockFiuData);

      // Ingest it into our database
      const result = await importTradebookFromCsv(user.id, csvData, 'Account_Aggregator_Sync.csv', 'MUTUAL_FUND');

      if (result.errors && result.errors.length > 0) {
        console.error('Errors during AA ingestion:', result.errors);
      }

      revalidatePath('/');
      revalidatePath('/holdings');
      revalidatePath('/upload');

      return NextResponse.json({
        success: true,
        imported: result.imported,
        skipped: result.skipped
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('AA API Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
