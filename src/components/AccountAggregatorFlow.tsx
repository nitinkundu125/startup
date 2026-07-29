'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Smartphone, ShieldCheck, KeyRound, Loader2, ArrowRight, Building2 } from 'lucide-react';

export function AccountAggregatorFlow() {
  const router = useRouter();
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'FETCHING' | 'SUCCESS'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [consentId, setConsentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  async function handleRequestConsent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/aa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request-consent', phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request consent');
      
      setConsentId(data.consentId);
      setStep('OTP');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!otp) return;

    setLoading(true);
    try {
      const res = await apiFetch('/api/aa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', consentId, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      
      setStep('FETCHING');
      
      // Artificial delay to simulate fetching data from AMC
      setTimeout(() => {
        setResultMsg(`Successfully synced ${data.imported} Mutual Fund transactions!`);
        setStep('SUCCESS');
        router.refresh();
      }, 2000);
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden border-teal-100 bg-gradient-to-b from-teal-50/50 to-white">
      <div className="flex flex-col md:flex-row items-center p-6 gap-8">
        <div className="flex-1 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
            <ShieldCheck className="h-4 w-4" />
            RBI Regulated Account Aggregator
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Auto-Sync Mutual Funds
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Skip the CSV uploads. Securely fetch your Mutual Fund holdings and transaction history directly from your AMCs using the official Account Aggregator network.
          </p>
          
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 pt-2">
            <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> CAMS & KFintech</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Bank-grade Security</span>
          </div>
        </div>

        <div className="w-full md:w-[340px] shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          {step === 'PHONE' && (
            <form onSubmit={handleRequestConsent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">Phone Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter linked mobile number"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>
              </div>
              
              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
              
              <Button type="submit" variant="accent" className="w-full h-10" disabled={loading || phone.length < 10}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
              </Button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">Enter OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 123456 to test"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all tracking-widest"
                    maxLength={6}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

              <Button type="submit" variant="accent" className="w-full h-10" disabled={loading || otp.length < 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Fetch Data'}
              </Button>
            </form>
          )}

          {step === 'FETCHING' && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-teal-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-teal-600 rounded-full p-3">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Fetching Mutual Funds</p>
                <p className="text-sm text-slate-500 mt-1">Establishing secure connection...</p>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="bg-green-100 text-green-600 rounded-full p-3">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Sync Complete!</p>
                <p className="text-sm text-slate-600 mt-1">{resultMsg}</p>
              </div>
              <Button onClick={() => router.push('/')} variant="secondary" className="w-full h-10 mt-2">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
