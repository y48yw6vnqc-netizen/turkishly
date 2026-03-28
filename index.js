require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const axios = require('axios');
const { OpenAI } = require('openai');
const express = require('express');
const cors = require('cors');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
console.log("-----------------------------------------");
console.log("🚀 SUNUCU BAŞLATIYOR...");
console.log("📂 Mevcut Klasör (CWD):", process.cwd());
console.log("🆔 BOT_TOKEN yüklü mü?:", process.env.BOT_TOKEN ? "Evet (Karakter Sayısı: " + process.env.BOT_TOKEN.length + ")" : "HAYIR! (Kritik Eksik)");
console.log("🔑 GROQ_API_KEY yüklü mü?:", process.env.GROQ_API_KEY ? "Evet" : "Hayır");
console.log("🌐 MINI_APP_URL:", process.env.MINI_APP_URL || "Tanımlanmamış!");
console.log("🐙 GITHUB_TOKEN (Gist DB):", process.env.GITHUB_TOKEN ? "Evet, Veri Yedeklenecek!" : "HAYIR (Geçici Hafıza)");
console.log("-----------------------------------------");
const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Yakalanamayan Promise Hatası:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Yakalanamayan İstisna Hatası:', err);
});

// DOSYA YOLLARI
const USERS_FILE = path.join(__dirname, 'users.json');
const WORDS_FILE = path.join(__dirname, 'words.json');
const SUBJECTS_FILE = path.join(__dirname, 'subjects.json');

// ====================================================
// =        GITHUB GIST VERİTABANI YEDEK SİSTEMİ      =
// ====================================================
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
let gistSyncTimeout = null;

async function syncToGist() {
    if (!GITHUB_TOKEN) return;
    try {
        let gistId = process.env.GIST_ID;
        const files = {
            "users.json": { content: fs.existsSync(USERS_FILE) ? fs.readFileSync(USERS_FILE, 'utf-8') : "{}" },
            "words.json": { content: fs.existsSync(WORDS_FILE) ? fs.readFileSync(WORDS_FILE, 'utf-8') : "[]" },
            "subjects.json": { content: fs.existsSync(SUBJECTS_FILE) ? fs.readFileSync(SUBJECTS_FILE, 'utf-8') : "[]" },
            "pdfs.json": { content: fs.existsSync(PDFS_FILE) ? fs.readFileSync(PDFS_FILE, 'utf-8') : "{}" }
        };

        if (gistId) {
            await axios.patch(`https://api.github.com/gists/${gistId}`, { files }, {
                headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }
            });
            console.log("💾 [GIST DB] Veriler GitHub'a otomatik yedeklendi.");
        } else {
            // İlk kez açılıyorsa Gist oluştur
            const res = await axios.post(`https://api.github.com/gists`, {
                description: "Turkishly Bot (Gizli Veritabanı Yedekleri)",
                public: false,
                files
            }, {
                headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }
            });
            gistId = res.data.id;
            fs.appendFileSync(path.join(__dirname, '.env'), `\nGIST_ID=${gistId}\n`);
            process.env.GIST_ID = gistId; // Bellek içi güncelle
            console.log(`🎉 [GIST DB] İLK VERİTABANI HAZIR! GIST_ID (.env) eklendi: ${gistId}`);
        }
    } catch(err) {
        console.error("❌ Gist Yedekleme Hatası:", err.response ? err.response.data : err.message);
    }
}

function triggerGistSync() {
    if (gistSyncTimeout) clearTimeout(gistSyncTimeout);
    // 5 Saniye içinde toplu işlem varsa biriktir, tek seferde GitHub'a gönder (Limiti aşmamak için)
    gistSyncTimeout = setTimeout(syncToGist, 5000); 
}

async function restoreFromGist() {
    const gistId = process.env.GIST_ID;
    if (gistId && GITHUB_TOKEN) {
        try {
            console.log("📥 [GIST DB] İnternet hafızasından veriler yerel diske kurtarılıyor...");
            const res = await axios.get(`https://api.github.com/gists/${gistId}`, {
                headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }
            });
            if (res.data.files["users.json"]) fs.writeFileSync(USERS_FILE, res.data.files["users.json"].content);
            if (res.data.files["words.json"]) fs.writeFileSync(WORDS_FILE, res.data.files["words.json"].content);
            if (res.data.files["subjects.json"]) fs.writeFileSync(SUBJECTS_FILE, res.data.files["subjects.json"].content);
            if (res.data.files["pdfs.json"]) fs.writeFileSync(PDFS_FILE, res.data.files["pdfs.json"].content);
            console.log("✅ [GIST DB] Render/Makinadaki tüm silinen veriler hafızaya eksiksiz onarıldı!");
        } catch(err) {
            console.error("❌ Gist Geri Yükleme Hatası:", err.message);
        }
    }
}
// ====================================================

