import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, Check, ClipboardPaste, Clock3, Copy, FileText, Inbox, Keyboard, Link2, LoaderCircle, LogOut, Pin, Plus, Search, Settings2, ShieldCheck, StickyNote, Trash2, Undo2, X, Image as ImageIcon } from 'lucide-react';
import type { AppInfo, ItemKind, Result, Retention, ShelfItem, Snapshot } from '../core/model';
import { MAX_CONTENT_LENGTH, RETENTION_LABELS, imageURL } from '../core/model';

type Filter = 'all' | 'pinned' | ItemKind;
type Toast = { message: string; undo?: boolean };
const kindLabels = { text: 'Text', note: 'Note', link: 'Link', image: 'Image' };
const kindIcons = { text: FileText, note: StickyNote, link: Link2, image: ImageIcon };
const filters = [
  { id: 'all', label: 'All items', icon: Inbox },
  { id: 'pinned', label: 'Pinned', icon: Pin },
  { id: 'note', label: 'Notes', icon: StickyNote },
  { id: 'link', label: 'Links', icon: Link2 },
  { id: 'image', label: 'Screenshots', icon: ImageIcon },
] as const;

function Buddy({ small = false }: { small?: boolean }) {
  return <span className={`buddy ${small ? 'buddy-small' : ''}`} aria-hidden="true"><i /><i /><b /></span>;
}

