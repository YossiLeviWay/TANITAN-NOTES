import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, signOut 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, collection, onSnapshot, 
  addDoc, updateDoc, deleteDoc, getDocs
} from 'firebase/firestore';
import { 
  LogIn, UserPlus, LogOut, Loader2, ShieldCheck, Plus, Trash2, 
  FileText, Lock, Mail, MoreHorizontal, Search, X, Pin, Edit2, 
  Moon, Sun, Bell, Send, Users, Tag, CheckCircle2, AlertCircle, 
  ChevronRight, Settings, Archive, Clock, Share2, Download, 
  History, Bold, Italic, List as ListIcon, Calendar, BarChart3, Hash
} from 'lucide-react';

// --- Firebase Configuration ---
// Ensure you have replaced these with your actual keys from the Firebase Console!
const firebaseConfig = {
  apiKey: "AIzaSyCv-FDx-2SUgYY73ud5v0dUBXeWjOQG_Lg",
  authDomain: "tanitan-notes.firebaseapp.com",
  projectId: "tanitan-notes",
  storageBucket: "tanitan-notes.firebasestorage.app",
  messagingSenderId: "77324184022",
  appId: "1:77324184022:web:110fd94ebf1fc83fdc1c77",
  measurementId: "G-YMP947VJ11"
};

const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey !== "";

