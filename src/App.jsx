import React, { useState, useEffect, useRef, useMemo } from 'react';
// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";



import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import {
  Terminal,
  Hash,
  Users,
  FileText,
  Send,
  Cpu,
  Activity,
  Lock,
  Unlock,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Sun,
  Moon,
  RefreshCw,
  Sparkles,
  Loader2,
  X
} from 'lucide-react';
import { callGeminiGameMaster, isGeminiConfigured, generatePuzzle } from './lib/geminiService';

// --- Firebase Configuration & Init ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Assets / Constants ---
const THEME = {
  bg: 'bg-[var(--color-bg)]',
  bgSoft: 'bg-[var(--color-bg-soft)]',
  bgPanel: 'bg-[var(--color-bg-panel)]',
  primary: 'text-[var(--color-primary)]',
  secondary: 'text-[var(--color-secondary)]',
  border: 'border-[var(--color-border)]',
  borderActive: 'border-[var(--color-border-active)]',
  text: 'text-[var(--color-text)]',
  textDim: 'text-[var(--color-text-dim)]',
  error: 'text-[var(--color-error)]',
  warn: 'text-[var(--color-warn)]',
  font: 'font-mono'
};

// Puzzle Data for Demo
const DEMO_PUZZLE = {
  title: "Case #001: 海鸥肉",
  content: "一个男人走进一家餐厅，点了一碗海鸥肉汤。他吃了一口，然后拿出勺子自杀了。为什么？",
  truth: "这个男人以前和朋友一起遭遇了海难，漂流到一个荒岛上。在岛上饥寒交迫之际，朋友出去找食物。朋友回来后给他煮了一碗'海鸥肉汤'让他活了下来，但朋友自己却饿死了。后来他获救后，在餐厅点了真正的海鸥肉汤，发现味道和当年完全不同。他意识到当年朋友给他吃的是朋友自己身上的肉，是朋友用自己的生命救了他。他无法承受这个真相，于是选择了自杀。",
  clues_total: 5,
  difficulty: "HARD"
};

// --- GAME ENGINE INTERFACE ---

/**
 * 游戏引擎接口 - 调用 Gemini AI 作为 Game Master
 * @param {string} userInput - 玩家的问题或猜测
 * @param {'QUERY' | 'SOLVE'} mode - 游戏模式
 * @param {Array} currentClues -已解锁的线索
 */
const callGameEngine = async (userInput, mode, history, puzzleContext, currentClues = [], currentCompleteness = 0) => {
  // 使用 Gemini API
  if (isGeminiConfigured()) {
    return await callGeminiGameMaster(
      puzzleContext?.content || DEMO_PUZZLE.content,
      puzzleContext?.truth || DEMO_PUZZLE.truth,
      userInput,
      mode,
      history,
      currentClues,
      currentCompleteness
    );
  }

  // Fallback: Mock 逻辑（当 API Key 未配置时）
  console.warn("[GameEngine] Gemini not configured, using mock logic");
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerText = userInput.toLowerCase();
      let response = {
        text: ">> [MOCK] API Key 未配置，使用模拟响应",
        type: "question",
        new_clue: null,
        score_delta: 0
      };

      if (mode === 'SOLVE') {
        if (lowerText.includes('朋友') && (lowerText.includes('肉') || lowerText.includes('救'))) {
          response.text = ">> [SUCCESS] 核心逻辑匹配。案件告破。";
          response.type = "success";
          response.new_clue = puzzleContext?.truth || DEMO_PUZZLE.truth;
        } else {
          response.text = ">> [DENIED] 关键逻辑缺失。";
          response.type = "error";
        }
      } else {
        if (lowerText.includes('以前') || lowerText.includes('过去')) {
          response.text = ">> [TRUE] 是的。";
        } else if (lowerText.includes('朋友')) {
          response.text = ">> [TRUE] 这很重要。";
          response.new_clue = "FACT: 存在另一个关键人物。";
        } else {
          response.text = ">> [NULL] 无法确定。";
        }
      }
      resolve(response);
    }, 500);
  });
};


// --- Helper Components ---

// Glitch Text Effect
const GlitchText = ({ text, active = false, color = "text-[var(--color-primary)]" }) => {
  return (
    <div className={`relative inline-block ${active ? 'animate-pulse' : ''}`}>
      <span className={`relative z-10 ${color}`}>{text}</span>
      {active && (
        <>
          <span className="absolute top-0 left-[1px] -z-10 opacity-70 text-red-500 animate-pulse">{text}</span>
          <span className="absolute top-0 -left-[1px] -z-10 opacity-70 text-blue-500 animate-pulse delay-75">{text}</span>
        </>
      )}
    </div>
  );
};

// Typewriter Effect for AI messages
const Typewriter = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index));
        index++;
      } else {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, 20); // Speed
    return () => clearInterval(timer);
  }, [text, onComplete]);

  return <span>{displayedText}</span>;
};

