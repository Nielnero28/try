'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { clearStaffTabSession, rememberStaffTabSession } from '@/lib/admin-client';
import './admin-login.css';

type Props = {
  configured: boolean;
  onAuthenticated: () => void;
  onDemo: () => void;
  notice?: string;
};

export default function AdminLogin({ configured, onAuthenticated, onDemo, notice }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to sign in. Please try again.');

      // An embedded preview can silently discard even a successfully set cookie.
      const check = await fetch('/api/admin/session', { credentials: 'include', cache: 'no-store' });
      if (check.ok) {
        clearStaffTabSession();
      } else {
        const fallback = await fetch('/api/admin/session', {
          method: 'POST', credentials: 'include', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, transport: 'bearer' }),
        });
        const result = await fallback.json();
        if (!fallback.ok || typeof result.sessionToken !== 'string') {
          throw new Error(result.error || 'Unable to establish a staff session in this browser.');
        }
        rememberStaffTabSession(result.sessionToken, result.expiresIn);
      }
      setPassword('');
      onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="staff-entry">
      <aside className="staff-entry-visual" aria-label="PAINAWA resort photography">
        <div className="staff-entry-visual-image" />
        <div className="staff-entry-visual-tint" />
        <Link className="staff-entry-brand" href="/" aria-label="PAINAWA Resort & Stay home">
          <span className="staff-entry-brand-icon"><Leaf size={20} strokeWidth={1.5} /></span>
          <span><strong>PAINAWA</strong><small>RESORT & STAY</small></span>
        </Link>
        <div className="staff-entry-visual-copy">
          <span className="staff-entry-overline"><i /> THE ART OF A WARM WELCOME</span>
          <h2>Every great stay<br />starts <em>here.</em></h2>
          <p>More time for what matters. More room to make every guest feel at home.</p>
        </div>
        <span className="staff-entry-visual-foot">A SLOWER KIND OF PARADISE &nbsp; · &nbsp; PHILIPPINES</span>
      </aside>

      <section className="staff-entry-panel">
        <div className="staff-entry-topline">
          <span><span className="staff-entry-topline-dot" /> PAINAWA STAFF PORTAL</span>
          <Link href="/"><ArrowLeft size={15} /> Back to resort</Link>
        </div>

        <div className="staff-entry-main">
          <span className="staff-entry-kicker"><LockKeyhole size={14} /> {configured ? 'LIVE STAFF ACCESS' : 'INTERACTIVE STAFF PREVIEW'}</span>
          <h1>Welcome <em>back.</em></h1>
          <p className="staff-entry-lede">{configured ? 'Sign in as an authorized staff member to see real reservation requests, guest details, and booking updates.' : 'Explore the staff experience with fictional sample data. Live guest details always require staff authorization.'}</p>

          {notice && <div className="staff-entry-feedback" role="status">{notice}</div>}

          {configured ? (
            <form className="staff-entry-form" onSubmit={handleSubmit}>
              <div className="staff-entry-field">
                <label htmlFor="staff-email">Email address</label>
                <input id="staff-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@yourresort.com" autoComplete="username" autoCapitalize="none" required />
              </div>
              <div className="staff-entry-field">
                <div className="staff-entry-field-heading">
                  <label htmlFor="staff-password">Password</label>
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />} {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input id="staff-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
              </div>
              {error && <div className="staff-entry-feedback staff-entry-feedback-error" role="alert">{error}</div>}
              <button className="staff-entry-primary" type="submit" disabled={submitting}>
                {submitting ? 'Signing you in…' : 'Sign in to dashboard'} <ArrowRight size={18} />
              </button>
              <p className="staff-entry-privacy"><ShieldCheck size={16} /> Sessions expire after 8 hours. Embedded previews use a tab-only session if cookies are blocked.</p>
            </form>
          ) : (
            <div className="staff-entry-demo-card">
              <div className="staff-entry-demo-icon"><Sparkles size={20} /></div>
              <div>
                <span className="staff-entry-demo-label">DEMO MODE AVAILABLE</span>
                <h3>Take a look around.</h3>
                <p>Staff credentials haven’t been set up for this preview. Explore the dashboard using <strong>sample bookings only</strong>—nothing you do here changes real stays or payments.</p>
              </div>
              <button className="staff-entry-primary" type="button" onClick={onDemo}>Explore demo dashboard <ArrowRight size={18} /></button>
              <span className="staff-entry-demo-caption"><ShieldCheck size={15} /> Read-only · Fictional guest data · No sign-in needed</span>
            </div>
          )}

          <details className="staff-entry-setup">
            <summary>{configured ? 'About staff access and live bookings' : 'How do I enable live staff access?'}</summary>
            <p>{configured ? 'Your owner account is ready. Sign in above to see reservations stored in PostgreSQL. New requests appear as Pending; only authorized staff can change their status. To rotate credentials, update the server environment and restart the app.' : <>Set <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD_HASH</code> (or <code>ADMIN_PASSWORD</code>), and <code>ADMIN_SESSION_SECRET</code> in the server environment and restart. The demo never reads real guest records.</>}</p>
          </details>
        </div>
        <div className="staff-entry-bottom">© {new Date().getFullYear()} PAINAWA RESORT & STAY <span>MADE FOR MOMENTS THAT MATTER</span></div>
      </section>
    </main>
  );
}
