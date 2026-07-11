import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '../api';

const planOptions = [
  { code: 'starter', name: 'Starter', price: '$29/mo', limit: 'Up to 100 monitored listings' },
  { code: 'growth', name: 'Growth', price: '$79/mo', limit: 'Up to 500 monitored listings' },
  { code: 'pro', name: 'Pro', price: '$199/mo', limit: 'Up to 2,000 monitored listings' },
] as const;

const PricingValidationCard: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<(typeof planOptions)[number]['code']>('growth');
  const [submitting, setSubmitting] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const recordInterest = async () => {
    setSubmitting(true);
    try {
      const response = await fetchWithAuth('/api/product-validation/interest', {
        method: 'POST',
        body: JSON.stringify({
          plan: selectedPlan,
          source: 'homepage-pricing-validation',
          monitoredListingsBand: selectedPlan === 'starter' ? '1-100' : selectedPlan === 'growth' ? '101-500' : '501-2000',
        }),
      });
      if (!response.ok) throw new Error(`Interest recording failed with status ${response.status}`);
      setRecorded(true);
    } catch (error) {
      console.error('Unable to record pricing interest', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="pricing-validation-title" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-[#d7deeb] bg-[#101820] p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-[#9db4ff]">Help shape the product</p>
        <h2 id="pricing-validation-title" className="mt-2 text-2xl font-black sm:text-3xl">
          Which monitoring plan would fit your store?
        </h2>
        <p className="mt-3 max-w-3xl text-[#c3ccd5]">
          This is product research, not checkout. Your selection records anonymous interest and will not create a subscription or charge.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {planOptions.map((plan) => {
            const selected = selectedPlan === plan.code;
            return (
              <button
                key={plan.code}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setSelectedPlan(plan.code);
                  setRecorded(false);
                }}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selected ? 'border-[#9db4ff] bg-[#2f5bea]/25' : 'border-white/15 bg-white/[0.05] hover:bg-white/[0.09]'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="font-black">{plan.name}</span>
                  <span className="font-black text-[#9db4ff]">{plan.price}</span>
                </span>
                <span className="mt-2 block text-sm text-[#c3ccd5]">{plan.limit}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={recordInterest}
          disabled={submitting || recorded}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-black text-[#101820] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : recorded ? <CheckCircle2 className="mr-2 h-4 w-4 text-[#15b87a]" /> : null}
          {recorded ? 'Interest recorded—thank you' : 'Record my preference'}
        </button>
      </div>
    </section>
  );
};

export default PricingValidationCard;