// --------- MINİ APP API SUNUCUSU (EXPRESS) ---------
const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.url}`);
    }
    next();
});

app.post('/api/bot-webhook', (req, res) => {
    console.log("📥 Bot Webhook'u tetiklendi...");
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// STANDART DOSYA İŞLEMLERİ 
function readUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); } catch (e) { return {}; }
}
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    triggerGistSync(); // YEDEKLE
}

function readWords() {
    try { return JSON.parse(fs.readFileSync(WORDS_FILE, 'utf-8')); } catch (e) { return []; }
}
function saveWords(words) {
    fs.writeFileSync(WORDS_FILE, JSON.stringify(words, null, 2));
    triggerGistSync(); // YEDEKLE
}

function readSubjects() {
    try { return JSON.parse(fs.readFileSync(SUBJECTS_FILE, 'utf-8')); } catch (e) { return []; }
}
function saveSubjects(subs) {
    fs.writeFileSync(SUBJECTS_FILE, JSON.stringify(subs, null, 2));
    triggerGistSync(); // YEDEKLE
}

const ensureUser = (userId, chatId = null) => {
    let users = readUsers();
    if (!users[userId]) {
        users[userId] = { 
            learnedWordIds: [], 
            stars: 0, 
            levelPoints: {}, 
            completedSteps: [], 
            completedLevels: [],
            completedSubjects: [],
            chatId: chatId 
        };
        saveUsers(users);
    } else {
        let changed = false;
        if (users[userId].levelPoints === undefined) { users[userId].levelPoints = {}; changed = true; }
        if (users[userId].completedSteps === undefined) { users[userId].completedSteps = []; changed = true; }
        if (users[userId].completedLevels === undefined) { users[userId].completedLevels = []; changed = true; }
        if (users[userId].completedSubjects === undefined) { users[userId].completedSubjects = []; changed = true; }
        if (chatId && !users[userId].chatId) { users[userId].chatId = chatId; changed = true; }
        if (changed) saveUsers(users);
    }
    return users[userId];
};

app.get('/api/progress/:userId', (req, res) => {
    const user = ensureUser(req.params.userId);
    const totalPoints = Object.values(user.levelPoints || {}).reduce((a, b) => a + b, 0);
    res.json({ ...user, points: totalPoints });
});

app.post('/api/progress', (req, res) => {
    const { userId, wordId } = req.body;
    const users = readUsers();
    if (!users[userId].learnedWordIds.includes(wordId)) {
        users[userId].learnedWordIds.push(wordId);
        users[userId].stars += 1;
        saveUsers(users);
    }
    const totalPoints = Object.values(users[userId].levelPoints || {}).reduce((a, b) => a + b, 0);
    res.json({ ...users[userId], points: totalPoints });
});

app.post('/api/complete-step', (req, res) => {
    const { userId, level, step, score, totalQuestions } = req.body;
    ensureUser(userId);
    const users = readUsers();
    const stepKey = `${level}-${step}`;
    const ratio = score / (totalQuestions || 1);
    const finalScore = Math.round(ratio * 20);
    if (!users[userId].completedSteps.includes(stepKey)) users[userId].completedSteps.push(stepKey);
    users[userId].levelPoints[stepKey] = finalScore;
    saveUsers(users);
    const totalPoints = Object.values(users[userId].levelPoints || {}).reduce((a, b) => a + b, 0);
    res.json({ ...users[userId], points: totalPoints });
});

app.post('/api/complete-level', (req, res) => {
    const { userId, level, score, totalQuestions } = req.body;
    ensureUser(userId);
    let users = readUsers();
    const words = readWords();
    const ratio = score / (totalQuestions || 1);
    const finalLevelScore = Math.round(ratio * 20);
    if (!users[userId].completedLevels.includes(level)) users[userId].completedLevels.push(level);
    users[userId].levelPoints[`${level}-Level`] = finalLevelScore;
    words.filter(w => w.level === level).forEach(w => {
        if (!users[userId].learnedWordIds.includes(w.id)) {
            users[userId].learnedWordIds.push(w.id);
            users[userId].stars += 1;
        }
    });
    Array.from({ length: 20 }, (_, i) => i + 1).forEach(s => {
        const skey = `${level}-${s}`;
        if (!users[userId].completedSteps.includes(skey)) users[userId].completedSteps.push(skey);
        if (!users[userId].levelPoints[skey] || users[userId].levelPoints[skey] < 20) users[userId].levelPoints[skey] = 20;
    });
    saveUsers(users);
    const totalPoints = Object.values(users[userId].levelPoints || {}).reduce((a, b) => a + b, 0);
    res.json({ ...users[userId], points: totalPoints });
});

app.post('/api/reset-step', (req, res) => {
    const { userId, level, step, resetType } = req.body;
    const users = readUsers();
    const words = readWords();
    if (resetType === 'level') {
        const levelWordIds = words.filter(w => w.level === level).map(w => w.id);
        const before = users[userId].learnedWordIds.length;
        users[userId].learnedWordIds = users[userId].learnedWordIds.filter(id => !levelWordIds.includes(id));
        users[userId].stars = Math.max(0, users[userId].stars - (before - users[userId].learnedWordIds.length));
        users[userId].completedLevels = users[userId].completedLevels.filter(l => l !== level);
        users[userId].completedSteps = users[userId].completedSteps.filter(s => !s.startsWith(`${level}-`));
        delete users[userId].levelPoints[`${level}-Level`];
        Array.from({ length: 20 }, (_, i) => i + 1).forEach(s => delete users[userId].levelPoints[`${level}-${s}`]);
    } else {
        const stepKey = `${level}-${step}`;
        const stepWordIds = words.filter(w => w.level === level && parseInt(w.step) === parseInt(step)).map(w => w.id);
        const before = users[userId].learnedWordIds.length;
        users[userId].learnedWordIds = users[userId].learnedWordIds.filter(id => !stepWordIds.includes(id));
        users[userId].stars = Math.max(0, users[userId].stars - (before - users[userId].learnedWordIds.length));
        users[userId].completedSteps = users[userId].completedSteps.filter(s => s !== stepKey);
        delete users[userId].levelPoints[stepKey];
    }
    saveUsers(users);
    const totalPoints = Object.values(users[userId].levelPoints || {}).reduce((a, b) => a + b, 0);
    res.json({ ...users[userId], points: totalPoints });
});

const PDFS_FILE = path.join(__dirname, 'pdfs.json');
console.log("📍 PDF Dosyası Yolu:", PDFS_FILE);
function readPdfs() {
    try { 
        const data = JSON.parse(fs.readFileSync(PDFS_FILE, 'utf-8')); 
        console.log("📖 PDF Veritabanı Okundu (Kayit Sayisi):", Object.keys(data).length);
        return data;
    } catch(e) { 
        console.error("❌ PDF Okuma Hatası:", e.message);
        return {}; 
    }
}
function savePdfs(pdfs) {
    fs.writeFileSync(PDFS_FILE, JSON.stringify(pdfs, null, 2));
    if (typeof triggerGistSync === 'function') triggerGistSync(); // YEDEKLE
}
app.get('/api/words', (req, res) => {
    const { level, step } = req.query;
    let words = readWords();
    if (level && level !== 'All' && level !== 'null') words = words.filter(w => w.level === level);
    if (step && step !== 'All' && step !== 'null' && step !== 'LevelQuiz') words = words.filter(w => parseInt(w.step) === parseInt(step));
    res.json(words);
});

app.post('/api/words', (req, res) => {
    const { tr, uz, example, level, step, password } = req.body;
    if (password !== 'admin123') return res.status(403).json({ error: "Yetkisiz!" });
    const words = readWords();
    const newWord = { id: Math.random().toString(36).substr(2, 9), tr, uz, example: example || "", level, step: parseInt(step), createdAt: new Date().toISOString() };
    words.unshift(newWord);
    saveWords(words);
    res.json(newWord);
});

app.delete('/api/words/:id', (req, res) => {
    if (req.query.password !== 'admin123') return res.status(403).json({ error: "Yetkisiz!" });
    let words = readWords();
    words = words.filter(w => w.id !== req.params.id);
    saveWords(words);
    res.json({ success: true });
});

app.put('/api/words/:id', (req, res) => {
    const { tr, uz, example, level, step, password } = req.body;
    if (password !== 'admin123') return res.status(403).json({ error: "Yetkisiz!" });
    let words = readWords();
    const index = words.findIndex(w => w.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Kelime bulunamadı!" });
    
    words[index] = { ...words[index], tr, uz, example: example || "", level, step: parseInt(step) };
    saveWords(words);
    res.json(words[index]);
});

app.get('/api/subjects', (req, res) => {
    res.json(readSubjects());
});

app.post('/api/subjects', (req, res) => {
    const { title, content, password } = req.body;
    if (password !== 'admin123') return res.status(403).json({ error: "Yetkisiz!" });
    const subs = readSubjects();
    const newSub = { id: Math.random().toString(36).substr(2, 9), title, content, questions: [], createdAt: new Date().toISOString() };
    subs.unshift(newSub);
    saveSubjects(subs);
    res.json(newSub);
});

app.delete('/api/subjects/:id', (req, res) => {
    if (req.query.password !== 'admin123') return res.status(403).json({ error: "Yetkisiz!" });
    let subs = readSubjects();
    subs = subs.filter(s => s.id !== req.params.id);
    saveSubjects(subs);
    res.json({ success: true });
});

app.post('/api/subjects/:id/questions', (req, res) => {
    const { text, options, correct, password } = req.body;
    if (password !== 'admin123') return res.status(403).json({ error: "Yetkisiz!" });
    let subs = readSubjects();
    const sub = subs.find(s => s.id === req.params.id);
    if (!sub) return res.status(404).json({ error: "Konu bulunamadı!" });
    const newQ = { id: Math.random().toString(36).substr(2, 9), text, options, correct };
    sub.questions.push(newQ);
    saveSubjects(subs);
    res.json(newQ);
});

app.delete('/api/subjects/:id/questions/:qid', (req, res) => {
    if (req.query.password !== 'admin123') return res.status(403).json({ error: "Yetkisiz!" });
    let subs = readSubjects();
    const sub = subs.find(s => s.id === req.params.id);
    if (!sub) return res.status(404).json({ error: "Konu bulunamadı!" });
    sub.questions = sub.questions.filter(q => q.id !== req.params.qid);
    saveSubjects(subs);
    res.json({ success: true });
});

app.post('/api/complete-subject', (req, res) => {
    const { userId, subjectId, score, total } = req.body;
    ensureUser(userId);
    const users = readUsers();
    if (!users[userId].completedSubjects.includes(subjectId)) {
        users[userId].completedSubjects.push(subjectId);
        users[userId].levelPoints[`Subject-${subjectId}`] = Math.round((score / total) * 50); 
        saveUsers(users);
    }
    const totalPoints = Object.values(users[userId].levelPoints || {}).reduce((a, b) => a + b, 0);
    res.json({ ...users[userId], points: totalPoints });
});

const distPath = path.resolve(process.cwd(), 'mini-app', 'dist');

app.get('/api/ping', (req, res) => res.json({ 
    status: "ok", 
    time: new Date().toISOString(), 
    env: { bot: !!process.env.BOT_TOKEN, groq: !!process.env.GROQ_API_KEY, gist: !!process.env.GITHUB_TOKEN },
    distExists: fs.existsSync(distPath)
}));

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const filePath = path.join(distPath, req.path);
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send(`Hata: Uygulama klasörü bulunamadı veya boş. (Konum: ${distPath})`);
});

bot.catch((err, ctx) => {
    console.error(`❌ Telegraf Hatası (${ctx.updateType}):`, err.message);
});

async function startBot() {
    try {
        console.log("🤖 Bot başlatılıyor...");
        await bot.telegram.getMe(); 
        console.log("✅ Token geçerli, bot girişi yapıldı.");
        const miniAppUrl = (process.env.MINI_APP_URL || '').trim().replace(/\/+$/, '');
        if (miniAppUrl) {
            await bot.telegram.setChatMenuButton({
                menu_button: { type: 'web_app', text: '🚀 Kelime Avı', web_app: { url: miniAppUrl } }
            });
            console.log("📍 Menü butonu URL'si set edildi:", miniAppUrl);
            await bot.telegram.setWebhook(`${miniAppUrl}/api/bot-webhook`);
            console.log(`🚀 BOT WEBHOOK İLE YAYINDA: ${miniAppUrl}/api/bot-webhook`);
        } else {
            await bot.telegram.deleteWebhook();
            bot.launch();
            console.log("🚀 BOT ŞU AN YAYINDA VE POLLING YAPIYOR!");
        }
    } catch (e) {
        console.error("❌ BOT BAŞLATILAMADI (KRİTİK HATA):", e.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 API Sunucusu Port ${PORT}'de Başlatıldı!`);
    await restoreFromGist(); // VERİYİ GITHUB'DAN KURTAR
    if (!process.env.GIST_ID && process.env.GITHUB_TOKEN) {
        console.log("📥 [GIST DB] İlk Gist veritabanı oluşturuluyor...");
        await syncToGist(); 
    }
    startBot();
});