let auth, db;
if (isConfigValid) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase init failed:", e);
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
  
  // Data State
  const [notes, setNotes] = useState([]);
  const [labels, setLabels] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Interaction States
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

  // Note Form State
  const [noteForm, setNoteForm] = useState({
    title: '', content: '', label: '', tags: [], dueDate: '', attachmentUrl: ''
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

    // Fetch User's Private Notes
    const notesRef = collection(db, 'users', user.uid, 'notes');
    const unsubNotes = onSnapshot(notesRef, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Notes Fetch Error:", err));

    // Fetch User's Custom Labels
    const labelsRef = collection(db, 'users', user.uid, 'labels');
    const unsubLabels = onSnapshot(labelsRef, (snap) => {
      setLabels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Labels Fetch Error:", err));

    // Fetch System Notifications
    const notifRef = collection(db, 'public_notifications');
    const unsubNotif = onSnapshot(notifRef, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = all.filter(n => n.target === 'all' || n.target === user.uid);
      setNotifications(filtered.sort((a,b) => b.timestamp - a.timestamp));
      setUnreadCount(filtered.filter(n => !n.readBy?.includes(user.uid)).length);
    }, (err) => console.error("Notification Fetch Error:", err));

    // Admin Only: Fetch User List
    let unsubUsers;
    if (user.email === ADMIN_EMAIL) {
      const usersRef = collection(db, 'registered_users');
      unsubUsers = onSnapshot(usersRef, (snap) => {
        setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        console.error("Admin Registry error:", err);
        setUsersList([]);
      });
    }

    return () => {
      unsubNotes();
      unsubLabels();
      unsubNotif();
      if (unsubUsers) unsubUsers();
    };
  }, [user]);

  // Logic: Text Formatting for Reading Mode
  const renderFormattedText = (text) => {
    if (!text) return '';
    return text.split('\n').map((line, i) => {
      // Bold: **text**
      let content = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-500">$1</strong>');
      // Italic: _text_
      content = content.replace(/_(.*?)_/g, '<em class="italic opacity-80">$1</em>');
      // Lists: - text
      if (content.startsWith('- ')) {
        content = `• ${content.substring(2)}`;
      }
      return <p key={i} className="mb-1.5 min-h-[1em]" dangerouslySetInnerHTML={{ __html: content }} />;
    });
  };

  const insertFormat = (tag) => {
    const textarea = document.getElementById('note-content');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = noteForm.content;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const selected = text.substring(start, end);
    const formatted = `${tag}${selected}${tag}`;
    setNoteForm({ ...noteForm, content: before + formatted + after });
  };

  // Logic: Auth
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

  // Logic: Note Operations
  const saveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title) return;
    
    const noteData = {
      ...noteForm,
      label: noteForm.label || 'Unlabeled',
      lastModified: Date.now(),
      archived: noteForm.archived || false,
      pinned: noteForm.pinned || false,
      versions: editingNote ? [...(editingNote.versions || []), { content: editingNote.content, time: Date.now() }] : []
    };

    try {
      if (editingNote) {
        await updateDoc(doc(db, 'users', user.uid, 'notes', editingNote.id), noteData);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'notes'), {
          ...noteData,
          created: Date.now(),
          sharedWith: []
        });
      }
      closeComposer();
    } catch (err) {
      console.error("Save Note Error:", err);
      setError("Failed to save note.");
    }
  };

  const closeComposer = () => {
    setIsAddingNote(false);
    setEditingNote(null);
    setNoteForm({ title: '', content: '', label: '', tags: [], dueDate: '', attachmentUrl: '' });
  };

  const openEdit = (e, note) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingNote(note);
    setNoteForm({ ...note });
    setSelectedNote(null); 
    setIsAddingNote(true);
  };

  // Logic: Label Management
  const addLabel = async () => {
    if (!labelInput.trim()) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'labels'), { name: labelInput.trim() });
      setLabelInput('');
      setError(null);
    } catch (err) { 
      console.error("Label Add Error:", err);
      setError("Database error: Update your Firebase rules to allow label creation."); 
    }
  };

  const deleteLabel = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'labels', id));
    } catch (err) {
      console.error("Label Delete Error:", err);
    }
  };

  const exportNote = (e, note) => {
    e.preventDefault();
    e.stopPropagation();
    const element = document.createElement("a");
    const file = new Blob([`${note.title}\n\n${note.content}\n\nLabel: ${note.label}\nTags: ${note.tags?.join(', ')}`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${note.title}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  const toggleArchive = async (e, note) => {
    e.preventDefault();
    e.stopPropagation();
    await updateDoc(doc(db, 'users', user.uid, 'notes', note.id), { archived: !note.archived });
  };

  const togglePin = async (e, note) => {
    e.preventDefault();
    e.stopPropagation();
    await updateDoc(doc(db, 'users', user.uid, 'notes', note.id), { pinned: !note.pinned });
  };

  const handleDeleteNote = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteDoc(doc(db, 'users', user.uid, 'notes', id));
  };

  const handleAdminSend = async () => {
    if (!adminMsg.text) return;
    try {
      await addDoc(collection(db, 'public_notifications'), {
        message: adminMsg.text,
        target: adminMsg.target,
        sender: user.email,
        timestamp: Date.now()
      });
      setAdminMsg({ text: '', target: 'all' });
      setError("Notification sent successfully");
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError("Failed to send message.");
    }
  };

  // Filtered Notes Logic
  const processedNotes = useMemo(() => {
    let list = notes.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           n.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLabel = !activeLabelFilter || n.label === activeLabelFilter;
      const matchesView = view === 'archive' ? n.archived : !n.archived;
      return matchesSearch && matchesLabel && matchesView;
    });

    return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.lastModified - a.lastModified);
  }, [notes, searchQuery, activeLabelFilter, view]);

  // Dashboard Stats
  const stats = useMemo(() => {
    return {
      total: notes.length,
      pinned: notes.filter(n => n.pinned).length,
      archived: notes.filter(n => n.archived).length,
      reminders: notes.filter(n => n.dueDate && !n.archived).length,
      labelsCount: labels.length
    };
  }, [notes, labels]);

  if (initializing) return (
    <div className={`flex h-screen w-full items-center justify-center ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-100 text-slate-900'}`}>
      <ShieldCheck className="h-10 w-10 animate-pulse text-indigo-600" />
    </div>
  );

  if (!isConfigValid) {
    return (
      <div className={`flex h-screen w-full items-center justify-center p-6 ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-100 text-slate-900'}`}>
        <div className="max-w-md w-full p-8 rounded-[2.5rem] bg-white/10 backdrop-blur-3xl border border-white/10 text-center shadow-2xl">
          <Settings className="h-10 w-10 text-amber-500 animate-[spin_4s_linear_infinite] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3 tracking-tighter">Setup Required</h2>
          <p className="text-xs opacity-50 mb-6 leading-relaxed">Please paste your Firebase Configuration into the <code>firebaseConfig</code> object in <code>src/App.jsx</code>.</p>
        </div>
      </div>
    );
  }

  const cardStyles = theme === 'dark'
    ? "bg-white/10 backdrop-blur-2xl border-white/10 text-white"
    : "bg-white/80 backdrop-blur-2xl border-white/40 text-slate-900 shadow-lg shadow-slate-200/50";

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 pb-16 ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] blur-[140px] rounded-full opacity-20 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-blue-400'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] blur-[140px] rounded-full opacity-10 ${theme === 'dark' ? 'bg-purple-600' : 'bg-indigo-400'}`}></div>
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-4 pt-8">
        
        {/* iOS Header */}
        <div className="flex justify-between items-start mb-6 px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h1 className="text-4xl font-extralight tracking-tighter mt-1 flex items-center gap-2">
              {view === 'dashboard' ? 'Insight' : view === 'archive' ? 'Archive' : view === 'admin' ? 'Terminal' : 'Vault'}
            </h1>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2.5 rounded-xl border transition-all active:scale-90 ${cardStyles}`}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user && (
              <button onClick={() => setView('notifications')} className={`p-2.5 rounded-xl border relative transition-all active:scale-90 ${cardStyles}`}>
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
              </button>
            )}
          </div>
        </div>

        {user && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-5 px-0.5">
            {[
              { id: 'notes', label: 'Vault', icon: <FileText size={12}/> },
              { id: 'dashboard', label: 'Home', icon: <BarChart3 size={12}/> },
              { id: 'archive', label: 'Archive', icon: <Archive size={12}/> },
              ...(user.email === ADMIN_EMAIL ? [{ id: 'admin', label: 'Admin', icon: <ShieldCheck size={12}/> }] : [])
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border ${
                  view === tab.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : cardStyles
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold flex items-center gap-3 animate-in fade-in">
            <AlertCircle size={14} className="text-indigo-500" /> {error}
            <button onClick={() => setError(null)} className="ml-auto opacity-30">×</button>
          </div>
        )}

        {!user ? (
          /* AUTH INTERFACE */
          <div className={`p-8 rounded-[2.5rem] border ${cardStyles} animate-in fade-in zoom-in-95`}>
            <div className="flex justify-center mb-6">
               <div className="p-5 bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-600/30">
                <ShieldCheck color="white" size={32} strokeWidth={1.5} />
               </div>
            </div>
            <form onSubmit={handleAuth} className="space-y-3.5">
              <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                className={`w-full p-4 rounded-[1.5rem] outline-none border border-transparent focus:border-indigo-500/40 transition-all text-sm font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
              <input type="password" required placeholder="Security Key" value={password} onChange={e => setPassword(e.target.value)}
                className={`w-full p-4 rounded-[1.5rem] outline-none border border-transparent focus:border-indigo-500/40 transition-all text-sm font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
              <button type="submit" disabled={authLoading} className="w-full py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-[1.5rem] shadow-xl active:scale-[0.97] transition-all">
                {authLoading ? <Loader2 className="animate-spin mx-auto" /> : (authView === 'login' ? 'Authenticate' : 'Register')}
              </button>
            </form>
            <button onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')} className="w-full mt-6 text-[9px] font-black uppercase tracking-[0.3em] opacity-30 hover:opacity-100 transition-opacity text-center">
              {authView === 'login' ? 'Request Secure Access' : 'Return to login'}
            </button>
          </div>
        ) : (
          /* MAIN CONTENT VIEWS */
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            
            {view === 'dashboard' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3.5 animate-in zoom-in-95">
                  {[
                    { label: 'Total Vault', val: stats.total, color: 'text-blue-500', icon: <FileText size={18}/> },
                    { label: 'Pinned', val: stats.pinned, color: 'text-amber-500', icon: <Pin size={18}/> },
                    { label: 'Reminders', val: stats.reminders, color: 'text-indigo-500', icon: <Clock size={18}/> },
                    { label: 'Labels', val: stats.labelsCount, color: 'text-green-500', icon: <Hash size={18}/> }
                  ].map((s, idx) => (
                    <div key={idx} className={`p-5 rounded-[2.2rem] border ${cardStyles} flex flex-col items-center text-center`}>
                      <div className={`${s.color} mb-2.5`}>{s.icon}</div>
                      <div className="text-xl font-black mb-0.5">{s.val}</div>
                      <div className="text-[9px] font-bold uppercase opacity-40 tracking-widest">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Manage Labels Card */}
                <div className={`p-6 rounded-[2.2rem] border ${cardStyles}`}>
                   <div className="flex justify-between items-center mb-5">
                      <h3 className="font-bold text-xs">Organize Labels</h3>
                      <button onClick={() => setIsManagingLabels(!isManagingLabels)} className="text-[9px] font-black uppercase text-indigo-500">Edit Mode</button>
                   </div>
                   <div className="flex flex-wrap gap-1.5 mb-4">
                      {labels.map(l => (
                        <span key={l.id} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
                           {l.name}
                           {isManagingLabels && <X size={10} className="cursor-pointer hover:text-red-500" onClick={() => deleteLabel(l.id)}/>}
                        </span>
                      ))}
                   </div>
                   <div className="flex gap-2 relative">
                      <div className="flex-1 relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={12}/>
                        <input 
                          placeholder="New label..." value={labelInput} onChange={e => setLabelInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addLabel()}
                          className={`w-full pl-8 pr-3 py-2.5 text-[10px] rounded-xl outline-none border border-transparent focus:border-indigo-500/20 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                      </div>
                      <button onClick={addLabel} className="px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">Add</button>
                   </div>
                </div>
              </div>
            )}

            {(view === 'notes' || view === 'archive') && (
              <>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                  <input 
                    type="text" placeholder="Search your vault..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className={`w-full pl-11 pr-4 py-4 rounded-[1.8rem] outline-none border border-transparent focus:border-indigo-500/40 transition-all text-sm font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                </div>

                {/* Inline Label Filter */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                   <button onClick={() => setActiveLabelFilter(null)} className={`px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${!activeLabelFilter ? 'bg-indigo-600 text-white' : cardStyles}`}>All</button>
                   {labels.map(l => (
                     <button key={l.id} onClick={() => setActiveLabelFilter(l.name)} className={`px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeLabelFilter === l.name ? 'bg-indigo-600 text-white' : cardStyles}`}>{l.name}</button>
                   ))}
                </div>

                <div className="flex gap-2">
                   <button onClick={() => setIsAddingNote(true)} className="flex-1 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.97] transition-all">
                      <Plus size={18} /> New Entry
                   </button>
                </div>

                <div className="space-y-2.5">
                  {processedNotes.map(n => (
                    <div key={n.id} onClick={() => setSelectedNote(n)} className={`p-5 rounded-[2rem] border group relative transition-all hover:scale-[1.005] cursor-pointer ${cardStyles} ${n.pinned ? 'ring-2 ring-indigo-500/40' : ''}`}>
                      <div className="flex justify-between items-start mb-1.5">
                        <h3 className="font-bold text-sm flex items-center gap-2 tracking-tight">
                          {n.pinned && <Pin size={12} className="text-indigo-500 fill-indigo-500" />}
                          {n.title}
                        </h3>
                        <span className="text-[8px] opacity-20 font-black uppercase tracking-widest">{n.date}</span>
                      </div>
                      <p className="text-xs opacity-50 font-medium line-clamp-2 mb-3.5 leading-relaxed">{n.content}</p>
                      
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[7px] font-black uppercase px-2 py-0.5 bg-black/10 rounded-full opacity-60 tracking-wider border border-transparent group-hover:border-black/5">{n.label}</span>
                        {n.tags?.map(t => (
                          <span key={t} className="text-[7px] font-black uppercase px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full tracking-wider border border-indigo-500/5">#{t}</span>
                        ))}
                      </div>
                      <div className="absolute right-5 bottom-5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => openEdit(e, n)} className="p-2.5 bg-indigo-500/10 rounded-xl hover:bg-indigo-500/20"><Edit2 size={12}/></button>
                        <button onClick={(e) => exportNote(e, n)} className="p-2.5 bg-indigo-500/10 rounded-xl hover:bg-indigo-500/20"><Download size={12}/></button>
                        <button onClick={(e) => toggleArchive(e, n)} className="p-2.5 bg-indigo-500/10 rounded-xl hover:bg-indigo-500/20"><Archive size={12}/></button>
                        <button onClick={(e) => handleDeleteNote(e, n.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {view === 'admin' && user?.email === ADMIN_EMAIL && (
              <div className="space-y-5 animate-in slide-in-from-right-4">
                <div className={`p-7 rounded-[2.2rem] border ${cardStyles}`}>
                  <h3 className="text-[10px] font-black mb-5 flex items-center gap-2.5 text-indigo-500 uppercase tracking-[0.2em]"><Send size={16} /> Broadcast Hub</h3>
                  <textarea value={adminMsg.text} onChange={e => setAdminMsg({...adminMsg, text: e.target.value})}
                    placeholder="Global dispatch..." className={`w-full p-4 rounded-2xl outline-none text-xs min-h-[120px] mb-4 font-medium leading-relaxed border border-transparent focus:border-indigo-500/20 transition-all ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                  <div className="flex gap-2">
                    <select value={adminMsg.target} onChange={e => setAdminMsg({...adminMsg, target: e.target.value})}
                      className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black outline-none appearance-none cursor-pointer ${theme === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}>
                      <option value="all">Everyone</option>
                      {(usersList || []).map(u => <option key={u.uid} value={u.uid}>{u.email || 'No Email'}</option>)}
                    </select>
                    <button onClick={handleAdminSend} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-md">Dispatch</button>
                  </div>
                </div>
                <div className="space-y-2 px-1">
                  <p className="text-[9px] font-black uppercase opacity-20 ml-1 mb-3 tracking-[0.2em]">Member Registry ({(usersList || []).length})</p>
                  {(usersList || []).map(u => (
                    <div key={u.uid} className={`p-4 rounded-[1.5rem] border flex items-center justify-between ${cardStyles}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center font-black text-[11px] uppercase text-indigo-500">{(u.email || '?')[0]}</div>
                        <div>
                          <p className="text-[11px] font-bold tracking-tight">{u.email || 'Anonymous'}</p>
                          <p className="text-[8px] opacity-30 uppercase font-mono tracking-tighter">{u.uid}</p>
                        </div>
                      </div>
                      {u.email === ADMIN_EMAIL && <span className="text-[7px] font-black px-2 py-0.5 bg-indigo-500 text-white rounded-md tracking-widest uppercase">Admin</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'notifications' && (
              <div className="space-y-3.5">
                {notifications.map(n => (
                  <div key={n.id} className={`p-5 rounded-[2rem] border ${cardStyles} ${n.readBy?.includes(user.uid) ? 'opacity-40 scale-[0.98]' : 'border-indigo-500/30 shadow-md'}`}>
                    <div className="flex justify-between items-center mb-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-indigo-500" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">System Bulletin</span>
                      </div>
                      <span className="text-[8px] opacity-20 font-black">{new Date(n.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm font-semibold opacity-90 leading-relaxed">{n.message}</p>
                    {!n.readBy?.includes(user.uid) && (
                      <button 
                        onClick={async () => {
                          const readSet = new Set(n.readBy || []);
                          readSet.add(user.uid);
                          await updateDoc(doc(db, 'public_notifications', n.id), { readBy: Array.from(readSet) });
                        }}
                        className="mt-3.5 text-[8px] font-black uppercase text-indigo-500 flex items-center gap-1 hover:opacity-70"
                      >
                        <CheckCircle2 size={10}/> Confirm Receipt
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* READING MODE OVERLAY */}
        {selectedNote && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300">
             <div className={`w-full max-w-lg p-8 rounded-[2.8rem] border shadow-2xl relative ${cardStyles}`}>
                <button onClick={() => setSelectedNote(null)} className="absolute top-6 right-6 p-2 opacity-30 hover:opacity-100 hover:rotate-90 transition-all"><X size={24}/></button>
                <div className="mb-5">
                   <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-1.5">{selectedNote.label}</p>
                   <h2 className="text-2xl font-black tracking-tighter leading-none mb-1">{selectedNote.title}</h2>
                   <div className="flex flex-wrap gap-1 mt-3">
                      {selectedNote.tags?.map(t => <span key={t} className="text-[7px] font-black uppercase px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full border border-indigo-500/5">#{t}</span>)}
                   </div>
                </div>
                <div className="text-[13px] opacity-80 leading-relaxed max-h-[45vh] overflow-y-auto no-scrollbar pr-1.5 mb-6">
                   {renderFormattedText(selectedNote.content)}
                </div>
                <div className="flex justify-between items-center pt-5 border-t border-white/5">
                   <p className="text-[8px] font-bold opacity-30 tracking-widest uppercase">Vault Ref: {new Date(selectedNote.lastModified).toLocaleDateString()}</p>
                   <button onClick={(e) => openEdit(e, selectedNote)} className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
                      <Edit2 size={10}/> Edit Entry
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* COMPOSER OVERLAY */}
        {isAddingNote && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 bg-black/65 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`w-full max-w-lg p-7 rounded-[2.8rem] border shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-12 ${cardStyles}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black tracking-tighter uppercase">{editingNote ? 'Modify Draft' : 'Archive Entry'}</h3>
                <button onClick={closeComposer} className="p-2 opacity-30 hover:opacity-100"><X size={24} /></button>
              </div>
              
              <form onSubmit={saveNote} className="space-y-3.5">
                <input autoFocus placeholder="Headline" value={noteForm.title} onChange={e => setNoteForm({...noteForm, title: e.target.value})}
                  className={`w-full p-4 rounded-[1.2rem] outline-none font-bold text-base tracking-tight ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                
                <div className="flex gap-1.5 px-1.5">
                   <button type="button" onClick={() => insertFormat('**')} className="p-1.5 opacity-30 hover:opacity-100 hover:text-indigo-500"><Bold size={14}/></button>
                   <button type="button" onClick={() => insertFormat('_')} className="p-1.5 opacity-30 hover:opacity-100 hover:text-indigo-500"><Italic size={14}/></button>
                   <button type="button" onClick={() => insertFormat('\n- ')} className="p-1.5 opacity-30 hover:opacity-100 hover:text-indigo-500"><ListIcon size={14}/></button>
                   <div className="w-px h-5 bg-white/10 mx-1"></div>
                   <input type="date" value={noteForm.dueDate} onChange={e => setNoteForm({...noteForm, dueDate: e.target.value})} className="bg-transparent text-[9px] font-bold outline-none uppercase opacity-30 hover:opacity-100"/>
                </div>

                <textarea id="note-content" placeholder="Context flow..." value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})}
                  className={`w-full p-5 rounded-[1.5rem] outline-none min-h-[140px] text-xs font-medium leading-relaxed ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {noteForm.tags?.map(t => (
                      <span key={t} className="px-2.5 py-1 bg-indigo-500/20 text-indigo-500 rounded-lg text-[9px] font-bold flex items-center gap-1.5 animate-in zoom-in-90 border border-indigo-500/10">
                        #{t} <X size={10} className="cursor-pointer opacity-50 hover:opacity-100" onClick={() => setNoteForm({...noteForm, tags: noteForm.tags.filter(tag => tag !== t)})} />
                      </span>
                    ))}
                  </div>
                  <input placeholder="Add tag (Hit Enter)" value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = tagInput.trim().replace(/#/g, '').toLowerCase();
                        if (val && !noteForm.tags?.includes(val)) {
                          setNoteForm({...noteForm, tags: [...(noteForm.tags || []), val]});
                          setTagInput('');
                        }
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest outline-none border border-transparent focus:border-indigo-500/20 transition-all ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} />
                </div>

                <div className="flex gap-2.5 pt-4">
                  <select value={noteForm.label} onChange={e => setNoteForm({...noteForm, label: e.target.value})}
                    className={`flex-1 p-4 rounded-[1.2rem] font-black text-[9px] uppercase tracking-[0.2em] outline-none appearance-none cursor-pointer border-r-8 border-transparent ${theme === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}>
                    <option value="">Select Label</option>
                    {labels.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                  </select>
                  <button className="px-10 py-4 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-[1.2rem] shadow-xl active:scale-[0.97] transition-all">Store</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/5 rounded-full pointer-events-none opacity-50"></div>
    </div>
  );
}