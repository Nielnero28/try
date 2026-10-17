'use client';
/* eslint-disable @next/next/no-img-element -- Gallery and accommodation URLs may be changed by staff; native images support arbitrary HTTPS sources. */
import './admin.css';
import './admin-demo.css';
import './admin-live.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BedDouble, Bell, CalendarDays, Check, ChevronRight, CircleDollarSign, Image as ImageIcon, LayoutDashboard, LogOut, Menu, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import AdminLogin from './AdminLogin';
import { clearStaffTabSession, getStaffTabToken, staffFetch } from '@/lib/admin-client';
import { makeAdminDemoData } from '@/lib/admin-demo';
type Room = { id:number; name:string; category:string; baseRate:number; capacity:number; active:boolean; image:string };
type Unit = { id:number; accommodationId:number; label:string; active:boolean };
type Booking = { id:number; reference:string; roomName:string; unitLabel:string; guestName:string; guestEmail:string; guestPhone:string; checkIn:string; checkOut:string; nights:number; adults:number; children:number; total:number; subtotal:number; fee:number; discount:number; paymentMethod:string; status:string; specialRequests:string|null; createdAt:string };
type Block = { id:number; roomId:number; startDate:string; endDate:string; reason:string };
type Photo = { id:number; url:string; alt:string; category:string; active:boolean };
type Payment = { id:number; reservationId:number; status:string; method:string; amount:number };
type Guest = { id:number; name:string; email:string; phone:string; createdAt:string };
type Data = { rooms:Room[]; units:Unit[]; bookings:Booking[]; blocks:Block[]; gallery:Photo[]; payments:Payment[]; guests:Guest[] };
const peso=(n:number)=>'₱'+n.toLocaleString('en-PH');
const displayDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const tabs=[['Overview',LayoutDashboard],['Reservations',CalendarDays],['Rooms & rates',BedDouble],['Guests',Users],['Gallery',ImageIcon],['Reports',CircleDollarSign]] as const;
export default function AdminDashboard({authenticated,configured}:{authenticated:boolean;configured:boolean}){
  const [loggedIn,setLoggedIn]=useState(authenticated);
  const [checkingSession,setCheckingSession]=useState(false);
  const [demo,setDemo]=useState(false);
  const [notice,setNotice]=useState('');
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
  const [statusFilter,setStatusFilter]=useState('All');
  const requestSequence=useRef(0);
  const [data,setData]=useState<Data|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [tab,setTab]=useState('Overview');const [search,setSearch]=useState('');const [selected,setSelected]=useState<Booking|null>(null);const [busy,setBusy]=useState(false);const [mobileNav,setMobileNav]=useState(false);
  const [rates,setRates]=useState<Record<number,string>>({});const [unitLabel,setUnitLabel]=useState('');const [unitRoom,setUnitRoom]=useState('');const [blockRoom,setBlockRoom]=useState('');const [blockStart,setBlockStart]=useState('');const [blockEnd,setBlockEnd]=useState('');const [blockReason,setBlockReason]=useState('');const [photoUrl,setPhotoUrl]=useState('');const [photoAlt,setPhotoAlt]=useState('');const [photoCategory,setPhotoCategory]=useState('Resort');
  const refresh = useCallback(async () => {
    if (demo) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const response = await staffFetch('/api/admin/data');
      if (sequence !== requestSequence.current) return;
      if (response.status === 401) {
        setNotice('Your staff session has expired. Please sign in again.');
        setLoggedIn(false);
        setData(null);
        setSelected(null);
        return;
      }
      const result: Data & { error?: string } = await response.json();
      if (sequence !== requestSequence.current) return;
      if (!response.ok) throw new Error(result.error || 'Could not load bookings.');
      setData(result);
      setSelected(previous => previous ? result.bookings.find(booking => booking.id === previous.id) || null : null);
      setLastUpdated(new Date());
      setError('');
    } catch (cause) {
      if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : 'Could not load data.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    if (authenticated || !configured || !getStaffTabToken()) return;
    let active = true;
    queueMicrotask(() => { if (active) setCheckingSession(true); });
    void staffFetch('/api/admin/session').then(response => {
      if (!active) return;
      if (response.ok) onAuthenticated();
      else clearStaffTabSession();
    }).catch(() => {
      if (active) setNotice('Could not verify your staff session. Please try signing in.');
    }).finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [authenticated, configured]);
  useEffect(() => {
    if (!loggedIn || demo) return;
    const requestRef = requestSequence;
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    const checkForBookings = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(checkForBookings, 20_000);
    window.addEventListener('focus', checkForBookings);
    document.addEventListener('visibilitychange', checkForBookings);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', checkForBookings);
      document.removeEventListener('visibilitychange', checkForBookings);
      requestRef.current++;
    };
  }, [loggedIn, demo, refresh]);
  function startDemo() {
    setData(makeAdminDemoData());
    setLoading(false);
    setError('');
    setSelected(null);
    setTab('Overview');
    setStatusFilter('All');
    setDemo(true);
    setLoggedIn(true);
  }
  function onAuthenticated() {
    setDemo(false);
    setData(null);
    setSelected(null);
    setTab('Overview');
    setStatusFilter('All');
    setNotice('');
    setLoading(true);
    setLoggedIn(true);
  }
  async function logout() {
    requestSequence.current++;
    try { if (!demo) await staffFetch('/api/admin/session', { method: 'DELETE' }); }
    catch { /* Clear the local tab session even when a network request fails. */ }
    finally {
      clearStaffTabSession();
      setLoggedIn(false);
      setDemo(false);
      setData(null);
      setSelected(null);
      setLastUpdated(null);
      setLoading(true);
    }
  }
  async function mutate(method:string, body:object, url='/api/admin/data') {
    if (demo) {
      setError('This is a read-only preview with sample data. Sign in with configured staff credentials to make changes to live bookings.');
      return false;
    }
    setBusy(true);
    setError('');
    try {
      const response = await staffFetch(url, {method, headers:{'Content-Type':'application/json'}, ...(method !== 'DELETE' ? {body:JSON.stringify(body)} : {})});
      if (response.status === 401) {
        setNotice('Your staff session has expired. Please sign in again.');
        setLoggedIn(false);
        setData(null);
        setSelected(null);
        return false;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (checkingSession && !loggedIn) return <div className="admin-session-check" role="status"><div className="admin-session-check-spinner"/><span>Checking your staff session…</span></div>;
  if (!loggedIn) return <AdminLogin configured={configured} onAuthenticated={onAuthenticated} onDemo={startDemo} notice={notice} />;
  const bookings=data?.bookings||[];const rooms=data?.rooms||[];const units=data?.units||[];const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
  const activeBookings=bookings.filter(b=>!['Cancelled','Completed'].includes(b.status));
  const pendingCount=bookings.filter(b=>b.status==='Pending').length;
  const occupied=new Set(bookings.filter(b=>['Confirmed','Checked In'].includes(b.status)&&b.checkIn<=today&&b.checkOut>today).map(b=>b.unitLabel));
  const reservedNow=new Set(activeBookings.filter(b=>b.checkIn<=today&&b.checkOut>today).map(b=>b.unitLabel));
  const blockedNow=new Set((data?.blocks||[]).filter(block=>block.startDate<=today&&block.endDate>today).map(block=>block.roomId));
  const activeUnits=units.filter(u=>u.active&&rooms.find(r=>r.id===u.accommodationId)?.active);
  const availableNow=activeUnits.filter(unit=>!reservedNow.has(unit.label)&&!blockedNow.has(unit.id)).length;
  const bookedRevenue=bookings.filter(b=>['Confirmed','Checked In','Completed'].includes(b.status)).reduce((s,b)=>s+b.total,0);
  const filtered=tab==='Reservations' ? bookings.filter(b=>(statusFilter==='All'||b.status===statusFilter)&&[b.reference,b.guestName,b.guestEmail,b.roomName,b.status].some(x=>x.toLowerCase().includes(search.toLowerCase()))) : bookings.slice(0,5);
  const paymentFor=(id:number)=>data?.payments.find(p=>p.reservationId===id);
  const table=<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>REFERENCE / GUEST</th><th>ACCOMMODATION</th><th>STAY DATES</th><th>TOTAL</th><th>STATUS</th><th></th></tr></thead><tbody>{filtered.map(b=><tr key={b.id} onClick={()=>setSelected(b)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setSelected(b)}}><td><strong>{b.reference}</strong><small>{b.guestName}</small></td><td>{b.roomName}<small>{b.unitLabel}</small></td><td>{displayDate(b.checkIn)}<small>to {displayDate(b.checkOut)}</small></td><td><strong>{peso(b.total)}</strong></td><td><span className={'admin-status status-'+b.status.toLowerCase().replace(' ','-')}>{b.status}</span></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table>{filtered.length===0&&<div className="admin-empty">{tab==='Reservations'&&(search||statusFilter!=='All')?'No reservations match your search or status filter.':'No reservations yet. New guest booking requests will appear here automatically.'}</div>}</div>;
  return <div className={demo ? 'admin-shell admin-demo-mode' : 'admin-shell'}><aside className={'admin-sidebar '+(mobileNav?'admin-sidebar-open':'')}><div className="admin-sidebar-top"><Link href="/" className="admin-logo">✳ <span>PAINAWA<small>STAFF PORTAL</small></span></Link><button className="admin-mobile-close" onClick={()=>setMobileNav(false)}><X size={20}/></button></div><p className="admin-nav-label">WORKSPACE</p><nav>{tabs.map(([label,Icon])=><button key={label} className={tab===label?'selected':''} onClick={()=>{setTab(label);setMobileNav(false);setError('')}}><Icon size={17}/>{label}{label==='Reservations'&&pendingCount>0&&<span className="admin-nav-count" aria-label={`${pendingCount} pending requests`}>{pendingCount}</span>}</button>)}</nav><div className="admin-sidebar-bottom"><Link href="/" target="_blank" rel="noopener noreferrer"><ArrowLeft size={16}/> View website</Link><button onClick={logout}><LogOut size={16}/> Sign out</button></div></aside><main className="admin-main"><header className="admin-topbar"><button className="admin-menu" onClick={()=>setMobileNav(true)}><Menu size={22}/></button><div><span>PAINAWA / {tab.toUpperCase()}</span><h1>{tab}</h1></div><div className="admin-topright">{!demo&&<button className="admin-refresh-control" type="button" onClick={()=>void refresh()} disabled={loading} aria-label="Refresh live reservations"><RefreshCw size={15} className={loading?'admin-spin':''}/> <span>Refresh</span></button>}<span className="admin-live-dot"/> {demo ? 'Sample data' : 'Live bookings'} <span className="admin-avatar">{demo ? 'D' : 'P'}</span></div></header><div className="admin-content">{demo && <div className="admin-demo-banner" role="status"><div className="admin-demo-banner-icon"><LayoutDashboard size={20}/></div><div><strong>Read-only demo · Sample data</strong><p>These bookings and guest details are fictional. Nothing here changes real reservations or payments.</p></div><button onClick={logout}>Exit demo <ArrowRight size={15}/></button></div>}{error&&<div className="admin-alert" role="alert">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}{loading && !data ? <div className="admin-empty">Loading your dashboard...</div> : !data ? <div className="admin-empty"><p>We couldn’t load your dashboard right now.</p><button className="admin-solid" onClick={() => void refresh()}>Try again</button></div> : <>
  {tab==='Overview'&&<><div className="admin-welcome"><div><span className="eyebrow dark">YOUR RESORT AT A GLANCE</span><h2>Good to see you.</h2><p>Here’s what’s happening at PAINAWA today.</p></div><div className="admin-today">{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'Asia/Manila'})}</div></div><div className="admin-inbox-notice"><div className="admin-inbox-icon"><Bell size={21}/></div><div><strong>{pendingCount>0?`${pendingCount} booking request${pendingCount===1?'':'s'} awaiting review`:'All caught up on booking requests'}</strong><p>{demo?'These are fictional preview reservations.':pendingCount>0?'New requests are saved to the database and appear here automatically.':'When a guest requests a stay, it will appear here as Pending.'}</p></div><button onClick={()=>{setStatusFilter(pendingCount?'Pending':'All');setSearch('');setTab('Reservations')}}>{pendingCount?'Review requests':'View reservations'} <ArrowRight size={16}/></button></div><div className="admin-stats"><div><span><CalendarDays size={20}/></span><small>Total bookings</small><strong>{bookings.length}</strong><p>{activeBookings.length} active reservations</p></div><div><span><CircleDollarSign size={20}/></span><small>Booked revenue</small><strong>{peso(bookedRevenue)}</strong><p>Confirmed, checked in & completed</p></div><div><span><BedDouble size={20}/></span><small>Occupancy today</small><strong>{activeUnits.length?Math.round(occupied.size/activeUnits.length*100):0}%</strong><p>{occupied.size} of {activeUnits.length} active units</p></div><div><span><Check size={20}/></span><small>Available rooms</small><strong>{availableNow}</strong><p>After pending stays &amp; blocked dates</p></div></div><div className="admin-section-title"><div><h3>Recent reservations</h3><p>Review new requests and keep stays moving.</p></div><button onClick={()=>setTab('Reservations')}>View all <ArrowRight size={16}/></button></div>{table}</>}
  {tab==='Reservations'&&<><div className="admin-section-title"><div><h3>All reservations</h3><p>Review live booking requests and keep guests informed.</p></div><span>{bookings.length} total · {pendingCount} pending</span></div><div className="admin-reservation-tools"><div className="admin-search"><Search size={17}/><input aria-label="Search reservations" placeholder="Search guest, reference, room, or status..." value={search} onChange={e=>setSearch(e.target.value)}/></div><label className="admin-status-filter"><span>STATUS</span><select aria-label="Filter reservations by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{['All','Pending','Confirmed','Checked In','Completed','Cancelled'].map(status=><option key={status} value={status}>{status==='All'?'All statuses':status}</option>)}</select></label></div><p className="admin-results-meta">Showing {filtered.length} of {bookings.length} reservations {!demo&&lastUpdated&&<span>· Updated {lastUpdated.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} · Auto-refreshes every 20 seconds</span>}</p>{table}</>}
  {tab==='Rooms & rates'&&<><div className="admin-section-title"><div><h3>Rooms & pricing</h3><p>Control rates, bookable units and unavailable dates.</p></div></div><div className="admin-room-grid">{rooms.map(r=><div className="admin-room-card" key={r.id}><img src={r.image} alt={r.name}/><div><span className="mini-label">{r.category.toUpperCase()} · UP TO {r.capacity} GUESTS</span><h4>{r.name}</h4><label>Nightly rate (PHP)<input disabled={demo} type="number" min="500" value={rates[r.id]??String(r.baseRate)} onChange={e=>setRates({...rates,[r.id]:e.target.value})}/></label><div className="admin-room-actions"><span>{units.filter(u=>u.accommodationId===r.id&&u.active).length} active units</span><button disabled={busy || demo} onClick={()=>mutate('PATCH',{type:'room',id:r.id,baseRate:Number(rates[r.id]??r.baseRate),active:r.active})}>Save rate</button></div><button className="admin-toggle" disabled={busy || demo} onClick={()=>mutate('PATCH',{type:'room',id:r.id,baseRate:r.baseRate,active:!r.active})}>{r.active?'● Bookable — click to disable':'○ Disabled — click to enable'}</button></div></div>)}</div><div className="admin-panels"><div className="admin-panel"><h4>Room inventory</h4><p>Individual units are assigned automatically when guests book.</p>{units.map(u=><div className="admin-list-row" key={u.id}><span>{u.label}<small>{rooms.find(r=>r.id===u.accommodationId)?.name}</small></span><button disabled={busy || demo} onClick={()=>mutate('PATCH',{type:'unit',id:u.id,active:!u.active})}>{u.active?'Active':'Disabled'}</button></div>)}<form onSubmit={async e=>{e.preventDefault();if(await mutate('POST',{type:'unit',label:unitLabel,accommodationId:Number(unitRoom)}))setUnitLabel('')}}><h5>Add inventory unit</h5><select disabled={demo} required value={unitRoom} onChange={e=>setUnitRoom(e.target.value)}><option value="">Choose accommodation</option>{rooms.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select><input disabled={demo} required placeholder="Unique unit label (e.g. Garden Villa 04)" value={unitLabel} onChange={e=>setUnitLabel(e.target.value)}/><button disabled={busy || demo} className="admin-solid"><Plus size={15}/> Add unit</button></form></div><div className="admin-panel"><h4>Availability blocks</h4><p>Block a unit for maintenance or private use. Existing bookings cannot be blocked.</p>{data?.blocks.map(b=><div className="admin-list-row" key={b.id}><span>{units.find(u=>u.id===b.roomId)?.label}<small>{displayDate(b.startDate)} – {displayDate(b.endDate)} · {b.reason}</small></span><button disabled={busy || demo} onClick={()=>mutate('DELETE',{},`/api/admin/data?id=${b.id}`)}>Remove</button></div>)}{!data?.blocks.length&&<p>No dates blocked.</p>}<form onSubmit={async e=>{e.preventDefault();if(await mutate('POST',{type:'block',roomId:Number(blockRoom),startDate:blockStart,endDate:blockEnd,reason:blockReason})){setBlockReason('');setBlockStart('');setBlockEnd('')}}}><h5>Block dates</h5><select disabled={demo} required value={blockRoom} onChange={e=>setBlockRoom(e.target.value)}><option value="">Choose unit</option>{units.map(u=><option value={u.id} key={u.id}>{u.label}</option>)}</select><div className="admin-form-row"><input disabled={demo} required type="date" min={today} value={blockStart} onChange={e=>setBlockStart(e.target.value)}/><input disabled={demo} required type="date" min={blockStart||today} value={blockEnd} onChange={e=>setBlockEnd(e.target.value)}/></div><input disabled={demo} required placeholder="Reason (e.g. maintenance)" value={blockReason} onChange={e=>setBlockReason(e.target.value)}/><button disabled={busy || demo} className="admin-solid"><Plus size={15}/> Block dates</button></form></div></div></>}
  {tab==='Guests'&&<><div className="admin-section-title"><div><h3>Guest directory</h3><p>Contact details submitted with reservation requests.</p></div><span>{data?.guests.length||0} guests</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>GUEST</th><th>EMAIL</th><th>PHONE</th><th>RESERVATIONS</th></tr></thead><tbody>{data?.guests.map(g=><tr key={g.id}><td><strong>{g.name}</strong></td><td>{g.email}</td><td>{g.phone}</td><td>{bookings.filter(b=>b.guestEmail===g.email).length}</td></tr>)}</tbody></table>{!data?.guests.length&&<div className="admin-empty">No guests yet.</div>}</div></>}
  {tab==='Gallery'&&<><div className="admin-section-title"><div><h3>Gallery manager</h3><p>Images shown in the resort gallery.</p></div></div><div className="admin-photo-grid">{data?.gallery.map(p=><div key={p.id}><img src={p.url} alt={p.alt}/><div><strong>{p.alt}</strong><small>{p.category}</small><button disabled={busy || demo} onClick={()=>mutate('PATCH',{type:'gallery',id:p.id,active:!p.active})}>{p.active?'Visible':'Hidden'}</button></div></div>)}</div><form className="admin-panel admin-gallery-form" onSubmit={async e=>{e.preventDefault();if(await mutate('POST',{type:'gallery',url:photoUrl,alt:photoAlt,category:photoCategory})){setPhotoUrl('');setPhotoAlt('')}}}><h4>Add a photo</h4><p>Use a publicly accessible HTTPS image URL.</p><input disabled={demo} required type="url" placeholder="https://... image URL" value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)}/><input disabled={demo} required placeholder="Describe the image for accessibility" value={photoAlt} onChange={e=>setPhotoAlt(e.target.value)}/><select disabled={demo} value={photoCategory} onChange={e=>setPhotoCategory(e.target.value)}><option>Resort</option><option>Rooms</option><option>Dining</option><option>Experiences</option></select><button disabled={busy || demo} className="admin-solid"><Plus size={15}/> Add photo</button></form></>}
  {tab==='Reports'&&<><div className="admin-section-title"><div><h3>Resort reports</h3><p>A simple snapshot of your reservations and projected bookings.</p></div></div><div className="admin-stats"><div><small>Total reservations</small><strong>{bookings.length}</strong><p>All time</p></div><div><small>Pending review</small><strong>{bookings.filter(b=>b.status==='Pending').length}</strong><p>Awaiting staff action</p></div><div><small>Booked revenue</small><strong>{peso(bookedRevenue)}</strong><p>Not equivalent to payments received</p></div><div><small>Verified payments</small><strong>{peso((data?.payments||[]).filter(p=>p.status==='Verified').reduce((s,p)=>s+p.amount,0))}</strong><p>Manually marked verified by staff</p></div></div><div className="admin-panel"><h4>Bookings by accommodation</h4>{rooms.map(r=><div className="admin-list-row" key={r.id}><span>{r.name}</span><strong>{bookings.filter(b=>b.roomName===r.name).length} bookings</strong></div>)}</div><p className="admin-report-note">All totals are based on saved reservation records. “Booked revenue” is a projection, not proof of payment. Refunds require manual handling.</p></>}
  </>}</div></main>
  {selected&&<div className="admin-drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div className="admin-drawer" role="dialog" aria-modal="true" aria-label="Reservation details"><button className="admin-drawer-close" onClick={()=>setSelected(null)}><X size={22}/></button><span className="eyebrow dark">RESERVATION DETAILS</span><h2>{selected.reference}</h2><span className={'admin-status status-'+selected.status.toLowerCase().replace(' ','-')}>{selected.status}</span><div className="admin-detail-section"><h4>Guest</h4><p><strong>{selected.guestName}</strong><br/>{selected.guestEmail}<br/>{selected.guestPhone}</p></div><div className="admin-detail-section"><h4>Stay</h4><div><span>Accommodation</span><strong>{selected.roomName}</strong></div><div><span>Assigned unit</span><strong>{selected.unitLabel}</strong></div><div><span>Dates</span><strong>{displayDate(selected.checkIn)} – {displayDate(selected.checkOut)}</strong></div><div><span>Guests</span><strong>{selected.adults} adults, {selected.children} children</strong></div><div><span>Nights</span><strong>{selected.nights}</strong></div></div><div className="admin-detail-section"><h4>Payment & price</h4><div><span>Room cost</span><strong>{peso(selected.subtotal)}</strong></div><div><span>Service fee</span><strong>{peso(selected.fee)}</strong></div><div><span>Discount</span><strong>−{peso(selected.discount)}</strong></div><div><span>Total estimate</span><strong>{peso(selected.total)}</strong></div><div><span>Method</span><strong>{selected.paymentMethod}</strong></div><label>Verification status<select value={paymentFor(selected.id)?.status||'Unverified'} disabled={busy || demo} onChange={e=>{const p=paymentFor(selected.id);if(p)mutate('PATCH',{type:'payment',id:p.id,status:e.target.value})}}><option>Unverified</option><option>Verified</option><option>Refunded</option></select></label><small>Only mark Verified after independently confirming payment. Refunds are handled outside this website.</small></div><div className="admin-detail-section"><h4>Special requests</h4><p>{selected.specialRequests||'None provided.'}</p></div><div className="admin-detail-section"><h4>Reservation status</h4><select value={data?.bookings.find(b=>b.id===selected.id)?.status||selected.status} disabled={busy || demo} onChange={async e=>{if(await mutate('PATCH',{type:'reservation',id:selected.id,status:e.target.value}))setSelected({...selected,status:e.target.value})}}>{['Pending','Confirmed','Checked In','Completed','Cancelled'].map(x=><option key={x}>{x}</option>)}</select><small>Pending reservations reserve inventory. Cancelled reservations cannot be reopened.</small></div></div></div>}
  </div>;
}
