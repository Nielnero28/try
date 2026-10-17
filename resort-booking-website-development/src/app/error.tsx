'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Leaf, RefreshCw, ShieldCheck } from 'lucide-react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[PAINAWA] Unexpected page render error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f6ef] px-5 py-14 text-[#173c32]">
      <section className="w-full max-w-xl border border-[#e1e6d9] bg-white p-8 shadow-[0_22px_60px_rgba(22,49,34,.07)] sm:p-12">
        <Link href="/" className="inline-flex items-center gap-3 font-serif text-xl tracking-[.12em]"><span className="grid h-10 w-10 place-items-center rounded-full border border-[#47735a]"><Leaf size={19}/></span> PAINAWA</Link>
        <div className="mt-12 h-px w-10 bg-[#b59866]" />
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[.2em] text-[#759077]">Something interrupted the journey</p>
        <h1 className="mt-3 font-serif text-[clamp(46px,7vw,68px)] leading-[.96] tracking-[-.03em]">Let’s try that <em>again.</em></h1>
        <p className="mt-6 text-sm leading-7 text-[#697b6d]">This page did not finish loading. You can retry below. If it continues, check the backend health status and your deployment’s server logs. No reservation or payment has been confirmed by this error page.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={reset} className="inline-flex items-center gap-3 bg-[#173c32] px-5 py-3 text-xs font-bold text-white hover:bg-[#2c5a43]">Try again <RefreshCw size={16}/></button>
          <Link href="/" className="inline-flex items-center gap-3 border border-[#c4d1bd] px-5 py-3 text-xs font-bold hover:bg-[#f5f8f2]">Return home <ArrowLeft size={15}/></Link>
          <a href="/api/health" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-2 py-3 text-xs font-bold hover:underline">Check backend <ArrowUpRight size={15}/></a>
        </div>
        <p className="mt-10 flex items-center gap-2 border-t border-[#edf0e8] pt-5 text-[11px] text-[#859486]"><ShieldCheck size={15}/> Guest data is never shown here. Error details remain in the server logs.</p>
      </section>
    </main>
  );
}
