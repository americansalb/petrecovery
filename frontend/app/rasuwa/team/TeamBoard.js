'use client';

/**
 * The family task force board. One shared code opens it (teamAuth.js);
 * a typed name signs everything, like a sign-in sheet at a family
 * meeting. Four sections, one polled read:
 *
 *   Updates   - posts that stay at the top for everyone
 *   Needs     - things to do, claimable ("I'll do it") and markable done
 *   People    - the coverage wall: every missing person, their letters
 *               on record, and who has said they will write for them
 *   Talk      - the running conversation
 *
 * Mechanics borrowed from mission control: the board refetches on a
 * steady interval plus tab focus (no realtime plumbing to break),
 * sends append optimistically and clear the box before the request,
 * claim buttons draw from one state machine (teamLogic.needView), and
 * a claim conflict redraws from the row the server sends back with the
 * 409 rather than erroring.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronLeft, Megaphone, Plus, Send, Undo2, X } from 'lucide-react';
import { needView, timeAgo } from './teamLogic';

const NAME_KEY = 'rasuwaTeamName';
const SEEN_KEY = 'rasuwaTeamSeen';
const POLL_MS = 8000;

const loadName = () => {
  try {
    return window.localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};
const storeName = (name) => {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // storage can be blocked; the session still works, the name just will not stick
  }
};

/**
 * Is this browser also signed in as a site admin? The middleware
 * answers an anonymous probe with a redirect to an HTML page that
 * loads fine, so "the request succeeded" is not the test: only a
 * non-redirected JSON 200 from the admin route counts.
 */
async function probeAdmin() {
  try {
    const res = await fetch('/api/admin/rasuwa-team', { redirect: 'manual' });
    return res.ok && (res.headers.get('content-type') || '').includes('application/json');
  } catch {
    return false;
  }
}

