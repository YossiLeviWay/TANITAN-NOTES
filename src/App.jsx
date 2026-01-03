import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, signOut 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, collection, onSnapshot, 
  addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  LogIn, UserPlus, LogOut, Loader2, ShieldCheck, Plus, Trash2, 
  FileText, Lock, Mail, MoreHorizontal, Search, X, Pin, Edit2, 
  Moon, Sun, Bell, Send, Users, Tag, CheckCircle2, AlertCircle, 
  ChevronRight, Settings, Archive, Clock, Download, 
  Bold, Italic, List as ListIcon, Calendar, BarChart3, Hash
} from 'lucide-react';

// --- Firebase Configuration ---
// IMPORTANT: Ensure your keys are inside these quotes!
const firebaseConfig = {
  apiKey: "AIzaSyCv-FDx-2SUgYY73ud5v0dUBXeWjOQG_Lg",
  authDomain: "tanitan-notes.firebaseapp.com",
  projectId: "tanitan-notes",
  storageBucket: "tanitan-notes.firebasestorage.app",
  messagingSenderId: "77324184022",
  appId: "1:77324184022:web:110fd94ebf1fc83fdc1c77",
  measurementId: "G-YMP947VJ11"
};

const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10;

let auth, db;
if (isConfigValid) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

const ADMIN_EMAIL = 'yossi.levi011@gmail.com';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [view, setView] = useState('notes'); 
  const [authView, setAuthView] = useState('login'); 
  
  const [notes, setNotes] = useState([]);
  const [labels, setLabels] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeLabelFilter, setActiveLabelFilter] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isManagingLabels, setIsManagingLabels] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [adminMsg, setAdminMsg] = useState({ text: '', target: 'all' });

  const [noteForm, setNoteForm] = useState({
    title: '', content: '', label: '', tags: [], dueDate: ''
  });

  useEffect(() => {
    if (!isConfigValid) {
      setInitializing(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isConfigValid) return;

    const unsubNotes = onSnapshot(collection(db, 'users', user.uid, 'notes'), (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Notes Error:", err));

    const unsubLabels = onSnapshot(collection(db, 'users', user.uid, 'labels'), (snap) => {
      setLabels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Labels Error:", err));

    const unsubNotif = onSnapshot(collection(db, 'public_notifications'), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = all.filter(n => n.target === 'all' || n.target === user.uid);
      setNotifications(filtered.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)));
      setUnreadCount(filtered.filter(n => !n.readBy?.includes(user.uid)).length);
    });

    let unsubUsers;
    if (user.email === ADMIN_EMAIL) {
      unsubUsers = onSnapshot(collection(db, 'registered_users'), (snap) => {
        setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        console.error("Admin Error:", err);
        setUsersList([]);
      });
    }

    return () => {
      unsubNotes(); unsubLabels(); unsubNotif();
      if (unsubUsers) unsubUsers();
    };
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);
    try {
      if (authView === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'registered_users', cred.user.uid), {
          email: cred.user.email,
          uid: cred.user.uid,
          joined: Date.now()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace('Firebase:', '').trim());
    } finally {
      setAuthLoading(false);
    }
  };

  const saveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title) return;
    const noteData = {
      ...noteForm,
      label: noteForm.label || 'General',
      lastModified: Date.now(),
      archived: noteForm.archived || false,
      pinned: noteForm.pinned || false
    };
    try {
      if (editingNote) {
        await updateDoc(doc(db, 'users', user.uid, 'notes', editingNote.id), noteData);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'notes'), { ...noteData, created: Date.now() });
      }
      setIsAddingNote(false);
      setEditingNote(null);
      setNoteForm({ title: '', content: '', label: '', tags: [], dueDate: '' });
    } catch (err) { setError("Save failed."); }
  };

  const addLabel = async () => {
    if (!labelInput.trim()) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'labels'), { name: labelInput.trim() });
      setLabelInput('');
      setError(null);
    } catch (err) { setError("Rules Error: Update rules for 'labels' subcollection."); }
  };

  const processedNotes = useMemo(() => {
    const list = (notes || []).filter(n => {
      const matchesSearch = (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (n.content || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLabel = !activeLabelFilter || n.label === activeLabelFilter;
      const matchesView = view === 'archive' ? n.archived : !n.archived;
      return matchesSearch && matchesLabel && matchesView;
    });
    return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.lastModified || 0) - (a.lastModified || 0));
  }, [notes, searchQuery, activeLabelFilter, view]);

  const stats = useMemo(() => ({
    total: notes.length,
    pinned: notes.filter(n => n.pinned).length,
    archived: notes.filter(n => n.archived).length,
    reminders: notes.filter(n => n.dueDate && !n.archived).length,
    labels: labels.length
  }), [notes, labels]);

  if (initializing) return (
    <div className={`flex h-screen w-full items-center justify-center ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-50'}`}>
      <ShieldCheck className="h-6 w-6 animate-pulse text-indigo-600" />
    </div>
  );

  if (!isConfigValid) return (
    <div className="flex h-screen w-full items-center justify-center p-6 bg-black text-white">
      <div className="max-w-md w-full p-8 rounded-[2rem] bg-white/5 border border-white/10 text-center">
        <Settings className="h-8 w-8 text-amber-500 animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-bold mb-2 uppercase tracking-widest">Connection Missing</h2>
        <p className="text-[10px] opacity-40">Paste your Firebase keys into src/App.jsx</p>
      </div>
    </div>
  );

  const cardStyles = theme === 'dark' ? "bg-white/5 backdrop-blur-3xl border-white/10 text-white" : "bg-white/90 backdrop-blur-3xl border-slate-200 text-slate-900 shadow-xl shadow-slate-100";

  return (
    <div className={`min-h-screen w-full font-sans transition-colors duration-500 pb-10 selection:bg-indigo-500/30 ${theme === 'dark' ? 'bg-black text-white' : 'bg-[#F2F2F7] text-slate-900'}`}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full opacity-10 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-blue-400'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full opacity-10 ${theme === 'dark' ? 'bg-purple-600' : 'bg-indigo-300'}`}></div>
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-6">
        <div className="flex justify-between items-start mb-4 px-1">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.4em] opacity-20">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            <h1 className="text-3xl font-extralight tracking-tighter mt-0.5">{!user ? 'TANITAN' : view === 'dashboard' ? 'Insight' : view === 'archive' ? 'Archive' : view === 'admin' ? 'Terminal' : 'Vault'}</h1>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-lg border transition-all active:scale-90 ${cardStyles}`}><Sun size={12} /></button>
            {user && <button onClick={() => setView('notifications')} className={`p-2 rounded-lg border relative transition-all active:scale-90 ${cardStyles}`}><Bell size={12} />{unreadCount > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>}</button>}
          </div>
        </div>

        {user && (
          <div className="flex gap-1 overflow-x-auto no-scrollbar mb-4">
            {[
              { id: 'notes', label: 'Vault', icon: <FileText size={10}/> },
              { id: 'dashboard', label: 'Home', icon: <BarChart3 size={10}/> },
              { id: 'archive', label: 'Archive', icon: <Archive size={10}/> },
              ...(user.email === ADMIN_EMAIL ? [{ id: 'admin', label: 'Admin', icon: <ShieldCheck size={10}/> }] : [])
            ].map(tab => (
              <button key={tab.id} onClick={() => setView(tab.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold transition-all whitespace-nowrap border ${view === tab.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : cardStyles}`}>{tab.icon} {tab.label}</button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[8px] font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={10} className="text-red-500" /> {error}
            <button onClick={() => setError(null)} className="ml-auto opacity-30">×</button>
          </div>
        )}

        {!user ? (
          <div className={`p-8 rounded-[2rem] border ${cardStyles} animate-in fade-in zoom-in-95`}>
            <div className="flex justify-center mb-6"><div className="p-4 bg-indigo-600 rounded-2xl shadow-lg"><ShieldCheck color="white" size={24} /></div></div>
            <form onSubmit={handleAuth} className="space-y-3">
              <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={`w-full p-3 rounded-xl outline-none text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
              <input type="password" required placeholder="Security Key" value={password} onChange={e => setPassword(e.target.value)} className={`w-full p-3 rounded-xl outline-none text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
              <button type="submit" disabled={authLoading} className="w-full py-3.5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all">{authLoading ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> : (authView === 'login' ? 'Authenticate' : 'Register')}</button>
            </form>
            <button onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')} className="w-full mt-5 text-[8px] font-black uppercase opacity-20 text-center tracking-widest">{authView === 'login' ? 'Request Secure Access' : 'Return to Entry'}</button>
          </div>
        ) : (
          <div className="space-y-3 animate-in slide-in-from-bottom-2">
            {view === 'dashboard' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Notes', val: stats.total, color: 'text-blue-500', icon: <FileText size={12}/> },
                    { label: 'Pinned', val: stats.pinned, color: 'text-amber-500', icon: <Pin size={12}/> },
                    { label: 'Tasks', val: stats.reminders, color: 'text-indigo-500', icon: <Clock size={12}/> },
                    { label: 'Groups', val: stats.labels, color: 'text-green-500', icon: <Hash size={12}/> }
                  ].map((s, idx) => (
                    <div key={idx} className={`p-3 rounded-2xl border ${cardStyles} flex flex-col items-center text-center`}>
                      <div className={`${s.color} mb-1.5`}>{s.icon}</div>
                      <div className="text-base font-black leading-none mb-0.5">{s.val}</div>
                      <div className="text-[7px] font-bold uppercase opacity-30">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className={`p-4 rounded-[1.5rem] border ${cardStyles}`}>
                   <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-[9px] uppercase opacity-40">Quick Groups</h3>
                      <button onClick={() => setIsManagingLabels(!isManagingLabels)} className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md ${isManagingLabels ? 'bg-red-500 text-white' : 'text-indigo-500'}`}>{isManagingLabels ? 'Done' : 'Edit'}</button>
                   </div>
                   <div className="flex flex-wrap gap-1 mb-3">
                      {labels.map(l => (
                        <span key={l.id} className="px-2 py-1 bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 rounded-lg text-[8px] font-bold flex items-center gap-1 animate-in fade-in">
                           {l.name}
                           {isManagingLabels && <X size={7} className="cursor-pointer hover:text-red-500" onClick={() => deleteLabel(l.id)}/>}
                        </span>
                      ))}
                   </div>
                   <div className="flex gap-1">
                      <input placeholder="New group..." value={labelInput} onChange={e => setLabelInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLabel()} className={`flex-1 pl-3 pr-2 py-2 text-[10px] rounded-lg outline-none border border-transparent focus:border-indigo-500/20 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                      <button onClick={addLabel} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow-md active:scale-95 transition-all">Add</button>
                   </div>
                </div>
              </div>
            )}

            {(view === 'notes' || view === 'archive') && (
              <>
                <div className="relative group mb-0.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" size={12} />
                  <input type="text" placeholder="Search Vault..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-full pl-8 pr-3 py-2 rounded-xl outline-none border border-transparent focus:border-indigo-500/40 text-[10px] font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                </div>
                <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                   <button onClick={() => setActiveLabelFilter(null)} className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${!activeLabelFilter ? 'bg-indigo-600 text-white' : cardStyles}`}>All</button>
                   {labels.map(l => (
                     <button key={l.id} onClick={() => setActiveLabelFilter(l.name)} className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${activeLabelFilter === l.name ? 'bg-indigo-600 text-white' : cardStyles}`}>{l.name}</button>
                   ))}
                </div>
                <button onClick={() => setIsAddingNote(true)} className="w-full py-3 bg-indigo-600 text-white rounded-[1rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg active:scale-[0.97] transition-all"><Plus size={12} /> Create Entry</button>
                <div className="space-y-1.5">
                  {processedNotes.map(n => (
                    <div key={n.id} onClick={() => setSelectedNote(n)} className={`p-3.5 rounded-[1.2rem] border group relative transition-all hover:scale-[1.002] cursor-pointer ${cardStyles} ${n.pinned ? 'ring-1 ring-indigo-500/40' : ''}`}>
                      <div className="flex justify-between items-start mb-0.5">
                        <h3 className="font-bold text-[12px] flex items-center gap-1 tracking-tight">{n.pinned && <Pin size={8} className="text-indigo-500 fill-indigo-500" />}{n.title}</h3>
                        <span className="text-[6px] opacity-20 font-black uppercase">{n.date}</span>
                      </div>
                      <p className="text-[10px] opacity-40 font-medium line-clamp-1 mb-2 leading-relaxed">{n.content}</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[6px] font-black uppercase px-1.5 py-0.5 bg-black/10 rounded-md opacity-40">{n.label}</span>
                        {n.tags?.map(t => <span key={t} className="text-[6px] font-black uppercase px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-md">#{t}</span>)}
                      </div>
                      <div className="absolute right-3 bottom-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => openEdit(e, n)} className="p-1.5 bg-indigo-500/10 rounded-lg"><Edit2 size={8}/></button>
                        <button onClick={async (e) => { e.stopPropagation(); await updateDoc(doc(db, 'users', user.uid, 'notes', n.id), { archived: !n.archived }); }} className="p-1.5 bg-indigo-500/10 rounded-lg"><Archive size={8}/></button>
                        <button onClick={async (e) => { e.stopPropagation(); await deleteDoc(doc(db, 'users', user.uid, 'notes', n.id)); }} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={8}/></button>
                      </div>
                    </div>
                  ))}
                  {processedNotes.length === 0 && <div className="text-center py-10 opacity-10 font-black text-[8px] uppercase tracking-widest">No entries found</div>}
                </div>
              </>
            )}

            {view === 'admin' && user?.email === ADMIN_EMAIL && (
              <div className="space-y-3 animate-in slide-in-from-right-3">
                <div className={`p-5 rounded-[1.5rem] border ${cardStyles}`}>
                  <h3 className="text-[8px] font-black mb-3 flex items-center gap-1.5 text-indigo-500 uppercase tracking-widest"><Send size={10} /> Dispatch Center</h3>
                  <textarea value={adminMsg.text} onChange={e => setAdminMsg({...adminMsg, text: e.target.value})} placeholder="Global broadcast..." className={`w-full p-3 rounded-xl outline-none text-[10px] min-h-[80px] mb-2 font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                  <div className="flex gap-1.5">
                    <select value={adminMsg.target} onChange={e => setAdminMsg({...adminMsg, target: e.target.value})} className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black outline-none ${theme === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}>
                      <option value="all">Everyone</option>
                      {(usersList || []).map(u => u?.uid && <option key={u.uid} value={u.uid}>{u.email || 'User'}</option>)}
                    </select>
                    <button onClick={async () => {
                      if (!adminMsg.text) return;
                      await addDoc(collection(db, 'public_notifications'), { message: adminMsg.text, target: adminMsg.target, sender: user.email, timestamp: Date.now() });
                      setAdminMsg({ text: '', target: 'all' });
                    }} className="px-5 py-2 bg-indigo-600 text-white font-black rounded-lg text-[9px] uppercase active:scale-95">Send</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[7px] font-black uppercase opacity-20 ml-1 mb-2 tracking-widest">Active Registry ({(usersList || []).length})</p>
                  {(usersList || []).map(u => u && (
                    <div key={u.uid} className={`p-2.5 rounded-xl border flex items-center justify-between ${cardStyles}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center font-black text-[9px] uppercase text-indigo-500">{(u.email || '?')[0]}</div>
                        <div><p className="text-[9px] font-bold leading-none">{u.email || 'Anon'}</p><p className="text-[6px] opacity-30 mt-1 uppercase font-mono">{u.uid?.substring(0, 8)}</p></div>
                      </div>
                      {u.email === ADMIN_EMAIL && <span className="text-[5px] font-black px-1 py-0.5 bg-indigo-500 text-white rounded uppercase tracking-tighter">Admin</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isAddingNote && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-8 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className={`w-full max-w-lg p-6 rounded-[1.8rem] border shadow-2xl animate-in slide-in-from-bottom-10 ${cardStyles}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-black uppercase tracking-widest">{editingNote ? 'Modify' : 'New Entry'}</h3>
                <button onClick={() => { setIsAddingNote(false); setEditingNote(null); setNoteForm({ title: '', content: '', label: '', tags: [], dueDate: '' }); }} className="p-1 opacity-20 hover:opacity-100 hover:rotate-90 transition-all"><X size={18} /></button>
              </div>
              <form onSubmit={saveNote} className="space-y-2.5">
                <input autoFocus placeholder="Subject" value={noteForm.title} onChange={e => setNoteForm({...noteForm, title: e.target.value})} className={`w-full p-3 rounded-xl outline-none font-bold text-[12px] ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                <div className="flex gap-1 px-1 opacity-30">
                   <button type="button" onClick={() => insertFormat('**')} className="p-1 hover:text-indigo-500"><Bold size={11}/></button>
                   <button type="button" onClick={() => insertFormat('_')} className="p-1 hover:text-indigo-500"><Italic size={11}/></button>
                   <button type="button" onClick={() => insertFormat('\n- ')} className="p-1 hover:text-indigo-500"><ListIcon size={11}/></button>
                </div>
                <textarea id="note-content" placeholder="Context..." value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} className={`w-full p-4 rounded-xl outline-none min-h-[120px] text-[11px] font-medium leading-relaxed ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">{noteForm.tags?.map(t => (<span key={t} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-500 rounded text-[7px] font-bold flex items-center gap-1 border border-indigo-500/10">#{t} <X size={6} className="cursor-pointer" onClick={() => setNoteForm({...noteForm, tags: noteForm.tags.filter(tag => tag !== t)})} /></span>))}</div>
                  <input placeholder="Add tags (Enter)" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const val = tagInput.trim().toLowerCase(); if (val && !noteForm.tags?.includes(val)) { setNoteForm({...noteForm, tags: [...(noteForm.tags || []), val]}); setTagInput(''); } } }} className={`w-full px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg outline-none border border-transparent focus:border-indigo-500/20 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                </div>
                <div className="flex gap-2 pt-2">
                  <select value={noteForm.label} onChange={e => setNoteForm({...noteForm, label: e.target.value})} className={`flex-1 p-3 rounded-xl font-black text-[8px] uppercase tracking-widest outline-none appearance-none cursor-pointer border-r-4 border-transparent ${theme === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}><option value="">Group: General</option>{labels.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select>
                  <button className="px-8 py-3 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest rounded-xl active:scale-[0.97] transition-all">Store</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedNote && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
             <div className={`w-full max-w-lg p-8 rounded-[2rem] border shadow-2xl relative ${cardStyles}`}>
                <button onClick={() => setSelectedNote(null)} className="absolute top-5 right-5 p-1.5 opacity-20 hover:opacity-100 transition-all"><X size={20}/></button>
                <div className="mb-4">
                   <p className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-1">{selectedNote.label}</p>
                   <h2 className="text-xl font-black tracking-tighter leading-tight">{selectedNote.title}</h2>
                   <div className="flex flex-wrap gap-1 mt-2">{selectedNote.tags?.map(t => <span key={t} className="text-[6px] font-black uppercase px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded border border-indigo-500/5">#{t}</span>)}</div>
                </div>
                <div className="opacity-80 max-h-[40vh] overflow-y-auto no-scrollbar pr-1 mb-5">{renderFormattedText(selectedNote.content)}</div>
                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                   <p className="text-[7px] font-bold opacity-30 uppercase tracking-[0.2em]">Stored: {new Date(selectedNote.lastModified || 0).toLocaleDateString()}</p>
                   <button onClick={(e) => openEdit(e, selectedNote)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest text-white shadow-md shadow-indigo-600/20"><Edit2 size={9}/> Edit</button>
                </div>
             </div>
          </div>
        )}

        {user && view === 'notes' && !isAddingNote && (
          <div className="mt-12 flex justify-center pb-8 opacity-20 hover:opacity-100 transition-all duration-1000">
             <button onClick={() => signOut(auth)} className="px-8 py-2 rounded-full border border-white/5 text-[7px] font-black uppercase tracking-[0.4em] hover:text-red-500 hover:border-red-500/20 transition-all">Sign Out Session</button>
          </div>
        )}
      </div>
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-white/10 rounded-full pointer-events-none opacity-50"></div>
    </div>
  );
}