// --- ZORUNLU KANAL ABONELİĞİ (FORCE SUBSCRIPTION) KONTROLÜ ---
const REQUIRED_CHANNELS = ["@unity4_academy", "@turkishly"]; // Bekleyen kanallar burada

bot.use(async (ctx, next) => {
    // Sadece özel mesajlaşmalarda kontrol et
    if (ctx.chat && ctx.chat.type === 'private') {
        let missingChannels = [];

        for (const channel of REQUIRED_CHANNELS) {
            try {
                const member = await ctx.telegram.getChatMember(channel, ctx.from.id);
                // Eğer üye değilse (left, kicked) listeye ekle
                if (!['creator', 'administrator', 'member', 'restricted'].includes(member.status)) {
                    missingChannels.push(channel);
                }
            } catch (error) {
                console.error(`❌ ${channel} üyelik kontrolünde hata (Bot kanalda admin mi?):`, error.message);
                missingChannels.push(channel); // Admin değilse veya test ortamıysa güvenlik riski için üye değil say
            }
        }
        
        // Eğer abone olunmamış kanallar varsa engelle ve butonları dinamik oluştur
        if (missingChannels.length > 0) {
            const buttons = missingChannels.map(ch => 
                [{ text: `📣 ${ch} Kanalına Katıl`, url: `https://t.me/${ch.replace('@', '')}` }]
            );

            return ctx.reply(
                "🛑 <b>Dur bakalım! Yasin Hoca'nın derslerine katılmadan önce küçük bir şartım var.</b>\n\n" +
                `Ücretsiz Kelime Avı uygulamasını ve benimle sohbet edebilme özelliğini kullanmak için ` +
                `lütfen önce aşağıdaki resmi kanallarımıza abone ol.\n\nKanallara katılıp tekrar /start yazarak başlayabilirsin!`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: buttons
                    }
                }
            );
        }
    }
    
    // Tüm kanallara aboneyse devam et
    return next();
});