async function api(path, body) {
  const res = await fetch(`/api/rasuwa/team/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // some errors have no body; status carries the meaning
  }
  return { ok: res.ok, status: res.status, data };
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-40 transition-colors';

export default function TeamBoard() {
  const [phase, setPhase] = useState('checking'); // checking | gate | in | off
  const [name, setName] = useState('');
  const [board, setBoard] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const say = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  // The one read. A 401 at any point sends the person back to the door
  // (cookie expired or the code rotated); everything else keeps the last
  // good board on screen and lets the next tick retry.
  const lastLocalPost = useRef(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [fresh, setFresh] = useState({ updates: 0, talk: 0 });
  const freshDone = useRef(false);
  const loadBoard = useCallback(async () => {
    const { ok, status, data } = await api('board');
    if (status === 401) {
      setPhase('gate');
      return;
    }
    if (!ok || !data || !data.messages) return;
    // A message posted between this poll starting and landing would
    // vanish for one tick; keep the latest local send visible.
    const local = lastLocalPost.current;
    if (local && local.kind === 'message' && !data.messages.some((m) => m.id === local.id)) {
      data.messages = [...data.messages, local];
    }
    if (local && local.kind === 'update' && !data.updates.some((u) => u.id === local.id)) {
      data.updates = [local, ...data.updates];
    }
    // "New since your last visit", once per visit, per device: counted
    // against the timestamp stored on the way out of the previous visit.
    if (!freshDone.current) {
      freshDone.current = true;
      let seen = 0;
      try {
        seen = Number(window.localStorage.getItem(SEEN_KEY)) || 0;
      } catch {
        // no storage, no badge
      }
      if (seen) {
        const countNew = (rows) => rows.filter((r) => new Date(r.createdAt).getTime() > seen).length;
        setFresh({ updates: countNew(data.updates), talk: countNew(data.messages) });
      }
      try {
        window.localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        // same
      }
    }
    setBoard(data);
    setLoadedAt(Date.now());
    setPhase('in');
  }, []);

  useEffect(() => {
    let stop = false;
    setName(loadName());
    (async () => {
      const { ok, data } = await api('join');
      if (stop) return;
      if (ok && data && data.enabled === false) {
        setPhase('off');
        return;
      }
      if (ok && data && data.in) {
        await loadBoard();
        if (!stop) {
          const admin = await probeAdmin();
          if (!stop && admin) setIsAdmin(true);
        }
        return;
      }
      setPhase('gate');
    })();
    return () => {
      stop = true;
    };
  }, [loadBoard]);

  useEffect(() => {
    if (phase !== 'in') return;
    const tick = () => {
      if (document.visibilityState === 'visible') loadBoard();
    };
    const interval = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadBoard();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [phase, loadBoard]);

  async function join(code, joinName) {
    const cleanName = joinName.trim();
    if (!cleanName) return 'Add your name so people know who is writing.';
    const { ok, status, data } = await api('join', { code });
    if (!ok) {
      if (status === 429) return 'Too many tries from this connection. Wait a few minutes.';
      return (data && data.error) || 'That did not work. Try again.';
    }
    setName(cleanName);
    storeName(cleanName);
    await loadBoard();
    if (await probeAdmin()) setIsAdmin(true);
    return '';
  }

  // ── Actions. Each one repaints from the server's answer. ───────────
  async function sendPost(body, kind) {
    const { ok, status, data } = await api('posts', { author: name, body, kind });
    if (status === 401) {
      setPhase('gate');
      return false;
    }
    if (!ok || !data || !data.post) {
      say((data && data.error) || 'That did not send. Try again.');
      return false;
    }
    lastLocalPost.current = data.post;
    setBoard((b) =>
      !b
        ? b
        : kind === 'update'
          ? { ...b, updates: [data.post, ...b.updates] }
          : { ...b, messages: [...b.messages, data.post] }
    );
    return true;
  }

  async function addNeed(title, detail) {
    const { ok, status, data } = await api('needs', { author: name, title, detail });
    if (status === 401) {
      setPhase('gate');
      return false;
    }
    if (!ok || !data || !data.need) {
      say((data && data.error) || 'That did not save. Try again.');
      return false;
    }
    setBoard((b) => (b ? { ...b, needs: [data.need, ...b.needs] } : b));
    return true;
  }

  async function actOnNeed(need, action) {
    const { status, data } = await api(`needs/${need.id}`, { action, name });
    if (status === 401) {
      setPhase('gate');
      return;
    }
    if (data && data.need) {
      setBoard((b) =>
        b ? { ...b, needs: b.needs.map((n) => (n.id === data.need.id ? data.need : n)) } : b
      );
      if (status === 409 && action === 'claim') {
        say(`${data.need.claimedBy || 'Someone'} already has that one.`);
      }
    } else if (status === 404) {
      setBoard((b) => (b ? { ...b, needs: b.needs.filter((n) => n.id !== need.id) } : b));
    } else {
      say((data && data.error) || 'That did not save. Try again.');
    }
  }

  async function actOnPerson(person, action) {
    // Optimistic: the wall updates under the tap, the next poll confirms.
    setBoard((b) => {
      if (!b) return b;
      const people = b.coverage.people.map((p) => {
        if (p.key !== person.key) return p;
        const claimants =
          action === 'claim'
            ? p.claimants.includes(name)
              ? p.claimants
              : [...p.claimants, name]
            : p.claimants.filter((c) => c !== name);
        return { ...p, claimants, needsSomeone: p.letters === 0 && claimants.length === 0 };
      });
      return { ...b, coverage: { ...b.coverage, people } };
    });
    const { status, data } = await api('people', { personKey: person.key, name, action });
    if (status === 401) setPhase('gate');
    else if (status >= 400) {
      say((data && data.error) || 'That did not save. It will retry when the board refreshes.');
      loadBoard();
    }
  }

  async function adminRemove(type, id) {
    if (!window.confirm('Remove this from the board for everyone?')) return;
    const res = await fetch(`/api/admin/rasuwa-team?type=${type}&id=${id}`, {
      method: 'DELETE',
      redirect: 'manual',
    });
    if (res.ok) loadBoard();
    else say('The removal did not go through.');
  }

  function changeName(next) {
    const clean = next.trim();
    if (!clean) return;
    setName(clean);
    storeName(clean);
  }

  if (phase === 'checking') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-sm">
        Opening the board...
      </div>
    );
  }
  if (phase === 'off') {
    return (
      <Frame>
        <div className="max-w-md mx-auto mt-16 rounded-2xl bg-white border border-slate-200 p-7 text-center">
          <h1 className="text-xl font-extrabold text-slate-900">The board is not switched on yet</h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            The coordinators have not set a team code for this site. Ask in the family group chat.
          </p>
          <Link href="/rasuwa" className="mt-5 inline-block text-blue-700 font-semibold hover:underline">
            Go to the letter tool
          </Link>
        </div>
      </Frame>
    );
  }
  if (phase === 'gate') {
    return <Gate initialName={name} onJoin={join} />;
  }

  return (
    <Frame>
      <BoardHeader name={name} onChangeName={changeName} board={board} fresh={fresh} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-24 space-y-10">
        <p className="pt-3 -mb-6 text-right text-[11px] text-slate-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />
          Live board · updated {loadedAt ? timeAgo(loadedAt) : 'just now'}
        </p>
        <NamePrompt name={name} onSave={changeName} />
        <UpdatesSection
          updates={board?.updates || []}
          canPost={Boolean(name)}
          onPost={(body) => sendPost(body, 'update')}
          isAdmin={isAdmin}
          onRemove={(id) => adminRemove('post', id)}
        />
        <NeedsSection
          needs={board?.needs || []}
          myName={name}
          onAdd={addNeed}
          onAct={actOnNeed}
          isAdmin={isAdmin}
          onRemove={(id) => adminRemove('need', id)}
        />
        <CoverageSection coverage={board?.coverage} myName={name} onAct={actOnPerson} />
        <TalkSection
          messages={board?.messages || []}
          myName={name}
          onSend={(body) => sendPost(body, 'message')}
          isAdmin={isAdmin}
          onRemove={(id) => adminRemove('post', id)}
        />
      </main>
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </Frame>
  );
}

function Frame({ children }) {
  return <div className="min-h-screen bg-slate-100 text-slate-900">{children}</div>;
}

// ── The door ─────────────────────────────────────────────────────────

function Gate({ initialName, onJoin }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const problem = await onJoin(code, name);
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <Frame>
      <div className="max-w-md mx-auto px-4 pt-14 pb-16">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-blue-800 border-t-2 border-blue-300 flex items-center justify-center font-extrabold text-white">
            R
          </span>
          <span className="font-extrabold text-lg tracking-tight">rescueourfamily.org</span>
        </div>
        <h1 className="mt-7 text-2xl font-extrabold tracking-tight">Family task force</h1>
        <p className="mt-2.5 text-slate-600 leading-relaxed">
          The working board for the families and friends of the people missing in the Rasuwa
          flood: updates, who is doing what, and letters for every person. It opens with the
          code shared in the family group chats.
        </p>
        <form method="post" onSubmit={submit} className="mt-7 rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Your name</span>
            <input
              className={`mt-1.5 ${inputCls}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As people in the group know you"
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Team code</span>
            <input
              className={`mt-1.5 ${inputCls}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="From the group chat"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
            {busy ? 'Checking...' : 'Open the board'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-500 leading-relaxed">
          No account and nothing to install. If you do not have the code, ask in the group
          chat; anyone already in can read it to you.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/rasuwa" className="text-blue-700 font-semibold hover:underline">
            Write to Congress instead
          </Link>
        </p>
      </div>
    </Frame>
  );
}

// ── Chrome ───────────────────────────────────────────────────────────

function BoardHeader({ name, onChangeName, board, fresh }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  const openNeeds = (board?.needs || []).filter((n) => n.status !== 'DONE').length;
  const needSomeone = board?.coverage?.totals?.needSomeone ?? 0;

  const chip = (href, label, count, freshCount = 0) => (
    <a
      href={href}
      className="shrink-0 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-semibold text-white/90 transition-colors"
    >
      {label}
      {count > 0 && <span className="ml-1.5 text-blue-300 tabular-nums">{count}</span>}
      {freshCount > 0 && (
        <span className="ml-1.5 rounded-full bg-amber-400 text-blue-950 px-1.5 tabular-nums">
          +{freshCount} new
        </span>
      )}
    </a>
  );

  return (
    <header className="sticky top-0 z-30 bg-blue-950 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 h-14">
          <Link href="/rasuwa" className="flex items-center gap-1 text-white/60 hover:text-white text-sm shrink-0">
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Letter tool</span>
          </Link>
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-md bg-blue-800 border-t-2 border-blue-300 flex items-center justify-center font-extrabold text-sm shrink-0">
              R
            </span>
            <span className="font-extrabold tracking-tight truncate">Family task force</span>
          </span>
          <span className="flex-1" />
          {editing ? (
            <form method="post"
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                onChangeName(draft);
                setEditing(false);
              }}
            >
              <input
                className="w-36 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 bg-white"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <button type="submit" className="rounded-lg bg-blue-700 hover:bg-blue-600 px-2.5 py-1.5 text-sm font-semibold">
                Save
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm text-white/90 transition-colors max-w-[10rem] truncate"
              title="Change the name you post under"
            >
              {name || 'Set your name'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 pb-2.5 -mx-1 px-1 overflow-x-auto">
          {chip('#updates', 'Updates', board?.updates?.length || 0, fresh?.updates)}
          {chip('#needs', 'Needs doing', openNeeds)}
          {chip('#people', 'The people', needSomeone)}
          {chip('#talk', 'Talk', 0, fresh?.talk)}
        </div>
      </div>
    </header>
  );
}

function NamePrompt({ name, onSave }) {
  const [draft, setDraft] = useState('');
  if (name) return null;
  return (
    <form method="post"
      className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row gap-3 sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <p className="text-sm text-amber-900 font-medium flex-1">
        Add your name first. Everything on the board is signed, so people know who is doing what.
      </p>
      <div className="flex gap-2">
        <input
          className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your name"
        />
        <button type="submit" className={primaryBtn}>
          Save
        </button>
      </div>
    </form>
  );
}

function SectionHead({ id, title, sub, action }) {
  return (
    <div id={id} className="scroll-mt-28 pt-8 flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        {sub && <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-xl">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function ByLine({ author, at, prefix }) {
  return (
    <p className="text-xs text-slate-500">
      {prefix ? `${prefix} ` : ''}
      <span className="font-semibold text-slate-600">{author}</span> · {timeAgo(at)}
    </p>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-slate-300 hover:text-red-600 transition-colors"
      aria-label="Remove"
      title="Remove (coordinators only)"
    >
      <X size={15} />
    </button>
  );
}

// ── Updates ──────────────────────────────────────────────────────────

function UpdatesSection({ updates, canPost, onPost, isAdmin, onRemove }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function post(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const sent = await onPost(body);
    setBusy(false);
    if (sent) {
      setDraft('');
      setOpen(false);
    }
  }

  return (
    <section>
      <SectionHead
        id="updates"
        title="Updates"
        sub="What everyone should see. Embassy answers, list changes, where to show up."
        action={
          canPost && (
            <button type="button" className={ghostBtn} onClick={() => setOpen((o) => !o)}>
              <Megaphone size={15} />
              Post an update
            </button>
          )
        }
      />
      {open && (
        <form method="post" onSubmit={post} className="mt-4 rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
          <textarea
            className={`${inputCls} min-h-[90px]`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What should everyone know?"
            autoFocus
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Updates stay at the top and carry your name.</p>
            <button type="submit" disabled={busy || !draft.trim()} className={primaryBtn}>
              {busy ? 'Posting...' : 'Post it'}
            </button>
          </div>
        </form>
      )}
      <div className="mt-4 space-y-3">
        {updates.length === 0 && (
          <p className="rounded-2xl bg-white border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            No updates yet. The first one sets the tone: say what is happening and what helps.
          </p>
        )}
        {updates.map((u) => (
          <article key={u.id} className="rounded-2xl bg-white border-l-4 border-blue-800 border-y border-r border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{u.body}</p>
              {isAdmin && <RemoveButton onClick={() => onRemove(u.id)} />}
            </div>
            <div className="mt-2.5">
              <ByLine author={u.author} at={u.createdAt} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── Needs ────────────────────────────────────────────────────────────

function NeedsSection({ needs, myName, onAdd, onAct, isAdmin, onRemove }) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const active = needs.filter((n) => n.status !== 'DONE');
  const finished = needs.filter((n) => n.status === 'DONE');

  async function add(e) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const saved = await onAdd(title.trim(), detail.trim());
    setBusy(false);
    if (saved) {
      setTitle('');
      setDetail('');
    }
  }

  return (
    <section>
      <SectionHead
        id="needs"
        title="Needs doing"
        sub="Add anything that would help. Tap I'll do it so two people do not do the same thing."
      />
      <form method="post" onSubmit={add} className="mt-4 rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing? For example: call the Kathmandu helpline list"
        />
        {title.trim() && (
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Anything the person doing it should know (optional)"
          />
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !title.trim()} className={primaryBtn}>
            <Plus size={16} />
            {busy ? 'Adding...' : 'Add it'}
          </button>
        </div>
      </form>
      <div className="mt-4 space-y-3">
        {active.length === 0 && (
          <p className="rounded-2xl bg-white border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            Nothing open right now. Anything on your mind that would help the search, add it above.
          </p>
        )}
        {active.map((n) => (
          <NeedCard key={n.id} need={n} myName={myName} onAct={onAct} isAdmin={isAdmin} onRemove={onRemove} />
        ))}
      </div>
      {finished.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            <ChevronDown size={16} className={`transition-transform ${showDone ? 'rotate-180' : ''}`} />
            Done ({finished.length})
          </button>
          {showDone && (
            <div className="mt-3 space-y-3">
              {finished.map((n) => (
                <NeedCard key={n.id} need={n} myName={myName} onAct={onAct} isAdmin={isAdmin} onRemove={onRemove} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function NeedCard({ need, myName, onAct, isAdmin, onRemove }) {
  const view = needView(need, myName);
  const [busy, setBusy] = useState('');

  async function act(action) {
    setBusy(action);
    await onAct(need, action);
    setBusy('');
  }

  const btn = (action, label, style, Icon) => (
    <button
      key={action}
      type="button"
      disabled={Boolean(busy) || !myName}
      onClick={() => act(action)}
      className={style}
    >
      {Icon && <Icon size={15} />}
      {busy === action ? 'Saving...' : label}
    </button>
  );

  return (
    <article className={`rounded-2xl border p-4 ${view.done ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`font-bold text-[15px] leading-snug ${view.done ? 'text-slate-500' : 'text-slate-900'}`}>
            {need.title}
          </h3>
          {need.detail && (
            <p className={`mt-1 text-sm leading-relaxed whitespace-pre-wrap ${view.done ? 'text-slate-400' : 'text-slate-600'}`}>
              {need.detail}
            </p>
          )}
        </div>
        {isAdmin && <RemoveButton onClick={() => onRemove(need.id)} />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <ByLine prefix="Added by" author={need.createdBy || 'someone'} at={need.createdAt} />
          {view.mine && <p className="text-xs font-semibold text-blue-800">You have this one.</p>}
          {view.held && (
            <p className="text-xs font-semibold text-slate-600">
              {view.holder} has it{need.claimedAt ? ` · ${timeAgo(need.claimedAt)}` : ''}
            </p>
          )}
          {view.done && (
            <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
              <Check size={13} strokeWidth={3} />
              Done{need.doneBy ? ` by ${need.doneBy}` : ''}{need.doneAt ? ` · ${timeAgo(need.doneAt)}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {view.open && btn('claim', "I'll do it", primaryBtn)}
          {view.mine && btn('done', 'Done', primaryBtn, Check)}
          {view.mine && btn('release', 'Hand it back', ghostBtn, Undo2)}
          {(view.open || view.held) && btn('done', 'Mark done', ghostBtn, Check)}
          {view.done && btn('reopen', 'Reopen', ghostBtn, Undo2)}
        </div>
      </div>
    </article>
  );
}

// ── The people ───────────────────────────────────────────────────────

// The wall lists every missing person, but on a phone 86 cards would
// push the conversation thousands of pixels down; it opens as a
// preview and expands on request.
const COVERAGE_PREVIEW = 6;

function CoverageSection({ coverage, myName, onAct }) {
  const [onlyUncovered, setOnlyUncovered] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const people = coverage?.people || [];
  const totals = coverage?.totals || { people: 0, withLetters: 0, needSomeone: 0 };
  const shown = onlyUncovered ? people.filter((p) => p.needsSomeone) : people;
  const visible = showAll ? shown : shown.slice(0, COVERAGE_PREVIEW);

  const filterChip = (activeState, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        activeState ? 'bg-blue-800 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-400'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section>
      <SectionHead
        id="people"
        title="Letters for every person"
        sub={`${totals.withLetters} of ${totals.people} people on the list have letters on record. ${
          totals.needSomeone > 0
            ? `${totals.needSomeone} have nobody on it yet. Pick one and say you will write.`
            : 'Every person has someone. Keep them coming.'
        }`}
      />
      <div className="mt-4 flex items-center gap-2">
        {filterChip(!onlyUncovered, `Everyone (${totals.people})`, () => setOnlyUncovered(false))}
        {filterChip(onlyUncovered, `Needs someone (${totals.needSomeone})`, () => setOnlyUncovered(true))}
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((p) => (
          <PersonCard key={p.key} person={p} myName={myName} onAct={onAct} />
        ))}
      </div>
      {shown.length > COVERAGE_PREVIEW && (
        <div className="mt-4 flex justify-center">
          <button type="button" className={ghostBtn} onClick={() => setShowAll((s) => !s)}>
            <ChevronDown size={16} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
            {showAll ? 'Show fewer' : `Show all ${shown.length} people`}
          </button>
        </div>
      )}
      {shown.length === 0 && (
        <p className="mt-4 rounded-2xl bg-white border border-dashed border-slate-300 p-5 text-sm text-slate-500">
          Every person on the list has letters or someone writing. Thank you.
        </p>
      )}
      {(coverage?.others || []).length > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          Also on record: {coverage.others.map((o) => `${o.personName} (${o.records})`).join(', ')} -
          letters saved under names not on the current list.
        </p>
      )}
    </section>
  );
}

function PersonCard({ person, myName, onAct }) {
  const mine = person.claimants.includes(myName);
  const othersWriting = person.claimants.filter((c) => c !== myName);
  return (
    <article
      className={`rounded-2xl border p-4 flex flex-col gap-2.5 ${
        person.needsSomeone ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200'
      }`}
    >
      <div>
        <h3 className="font-bold text-[15px] leading-snug">{person.name}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{person.home || person.country}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {person.letters > 0 ? (
          <span className="rounded-full bg-green-100 text-green-800 font-semibold px-2.5 py-1 tabular-nums">
            {person.letters} {person.letters === 1 ? 'letter' : 'letters'} on record
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 text-slate-600 font-semibold px-2.5 py-1">
            No letters yet
          </span>
        )}
        {mine && (
          <span className="rounded-full bg-blue-100 text-blue-800 font-semibold px-2.5 py-1">
            You are writing
          </span>
        )}
        {othersWriting.length > 0 && (
          <span className="text-slate-600 font-medium">
            {othersWriting.join(', ')} {othersWriting.length === 1 ? 'is' : 'are'} writing
          </span>
        )}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-1">
        {mine ? (
          <>
            <Link href={`/rasuwa?for=${person.num}`} className={`${primaryBtn} flex-1`}>
              Write now
            </Link>
            <button type="button" className={ghostBtn} onClick={() => onAct(person, 'release')}>
              Not me
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${ghostBtn} flex-1`}
              disabled={!myName}
              onClick={() => onAct(person, 'claim')}
            >
              I&apos;ll write for them
            </button>
            <Link
              href={`/rasuwa?for=${person.num}`}
              className="text-sm font-semibold text-blue-700 hover:underline shrink-0 px-1"
            >
              Write now
            </Link>
          </>
        )}
      </div>
    </article>
  );
}

// ── Talk ─────────────────────────────────────────────────────────────

function TalkSection({ messages, myName, onSend, isAdmin, onRemove }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const countRef = useRef(0);

  // Follow new messages only when already reading the latest ones, so
  // the list never yanks while someone scrolls back.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const grew = messages.length > countRef.current;
    countRef.current = messages.length;
    if (grew && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy || !myName) return;
    setDraft('');
    setBusy(true);
    atBottomRef.current = true;
    const sent = await onSend(body);
    setBusy(false);
    if (!sent) setDraft(body);
  }

  return (
    <section>
      <SectionHead
        id="talk"
        title="Talk"
        sub="The running conversation. For decisions everyone must see, post an update instead."
      />
      <div className="mt-4 rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          }}
          className="max-h-[55vh] min-h-[180px] overflow-y-auto p-4 space-y-3"
        >
          {messages.length === 0 && (
            <p className="text-sm text-slate-500">Nothing here yet. Say hello so people know the board works.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`rounded-xl px-3.5 py-2.5 ${m.author === myName ? 'bg-blue-50' : 'bg-slate-50'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold text-slate-700">{m.author}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-400">{timeAgo(m.createdAt)}</span>
                  {isAdmin && <RemoveButton onClick={() => onRemove(m.id)} />}
                </span>
              </div>
              <p className="mt-0.5 text-[15px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </div>
        <form method="post" onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 p-3">
          <textarea
            className={`${inputCls} resize-none`}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) send(e);
            }}
            placeholder={myName ? 'Write a message' : 'Set your name above to write'}
            disabled={!myName}
          />
          <button type="submit" disabled={busy || !draft.trim() || !myName} className={`${primaryBtn} shrink-0`} aria-label="Send">
            <Send size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}
