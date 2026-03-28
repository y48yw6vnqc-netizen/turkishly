import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2, Volume2, Plus, Trash2, Shield, Layout, BookOpen, ArrowLeft, Star, Sparkles, RotateCcw, Lock } from 'lucide-react';
import './App.css';

const LEVELS = [
  { id: 'A1', name: 'A1 - Başlangıç', icon: '🌱' },
  { id: 'A2', name: 'A2 - Temel', icon: '🧱' },
  { id: 'B1', name: 'B1 - Orta', icon: '🚲' },
  { id: 'B2', name: 'B2 - İleri', icon: '🚀' },
  { id: 'C1', name: 'C1 - Akıcı', icon: '🎓' }
];

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function App() {
  const [view, setView] = useState('main-choice'); 
  const [level, setLevel] = useState(null);
  const [step, setStep] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [learnedIds, setLearnedIds] = useState([]);
  const [stars, setStars] = useState(0);
  const [points, setPoints] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [completedSubjects, setCompletedSubjects] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [currentSubject, setCurrentSubject] = useState(null);
  
  const [allLevelWords, setAllLevelWords] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizInput, setQuizInput] = useState('');
  const [quizType, setQuizType] = useState('step'); // 'step' or 'level'

  const [adminPassword, setAdminPassword] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [userId, setUserId] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  const [newTr, setNewTr] = useState('');
  const [newUz, setNewUz] = useState('');
  const [newEx, setNewEx] = useState('');
  const [newLevel, setNewLevel] = useState('A1');
  const [newStep, setNewStep] = useState(1);
  const [editingWord, setEditingWord] = useState(null); // Kelime düzenleme için

  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const handleVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };
    
    // Some browsers wait for a user gesture or take time to load voices
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = handleVoices;
    }
    
    handleVoices();
    // Re-check after a short delay for browsers like Chrome/Android
    setTimeout(handleVoices, 500);
    setTimeout(handleVoices, 2000);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      // Check for 'uid' in URL first (direct fallback)
      const urlParams = new URLSearchParams(window.location.search);
      const urlUid = urlParams.get('uid');
      if (urlUid) {
        setUserId(urlUid);
        clearInterval(interval);
        return;
      }

      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        const user = tg.initDataUnsafe?.user;
        if (user?.id) {
          setUserId(user.id.toString());
          clearInterval(interval);
        } else if (attempts > 40) { // 8 seconds total
          setUserId('guest_user');
          setIsGuest(true);
          clearInterval(interval);
        }
      } else if (attempts > 40) {
        setUserId('guest_user');
        setIsGuest(true);
        clearInterval(interval);
      }
      attempts++;
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const fetchUserProgress = async () => {
    try {
      const res = await fetch(`/api/progress/${userId}`);
      const data = await res.json();
      setLearnedIds(data.learnedWordIds || []);
      setStars(data.stars || 0);
      setPoints(data.points || 0);
      setCompletedSteps(data.completedSteps || []);
      setCompletedLevels(data.completedLevels || []);
      setCompletedSubjects(data.completedSubjects || []);
    } catch (err) { console.error(err); }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();
      setSubjects(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (userId) fetchUserProgress();
  }, [userId]);

  useEffect(() => {
    if (level && step) fetchWords(level, step);
  }, [level, step, learnedIds]);

  const fetchWords = async (lvl, stp, currentLearnedIds = null) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/words?level=${lvl}&step=${stp}`);
      const data = await res.json();
      setAllLevelWords(data);
      if (stp !== 'LevelQuiz') {
          const lids = currentLearnedIds !== null ? currentLearnedIds : learnedIds;
          const filtered = data.filter(w => !lids.includes(w.id));
          setCards(filtered);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const isLevelLocked = (lvlId) => {
    if (lvlId === 'A1') return false;
    const index = LEVELS.findIndex(l => l.id === lvlId);
    const prevLvl = LEVELS[index - 1];
    return !completedLevels.includes(prevLvl.id);
  };

  const isStepLocked = (stp) => {
    if (completedLevels.includes(level)) return false;
    if (stp === 1) return false;
    const prevStepKey = `${level}-${stp - 1}`;
    return !completedSteps.includes(prevStepKey);
  };

  const generateQuiz = (type = 'step') => {
    setQuizType(type);
    if (!allLevelWords || allLevelWords.length === 0) {
      alert("Kelime bulunamadı!");
      return;
    }
    
    const questions = [];
    allLevelWords.forEach(word => {
      // 1. Çoktan seçmeli UZ (TR sorulur)
      const d1 = allLevelWords.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.uz);
      questions.push({ id: word.id, target: word.tr, correct: word.uz, options: [...d1, word.uz].sort(() => 0.5 - Math.random()), phase: 1 });
      
      // 2. Çoktan seçmeli TR (UZ sorulur)
      const d2 = allLevelWords.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.tr);
      questions.push({ id: word.id, target: word.uz, correct: word.tr, options: [...d2, word.tr].sort(() => 0.5 - Math.random()), phase: 2 });
      
      // 3. Yazılı TR
      questions.push({ id: word.id, target: word.uz, correct: word.tr, phase: 3 });
    });

    // Soruları karıştır
    const shuffledPool = questions.sort(() => 0.5 - Math.random());
    
    // Seviye sınavı ise tam 30 soru seç, adım sınavı ise daha az (örneğin 15)
    const finalPool = type === 'level' ? shuffledPool.slice(0, 30) : shuffledPool.slice(0, 15);

    setQuizQuestions(finalPool);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setQuizInput('');
    setView('quiz');
  };

  const handleQuizAnswer = (answer) => {
    const q = quizQuestions[currentQuizIndex];
    let isCorrect = false;
    if (q.phase === 3) {
      isCorrect = quizInput.trim().toLowerCase() === (q.correct || "").trim().toLowerCase();
    } else {
      isCorrect = answer === q.correct;
    }
    if (isCorrect) setQuizScore(s => s + 1);
    setQuizInput('');
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(i => i + 1);
    } else {
      finalizeQuiz(isCorrect ? quizScore + 1 : quizScore);
    }
  };

  const [quizStatus, setQuizStatus] = useState('success');

  const finalizeQuiz = async (finalScore) => {
    const total = quizQuestions.length;
    const percentage = (finalScore / total) * 100;
    const threshold = quizType === 'level' ? 95 : 90;
    const isPassed = percentage >= threshold;

    setQuizStatus(isPassed ? 'success' : 'fail');

    if (isPassed) {
      const endpoint = quizType === 'level' ? '/api/complete-level' : '/api/complete-step';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, level, step, score: finalScore, totalQuestions: total })
        });
        if (res.ok) {
          const data = await res.json();
          setPoints(data.points);
          setCompletedSteps(data.completedSteps);
          setCompletedLevels(data.completedLevels);
          setLearnedIds(data.learnedWordIds);
          setStars(data.stars);
        }
      } catch (err) { console.error(err); }
    }
    setView('quiz-result');
  };

  const resetProcess = async (type = 'step') => {
    if (!window.confirm("Sıfırlamak istiyor musun?")) return;
    try {
      const res = await fetch('/api/reset-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, level, step, resetType: type })
      });
      if (res.ok) {
        const data = await res.json();
        setLearnedIds(data.learnedWordIds);
        setStars(data.stars);
        setPoints(data.points);
        setCompletedSteps(data.completedSteps);
        setCompletedLevels(data.completedLevels);
        if (type === 'step') fetchWords(level, step, data.learnedWordIds);
        else setView('level-choice');
      }
    } catch (err) { console.error(err); }
  };

  const markAsLearned = async (wordId) => {
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, wordId })
      });
      if (res.ok) {
        const data = await res.json();
        setLearnedIds(data.learnedWordIds);
        setStars(data.stars);
        setPoints(data.points);
      }
    } catch (err) { console.error(err); }
  };

  const addWord = async () => {
    if (!newTr || !newUz) return;
    try {
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tr: newTr, uz: newUz, example: newEx, level: newLevel, step: newStep, password: adminPassword })
      });
      if (res.ok) {
        setNewTr(''); setNewUz(''); setNewEx('');
        const data = await res.json();
        if (level === data.level && parseInt(step) === parseInt(data.step)) {
           fetchWords(level, step);
        }
      }
    } catch (err) { console.error(err); }
  };

  const deleteWord = async (id) => {
    if (!window.confirm("Silinsin mi?")) return;
    try {
      const res = await fetch(`/api/words/${id}?password=${adminPassword}`, { method: 'DELETE' });
      if (res.ok) fetchWords(level, step);
    } catch (err) { console.error(err); }
  };

  const updateWord = async () => {
    if (!editingWord.tr || !editingWord.uz) return;
    try {
      const res = await fetch(`/api/words/${editingWord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingWord, password: adminPassword })
      });
      if (res.ok) {
        setEditingWord(null);
        fetchWords(level, step);
      }
    } catch (err) { console.error(err); }
  };

  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubContent, setNewSubContent] = useState('');
  const [newQText, setNewQText] = useState('');
  const [newQOptions, setNewQOptions] = useState(['', '', '', '']);
  const [newQCorrect, setNewQCorrect] = useState('');
  const [addingQTo, setAddingQTo] = useState(null);
  const [adminMode, setAdminMode] = useState('words'); // 'words' or 'subjects'

  const handleSubjectQuizAnswer = (answer) => {
    const q = currentSubject.questions[currentQuizIndex];
    if (answer === q.correct) setQuizScore(s => s + 1);
    
    if (currentQuizIndex < currentSubject.questions.length - 1) {
      setCurrentQuizIndex(i => i + 1);
    } else {
      finalizeSubjectQuiz(answer === q.correct ? quizScore + 1 : quizScore);
    }
  };

  const finalizeSubjectQuiz = async (finalScore) => {
    const total = currentSubject.questions.length;
    try {
      const res = await fetch('/api/complete-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subjectId: currentSubject.id, score: finalScore, total })
      });
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points);
        setCompletedSubjects(data.completedSubjects);
      }
    } catch (err) { console.error(err); }
    setView('subject-quiz-result');
  };

  const addSubject = async () => {
    if (!newSubTitle || !newSubContent) return;
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSubTitle, content: newSubContent, password: adminPassword })
      });
      if (res.ok) {
        setNewSubTitle(''); setNewSubContent('');
        fetchSubjects();
      }
    } catch (err) { console.error(err); }
  };

  const deleteSubject = async (id) => {
    if (!window.confirm("Konu silinsin mi?")) return;
    try {
      const res = await fetch(`/api/subjects/${id}?password=${adminPassword}`, { method: 'DELETE' });
      if (res.ok) fetchSubjects();
    } catch (err) { console.error(err); }
  };

  const addQuestion = async () => {
    if (!newQText || !newQCorrect) return;
    try {
      const res = await fetch(`/api/subjects/${addingQTo}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newQText, options: newQOptions, correct: newQCorrect, password: adminPassword })
      });
      if (res.ok) {
        setNewQText(''); setNewQOptions(['', '', '', '']); setNewQCorrect('');
        setAddingQTo(null);
        fetchSubjects();
      }
    } catch (err) { console.error(err); }
  };

  const deleteQuestion = async (sid, qid) => {
    if (!window.confirm("Soru silinsin mi?")) return;
    try {
      const res = await fetch(`/api/subjects/${sid}/questions/${qid}?password=${adminPassword}`, { method: 'DELETE' });
      if (res.ok) fetchSubjects();
    } catch (err) { console.error(err); }
  };

  const handleSwipe = (direction, id) => {
    if (direction === 'right') {
      markAsLearned(id);
      setCards(prev => prev.filter(c => c.id !== id));
    } else {
      setCards(prev => {
        const current = prev.find(c => c.id === id);
        const others = prev.filter(c => c.id !== id);
        return [...others, current];
      });
    }
    setFlipped(false);
  };

  const playAudio = (e, text) => {
    if (e) e.stopPropagation();
    
    if (!text) return;

    // First, try consistent high-quality fallback: Google Translate TTS (Reliable on all platforms)
    // This solves the "English accent on Android/PC" problem because it's a server-side voice
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=tr-TR&client=tw-ob&q=${encodeURIComponent(text)}`;
    const audio = new Audio(googleTtsUrl);
    
    audio.play().catch(err => {
      console.warn("Google TTS failed, falling back to local speech engine:", err);
      // Fallback to local SpeechSynthesis if Google TTS is blocked
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        
        const voices = window.speechSynthesis.getVoices();
        const trVoices = voices.filter(v => v.lang.toLowerCase().includes('tr'));
        
        // Priority: Native Turkish voices or Google Turkish
        const maleNames = ['google türkçe', 'cem', 'tolga', 'sinan', 'yasin', 'tevfik', 'erkek', 'male'];
        let selectedVoice = null;
        
        for (const name of maleNames) {
          selectedVoice = trVoices.find(v => v.name.toLowerCase().includes(name));
          if (selectedVoice) break;
        }
        
        if (!selectedVoice && trVoices.length > 0) selectedVoice = trVoices[0];
        if (selectedVoice) utterance.voice = selectedVoice;
        
        utterance.rate = 0.95;
        utterance.pitch = 1.0; 
        window.speechSynthesis.speak(utterance);
      }
    });
  };

  let viewContent;
  if (view === 'main-choice') {
    viewContent = (
      <div className="view-container main-choice">
        <div className="user-score-header">
          <div className="sparkle-badge"><Sparkles size={18} fill="#fbbf24" color="#fbbf24" /><span>{points} Puan</span></div>
          <div className="sparkle-badge"><Star size={18} fill="#FFD700" color="#FFD700" /><span>{stars} Yıldız</span></div>
        </div>
        <h1 className="welcome-title">Hoş Geldin! 👋</h1>
        <p className="welcome-subtitle">Bugün ne yapmak istersin?</p>
        
        <div className="main-options-grid">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('level-choice')} className="main-opt-card glass-panel">
            <div className="opt-icon-circle voca"><BookOpen size={32} /></div>
            <h3>Kelime Kartları</h3>
            <p>Seviyene uygun yeni kelimeler öğren ve kendini test et.</p>
          </motion.button>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('subject-list')} className="main-opt-card glass-panel">
            <div className="opt-icon-circle subject"><Layout size={32} /></div>
            <h3>Konu Anlatımları</h3>
            <p>Dil bilgisi ve önemli konuları öğren, becerilerini geliştir.</p>
          </motion.button>
        </div>
        
        <footer className="view-footer">
          <button className="admin-access-btn" onClick={() => setView('admin-login')}><Shield size={16} /> Admin</button>
          <div style={{ opacity: 0.2, fontSize: '0.7rem', marginTop: '10px' }}>{isGuest ? 'Misafir Modu' : `ID: ${userId}`}</div>
        </footer>
      </div>
    );
  } else if (view === 'subject-list') {
    viewContent = (
      <div className="view-container subject-list">
        <header className="view-header"><button className="back-btn" onClick={() => setView('main-choice')}><ArrowLeft /></button><h2>Konular</h2><div></div></header>
        <div className="levels-grid">
          {subjects.map(s => (
            <button key={s.id} onClick={() => { setCurrentSubject(s); setView('subject-view'); }} className={`level-card glass-panel ${completedSubjects.includes(s.id) ? 'completed' : ''}`}>
              <div className="step-num-badge">{completedSubjects.includes(s.id) ? "✅" : "📖"}</div>
              <div className="level-info">
                  <span className="level-id">{s.title}</span>
                  <span className="level-name">{completedSubjects.includes(s.id) ? "Tamamlandı" : `${s.questions.length} Beceri Testi`}</span>
              </div>
              <div className="card-arrow">→</div>
            </button>
          ))}
          {subjects.length === 0 && <p className="empty-msg">Henüz konu eklenmemiş.</p>}
        </div>
      </div>
    );
  } else if (view === 'subject-view') {
    viewContent = (
      <div className="view-container subject-view">
        <header className="view-header"><button className="back-btn" onClick={() => setView('subject-list')}><ArrowLeft /></button><h2>{currentSubject?.title}</h2><div></div></header>
        <div className="lesson-content glass-panel">
           <div className="lesson-text" dangerouslySetInnerHTML={{ __html: currentSubject?.content.replace(/\n/g, '<br/>') }}></div>
           <div className="lesson-divider"></div>
           <h3>Becerilerini Test Et</h3>
           <p>Bu konuyu ne kadar iyi anladığını ölçmek için beceri testini çöz.</p>
           <button className="glass-btn primary" onClick={() => { setQuizScore(0); setCurrentQuizIndex(0); setView('subject-quiz'); }}>
              <Sparkles size={18} /> Beceri Testini Başlat
           </button>
        </div>
      </div>
    );
  } else if (view === 'subject-quiz') {
    const q = currentSubject.questions[currentQuizIndex];
    viewContent = (
      <div className="view-container quiz-view">
         <header className="quiz-header">
            <div className="quiz-progress-bar"><div className="progress-fill" style={{ width: `${((currentQuizIndex + 1) / currentSubject.questions.length) * 100}%` }}></div></div>
            <span>{currentQuizIndex + 1} / {currentSubject.questions.length}</span>
         </header>
         <h2 className="quiz-question-title">Doğru seçeneği bulunuz:</h2>
         <div className="quiz-word-card glass-panel"><p className="question-text">{q.text}</p></div>
         <div className="quiz-options-grid">
           {q.options.map((opt, i) => (
             <button key={i} className="quiz-option-btn glass-panel" onClick={() => handleSubjectQuizAnswer(opt)}>{opt}</button>
           ))}
         </div>
      </div>
    );
  } else if (view === 'subject-quiz-result') {
    const isSuccess = quizScore === currentSubject.questions.length;
    viewContent = (
      <div className="view-container quiz-result-view">
        {isSuccess ? <Sparkles size={80} fill="#FFD700" /> : <div className="fail-icon glass-panel"><X size={60} color="#ef4444" /></div>}
        <h1>{isSuccess ? "Harika! 🏆" : "Bitti! ✅"}</h1>
        <p>{currentSubject.questions.length} soruda {quizScore} doğru.</p>
        <p className="result-desc">
          {isSuccess ? "Tüm beceri sorularını doğru cevapladın! Harikasın." : "Konuyu pekiştirmek için tekrar göz atabilirsin."}
        </p>
        <button className="glass-btn primary" onClick={() => setView('subject-list')}>Konulara Dön</button>
      </div>
    );
  } else if (view === 'level-choice') {
    viewContent = (
      <div className="view-container level-choice">
        <header className="view-header">
           <button className="back-btn" onClick={() => setView('main-choice')}><ArrowLeft /></button>
           <h2>Seviyeler</h2>
           <div></div>
        </header>
        <div className="user-score-header">
          <div className="sparkle-badge"><Sparkles size={18} fill="#fbbf24" color="#fbbf24" /><span>{points} Puan</span></div>
          <div className="sparkle-badge"><Star size={18} fill="#FFD700" color="#FFD700" /><span>{stars} Yıldız</span></div>
        </div>
        <p className="welcome-subtitle">Bir seviye seç ve başla:</p>
        <div className="levels-grid">
          {LEVELS.map(l => {
            const locked = isLevelLocked(l.id);
            return (
              <button key={l.id} disabled={locked} onClick={() => { setLevel(l.id); setView('step-choice'); }} className={`level-card glass-panel ${locked ? 'locked' : ''}`}>
                <span className="level-icon">{locked ? <Lock /> : l.icon}</span>
                <div className="level-info">
                  <span className="level-id">{l.id}</span>
                  <span className="level-name">{l.name}</span>
                </div>
                {!locked && <div className="card-arrow">→</div>}
              </button>
            );
          })}
        </div>
      </div>
    );
  } else if (view === 'step-choice') {
    viewContent = (
      <div className="view-container step-choice">
        <header className="view-header">
           <button className="back-btn" onClick={() => setView('level-choice')}><ArrowLeft /></button>
           <h2>{level} Seviyesi</h2>
           <button className="back-btn" onClick={() => resetProcess('level')}><RotateCcw size={18} /></button>
        </header>
        <div className="levels-grid">
          {STEPS.map(s => {
            const stepKey = `${level}-${s}`;
            const isCompleted = completedSteps.includes(stepKey);
            const locked = isStepLocked(s);
            return (
              <button key={s} disabled={locked} onClick={() => { setStep(s); setView('game'); }} className={`level-card glass-panel ${locked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`}>
                <div className="step-num-badge">{locked ? <Lock size={20}/> : s}</div>
                <div className="level-info">
                   <span className="level-id">{s}. Adım {isCompleted && "✅"}</span>
                   <span className="level-name">{isCompleted ? "Tamamlandı" : `${level} - Bölüm ${s}`}</span>
                </div>
                {!locked && <div className="card-arrow">→</div>}
              </button>
            );
          })}
          
          <button className="level-card glass-panel level-quiz-card" onClick={async () => { await fetchWords(level, 'LevelQuiz'); generateQuiz('level'); }}>
             <div className="step-num-badge special"><Sparkles /></div>
             <div className="level-info">
                <span className="level-id">🏆 SEVİYE SINAVI</span>
                <span className="level-name">Tüm adımları kapsayan final testi</span>
             </div>
             <div className="card-arrow">→</div>
          </button>
        </div>
      </div>
    );
  } else if (view === 'admin-login') {
    /* (Admin logic codes kept for brevity) */
    viewContent = (
      <div className="view-container admin-login">
        <Shield size={64} className="admin-icon" />
        <h2>Admin Girişi</h2>
        <input type="password" placeholder="Şifre..." className="glass-input" value={tempPassword} onChange={e => setTempPassword(e.target.value)} />
        <button className="glass-btn primary" onClick={() => { setAdminPassword(tempPassword); setView('admin-panel'); }}>Giriş</button>
        <button className="glass-btn secondary" onClick={() => setView('level-choice')}>Geri</button>
      </div>
    );
  } else if (view === 'admin-panel') {
    viewContent = (
      <div className="view-container admin-panel">
        <header className="view-header"><button className="back-btn" onClick={() => setView('main-choice')}><Layout /> Menü</button><h2>Admin</h2></header>
        
        <div className="admin-tabs">
          <button className={`tab-btn ${adminMode === 'words' ? 'active' : ''}`} onClick={() => setAdminMode('words')}>Kelimeler</button>
          <button className={`tab-btn ${adminMode === 'subjects' ? 'active' : ''}`} onClick={() => setAdminMode('subjects')}>Konular</button>
        </div>

        {adminMode === 'words' ? (
          <>
            <div className="add-word-form glass-panel">
              <input placeholder="TR" value={newTr} onChange={e => setNewTr(e.target.value)} className="glass-input" />
              <input placeholder="UZ" value={newUz} onChange={e => setNewUz(e.target.value)} className="glass-input" />
              <textarea placeholder="Örnek Metin" value={newEx} onChange={e => setNewEx(e.target.value)} className="glass-input" />
              <div className="admin-grid">
                <select className="glass-input" value={newLevel} onChange={e => setNewLevel(e.target.value)}>
                    {LEVELS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select className="glass-input" value={newStep} onChange={e => setNewStep(e.target.value)}>
                    {STEPS.map(s => <option key={s} value={s}>{s}. Adım</option>)}
                </select>
              </div>
              <button onClick={addWord} className="glass-btn primary"><Plus /> Kart Ekle</button>
            </div>
            <div className="words-list">
                {allLevelWords.map(c => (
                    <div key={c.id} className="word-item glass-panel">
                        <div className="word-info">
                            <span><span className="lvl-badge">Adım {c.step}</span> {c.tr} - {c.uz}</span>
                        </div>
                        <div className="admin-actions">
                            <button onClick={() => setEditingWord(c)} className="edit-btn">Düzenle</button>
                            <button onClick={() => deleteWord(c.id)} className="delete-btn"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
            </div>
          </>
        ) : (
          <div className="admin-subjects-section">
            <div className="add-word-form glass-panel">
              <input placeholder="Konu Başlığı" value={newSubTitle} onChange={e => setNewSubTitle(e.target.value)} className="glass-input" />
              <textarea placeholder="Konu Anlatımı" value={newSubContent} onChange={e => setNewSubContent(e.target.value)} className="glass-input" />
              <button onClick={addSubject} className="glass-btn primary"><Plus /> Konu Ekle</button>
            </div>

            <div className="subjects-list">
              {subjects.map(s => (
                <div key={s.id} className="subject-admin-card glass-panel">
                  <div className="sub-admin-header">
                    <h4>{s.title}</h4>
                    <button onClick={() => deleteSubject(s.id)} className="delete-btn"><Trash2 size={14}/></button>
                  </div>
                  
                  <div className="admin-questions-list">
                    {s.questions.map(q => (
                      <div key={q.id} className="q-admin-item">
                        <span>{q.text}</span>
                        <button onClick={() => deleteQuestion(s.id, q.id)} className="mini-del-btn">×</button>
                      </div>
                    ))}
                  </div>

                  {addingQTo === s.id ? (
                    <div className="add-q-form">
                      <input placeholder="Soru metni" value={newQText} onChange={e => setNewQText(e.target.value)} className="glass-input mini" />
                      <div className="options-grid-admin">
                        {newQOptions.map((opt, idx) => (
                          <input key={idx} placeholder={`Seçenek ${idx+1}`} value={opt} onChange={e => {
                            const newOpts = [...newQOptions];
                            newOpts[idx] = e.target.value;
                            setNewQOptions(newOpts);
                          }} className="glass-input mini" />
                        ))}
                      </div>
                      <input placeholder="Doğru Cevap (Seçenekteki metinle aynı olmalı)" value={newQCorrect} onChange={e => setNewQCorrect(e.target.value)} className="glass-input mini" />
                      <div className="q-form-btns">
                        <button onClick={addQuestion} className="glass-btn primary mini">Kaydet</button>
                        <button onClick={() => setAddingQTo(null)} className="glass-btn secondary mini">İptal</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAddingQTo(s.id)} className="glass-btn secondary mini"><Plus size={14}/> Soru/Beceri Ekle</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {editingWord && (
          <div className="edit-modal-overlay">
            <div className="edit-modal glass-panel">
              <h3>Kartı Düzenle</h3>
              <input value={editingWord.tr} onChange={e => setEditingWord({...editingWord, tr: e.target.value})} className="glass-input" placeholder="Türkçe" />
              <input value={editingWord.uz} onChange={e => setEditingWord({...editingWord, uz: e.target.value})} className="glass-input" placeholder="Özbekçe" />
              <textarea value={editingWord.example} onChange={e => setEditingWord({...editingWord, example: e.target.value})} className="glass-input" placeholder="Örnek Cümle" />
              <div className="modal-btns">
                <button onClick={updateWord} className="glass-btn primary mini">Güncelle</button>
                <button onClick={() => setEditingWord(null)} className="glass-btn secondary mini">İptal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } else if (view === 'game') {
    const stepKey = `${level}-${step}`;
    const isCompleted = completedSteps.includes(stepKey);
    viewContent = (
      <div className="view-container game-view">
        <header className="view-header">
          <button className="back-btn" onClick={() => setView('step-choice')}><ArrowLeft /></button>
          <div className="game-info">
            <span className="lvl-tag">{level} - {step}. Adım</span>
            <div className="sparkle-badge mini"><Sparkles size={14} fill="#fbbf24" /><span>{points}</span></div>
          </div>
          <button className="back-btn" onClick={() => resetProcess('step')}><RotateCcw size={18} /></button>
        </header>
        <div className="card-container">
          <AnimatePresence mode="wait">
            {loading ? (<motion.div key="l" className="loading-state"><Loader2 className="spinner" size={48} /></motion.div>) : 
             cards.length === 0 ? (
              <motion.div key="e" className="empty-state">
                <Sparkles size={64} fill="#FFD700" />
                <h2>{isCompleted ? "Adım Tamamlandı! ✅" : "Tebrikler! 🎉"}</h2>
                <p>{isCompleted ? "Bu adımı zaten bitirdin. Bir sonraki adıma geçebilirsin!" : "Bu adımı tamamladın. Şimdi adım sınavı zamanı!"}</p>
                {!isCompleted && <button className="glass-btn primary" onClick={() => generateQuiz('step')}>Adım Sınavını Başlat</button>}
                {isCompleted && <button className="glass-btn secondary" onClick={() => setView('step-choice')}>Diğer Adımlar</button>}
              </motion.div>
            ) : cards[0] && (
              <motion.div 
                key={cards[0].id} 
                className="swipe-card-wrapper" 
                drag="x" 
                dragConstraints={{ left: 0, right: 0 }} 
                onDragEnd={(e, { offset }) => { 
                  if (Math.abs(offset.x) > 100) handleSwipe(offset.x > 0 ? 'right' : 'left', cards[0].id); 
                }} 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <motion.div 
                  className="flashcard" 
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                  onClick={() => setFlipped(!flipped)}
                  style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d" }}
                >
                  <div className="card-front">
                    <h2>{cards[0].tr}</h2>
                    <motion.button 
                      className="speaker-btn" 
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); playAudio(e, cards[0].tr); }}
                    >
                      <Volume2 />
                    </motion.button>
                  </div>
                  <div className="card-back">
                    <h3>{cards[0].uz}</h3>
                    <div className="divider"></div>
                    <p className="example-text">{cards[0].example}</p>
                    <motion.button 
                      className="speaker-btn mini" 
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); playAudio(e, cards[0].example); }}
                    >
                      <Volume2 />
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {cards.length > 0 && (<div className="swipe-hints"><button className="hint-item skip" onClick={() => handleSwipe('left', cards[0].id)}><X /> Geç</button><button className="hint-item know" onClick={() => handleSwipe('right', cards[0].id)}><Check /> Öğrendim</button></div>)}
      </div>
    );
  } else if (view === 'quiz') {
    const q = quizQuestions[currentQuizIndex];
    viewContent = (
      <div className="view-container quiz-view">
        {q ? (
          <>
            <header className="quiz-header">
              <div className="quiz-progress-bar"><div className="progress-fill" style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}></div></div>
              <span>{currentQuizIndex + 1} / {quizQuestions.length}</span>
            </header>
            <h2 className="quiz-question-title">{q.phase === 3 ? "Yazınız:" : "Seçiniz:"}</h2>
            <div className="quiz-word-card glass-panel"><h1>{q.target}</h1></div>
            {q.phase === 3 ? (
              <div className="quiz-input-container">
                <input className="glass-input" value={quizInput} onChange={(e) => setQuizInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQuizAnswer()} autoFocus />
                <button className="glass-btn primary" onClick={() => handleQuizAnswer()}>Tamam</button>
              </div>
            ) : (
              <div className="quiz-options-grid">{q.options?.map((opt, i) => (<button key={i} className="quiz-option-btn glass-panel" onClick={() => handleQuizAnswer(opt)}>{opt}</button>))}</div>
            )}
          </>
        ) : <Loader2 className="spinner" />}
      </div>
    );
  } else if (view === 'quiz-result') {
    const isSuccess = quizStatus === 'success';
    viewContent = (
      <div className="view-container quiz-result-view">
        {isSuccess ? <Sparkles size={80} fill="#FFD700" /> : <div className="fail-icon glass-panel"><X size={60} color="#ef4444" /></div>}
        <h1>{isSuccess ? (quizType === 'level' ? `${level} Seviyesi Bitti! 🎓` : "Adım Sınavı Bitti! ✅") : "Sınav Başarısız! ❌"}</h1>
        <p>{quizQuestions.length} soruda {quizScore} doğru.</p>
        <p className="result-desc">
          {isSuccess 
            ? (quizType === 'level' ? "Tüm adımları başarıyla tamamladın ve bir sonraki seviyeyi açtın!" : "Tebrikler! Bu adımı başarıyla tamamladın.")
            : `Sınavı geçmek için en az %${quizType === 'level' ? '95' : '90'} başarı gerekiyor. Lütfen tekrar çalışın!`
          }
        </p>
        <button className={`glass-btn ${isSuccess ? 'primary' : 'danger'}`} onClick={() => setView('step-choice')}>
          {isSuccess ? "Devam Et" : "Tekrar Dene"}
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="view-wrapper"
        >
          {viewContent}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