bot.command('post', async (ctx) => {
    if (ctx.from.id.toString() === "6429306893" || ctx.from.id.toString() === "7360824809" || ctx.from.username === "k_yasin") { 
        const topic = ctx.message.text.split(' ').slice(1).join(' '); 
        await ctx.reply(`🚀 "${topic || 'Genel Türkçe'}" konusu kanala gönderiliyor...`);
        await postToChannel(topic);
    } else {
        ctx.reply("❌ Yetkiniz yok!");
    }
});

bot.start(async (ctx) => {
    ensureUser('guest_user', ctx.chat.id); 
    const miniAppUrl = (process.env.MINI_APP_URL || 'https://holes-green-euro-heavily.trycloudflare.com').trim().replace(/\/+$/, '');
    try {
        await ctx.telegram.setChatMenuButton({ menu_button: { type: 'web_app', text: '🚀 Kelime Avı', web_app: { url: `${miniAppUrl}?uid=${ctx.from.id}` } } });
    } catch (e) {}
    ctx.reply(`Hoş Geldin ${ctx.from.first_name}! 👋\n\nBen Yasin Hoca! İstanbul Türkçesini mükemmel şekilde konuşan, son derece kültürlü ve disiplinli bir Türkçe öğretmeniyim. Dersimize hazırsan aşağıdaki menüden çalışmayı başlatabilirsin.`, 
    Markup.keyboard([
        [Markup.button.webApp("🚀 Mini Uygulama (Kelime Avı)", `${miniAppUrl}?uid=${ctx.from.id}`)],
        ["📚 Eğitim Kitapları"],
        ["🎙 Telaffuz Pratiği Yap", "☕ Serbest Sohbet Et"]
    ]).resize());
});