// --- Main Application Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);

  // Game State
  const [messages, setMessages] = useState([]);
  const [inputMode, setInputMode] = useState('QUERY'); // QUERY | SOLVE
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState('TERMINAL'); // CASE | TERMINAL | SQUAD (Mobile)
  const [clues, setClues] = useState([]);
  const [players, setPlayers] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [theme, setTheme] = useState('night'); // 'night' | 'day'
  const [gamePhase, setGamePhase] = useState('PLAYING'); // 'PLAYING' | 'FINISHED'
  const [solvedBy, setSolvedBy] = useState(null); // 谁解开了谜题
  const [currentPuzzle, setCurrentPuzzle] = useState(DEMO_PUZZLE); // 当前谜题
  const [isGenerating, setIsGenerating] = useState(false); // 本地生成状态
  const [generationLock, setGenerationLock] = useState(null); // 全局生成锁 { isGenerating, by, timestamp }
  const [now, setNow] = useState(Date.now());
  const [worldCompleteness, setWorldCompleteness] = useState(0); // 世界观完整度 (0-100)

  // Custom Theme Modal State
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [themeKeywords, setThemeKeywords] = useState('');

  // Access Control
  const [passcode, setPasscode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  // 强制刷新 UI (用于检测离线)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);


  const isGlobalLoading = useMemo(() => messages.some(m => m.status === 'analyzing'), [messages]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Refs
  const scrollRef = useRef(null);

  // --- Auth & Setup ---
  const [authError, setAuthError] = useState(null);

  // --- Auth & Setup ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
        setAuthError(err.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setAuthError(null);
    }, (err) => {
      console.error("AuthState Error:", err);
      setAuthError(err.message);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Sync ---
  useEffect(() => {
    if (!user || !joined) return;

    // 1. Sync Messages
    const msgQuery = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubMsg = onSnapshot(msgQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      // Auto scroll
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }, (err) => console.error("Chat sync error", err));

    // 2. Sync Clues (Mocking shared state)
    const cluesQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'game_clues'));
    const unsubClues = onSnapshot(cluesQuery, (snapshot) => {
      setClues(snapshot.docs.map(doc => doc.data()));
    }, (err) => console.error("Clues sync error", err));

    // 3. Sync Players
    const playersQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'players'));
    const unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => doc.data()));
    }, (err) => console.error("Players sync error", err));

    // 4. Sync Puzzle
    const puzzleRef = doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'current_puzzle');
    const unsubPuzzle = onSnapshot(puzzleRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentPuzzle(docSnap.data());
      }
    }, (err) => console.error("Puzzle sync error", err));

    // 5. Sync Game Status (Completeness)
    const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'game_status');
    const unsubStatus = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWorldCompleteness(data.worldCompleteness || 0);

        if (data.status === 'FINISHED') {
          setSolvedBy(data.winner || 'Unknown');

          // Delay showing the finish screen to allow reading the logs
          if (gamePhase !== 'FINISHED') {
            setTimeout(() => {
              setGamePhase('FINISHED');
            }, 3000);
          }
        } else {
          // Server authority: If not FINISHED, must be PLAYING
          setGamePhase('PLAYING');
        }
      }
    });

    // 6. Sync Generation Lock
    const lockRef = doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'lock');
    const unsubLock = onSnapshot(lockRef, (docSnap) => {
      if (docSnap.exists()) {
        setGenerationLock(docSnap.data());
      }
    });

    return () => {
      unsubMsg();
      unsubClues();
      unsubPlayers();
      unsubPuzzle();
      unsubStatus();
      unsubLock();
    };
  }, [user, joined]);

  // --- Heartbeat Logic ---
  useEffect(() => {
    if (!user || !joined) return;

    const heartbeatInterval = setInterval(async () => {
      try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
        // 只更新 lastSeen，不更新其它字段
        await updateDoc(userRef, { lastSeen: serverTimestamp() });
      } catch (err) {
        console.error("Heartbeat error:", err);
        // 如果文档不存在（被清除），尝试重新注册
        if (err.code === 'not-found' || err.message.includes('No document to update')) {
          try {
            await setDoc(userRef, {
              name: username || 'Unknown',
              score: 0,
              uid: user.uid,
              status: 'ONLINE',
              queryCount: 10,
              lastQueryTime: null,
              lastSeen: serverTimestamp(),
              joinedAt: serverTimestamp()
            });
            addSystemLog("CONNECTION RESTORED.");
          } catch (e) {
            console.error("Re-join failed:", e);
          }
        }
      }
    }, 30000); // 30s interval

    return () => clearInterval(heartbeatInterval);
  }, [user, joined]);

  // --- Actions ---

  const handleJoin = async () => {
    if (!username.trim()) return;
    setJoined(true);

    // Register player
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
    await setDoc(playerRef, {
      name: username,
      score: 0,
      uid: user.uid,
      status: 'ONLINE',
      queryCount: 10,
      lastQueryTime: null,
      lastSeen: serverTimestamp(),
      joinedAt: serverTimestamp()
    });

    addSystemLog(`${username} initialized connection.`);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // --- Command: /skip ---
    if (inputText.trim().toLowerCase() === '/skip') {
      setInputText('');

      // Sync Finish State
      const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'game_status');
      await setDoc(statusRef, {
        status: 'FINISHED',
        winner: `${username} (SKIPPED)`,
        lastUpdate: serverTimestamp()
      }, { merge: true });

      // Local update for immediate feedback (though sync will catch it)
      setSolvedBy(`${username} (SKIPPED)`);
      setGamePhase('FINISHED');
      addSystemLog(`${username} EXECUTED /skip. TRUTH REVEALED.`);

      // Override Message
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages'), {
        text: ">> [OVERRIDE] FORCE SKIP DETECTED. REVEALING TRUTH...",
        sender: "SYSTEM",
        senderId: "SYSTEM",
        type: "error",
        status: 'processed',
        timestamp: serverTimestamp()
      });
      return;
    }

    // --- Sanity & Cooldown Check ---
    const currentPlayer = players.find(p => p.uid === user.uid);
    const now = Date.now();
    const lastQueryTime = currentPlayer?.lastQueryTime?.toDate().getTime() || 0;

    // Check Cooldown (30s) - Only strictly enforced for QUERY success, but checked here for UI
    if (now - lastQueryTime < 10000) {
      addSystemLog(`COOLDOWN ACTIVE. PLEASE WAIT ${Math.ceil((10000 - (now - lastQueryTime)) / 1000)}s`);
      return;
    }

    // Check Sanity
    if (inputMode === 'QUERY' && (currentPlayer?.queryCount ?? 10) <= 0) {
      addSystemLog('SANITY DEPLETED. CANNOT QUERY.');
      return;
    }

    const text = inputText;
    const mode = inputMode;
    setInputText('');

    // 1. 立即显示用户的输入 (Optimistic UI) - Set status: 'analyzing'
    const userMsgRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages'), {
      text,
      sender: username,
      senderId: user.uid,
      type: mode === 'SOLVE' ? 'attempt' : 'question',
      status: 'analyzing',
      timestamp: serverTimestamp()
    });

    try {
      // 2. 调用游戏引擎 (Gemini AI)
      const recentHistory = messages
        .filter(m => m.status !== 'analyzing' && m.status !== 'error') // 只发已处理的消息
        .slice(-20)
        .map(m => ({ role: m.senderId === 'AI' ? 'assistant' : 'user', content: m.text }));

      const currentClueTexts = clues.map(c => c.text);
      const aiResponse = await callGameEngine(text, mode, recentHistory, currentPuzzle, currentClueTexts, worldCompleteness);

      // 3. 更新用户消息状态为 processed
      await updateDoc(userMsgRef, { status: 'processed' });

      // 4. 更新世界观完整度
      const newCompleteness = aiResponse.completeness_percent || worldCompleteness;
      if (newCompleteness !== worldCompleteness) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'game_status'), {
          worldCompleteness: newCompleteness,
          lastUpdate: serverTimestamp()
        }, { merge: true });
      }

      // 5. 处理加分逻辑 & Sanity扣除
      let scoreDelta = aiResponse.score_delta || 0;

      // SOLVE bonus logic
      if (mode === 'SOLVE' && aiResponse.is_correct) {
        const bonusMultiplier = 2 - ((worldCompleteness || 0) / 100);
        scoreDelta = Math.ceil(scoreDelta * bonusMultiplier);
      }

      // 更新玩家状态
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
      const updates = {};

      if (scoreDelta > 0) updates.score = increment(scoreDelta);

      // 只有 QUERY 模式且成功时扣除 Sanity 并重置 CD
      if (mode === 'QUERY') {
        updates.queryCount = increment(-1);
        updates.lastQueryTime = serverTimestamp();
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(playerRef, updates);
      }

      if (scoreDelta > 0) {
        addSystemLog(`${username} +${scoreDelta} PTS [${aiResponse.answer || (aiResponse.is_correct ? 'SOLVED' : 'QUERY')}]`);
      }

      // 5. 如果解锁了新线索，添加到 Evidence
      if (aiResponse.new_clue) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'game_clues'), {
          text: aiResponse.new_clue,
          unlockedBy: username
        });
        addSystemLog(`EVIDENCE UNLOCKED BY ${username}`);
      }

      // 6. 显示 AI 回复
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages'), {
        text: aiResponse.text,
        sender: "CORE_AI",
        senderId: "AI",
        type: aiResponse.type,
        timestamp: serverTimestamp()
      });

      // 8. 检测是否解开谜题 (or 100% completeness)
      if (aiResponse.is_correct || (typeof newCompleteness !== 'undefined' && newCompleteness >= 100)) {
        setSolvedBy(username);
        setGamePhase('FINISHED');
        addSystemLog(`CASE CLOSED BY ${username} (COMPLETENESS: ${newCompleteness || 100}%)`);
      }

    } catch (error) {
      console.error("Game engine error:", error);
      // 标记消息为错误，不扣次数
      await updateDoc(userMsgRef, { status: 'error' });
      addSystemLog(`TRANSMISSION ERROR: ${error.message}`);
    }
  };

  const addSystemLog = (msg) => {
    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  // 开始新游戏
  const handleNewGame = async () => {
    // 清空数据
    try {
      const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages');
      const messagesSnapshot = await getDocs(messagesRef);
      await Promise.all(messagesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      const cluesRef = collection(db, 'artifacts', appId, 'public', 'data', 'game_clues');
      const cluesSnapshot = await getDocs(cluesRef);
      await Promise.all(cluesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      // 重置所有玩家分数
      // 重置所有玩家分数
      const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
      const playersSnapshot = await getDocs(playersRef);
      await Promise.all(playersSnapshot.docs.map(doc =>
        updateDoc(doc.ref, {
          score: 0,
          queryCount: 10,
          lastQueryTime: null
        })
      ));
    } catch (error) {
      console.error('Error resetting game:', error);
    }

    // Reset Game Status (Server)
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'game_status'), {
        worldCompleteness: 0,
        lastUpdate: serverTimestamp()
      });
    } catch (err) {
      console.error("Error resetting game status:", err);
    }

    // 重置本地状态
    setSolvedBy(null);
    setGamePhase('PLAYING');
    setInputMode('QUERY');
    setSystemLogs([]);
    addSystemLog('NEW GAME INITIALIZED. GOOD LUCK.');
  };

  // 生成新谜题
  const handleGeneratePuzzle = async (options = {}) => {
    // Check Global Lock
    const now = Date.now();
    const isLocked = generationLock?.isGenerating &&
      generationLock.timestamp?.toMillis &&
      (now - generationLock.timestamp.toMillis() < 60000);

    if (isGenerating || isLocked) {
      if (isLocked) addSystemLog(`GENERATION LOCKED BY ${generationLock.by || 'ANOTHER AGENT'}`);
      return;
    }

    setIsGenerating(true);
    addSystemLog('GENERATING NEW PUZZLE...');

    // Acquire Lock
    const lockRef = doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'lock');
    await setDoc(lockRef, {
      isGenerating: true,
      by: username,
      timestamp: serverTimestamp()
    });

    try {
      // 1. Clear Data Immediately
      const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages');
      const messagesSnapshot = await getDocs(messagesRef);
      await Promise.all(messagesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      const cluesRef = collection(db, 'artifacts', appId, 'public', 'data', 'game_clues');
      const cluesSnapshot = await getDocs(cluesRef);
      await Promise.all(cluesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      // 重置所有玩家分数 (Safe Reset)
      const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
      const playersSnapshot = await getDocs(playersRef);
      await Promise.all(playersSnapshot.docs.map(doc =>
        updateDoc(doc.ref, {
          score: 0,
          queryCount: 10,
          lastQueryTime: null
        })
      ));

      // Reset Game Status
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'game_status'), {
        worldCompleteness: 0,
        status: 'PLAYING',
        lastUpdate: serverTimestamp()
      });

      // 2. Generate New Puzzle
      const puzzle = await generatePuzzle(options);

      // 转换为内部格式
      const newPuzzle = {
        title: puzzle.title,
        content: puzzle.soup_surface,
        truth: puzzle.soup_base,
        tags: puzzle.tags,
        difficulty: puzzle.tags.difficulty
      };

      setCurrentPuzzle(newPuzzle);

      // 同步到 Firebase（让其他玩家看到）
      const puzzleRef = doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'current_puzzle');
      await setDoc(puzzleRef, {
        ...newPuzzle,
        generatedBy: username,
        generatedAt: serverTimestamp()
      });

      // (Data already cleared)

      // Reset Game Status
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'game_status'), {
        worldCompleteness: 0,
        status: 'PLAYING',
        lastUpdate: serverTimestamp()
      });

      addSystemLog(`NEW PUZZLE LOADED: ${puzzle.title}`);
      addSystemLog(`TAGS: ${puzzle.tags.genre} | ${puzzle.tags.has_death ? '💀' : '✓'} | ${puzzle.tags.difficulty}`);

      // Reset local UI state
      setGamePhase('PLAYING');
      setSolvedBy(null);

    } catch (error) {
      console.error('Error generating puzzle:', error);
      addSystemLog(`ERROR: ${error.message}`);
    } finally {
      setIsGenerating(false);
      // Release Lock
      try {
        const lockRef = doc(db, 'artifacts', appId, 'public', 'data', 'room_state', 'lock');
        await setDoc(lockRef, { isGenerating: false });
      } catch (e) { console.error("Error releasing lock", e); }
    }
  };

  const openGenerateModal = () => {
    setThemeKeywords('');
    setShowNewGameModal(true);
  };

  const confirmGenerate = () => {
    setShowNewGameModal(false);
    handleGeneratePuzzle({ theme: themeKeywords });
  };

  // --- Rendering Helpers ---

  // --- Access Control ---
  if (!isAuthorized) {
    return (
      <div className={`h-[100dvh] w-full ${THEME.bg} ${THEME.primary} font-mono flex flex-col items-center justify-center p-4`}>
        <div className={`max-w-xs w-full border ${THEME.border} p-8 text-center relative overflow-hidden`}>
          {/* Scanline */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[var(--color-primary)]/5 to-transparent h-1 w-full animate-scan"></div>

          <Lock size={32} className="mx-auto mb-4 animate-pulse" />
          <h1 className="text-xl mb-2 font-bold tracking-widest">ACCESS RESTRICTED</h1>
          <p className="text-[10px] mb-6 opacity-70">SECURE TERMINAL // AUTH REQUIRED</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const validPass = import.meta.env.VITE_ACCESS_PASSWORD || "8888";
            if (passcode === validPass) {
              setIsAuthorized(true);
            } else {
              alert("ACCESS DENIED"); // Simple alert for now, or use state for error
              setPasscode("");
            }
          }}>
            <input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              className={`w-full bg-black/50 border ${THEME.border} p-2 text-center tracking-[0.5em] mb-4 outline-none focus:border-[var(--color-primary)] ${THEME.primary} text-xl`}
              placeholder="••••"
              autoFocus
              maxLength={6}
            />
            <button type="submit" className={`w-full border ${THEME.border} py-2 hover:bg-[var(--color-primary)] hover:text-black font-bold transition-colors text-xs tracking-widest`}>
              UNLOCK
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`h-[100dvh] w-full ${THEME.bg} ${THEME.primary} flex flex-col items-center justify-center font-mono p-4 text-center`}>
        <div className="mb-4">INITIALIZING UPLINK...</div>
        {authError && (
          <div className="text-red-500 max-w-md border border-red-500 p-4 bg-red-950/30">
            <h3 className="font-bold mb-2">CONNECTION FAILURE</h3>
            <p className="text-xs">{authError}</p>
            <p className={`text-xs mt-2 ${THEME.textDim}`}>Please check your network or Firebase configuration.</p>
          </div>
        )}
      </div>
    );
  }

  if (!joined) {
    return (
      <div className={`h-[100dvh] w-full ${THEME.bg} ${THEME.primary} font-mono flex flex-col items-center justify-center p-4`}>
        <div className={`max-w-md w-full border ${THEME.border} p-8 relative`}>
          <div className={`absolute top-0 left-0 ${THEME.primary} bg-[var(--color-bg)] border ${THEME.border} text-xs px-2 py-1`}>SECURE_LOGIN</div>
          <h1 className="text-4xl mb-8 mt-4 tracking-tighter">TURTLE_SOUP<span className="animate-pulse">_</span></h1>
          <form onSubmit={(e) => { e.preventDefault(); handleJoin(); }} className="space-y-6">
            <div>
              <label className={`block text-xs ${THEME.textDim} mb-2 uppercase tracking-widest`}>Identify Yourself</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={`w-full ${THEME.bg} border ${THEME.border} p-3 ${THEME.primary} focus:border-[var(--color-border-active)] outline-none placeholder-[var(--color-text-dim)] text-base md:text-sm`}
                placeholder="CODENAME"
                maxLength={10}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className={`w-full ${THEME.bg} border ${THEME.border} ${THEME.primary} hover:opacity-80 font-bold py-3 transition-colors flex items-center justify-center gap-2`}
            >
              <Activity size={18} /> ESTABLISH CONNECTION
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- FINISHED 界面：游戏结束，显示汤底 ---
  if (gamePhase === 'FINISHED') {
    return (
      <div className={`h-[100dvh] w-full ${THEME.bg} ${THEME.text} ${THEME.font} flex flex-col overflow-hidden`}>
        {/* Header */}
        <header className={`h-12 border-b ${THEME.border} flex items-center justify-center px-4 shrink-0`}>
          <span className="font-bold tracking-widest text-[var(--color-primary)] animate-pulse">
            {'>>'} CASE CLOSED {'<<'}
          </span>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
          <div className="max-w-2xl w-full space-y-8">
            {/* 成功消息 */}
            <div className={`text-center border-2 border-[var(--color-primary)] p-6 ${THEME.bgPanel}`}>
              <div className="text-4xl mb-4">🎉</div>
              <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-2">谜题已被破解！</h1>
              <p className={`${THEME.textDim}`}>
                由 <span className="text-[var(--color-primary)] font-bold">{solvedBy}</span> 成功解开
              </p>
            </div>

            {/* 汤面回顾 */}
            <div className={`border ${THEME.border} p-4 ${THEME.bgPanel}`}>
              <h2 className={`text-xs ${THEME.textDim} uppercase tracking-widest mb-3`}>汤面 (The Puzzle)</h2>
              <p className="text-sm leading-relaxed">{currentPuzzle.content}</p>
            </div>

            {/* 汤底揭晓 */}
            <div className={`border-2 border-[var(--color-primary)] p-6 ${THEME.bgPanel} relative`}>
              <div className={`absolute -top-3 left-4 bg-[var(--color-bg)] px-2 text-xs text-[var(--color-primary)] uppercase tracking-widest`}>
                汤底 (The Truth)
              </div>
              <p className="text-sm leading-relaxed mt-2">{currentPuzzle.truth}</p>
            </div>

            {/* 排行榜 */}
            <div className={`border ${THEME.border} p-4 ${THEME.bgPanel}`}>
              <h2 className={`text-xs ${THEME.textDim} uppercase tracking-widest mb-3`}>排行榜</h2>
              <div className="space-y-2">
                {players
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  // 简单过滤：如果 lastSeen 距离现在超过 90 秒则视为离线 (考虑到延迟，放宽一点)
                  //但在渲染阶段很难直接比较 serverTimestamp，这里先假设后端会处理或者前端接受所有数据
                  // 更好的做法是在 players sync 时转换 timestamp 为 Date 对象
                  .map((p, idx) => {
                    const lastSeenMs = p.lastSeen?.seconds ? p.lastSeen.seconds * 1000 : 0;
                    const isOffline = (Date.now() - lastSeenMs) > 60000; // 60s timeout

                    return (
                      <div key={p.uid} className={`flex items-center justify-between text-sm ${isOffline ? 'opacity-40 grayscale' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 flex items-center justify-center ${idx === 0 && !isOffline ? 'bg-[var(--color-primary)] text-[var(--color-inverse)]' : THEME.bgSoft} text-xs font-bold`}>
                            {idx + 1}
                          </span>
                          <span className={p.uid === user.uid ? 'text-[var(--color-primary)] font-bold' : ''}>
                            {p.name} {p.uid === user.uid && '(You)'} {isOffline && '(OFFLINE)'}
                          </span>
                        </div>
                        <span className="font-bold">{p.score || 0} PTS</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* 新游戏按钮 */}
            <button
              onClick={openGenerateModal}
              disabled={isGenerating || (generationLock?.isGenerating && (Date.now() - (generationLock.timestamp?.seconds * 1000 || 0) < 60000))}
              className={`w-full border-2 border-[var(--color-primary)] ${THEME.bg} text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-inverse)] font-bold py-4 transition-colors flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isGenerating || (generationLock?.isGenerating && (Date.now() - (generationLock.timestamp?.seconds * 1000 || 0) < 60000)) ? (
                <>
                  <RefreshCw size={24} className="animate-spin" />
                  {isGenerating ? '正在生成...' : `锁定中 (${generationLock?.by})`}
                </>
              ) : (
                <>
                  <Activity size={24} /> 开始新一轮
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 w-full ${THEME.bg} ${THEME.text} ${THEME.font} flex flex-col overflow-hidden selection:bg-[var(--color-primary)] selection:text-[var(--color-inverse)]`}>
      {/* HEADER */}
      <header className={`h-12 border-b ${THEME.border} flex items-center justify-between px-4 shrink-0`}>
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-widest flex items-center gap-2">
            <Hash size={16} /> ROOM_8821
          </span>
          <div className="flex items-center gap-1 text-xs">
            {/* TRUTH Moved to Right */}
          </div>
          {isGlobalLoading ? (
            <div className="flex items-center gap-2 text-[var(--color-primary)] animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[10px] font-bold">AI_PROCESSING...</span>
            </div>
          ) : (
            <span className="text-xs text-[#666] hidden md:inline">Latency: 12ms</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
            className={`p-1 rounded ${THEME.border} border hover:opacity-80 transition-opacity`}
            title="Toggle Theme"
          >
            {theme === 'night' ? <Sun size={14} className={THEME.primary} /> : <Moon size={14} className={THEME.primary} />}
          </button>
          <div className="flex gap-2 items-center" title={`World Completeness: ${worldCompleteness}%`}>
            <span className={`text-[10px] uppercase font-bold ${THEME.textDim}`}>TRUTH</span>
            <div className="flex gap-1 items-center">
              <div className={`w-24 h-2 ${THEME.bgSoft} border ${THEME.border} relative overflow-hidden`}>
                <div
                  className={`h-full bg-[var(--color-primary)] transition-all duration-1000 ease-out`}
                  style={{ width: `${worldCompleteness}%` }}
                ></div>
              </div>
              <span className={`text-xs w-8 text-right font-mono ${worldCompleteness >= 80 ? 'text-[var(--color-primary)] shadow-glow' : ''}`}>
                {worldCompleteness}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE TABS */}
      <div className={`md:hidden flex border-b ${THEME.border} text-xs sticky top-0 z-20 ${THEME.bg}`}>
        <button onClick={() => setActiveTab('CASE')} className={`flex-1 py-4 text-center font-bold transition-colors ${activeTab === 'CASE' ? `border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]` : THEME.textDim}`}>CASE FILE</button>
        <button onClick={() => setActiveTab('TERMINAL')} className={`flex-1 py-4 text-center font-bold transition-colors ${activeTab === 'TERMINAL' ? `border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]` : THEME.textDim}`}>TERMINAL</button>
        <button onClick={() => setActiveTab('SQUAD')} className={`flex-1 py-4 text-center font-bold transition-colors ${activeTab === 'SQUAD' ? `border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]` : THEME.textDim}`}>SQUAD</button>
      </div>

      {/* MAIN LAYOUT */}
      <main className="flex-1 grid grid-cols-12 grid-rows-1 min-h-0 relative overflow-hidden">

        {/* LEFT PANEL: Case File */}
        <div className={`
          ${activeTab === 'CASE' ? 'block' : 'hidden'} 
          md:col-span-3 md:block 
          border-r ${THEME.border} flex flex-col
          ${THEME.bg} absolute md:relative z-10 w-full h-full
        `}>
          <div className={`p-4 border-b ${THEME.border}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xs ${THEME.textDim} uppercase tracking-[0.2em]`}>The Soup</h2>
              <button
                onClick={openGenerateModal}
                disabled={isGenerating || (generationLock?.isGenerating && (Date.now() - (generationLock.timestamp?.seconds * 1000 || 0) < 60000))}
                className={`text-xs px-3 py-1.5 border ${THEME.border} flex items-center gap-2 transition-all
                  ${isGenerating || (generationLock?.isGenerating && (Date.now() - (generationLock.timestamp?.seconds * 1000 || 0) < 60000))
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                  }`}
              >
                {isGenerating || (generationLock?.isGenerating && (Date.now() - (generationLock.timestamp?.seconds * 1000 || 0) < 60000)) ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    {isGenerating ? '本地生成中...' : `锁定中 (${generationLock?.by})`}
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    生成新谜题
                  </>
                )}
              </button>
            </div>
            <div className={`border border-[var(--color-primary)] p-4 ${THEME.bgPanel} relative overflow-hidden group`}>
              {/* Scanline effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-primary)]/10 to-transparent h-2 w-full animate-scan pointer-events-none"></div>

              <h3 className="text-lg font-bold mb-2">{currentPuzzle.title}</h3>
              <p className="text-sm opacity-90 leading-relaxed mb-3">{currentPuzzle.content}</p>

              {/* Tags */}
              {currentPuzzle.tags && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                  {/* Genre Tag */}
                  <span className={`text-[10px] px-2 py-1 border ${currentPuzzle.tags.genre === '变格'
                    ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                    : 'border-blue-500 text-blue-400 bg-blue-500/10'
                    }`}>
                    {currentPuzzle.tags.genre === '变格' ? '👻 变格' : '🔍 本格'}
                  </span>

                  {/* Death Tag */}
                  <span className={`text-[10px] px-2 py-1 border ${currentPuzzle.tags.has_death
                    ? 'border-red-500 text-red-400 bg-red-500/10'
                    : 'border-green-500 text-green-400 bg-green-500/10'
                    }`}>
                    {currentPuzzle.tags.has_death ? '💀 有人死亡' : '✓ 无人死亡'}
                  </span>

                  {/* Difficulty Tag */}
                  <span className={`text-[10px] px-2 py-1 border ${currentPuzzle.tags.difficulty === '难'
                    ? 'border-orange-500 text-orange-400 bg-orange-500/10'
                    : currentPuzzle.tags.difficulty === '中'
                      ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                      : 'border-green-500 text-green-400 bg-green-500/10'
                    }`}>
                    {currentPuzzle.tags.difficulty === '难'
                      ? '⭐⭐⭐ 难'
                      : currentPuzzle.tags.difficulty === '中'
                        ? '⭐⭐ 中'
                        : '⭐ 易'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            <h2 className={`text-xs ${THEME.textDim} uppercase tracking-[0.2em] mb-4 flex items-center gap-2`}>
              <FileText size={12} /> Evidence
            </h2>
            <ul className="space-y-3">
              {clues.length === 0 && <li className={`text-xs ${THEME.textDim} italic`}>No evidence collected yet...</li>}
              {clues.map((c, i) => (
                <li key={i} className={`text-xs border-l-2 border-[var(--color-primary)] pl-2 py-2 animate-fadeIn`}>
                  <span className={`block ${THEME.textDim} text-xs mb-1 font-bold`}>DATA_FRAGMENT_{i + 1} // {c.unlockedBy}</span>
                  <span className="leading-relaxed">{c.text}</span>
                </li>
              ))}
              {/* Locked Placeholders */}
              {[...Array(3)].map((_, i) => (
                <li key={`locked-${i}`} className={`text-xs ${THEME.textDim} opacity-50 font-bold select-none`}>
                  [ENCRYPTED_DATA_BLOCK_{i + 9}]
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CENTER PANEL: Terminal */}
        <div className={`
          ${activeTab === 'TERMINAL' ? 'flex' : 'hidden'} 
          md:col-span-6 md:flex 
          flex-col min-h-0 ${THEME.bg} h-full overflow-hidden col-span-12
        `}>
          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 font-mono text-sm"
          >
            {/* Intro Message */}
            <div className={`opacity-50 text-xs text-center border-b ${THEME.border} pb-4 mb-4`}>
              -- SECURE CHANNEL ESTABLISHED --<br />
              -- AI HOST ONLINE --
            </div>

            {messages.map((msg) => {
              const isAI = msg.senderId === 'AI';
              const isMe = msg.senderId === user.uid;
              const isAttempt = msg.type === 'attempt';

              return (
                <div key={msg.id} className={`flex flex-col ${isAI ? 'items-start' : 'items-start'} mb-2`}>
                  {/* Header */}
                  <div className={`flex items-center gap-2 text-xs ${THEME.textDim} mb-1`}>
                    <span className={isMe ? `text-[var(--color-primary)]` : ''}>
                      {isAI ? '>> SYSTEM' : `[${msg.sender}]`}
                    </span>
                    <span>{msg.timestamp?.toDate().toLocaleTimeString()}</span>
                  </div>

                  {/* Content */}
                  <div className={`
                    break-words max-w-full
                    ${isAI ? 'font-bold' : 'font-normal'}
                    ${isAttempt ? `text-[var(--color-warn)]` : ''}
                    ${msg.type === 'success' ? `text-[var(--color-primary)] border border-[var(--color-primary)] p-2 ${THEME.bgPanel}` : ''}
                    ${msg.type === 'error' ? `text-[var(--color-error)]` : ''}
                    ${msg.type === 'question' ? `text-[var(--color-text)]` : ''}
                  `}>
                    {isAI ? (
                      <Typewriter text={msg.text} />
                    ) : (
                      <span>{isAttempt ? `> ATTEMPT: ${msg.text}` : `$ ${msg.text}`}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <div className={`shrink-0 border-t ${inputMode === 'SOLVE' ? `border-[var(--color-warn)]` : THEME.border} p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${THEME.bgSoft} transition-all duration-200`}>
            {/* Mode Toggle */}
            <div className="flex items-center gap-4 mb-3">
              <button
                onClick={() => setInputMode(inputMode === 'QUERY' ? 'SOLVE' : 'QUERY')}
                className={`text-xs px-2 py-1 border flex items-center gap-2 transition-colors
                  ${inputMode === 'QUERY'
                    ? `${THEME.border} ${THEME.textDim} hover:text-[var(--color-primary)]`
                    : `border-[var(--color-warn)] text-[var(--color-warn)] bg-[var(--color-warn)]/20`}
                `}
              >
                {inputMode === 'QUERY' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                MODE: {inputMode === 'SOLVE' ? 'SOLVE (汤底)' : 'QUERY (提问)'}
              </button>
              {inputMode === 'SOLVE' && (
                <span className={`text-[10px] text-[var(--color-warn)] animate-pulse`}>WARNING: INCORRECT GUESSES COST DATA INTEGRITY</span>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2 relative">
              <span className={`self-center font-bold ${inputMode === 'SOLVE' ? `text-[var(--color-warn)]` : `text-[var(--color-primary)]`}`}>
                {inputMode === 'SOLVE' ? 'SOLVE >' : 'query >'}
              </span>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                className={`flex-1 bg-transparent border-b ${inputMode === 'SOLVE' ? `border-[var(--color-warn)]` : THEME.border} focus:border-[var(--color-primary)] outline-none text-[var(--color-text)] font-mono h-10 text-base md:text-sm`}
                placeholder={inputMode === 'SOLVE' ? "Describe the full story..." : "Ask a Yes/No question..."}
                autoFocus
              />
              <button type="submit" className={`${THEME.textDim} hover:text-[var(--color-primary)]`}>
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT PANEL: Squad */}
        <div className={`
          ${activeTab === 'SQUAD' ? 'block' : 'hidden'} 
          md:col-span-3 md:block 
          border-l ${THEME.border} ${THEME.bg}
          absolute md:relative z-10 w-full h-full flex flex-col
        `}>
          {/* Leaderboard */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            <h2 className={`text-xs ${THEME.textDim} uppercase tracking-[0.2em] mb-4 flex items-center gap-2`}>
              <Users size={12} /> Unit Status
            </h2>
            <div className="space-y-4">
              {players.length === 0 ? (
                <div className={`text-[10px] ${THEME.textDim} py-4 text-center`}>SCANNING FOR UNITS...</div>
              ) : (
                players
                  .filter(p => {
                    // 过滤离线玩家 (70s 超时)
                    if (!p.lastSeen) return true; // 兼容旧数据，暂不移除
                    const lastSeenTime = p.lastSeen.toDate ? p.lastSeen.toDate().getTime() : 0;
                    if (lastSeenTime === 0) return true;
                    return (now - lastSeenTime) < 70000;
                  })
                  .sort((a, b) => (b.score || 0) - (a.score || 0)).map(p => (
                    <div key={p.uid} className={`flex items-center justify-between border ${p.uid === user.uid ? `border-[var(--color-primary)] ${THEME.bgPanel}` : `border-transparent opacity-80`} p-2`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 ${p.uid === user.uid ? 'bg-[var(--color-primary)] text-[var(--color-inverse)]' : `${THEME.bgSoft} border ${THEME.border} ${THEME.textDim}`} flex items-center justify-center font-bold text-xs`}>
                          {p.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${p.uid === user.uid ? 'text-[var(--color-primary)]' : ''}`}>{p.name}</div>
                          <div className={`text-[10px] ${THEME.textDim} flex items-center gap-2`}>
                            <span>SANITY: {p.queryCount ?? 10}/10</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-bold">{p.score || 0}</div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* System Log */}
          <div className={`h-1/3 border-t ${THEME.border} p-4 ${THEME.bgSoft} font-mono text-[10px] overflow-y-auto`}>
            <h2 className={`${THEME.textDim} uppercase mb-2 flex items-center gap-2`}>
              <Cpu size={10} /> Sys.log
            </h2>
            <div className={`space-y-1 ${THEME.textDim}`}>
              {systemLogs.map((log, i) => (
                <div key={i}>&gt; {log}</div>
              ))}
              <div>&gt; SYSTEM READY</div>
            </div>
          </div>
        </div>

      </main>

      {/* New Game Modal */}
      {showNewGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className={`w-full max-w-md border ${THEME.border} ${THEME.bg} p-6 relative shadow-2xl animate-fadeIn`}>
            <button
              onClick={() => setShowNewGameModal(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-[#fff]"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-[var(--color-primary)]">
              <Activity size={20} /> GENERATE NEW SOUP
            </h2>

            <div className="mb-6">
              <label className={`block text-xs uppercase tracking-widest ${THEME.textDim} mb-2`}>
                Scenario Keywords / Theme (Optional)
              </label>
              <input
                type="text"
                value={themeKeywords}
                onChange={(e) => setThemeKeywords(e.target.value)}
                placeholder="e.g. Cyberpunk, Ancient School, Time Loop..."
                className={`w-full bg-black/50 border ${THEME.border} p-3 outline-none focus:border-[var(--color-primary)] transition-colors text-sm font-mono`}
              />
              <p className="text-[10px] text-[#666] mt-2 font-mono">
                Leave empty for completely random generation.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNewGameModal(false)}
                className={`flex-1 py-3 border ${THEME.border} hover:bg-[var(--color-surface)] transition-colors text-xs font-bold`}
              >
                CANCEL
              </button>
              <button
                onClick={confirmGenerate}
                className={`flex-1 py-3 bg-[var(--color-primary)] text-[var(--color-inverse)] font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                GENERATE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}