function relativeTime(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function retentionText(item: ShelfItem, now: number) {
  if (item.pinned) return 'Pinned · kept until you unpin';
  if (item.expiresAt === null) return 'Kept until you delete it';
  const hours = Math.ceil((item.expiresAt - now) / 3_600_000);
  return hours <= 0 ? 'Expiring shortly' : hours <= 24 ? `Expires in ${hours}h` : `Expires in ${Math.ceil(hours / 24)} days`;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-label={title}>
    <div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
    {children}
  </dialog>;
}

export default function App() {
  const api = window.deskhelper;
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [monitoring, setMonitoring] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [mode, setMode] = useState<'text' | 'note'>('text');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [retention, setRetention] = useState<Retention>('day');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const currentItem = items.find((item) => item.id === detailId);

  const accept = useCallback((snapshot: Snapshot) => { setItems(snapshot.items); setMonitoring(snapshot.monitoring); setLoaded(true); }, []);
  const load = useCallback(async () => {
    if (!api) { setError('Open DeskHelper with npm start to use the desktop clipboard and your saved items.'); setLoaded(true); return; }
    setError('');
    try { const result = await api.list(); if (result.ok) accept(result.value); else { setError(result.error); setLoaded(true); } }
    catch { setError('Could not connect to your saved items. Please reopen DeskHelper.'); setLoaded(true); }
  }, [api, accept]);

  useEffect(() => {
    void load();
    void api?.info().then((result) => { if (result.ok) setInfo(result.value); }).catch(() => undefined);
    return api?.onChange(accept);
  }, [api, load, accept]);

  useEffect(() => api?.onFocusSearch(() => { if (!document.querySelector('dialog[open]')) searchRef.current?.focus(); }), [api]);
  useEffect(() => api?.onError(setError), [api]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), toast.undo ? 10_000 : 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.ctrlKey && (event.key.toLowerCase() === 'k' || event.key.toLowerCase() === 'f')) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.ctrlKey && event.key.toLowerCase() === 'n') { event.preventDefault(); setMode('note'); contentRef.current?.focus(); }
      if (event.key === 'Escape' && !content && !query) void api?.hide();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [api, content, query]);

  async function perform<T>(action: () => Promise<Result<T>>, success: (value: T) => void) {
    setPending(true); setError('');
    try { const result = await action(); if (result.ok) success(result.value); else setError(result.error); }
    catch { setError('That action could not finish. Please try again.'); }
    finally { setPending(false); }
  }

  function mutate(action: () => Promise<Result<Snapshot>>, message: string, undo = false) {
    void perform(action, (snapshot) => { accept(snapshot); setToast({ message, undo }); });
  }

  function save(event?: FormEvent) {
    event?.preventDefault();
    if (!api || pending || !content.trim()) return;
    void perform(() => api.save({ content, title: mode === 'note' ? title : undefined, kind: mode, retention }), (snapshot) => {
      accept(snapshot); setContent(''); setTitle(''); setToast({ message: mode === 'note' ? 'Note tucked away.' : 'Saved to your pocket.' });
      setQuery(''); setFilter('all'); contentRef.current?.focus();
    });
  }

  function capture() {
    if (!api || pending) return;
    void perform(() => api.monitoring(!monitoring), (snapshot) => { accept(snapshot); setToast({ message: snapshot.monitoring ? 'Clipboard history resumed.' : 'Clipboard history paused.' }); });
  }

  function copy(item: ShelfItem) {
    if (api) void perform(() => api.copy(item.id), () => setToast({ message: 'Copied. Ready when you are.' }));
  }

  const searched = query.trim().toLowerCase();
  const visible = items.filter((item) => (filter === 'all' || (filter === 'pinned' ? item.pinned : item.kind === filter)) && (!searched || `${item.title}\n${item.content}`.toLowerCase().includes(searched)))
    .sort((a, b) => sort === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  const pinnedCount = items.filter((item) => item.pinned).length;
  const filterLabel = filters.find((item) => item.id === filter)?.label ?? 'Text';
  const ready = loaded && Boolean(api);

  return <div className="app-shell">
    <div className="titlebar"><div className="titlebar-brand"><span className="tiny-dot" /> DeskHelper</div><span className="titlebar-caption">A little space for what’s next</span></div>
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand"><Buddy small /><div><span>DeskHelper</span><small>YOUR DESKTOP POCKET</small></div></div>
        <button className="new-note-button" onClick={() => { setMode('note'); contentRef.current?.focus(); }}><Plus size={17} /> New note <kbd>Ctrl N</kbd></button>
        <div className="nav-label">YOUR LIBRARY</div>
        <nav aria-label="Library">{filters.map(({ id, label, icon: Icon }) => {
          const count = id === 'all' ? items.length : id === 'pinned' ? pinnedCount : items.filter((item) => item.kind === id).length;
          return <button key={id} className={`nav-item ${filter === id ? 'active' : ''}`} aria-current={filter === id ? 'page' : undefined} onClick={() => { setFilter(id); setQuery(''); }}><Icon size={18} /><span>{label}</span><span className="nav-count">{count}</span></button>;
        })}</nav>
        <div className="sidebar-note"><span className="note-decoration" aria-hidden="true">✦</span><strong>Less to keep in your head.</strong><p>A link, a thought, a useful bit. Tuck it here for later.</p><span className="note-dots" aria-hidden="true"><i /><i /><i /></span></div>
        <div className="sidebar-bottom"><button className="settings-button corner-launch-button" onClick={() => void api?.expandWidget()}><ArrowDownToLine size={17} /> Open corner pocket</button><div className="local-status"><span /> Saved on this device</div><button className="settings-button" onClick={() => setSettings(true)}><Settings2 size={17} /> Settings & shortcuts</button><span className="version">DESKHELPER <span>v{info?.version ?? '0.3.0'}</span></span></div>
      </aside>

      <main>
        <div className="page-eyebrow"><span>YOUR SPACE <span className="eyebrow-slash">/</span> {filter === 'all' ? 'OVERVIEW' : filterLabel.toUpperCase()}</span><span className="private-pill"><ShieldCheck size={13} /> Local only</span></div>
        <header className="page-header"><div><h1>Your mind, a little lighter<span>.</span></h1><p>Keep the useful bits. Get back to your flow.</p></div><Buddy /></header>

        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}

        <section className="composer" aria-label="Save something">
          <div className="composer-top"><div className="composer-tabs" role="group" aria-label="Item type"><button className={mode === 'text' ? 'selected' : ''} aria-pressed={mode === 'text'} onClick={() => setMode('text')}><FileText size={15} /> Save text</button><button className={mode === 'note' ? 'selected' : ''} aria-pressed={mode === 'note'} onClick={() => setMode('note')}><StickyNote size={15} /> Quick note</button></div><button className="clipboard-button" onClick={capture} disabled={!ready || pending}><ClipboardPaste size={15} /> {monitoring ? 'Pause clipboard history' : 'Resume clipboard history'}</button></div>
          <form onSubmit={save}>
            {mode === 'note' && <input className="note-title-input" aria-label="Note title" placeholder="Give it a title (optional)" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />}
            <textarea ref={contentRef} aria-label={mode === 'note' ? 'Note content' : 'Text to save'} placeholder={mode === 'note' ? 'A thought, a reminder, a place to pick up later…' : 'Drop a thought here. Paste a link. Save something useful…'} value={content} onChange={(event) => setContent(event.target.value)} maxLength={MAX_CONTENT_LENGTH} onKeyDown={(event) => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); save(); } }} />
            <div className="composer-bottom"><label className="retention-control"><Clock3 size={14} /><span>Keep for</span><select aria-label="Keep duration" value={retention} onChange={(event) => setRetention(event.target.value as Retention)}>{Object.entries(RETENTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="primary-button save-button" type="submit" disabled={!ready || pending || !content.trim()}>{pending ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Save item <kbd>Ctrl ↵</kbd></button></div>
          </form>
        </section>
        <div className="capture-note"><ShieldCheck size={12} /> Copied text and images appear automatically while history is live. Pin an item to keep it longer.</div>

        <section className="library" aria-label="Saved items">
          <div className="library-heading"><h2>{searched ? 'Search results' : filter === 'all' ? 'Recently saved' : filterLabel}<span>{visible.length}</span></h2><label className="sort-control"><span className="sr-only">Sort items</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
          <div className="search-bar"><Search size={17} /><input ref={searchRef} aria-label="Search saved items" placeholder="Find that thing you saved…" value={query} onChange={(event) => setQuery(event.target.value)} />{query ? <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button> : <kbd>Ctrl K</kbd>}</div>

          {!loaded ? <div className="empty-state"><LoaderCircle className="spin" size={28} /><h3>Opening your pocket…</h3></div> : visible.length === 0 ? <div className="empty-state"><div className="empty-illustration" aria-hidden="true"><span className="paper paper-back" /><span className="paper paper-front"><i /><i /><i /></span><span className="empty-spark">✦</span></div><h3>{searched ? 'Nothing here matches that.' : items.length === 0 ? 'Good things start with a little space.' : filter === 'pinned' ? 'A home for your keepers.' : `No ${filterLabel.toLowerCase()} here yet.`}</h3><p>{searched ? 'Try a different word or clear your search.' : items.length === 0 ? 'Save a link, a note, or the text on your clipboard.' : filter === 'pinned' ? 'Pin any saved item and it will stay right here.' : 'Save something above to get started.'}</p>{searched ? <button className="text-button" onClick={() => setQuery('')}>Clear search <ArrowRight size={15} /></button> : items.length === 0 ? <button className="text-button" disabled={!ready || pending} onClick={capture}>{monitoring ? 'Pause clipboard history' : 'Resume clipboard history'} <ArrowRight size={15} /></button> : null}</div> : <div className="items-grid">{visible.map((item) => {
            const Icon = kindIcons[item.kind];
            return <article className={`item-card ${item.pinned ? 'is-pinned' : ''}`} key={item.id} data-testid="item-card">
              <div className="item-top"><span className={`kind-badge kind-${item.kind}`}><Icon size={13} />{kindLabels[item.kind]}</span><button className={`icon-button pin-button ${item.pinned ? 'pinned' : ''}`} disabled={pending} aria-label={`${item.pinned ? 'Unpin' : 'Pin'} ${item.title}`} title={item.pinned ? 'Unpin item' : 'Pin to keep'} onClick={() => api && mutate(() => api.pin(item.id), item.pinned ? 'Unpinned. Keep duration restarted.' : 'Pinned. This one’s a keeper.')}><Pin size={15} fill={item.pinned ? 'currentColor' : 'none'} /></button></div>
              <button className="item-content" aria-label={`View ${item.title}`} onClick={() => setDetailId(item.id)}>{item.image && <img className="library-thumbnail" src={imageURL(item)} alt={item.title} />}<h3>{item.title}</h3>{!item.image && item.content.trim() !== item.title && <p>{item.content.slice(0, 250)}</p>}</button>
              <div className="item-footer"><span title={retentionText(item, now)}><Clock3 size={12} />{relativeTime(item.createdAt, now)}</span><div><button className="icon-button copy-button" aria-label={`Copy ${item.title}`} title="Copy item" disabled={pending} onClick={() => copy(item)}><Copy size={15} /></button><button className="icon-button delete-button" aria-label={`Delete ${item.title}`} title="Delete item" disabled={pending} onClick={() => { if (api) mutate(() => api.remove(item.id), 'Item removed.', true); }}><Trash2 size={15} /></button></div></div>
            </article>;
          })}</div>}
        </section>
        <footer className="page-footer"><span><span className="footer-dot" /> A quieter corner of your desktop.</span><span><Keyboard size={13} />{info?.shortcutAvailable ? info.shortcut : 'Tray icon'} to open</span></footer>
      </main>
    </div>

    {toast && <div className="toast" role="status"><span className="toast-check"><Check size={15} /></span>{toast.message}{toast.undo && <button disabled={pending} onClick={() => api && mutate(() => api.undo(), 'Item restored.')}><Undo2 size={14} /> Undo</button>}<button className="toast-close" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14} /></button></div>}

    {currentItem && <Modal title={kindLabels[currentItem.kind]} onClose={() => setDetailId(null)}><div className="detail-meta"><span>{retentionText(currentItem, now)}</span><time>{new Date(currentItem.createdAt).toLocaleString()}</time></div><h3 className="detail-title">{currentItem.title}</h3>{currentItem.image ? <img className="library-image-detail" src={imageURL(currentItem)} alt={currentItem.title} /> : <pre className="detail-content">{currentItem.content}</pre>}<div className="modal-actions"><button className="secondary-button" disabled={pending} onClick={() => api && mutate(() => api.pin(currentItem.id), currentItem.pinned ? 'Item unpinned.' : 'Item pinned.')}><Pin size={15} />{currentItem.pinned ? 'Unpin' : 'Pin item'}</button><button className="primary-button" disabled={pending} onClick={() => copy(currentItem)}><Copy size={15} /> Copy {currentItem.image ? 'image' : 'text'}</button></div></Modal>}

    {settings && <Modal title="Make yourself at home" onClose={() => setSettings(false)}><div className="settings-section"><div className="settings-section-title"><Keyboard size={18} /><h3>A few useful shortcuts</h3></div><div className="shortcut-row"><span>Show / tuck away corner pocket</span><kbd>{info?.shortcut ?? 'Ctrl + Shift + Space'}</kbd></div>{info && !info.shortcutAvailable && <p className="setting-warning">The global shortcut is unavailable. Another app may be using it. You can still open DeskHelper from the tray.</p>}<div className="shortcut-row"><span>Find a saved item</span><kbd>Ctrl K</kbd></div><div className="shortcut-row"><span>Start a quick note</span><kbd>Ctrl N</kbd></div><div className="shortcut-row"><span>Save what you’re writing</span><kbd>Ctrl Enter</kbd></div></div><div className="settings-section"><div className="settings-section-title"><ShieldCheck size={18} /><h3>Your little local pocket</h3></div><p>Items stay on this computer. Copied text and images are saved automatically while history is live. Pause history before copying private content. Print Screen images appear once placed on the clipboard. Pinned items don’t expire; unpinning restarts their keep duration.</p><p>Saved text is stored locally without encryption. Use your password manager for secrets.</p></div><div className="settings-section"><h3>Close the panel, keep your space.</h3><p>Closing the window keeps DeskHelper in the tray. Use Quit to fully exit.</p></div><div className="modal-actions"><button className="secondary-button" onClick={() => { setSettings(false); void api?.hide(); }}><ArrowDownToLine size={15} /> Hide to tray</button><button className="quit-button" onClick={() => void api?.quit()}><LogOut size={15} /> Quit DeskHelper</button></div></Modal>}
  </div>;
}