async function postToChannel(topic = "", fileId = null, fileType = "photo") {
    const channelId = "@turkishly"; // Sadece @turkishly kanalına gönderilecek şekilde ayarlandı

    try {
        const selectedTopic = topic || "Genel Türkçe Dil Bilgisi";
        // Kullanıcı "detaylı" istiyorsa kilitleri aç
        const isDetailed = /detaylı|uzun|geniş|açıklayıcı|anlat|bilgi|nedir|öğret|notlar/i.test(selectedTopic);
        
        // --- 1. ÖZBEKÇE ÖĞRETMEN MANTIĞI ---
        const isUzbek = /özbekçe|ozbekce|uzbek|o'zbek/i.test(selectedTopic);
        let systemPrompt = "";

        if (isUzbek) {
            systemPrompt = `Sen anadili Özbekçe olan, mükemmel bir Türkçe öğretmenisin. Özbek öğrencilerine Türkçeyi en anlaşılır şekilde, iki dil arasındaki benzerlikleri ve farklılıkları da göstererek (ve gramer kurallarını Özbek dilindeki mantıkla kıyaslayarak) öğretiyorsun. 
Konuyu *Özbekçe* (Latin alfabesiyle) anlatmalısın. Sadece Türkçe kelime ve örnekleri verirken Türkçe kullan. Çok samimi, sıcak ve öğrencilerini teşvik edici bir öğretmen tonu kullan. 
Gönderilerin şu şık formatla başlamalı:
🇺🇿🇹🇷 <b>Turk Tili Darslari</b>

🌟 <b>[Telegram Kanalidagi Mavzu]</b> 🌟

(İçeriği Özbekçe ve son derece kaliteli, HTML (<b>, <i>) etiketli metinlerle hazırla. Çarpıcı 2-3 hashtag ekle.)`;
        } else {
            // Yasin Hoca (Türkçe) Konsepti
            systemPrompt = `Sen Yasin Hoca'sın. Her zaman şu şık formatla başla:
🏛️ <b>Yasin Hoca'dan Türkçe Notları</b>

🌟 <b>[Konu Başlığı]</b> 🌟

İçerik kuralları:
1. Son derece zarif, profesyonel ve yüksek seviyede bir 'kanal vizyonu' olan üslup kullan. "Değerli öğrencilerim," veya "Kıymetli arkadaşlar," gibi saygın bir hitapla başla.
2. ASLA ama ASLA Türkçe dışında bir kelime veya Latin alfabesi dışı karakter kullanma. Metin %100 temiz, duru ve hatasız bir İstanbul Türkçesi olmalıdır.
3. Emojileri ciddi oranda azalt. Sadece başlıklar veya çok önemli vurgular için sembolik ve seçkin bir şekilde kullan. Her cümlede emoji olmasın.
4. Bilgiyi derin, akademik bir altyapıyla ama akıcı ve ilgi çekici bir üslupla sun. Başka hiçbir kanalda bulunmayan bir kalite ve derinlik hissi ver.
5. Metin düzeni tertemiz ve dengeli olmalı. HTML (<b>, <i>, <u>) kullanarak profesyonel bir tipografi oluştur. En sona 2-3 hashtag ekle.`;
        }

        // --- 2. ANKET (POLL) GÖNDERME KONTROLÜ ---
        const wantsPoll = /anket|quiz|test/i.test(selectedTopic);

        // Ana Post'u Oluştur
        const comp = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Öğrencilerine şu konuyu anlat: ${selectedTopic}` }
            ],
            temperature: 0.8
        });
        const text = comp.choices[0].message.content;

        // Post'u Kanala Gönder
        if (fileId) {
            if (isDetailed || text.length > 1024) {
               if (fileType === "document") await bot.telegram.sendDocument(channelId, fileId);
               else await bot.telegram.sendPhoto(channelId, fileId);
               await bot.telegram.sendMessage(channelId, text, { parse_mode: 'HTML' });
            } else {
               if (fileType === "document") await bot.telegram.sendDocument(channelId, fileId, { caption: text, parse_mode: 'HTML' });
               else await bot.telegram.sendPhoto(channelId, fileId, { caption: text, parse_mode: 'HTML' });
            }
        } else {
            await bot.telegram.sendMessage(channelId, text, { parse_mode: 'HTML' });
        }
        console.log(`✅ Kanal postu başarıyla paylaşıldı! (Özbekçe: ${isUzbek ? "Evet" : "Hayır"})`);

        // --- 3. ANKET/TEST GÖNDERME (YAPAY ZEKA İLE JSON) ---
        if (wantsPoll) {
            console.log("📝 Kanala anket/quiz hazırlanıyor...");
            const pollComp = await openai.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                messages: [
                    { 
                        role: "system", 
                        content: `Sen bir Telegram anket (quiz) oluşturucusun. Kullanıcının işlediği ve anlattığı bu Türkçe dilbilgisi konusunu test etmek için ÇOK ZEKİ 1 soruluk bir quiz hazırla. Çıktı SADECE geçerli bir JSON objesi olmalıdır.
JSON Şablonu:
{
  "question": "Soru metni (en fazla 250 karakter)",
  "options": ["A şıkkı metni", "B şıkkı metni", "C şıkkı metni", "D şıkkı metni"],
  "correct_option_id": 0, // Bu rakam 0 (A şıkkı), 1 (B şıkkı), 2 (C şıkkı), 3 (D şıkkı) doğruysa ona göre verilir.
  "explanation": "Öğrenci yanlış cevaplarsa Telegram'da havaya kalkan ufak bilgi (190 karakteri ASLA aşma!)"
}`
                    },
                    { 
                        role: "user", 
                        content: `Konumuz: ${selectedTopic}. Öğrencilere bu yönde bir mini sınav ver. 
DİL UYARISI: Eğer üstteki konu ibaresinde 'Özbekçe' falan yazıyorsa, Quizin sorusunu ve explanation (açıklamasını) MUTLAKA Özbekçe (Latin alfabesiyle) hazırla! Fakat şıklar Türkçe olsun ki Türkçe test edilsin.` 
                    }
                ],
                temperature: 0.5
            });

            const pollData = JSON.parse(pollComp.choices[0].message.content);
            
            // Telegram Quiz (Anket) Api İle Gönder (Soru için bot.telegram.sendPoll çağrılır)
            await bot.telegram.sendPoll(channelId, pollData.question, pollData.options, {
                type: 'quiz',
                correct_option_id: pollData.correct_option_id,
                explanation: pollData.explanation
            });
            console.log("✅ Anket kanala gönderildi!");
        }
    } catch (e) {
        console.error("❌ Kanal post/anket hatası:", e.message);
    }
}

// FOTOĞRAFLI YADA BELGELİ POST / PDF EKLEME KOMUTU
bot.on(['photo', 'document'], async (ctx) => {
    if (ctx.from.id.toString() === "6429306893" || ctx.from.id.toString() === "7360824809" || ctx.from.username === "k_yasin") {
        let topic = ctx.message.caption || "";
        
        let fileId;
        let type = "photo";

        if (ctx.message.photo) {
            fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            type = "photo";
        } else if (ctx.message.document) {
            // Check if it's actually an image pretending to be a document or a PDF
            fileId = ctx.message.document.file_id;
            type = "document";
        } else {
            return ctx.reply("❌ Lütfen sadece fotoğraf veya belge gönderin!");
        }

        // --- PDF EKLEME (VERİTABANINA) ---
        // Kullanım: `/addpdf istanbul ders a1`
        if (topic.trim().toLowerCase().startsWith('/addpdf') && type === "document") {
            const args = topic.trim().split(' ').filter(String).slice(1);
            if (args.length !== 3) {
                 return ctx.reply("❌ Hatalı kullanım! Lütfen şu formatta ayarlayın:\nPDF'i atarken açıklama kısmına yazın: `/addpdf <kitap:istanbul|yediiklim> <tür:ders|calisma> <seviye:a1|a2|b1|b2|c1>`", { parse_mode: "Markdown" });
            }
            const [book, bType, level] = args.map(a => a.toLowerCase());
            const key = `${book}_${bType}_${level}`;
            const pdfs = readPdfs();
            pdfs[key] = fileId;
            console.log("📝 PDF Kaydediliyor - Anahtar:", key, "ID:", fileId);
            savePdfs(pdfs);
            return ctx.reply(`✅ Harika! PDF dosyası başarıyla Telegram altyapısı ile veritabanına kaydedildi.\n\n📚 **Sistem Kaydı:** ${key}\nÖğrenciler menüden bu PDF'i anında 1 saniyede ücretsiz indirebilir.`);
        }

        // --- NORMAL /POST (KANALA YAYINLAMA) ---
        let finalTopic = topic.replace(/^\/post\s*/i, '').trim() || "Genel Türkçe Dil Bilgisi";
        await ctx.reply(`📸 Görseliniz/Dökümanınız alındı! "${finalTopic}" konusu özel ders tadında hazırlanıp sadece @turkishly kanalına gönderiliyor...`);
        await postToChannel(finalTopic, fileId, type);
    } else {
        ctx.reply("❌ Post hazırlama yetkiniz bulunmuyor.");
    }
});


