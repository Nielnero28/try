import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CircleAlert, Database, Leaf, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { backendMessages, type BackendStatus } from '@/lib/readiness';

type SetupStatus = Exclude<BackendStatus, 'ready'>;

export default function BackendSetup({ status }: { status: SetupStatus }) {
  const needsUrl = status === 'configuration_missing' || status === 'database_unavailable';
  return (
    <main className="min-h-screen bg-[#f7f6ef] text-[#173c32]">
      <div className="grid min-h-screen lg:grid-cols-[.84fr_1.16fr]">
        <aside className="relative hidden min-h-screen overflow-hidden bg-[#173c32] lg:block">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "linear-gradient(180deg,rgba(13,43,31,.35),rgba(13,43,31,.82)),url('https://images.pexels.com/photos/27429704/pexels-photo-27429704.jpeg?auto=compress&cs=tinysrgb&w=1200')" }} />
          <div className="relative flex h-full flex-col justify-between p-12 text-white">
            <Link href="/" className="flex w-fit items-center gap-3 font-serif text-xl tracking-[.18em]"><span className="grid h-10 w-10 place-items-center rounded-full border border-white/80"><Leaf size={19}/></span> PAINAWA</Link>
            <div><p className="mb-5 text-[10px] font-bold tracking-[.25em] text-[#e8dab8]">YOUR RESORT, READY WHEN YOU ARE</p><h2 className="max-w-xl text-6xl leading-[.95] xl:text-7xl">Thoughtful stays need a <em>dependable beginning.</em></h2><p className="mt-6 max-w-sm text-sm leading-7 text-white/80">The staff portal protects your guest data while the booking service is being prepared.</p></div>
            <span className="text-[10px] tracking-[.2em] text-white/75">PAINAWA RESORT & STAY · PHILIPPINES</span>
          </div>
        </aside>
        <section className="flex min-h-screen flex-col px-6 py-7 sm:px-12 lg:px-[clamp(45px,7vw,120px)]">
          <header className="flex items-center justify-between gap-4 text-xs font-semibold"><span className="flex items-center gap-2 uppercase tracking-[.16em] text-[#718875]"><span className="h-2 w-2 rounded-full bg-[#be956d]"/> Staff portal</span><Link href="/" className="flex items-center gap-2 text-[#3b6048] hover:underline"><ArrowLeft size={15}/> Resort homepage</Link></header>
          <div className="my-auto w-full max-w-[540px] py-14">
            <div className="mb-8 grid h-14 w-14 place-items-center rounded-full bg-[#e9e4d3] text-[#4f7256]"><Database size={25} strokeWidth={1.5}/></div>
            <span className="text-[11px] font-bold uppercase tracking-[.22em] text-[#7a8d75]">Booking service setup</span>
            <h1 className="mt-4 font-serif text-[clamp(48px,5vw,75px)] leading-[.96] tracking-[-.04em]">Staff access is <em>paused.</em></h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[#66786b]">Live reservations are not available yet. This is a configuration issue, not an expired staff session. Guest details remain protected.</p>
            <div className="my-9 border border-[#dfe6d9] bg-white p-6 shadow-[0_12px_36px_rgba(18,48,34,.04)]">
              <div className="flex items-start gap-3"><CircleAlert size={19} className="mt-0.5 shrink-0 text-[#a57c4d]"/><div><strong className="block text-xs uppercase tracking-[.12em]">What needs attention</strong><p className="mt-2 mb-0 text-sm leading-6 text-[#607365]">{backendMessages[status]}</p></div></div>
            </div>
            <div className="space-y-5 text-sm">
              <div className="flex gap-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8eee4] text-xs font-bold">1</span><p className="m-0 leading-6">{needsUrl ? <>Add a persistent PostgreSQL <code className="rounded bg-[#e9eee5] px-1 py-0.5 text-xs">DATABASE_URL</code> as a <strong>server-side</strong> environment variable on your host.</> : <>Point the app and migration CLI at the <strong>same</strong> PostgreSQL database.</>}</p></div>
              <div className="flex gap-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8eee4] text-xs font-bold">2</span><p className="m-0 leading-6">On a fresh database, apply the schema with <code className="rounded bg-[#e9eee5] px-1 py-0.5 text-xs">npx drizzle-kit migrate</code>. Preserve existing bookings if you are migrating an older database.</p></div>
              <div className="flex gap-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8eee4] text-xs font-bold">3</span><p className="m-0 leading-6">Run <code className="rounded bg-[#e9eee5] px-1 py-0.5 text-xs">node scripts/check-deployment.mjs</code>, then reload. See <strong>README.md</strong> for fresh and existing database paths.</p></div>
            </div>
            <div className="mt-9 flex flex-wrap gap-3"><a href="/api/health" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-[#173c32] px-5 py-3.5 text-xs font-semibold text-white hover:bg-[#285a43]">Check backend status <ArrowUpRight size={16}/></a><a href="/admin" className="inline-flex items-center gap-3 border border-[#b9c8b7] px-5 py-3.5 text-xs font-semibold hover:bg-white">Try again <RefreshCw size={15}/></a></div>
          </div>
          <footer className="flex items-center gap-2 border-t border-[#dfe6d9] pt-5 text-[11px] text-[#819184]"><ShieldCheck size={15}/> No guest data or staff credentials are exposed on this page. <LockKeyhole size={13}/></footer>
        </section>
      </div>
    </main>
  );
}
