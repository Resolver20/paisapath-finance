import React, { Component, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, database, googleProvider } from './firebase';
import './styles.css';

const blank = { accounts: [], flow: [], goals: [] };
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const amount = (n) => money.format(Number(n) || 0);
const sum = (items) => items.reduce((total, item) => total + (Number(item.amount) || 0), 0);

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <Screen><p className="eyebrow">PAISAPATH</p><h1>Your dashboard needs a refresh.</h1><p className="lead">Please reload this page. Your private Firestore data has not been changed.</p><button className="primary" onClick={() => window.location.reload()}>Reload PaisaPath</button></Screen>;
    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(); const [data, setData] = useState(blank); const [busy, setBusy] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    // Some privacy-focused browsers delay Firebase's saved-session check. Never leave the page loading forever.
    const fallback = window.setTimeout(() => setBusy(false), 3500);
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      window.clearTimeout(fallback);
      // Do not retain a previous account's values during identity changes.
      setData(blank); setBusy(true); setUser(nextUser); setError('');
      if (!nextUser) { setBusy(false); return; }
      try {
        const saved = await getDoc(doc(database, 'users', nextUser.uid, 'private', 'dashboard'));
        setData(saved.exists() ? { ...blank, ...saved.data() } : blank);
      } catch { setError('Your dashboard could not be loaded. Please try again.'); }
      finally { setBusy(false); }
    });
    return () => { window.clearTimeout(fallback); unsubscribe(); };
  }, []);
  const save = async (next) => { setData(next); setSaving(true); setError(''); try { await setDoc(doc(database, 'users', user.uid, 'private', 'dashboard'), { ...next, updatedAt: serverTimestamp() }); } catch { setError('Could not save that change. Please try again.'); } finally { setSaving(false); } };
  const switchAccount = async () => {
    // Clear all visible values before Google shows the account picker.
    setData(blank); setBusy(true); setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await signInWithPopup(auth, provider); }
    catch { setBusy(false); setError('Account switching was cancelled.'); }
  };
  const leaveAccount = async () => { setData(blank); setUser(null); setBusy(false); await signOut(auth); };
  if (busy) return <Screen><p className="eyebrow">PAISAPATH</p><h1>Loading your private space…</h1></Screen>;
  if (!user) return <SignIn error={error} />;
  return <Dashboard data={data} save={save} user={user} saving={saving} error={error} switchAccount={switchAccount} leaveAccount={leaveAccount} />;
}
function Screen({ children }) { return <main className="screen"><i className="orb one" /><i className="orb two" /><section className="gate">{children}</section></main>; }
function SignIn({ error }) { return <Screen><span className="brand"><b>P</b> PaisaPath</span><p className="eyebrow">PRIVATE FINANCE</p><h1>Money, with a little more calm.</h1><p className="lead">Your details are visible only after you sign in with your approved Google account.</p><button className="primary" onClick={() => signInWithPopup(auth, googleProvider).catch(() => {})}><span>G</span> Continue with Google</button>{error && <p className="error">{error}</p>}<p className="fine">Your financial data lives in your protected Firestore account — never in this website’s source code.</p></Screen>; }
function Dashboard({ data, save, user, saving, error, switchAccount, leaveAccount }) {
  const [tab, setTab] = useState('overview'); const [editor, setEditor] = useState(null); const income = sum(data.flow.filter((x) => x.type === 'Income')); const outgoing = sum(data.flow.filter((x) => x.type !== 'Income')); const assets = sum(data.accounts); const goalSaved = data.goals.reduce((t, x) => t + (Number(x.current) || 0), 0);
  const update = (kind, entry) => save({ ...data, [kind]: [...data[kind].filter((x) => x.id !== entry.id), entry] }); const remove = (kind, id) => save({ ...data, [kind]: data[kind].filter((x) => x.id !== id) });
  return <main className="shell"><header><a className="brand" href="#top"><b>P</b> PaisaPath</a><nav>{['overview', 'accounts', 'plans'].map((x) => <button key={x} className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>{x}</button>)}</nav><AccountSwitcher user={user} saving={saving} switchAccount={switchAccount} leaveAccount={leaveAccount} /></header><section id="top" className="hero"><div><p className="eyebrow">PERSONAL FINANCE</p><h1>Here’s your money,<br /><em>clearly organised.</em></h1><p>Update any number, and it securely saves back to your private dashboard.</p></div><button className="outline" onClick={() => setEditor({ kind: 'accounts' })}>+ Add account</button></section>{error && <p className="error notice">{error}</p>}{tab === 'overview' && <Overview data={data} assets={assets} income={income} outgoing={outgoing} goalSaved={goalSaved} toAccounts={() => setTab('accounts')} addFlow={() => setEditor({ kind: 'flow' })} toPlans={() => setTab('plans')} />}{tab === 'accounts' && <DataSection title="Accounts" subtitle="What you own, grouped your way." items={data.accounts} kind="accounts" add={() => setEditor({ kind: 'accounts' })} edit={(entry) => setEditor({ kind: 'accounts', entry })} remove={(id) => remove('accounts', id)} />}{tab === 'plans' && <><DataSection title="Monthly flow" subtitle="Income and the commitments it supports." items={data.flow} kind="flow" add={() => setEditor({ kind: 'flow' })} edit={(entry) => setEditor({ kind: 'flow', entry })} remove={(id) => remove('flow', id)} /><DataSection title="Goals" subtitle="A calm view of what is in progress." items={data.goals} kind="goals" add={() => setEditor({ kind: 'goals' })} edit={(entry) => setEditor({ kind: 'goals', entry })} remove={(id) => remove('goals', id)} /></>}{editor && <Editor kind={editor.kind} entry={editor.entry} close={() => setEditor(null)} save={(entry) => { update(editor.kind, entry); setEditor(null); }} />}</main>;
}
function AccountSwitcher({ user, saving, switchAccount, leaveAccount }) { const [open, setOpen] = useState(false); return <div className="profile"><span>{saving ? 'Saving…' : 'Synced'}</span><div className="account-switcher"><button className="avatar" onClick={() => setOpen(!open)} title="Manage accounts" aria-expanded={open}>{user.photoURL ? <img src={user.photoURL} alt="" /> : user.email?.[0]?.toUpperCase()}</button>{open && <div className="account-menu"><p>Signed in as</p><div className="current-account">{user.photoURL && <img src={user.photoURL} alt="" />}<span><b>{user.displayName || 'Google account'}</b><small>{user.email}</small></span></div><button onClick={() => { setOpen(false); switchAccount(); }}>Switch Google account</button><button className="sign-out" onClick={() => { setOpen(false); leaveAccount(); }}>Sign out</button></div>}</div></div>; }
function Overview({ data, assets, income, outgoing, goalSaved, toAccounts, addFlow, toPlans }) { const groups = ['Investments', 'Savings', 'Retirement'].map((type) => ({ type, items: data.accounts.filter((x) => x.type === type) })).filter((x) => x.items.length); return <><section className="metrics">{[['Total money', assets, 'Across your accounts'], ['This month', income - outgoing, 'After planned commitments'], ['Goals saved', goalSaved, 'Across your active goals']].map(([label, value, hint], index) => <article className={index === 2 ? 'dark' : ''} key={label}><p>{label}</p><strong>{amount(value)}</strong><small>{hint}</small></article>)}</section><section className="split"><Panel title="Your accounts" action={toAccounts} label="See all">{groups.length ? groups.map((group) => <div className="group" key={group.type}><span>{group.type}</span><strong>{amount(sum(group.items))}</strong><div><i style={{ width: `${Math.max(12, sum(group.items) / (assets || 1) * 100)}%` }} /></div></div>) : <Empty label="Add your first account to see your picture here." />}</Panel><Panel title="Monthly flow" action={addFlow} label="+ Add item">{data.flow.length ? data.flow.map((item) => <div className="row" key={item.id}><span><b>{item.name}</b><small>{item.type}</small></span><strong className={item.type === 'Income' ? 'in' : ''}>{item.type === 'Income' ? '+' : '−'}{amount(item.amount)}</strong></div>) : <Empty label="Add income and monthly commitments." />}</Panel></section><Panel title="Plans & goals" action={toPlans} label="Manage goals">{data.goals.length ? data.goals.map((goal) => <Goal key={goal.id} goal={goal} />) : <Empty label="Set a goal and track it here." />}</Panel></>; }
function Panel({ title, action, label, children }) { return <section className="panel"><div className="section-title"><div><p className="eyebrow">PRIVATE VIEW</p><h2>{title}</h2></div><button className="text-button" onClick={action}>{label} →</button></div>{children}</section>; }
function Empty({ label }) { return <p className="empty">{label}</p>; }
function Goal({ goal }) { const progress = goal.amount ? Math.min(100, (Number(goal.current) || 0) / Number(goal.amount) * 100) : 0; return <div className="goal"><div><b>{goal.name}</b><small>{goal.note || 'No note added'}</small></div><strong>{amount(goal.current)} <small>of {amount(goal.amount)}</small></strong><div className="progress"><i style={{ width: `${progress}%` }} /></div><span>{Math.round(progress)}% complete</span></div>; }
function DataSection({ title, subtitle, items, kind, add, edit, remove }) { return <section className="panel data"><div className="section-title"><div><p className="eyebrow">PAISAPATH</p><h2>{title}</h2><p className="subtitle">{subtitle}</p></div><button className="outline" onClick={add}>+ Add</button></div>{items.length ? <div className="list">{items.map((item) => <article key={item.id}><div><b>{item.name}</b><small>{item.type}</small>{kind === 'goals' && <small>{item.note}</small>}</div><strong>{kind === 'goals' ? amount(item.current) : amount(item.amount)}</strong><button onClick={() => edit(item)}>Edit</button><button className="remove" onClick={() => remove(item.id)}>Remove</button></article>)}</div> : <Empty label="Nothing here yet. Add your first entry." />}</section>; }
function Editor({ kind, entry, close, save }) { const [form, setForm] = useState(entry || { id: crypto.randomUUID(), name: '', type: kind === 'accounts' ? 'Savings' : kind === 'flow' ? 'Income' : 'Goal', amount: '', current: '', note: '' }); const goal = kind === 'goals'; const update = (key, value) => setForm({ ...form, [key]: value }); return <div className="modal-backdrop" onMouseDown={close}><form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); save({ ...form, amount: Number(form.amount) || 0, current: Number(form.current) || 0 }); }}><button className="close" type="button" onClick={close}>×</button><p className="eyebrow">{entry ? 'EDIT' : 'NEW'} {kind.slice(0, -1)}</p><h2>{entry ? 'Update this entry' : 'Add an entry'}</h2><label>Name<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label><label>Category<input required value={form.type} onChange={(event) => update('type', event.target.value)} /></label>{goal ? <><label>Goal amount<input required type="number" min="0" value={form.amount} onChange={(event) => update('amount', event.target.value)} /></label><label>Already saved<input type="number" min="0" value={form.current} onChange={(event) => update('current', event.target.value)} /></label><label>Note<input value={form.note} onChange={(event) => update('note', event.target.value)} /></label></> : <label>Amount<input required type="number" min="0" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} /></label>}<button className="primary" type="submit">Save securely</button></form></div>; }
createRoot(document.getElementById('root')).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