bot.hears('🎙 Telaffuz Pratiği Yap', (ctx) => ctx.reply("Harika! Telaffuz yeteneklerini geliştirelim. Lütfen aşağıdaki cümleyi sesli olarak oku:\n🎤 'Bugün hava çok güzel!'"));
bot.hears('☕ Serbest Sohbet Et', (ctx) => ctx.reply("Serbest sohbet moduna geçtik. Seni dinliyorum; dilediğin konuda Türkçe olarak sohbet edebilirsin. 😊"));

// --- KİTAP MENÜSÜ VE BUTON İŞLEMLERİ ---
const BOOK_NAMES = { 'istanbul': 'Yeni İstanbul', 'yediiklim': 'Yedi İklim' };
const TYPE_NAMES = { 'ders': 'Ders Kitabı', 'calisma': 'Çalışma Kitabı' };
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];

bot.hears('📚 Eğitim Kitapları', async (ctx) => {
    await ctx.reply("📚 Lütfen bilgisayarınıza veya telefonunuza ücretsiz indirmek istediğiniz kitap serisini seçin:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📘 Yeni İstanbul", callback_data: `pdfbook_istanbul` }, { text: "📗 Yedi İklim", callback_data: `pdfbook_yediiklim` }]
            ]
        }
    });
});

bot.action(/pdfbook_(.+)/, async (ctx) => {
    const book = ctx.match[1];
    await ctx.editMessageText(`📚 **${BOOK_NAMES[book]}** serisini seçtin.\nLütfen indirmek istediğin kitabın türünü seç:`, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "📖 Ders Kitabı", callback_data: `pdftype_${book}_ders` }, { text: "✍️ Çalışma Kitabı", callback_data: `pdftype_${book}_calisma` }],
                [{ text: "🔙 Geri Dön", callback_data: "pdf_main_menu" }]
            ]
        }
    });
    ctx.answerCbQuery();
});

bot.action(/pdftype_(.+)_(.+)/, async (ctx) => {
    const book = ctx.match[1];
    const type = ctx.match[2];
    
    // Seviye butonlarını oluştur
    const levelButtons = LEVELS.map(lvl => ({ text: `📈 ${lvl.toUpperCase()}`, callback_data: `pdflevel_${book}_${type}_${lvl}` }));
    const keyboard = [];
    for (let i = 0; i < levelButtons.length; i += 2) {
        keyboard.push(levelButtons.slice(i, i + 2)); // Yan yana ikili yapmak için
    }
    keyboard.push([{ text: "🔙 Kitap Seçimine Dön", callback_data: "pdf_main_menu" }]);

    await ctx.editMessageText(`📚 Mükemmel! Lütfen **${BOOK_NAMES[book]} ${TYPE_NAMES[type]}** için son olarak seviyeni (kurunu) seç:`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
    });
    ctx.answerCbQuery();
});

bot.action(/pdflevel_(.+)_(.+)_(.+)/, async (ctx) => {
    const book = ctx.match[1];
    const type = ctx.match[2];
    const level = ctx.match[3];
    const key = `${book}_${type}_${level}`; // Örn: istanbul_ders_a1
    
    const pdfs = readPdfs();
    const fileId = pdfs[key];
    
    ctx.answerCbQuery();
    if (fileId) {
        await ctx.editMessageText(`📥 **${BOOK_NAMES[book]} - ${TYPE_NAMES[type]} (${level.toUpperCase()})** dosyası hazırlanıyor...\nLütfen Telegram sunucularının hızı nedeniyle birkaç saniye bekleyin.`, { parse_mode: "Markdown"});
        try {
            await ctx.telegram.sendDocument(ctx.chat.id, fileId, { caption: `📚 ${BOOK_NAMES[book]} - ${TYPE_NAMES[type]} (${level.toUpperCase()})\nİyi çalışmalar dilerim!` });
        } catch (e) {
             ctx.reply("❌ Dosya Telegram sunucusundan silinmiş veya bir hata oluştu. Lütfen Yasin Hoca'ya haber verin.");
        }
    } else {
        await ctx.reply("❌ Üzgünüm! Bu kitabın PDF'i henüz sisteme Yasin Hoca tarafından yüklenmemiştir. Lütfen yetkiliye bildirin veya daha sonra tekrar deneyin.");
    }
});

bot.action("pdf_main_menu", async (ctx) => {
    await ctx.editMessageText("📚 Lütfen bilgisayarınıza veya telefonunuza ücretsiz indirmek istediğiniz kitap serisini seçin:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📘 Yeni İstanbul", callback_data: `pdfbook_istanbul` }, { text: "📗 Yedi İklim", callback_data: `pdfbook_yediiklim` }]
            ]
        }
    });
    ctx.answerCbQuery();
});
const SYSTEM_PROMPT = `Sen "Yasin Hoca" adında, İstanbul Türkçesini mükemmel ve hatasız konuşan, TDK kurallarına harfiyen uyan kıdemli bir Türkçe öğretmenisin. 
Kuralların:
1. Hitabetin beyefendi bir öğretmen tonunda olmalı. Herkese "Sen" diye hitap etmelisin. 
2. Yazım ve imla kuralları konusunda kusursuz olmalısın. Asla yazım hatası yapma, noktalama işaretlerini doğru kullan.
3. Kesinlikle ve sadece %100 saf Türkçe konuşacaksın. Öğrenci hangi dilde yazarsa yazsın, cevabın her zaman sadece temiz bir Türkçe olmalıdır.
4. Cevaplarının içine asla ama asla yabancı dilde bir kelime (Örn: "cosa", "okay", "test" vb.) katma. Türkçeyi en saf ve İstanbul beyefendisi tarzıyla kullan.
5. Eğer öğrenci Türkçe dışında bir dil kullanırsa veya senden Türkçe dışında bir dilde konuşmanı isterse, onu kesin ve disiplinli bir dille uyar. Bu davranışın "Yasin Hoca" kurallarına aykırı olduğunu, aksi takdirde eksi puan alacağını ve durumun ceza ile sonuçlanacağını net bir şekilde hatırlat.
6. Senin amacın, öğrencinin sadece doğru ve kaliteli bir Türkçe maruz kalmasını sağlayarak onu geliştirmektir.`;

bot.on('voice', async (ctx) => {
    const mid = await ctx.reply('🎧 Yasin Hoca dinliyor...');
    try {
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const res = await axios({ url: link.href, responseType: 'stream' });
        const pathS = `./${ctx.message.voice.file_id}.ogg`;
        const writer = fs.createWriteStream(pathS);
        res.data.pipe(writer);
        await new Promise(r => writer.on('finish', r));
        const trans = await openai.audio.transcriptions.create({ file: fs.createReadStream(pathS), model: "whisper-large-v3", language: "tr" });
        const comp = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: trans.text }
            ],
            temperature: 0.1,
            top_p: 0.1
        });
        await ctx.telegram.editMessageText(ctx.chat.id, mid.message_id, null, `👨‍🏫 ${comp.choices[0].message.content}`);
        fs.unlinkSync(pathS);
    } catch (e) {
        console.error("❌ AI Hatası:", e.message);
        ctx.reply("❌ Bir hata oluştu!");
    }
});

bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const mid = await ctx.reply('🤔 Düşünüyorum...');
    try {
        const comp = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: ctx.message.text }
            ],
            temperature: 0.1,
            top_p: 0.1
        });
        ctx.telegram.editMessageText(ctx.chat.id, mid.message_id, null, `👨‍🏫 ${comp.choices[0].message.content}`);
    } catch (e) {
        console.error("❌ AI Hatası:", e.message);
        ctx.telegram.editMessageText(ctx.chat.id, mid.message_id, null, "❌ Üzgünüm, şu an bağlantıda bir sorun yaşıyorum. Lütfen biraz sonra tekrar dene.");
    }
});

// --- İNTERAKTİF SÖZLÜK (INLINE QUERY) ---
const dictionaryCache = {};

bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    
    // Eğer kişi henüz bir şey yazmadıysa veya tek harf yazdıysa bekle
    if (query.length < 2) {
        return ctx.answerInlineQuery([{
            type: 'article',
            id: 'info',
            title: '🇹🇷🇺🇿 Akıllı Çift Yönlü Sözlük',
            description: 'Çevirmek istediğiniz Türkçe veya Özbekçe kelimeyi yazın...',
            thumbnail_url: 'https://cdn-icons-png.flaticon.com/512/3233/3233483.png',
            input_message_content: { message_text: '💡 Sözlük kullanımı: Herhangi bir sohbette `@SeninBotunAdi kelime` yazarak bekleyiniz.', parse_mode: 'Markdown' }
        }]);
    }

    const cacheKey = query.toLowerCase();

    try {
        let resultData;

        // Önce kendi belleğimize (cache) bakıyoruz.
        if (dictionaryCache[cacheKey]) {
            resultData = dictionaryCache[cacheKey];
        } else {
            // Groq Yapay Zekadan Çift Yönlü Çeviri İste (JSON formatında)
            const comp = await openai.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                messages: [
                    { 
                        role: "system", 
                        content: `Sen akademik düzeyde uzman bir Türkolog ve çift dilli (Türkçe - Özbekçe) kıdemli bir sözlük editörüsün.
Görevin: Kullanıcının girdiği kelimenin hangi dilde (Türkçe mi Özbekçe mi) olduğunu tespit et ve diğer dile profesyonelce çevir.

Hata yapmaman gereken kritik noktalar:
1. Kesinlikle uydurma (hallucinative) kelime üretme. (Örn: "Saçma" -> "Bekvayt" gibi uydurma kelime ASLA kullanma!)
2. Doğru Örnekler: "Saçma" (TR) -> "Mantiqsiz / Safsata" (UZ), "Gelecek" (TR) -> "Kelajak" (UZ), "Kitap" (TR) -> "Kitob" (UZ).
3. Kelimenin türünü (İsim, fiil, sıfat vb.) mutlaka belirt.
4. Özbekçe çevirilerde sadece Özbek Türkçesi (Latin alfabesi) kullan.
5. "title" kısmına her zaman '[Kaynak Kelime] → [Hedef Karşılık]' şeklinde yaz.
6. Eğer kelimenin tam karşılığı yoksa "Tam karşılığı bulunamadı" de veya en yakın akademik anlamı ver.

JSON Şablonu:
{
  "title": "Kelime → Karşılığı (Tür)",
  "short_desc": "Temel karşılık ve kısa Özbekçe özet",
  "html_view": "🇹🇷 <b>[Türkçe]</b>\\n🇺🇿 <b>[Özbekçe]</b>\\n\\n📖 <b>Tür (Tur):</b> [Kelime Türü]\\n\\n🔍 <b>Anlamları (Ma'nolari):</b>\\n[Madde madde derin anlamlar]\\n\\n🔄 <b>Eş Anlamlılar (Sinonimlar):</b>\\n[Virgülle ayrılmış benzer kelimeler]\\n\\n✨ <b>Örnek Cümle (Misol):</b>\\n🇹🇷 <i>[Örnek cümle]</i>\\n🇺🇿 [Cümlenin çevirisi]\\n\\n<i>✍️ Yasin Hoca Lûgatı</i>"
}`
                    },
                    { role: "user", content: `Lütfen şu kelimeyi analiz et ve çevir: ${query}` }
                ],
                temperature: 0.1
            });

            resultData = JSON.parse(comp.choices[0].message.content);
            dictionaryCache[cacheKey] = resultData; // Öğrenilmiş kelimeyi belleğe at
        }

        // Telegram'a Listeli Yanıt Fırlat (Kişinin klavyesinin üstünde pop-up çıkar)
        await ctx.answerInlineQuery([{
            type: 'article',
            id: cacheKey,
            title: `✨ ${resultData.title}`,
            description: resultData.short_desc,
            thumbnail_url: 'https://cdn-icons-png.flaticon.com/512/3362/3362635.png',
            input_message_content: {
                message_text: `🏛️ <b>Kapsamlı Yasin Hoca Lûgatı</b>\n\n${resultData.html_view}`,
                parse_mode: 'HTML'
            }
        }], { cache_time: 86400 }); // Aynı aramayı Telegram 1 günlüğüne hatırlasın

    } catch (error) {
         console.error("❌ Inline query hatası:", error.message);
         try { await ctx.answerInlineQuery([]); } catch(e) {}
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
