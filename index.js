require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const axios = require('axios');
const { OpenAI } = require('openai');
const express = require('express');
const cors = require('cors');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
console.log("Groq API Key yüklendi mi?:", process.env.GROQ_API_KEY ? "Evet (..." + process.env.GROQ_API_KEY.slice(-5) + ")" : "Hayır");

// --------- MINİ APP API SUNUCUSU (EXPRESS) ---------
const app = express();
app.use(cors());
app.use(express.json());

// API Request Logger for debugging
app.use('/api', (req, res, next) => {
    const uid = req.params.userId || req.body?.userId || 'unknown';
    console.log(`[API] ${req.method} ${req.url} - User: ${uid}`);
    next();
});

// WEBHOOK DESTEĞİ (EN ÜSTTE)
app.post('/api/bot-webhook', (req, res) => {
    console.log("📥 Bot Webhook'u tetiklendi...");
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

const USERS_FILE = path.join(__dirname, 'users.json');

function readUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); } catch (e) { return {}; }
}
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
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
    [1, 2, 3, 4, 5].forEach(s => {
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
        [1, 2, 3, 4, 5].forEach(s => delete users[userId].levelPoints[`${level}-${s}`]);
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

const WORDS_FILE = path.join(__dirname, 'words.json');
function readWords() {
    try { return JSON.parse(fs.readFileSync(WORDS_FILE, 'utf-8')); } catch (e) { return []; }
}
function saveWords(words) {
    fs.writeFileSync(WORDS_FILE, JSON.stringify(words, null, 2));
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

// --------- KONULAR VE BECERİLER API ---------
const SUBJECTS_FILE = path.join(__dirname, 'subjects.json');
function readSubjects() {
    try { return JSON.parse(fs.readFileSync(SUBJECTS_FILE, 'utf-8')); } catch (e) { return []; }
}
function saveSubjects(subs) {
    fs.writeFileSync(SUBJECTS_FILE, JSON.stringify(subs, null, 2));
}

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
        // Bonus puan
        users[userId].levelPoints[`Subject-${subjectId}`] = Math.round((score / total) * 50); 
        saveUsers(users);
    }
    const totalPoints = Object.values(users[userId].levelPoints || {}).reduce((a, b) => a + b, 0);
    res.json({ ...users[userId], points: totalPoints });
});

// WEBHOOK YUKARIYA TAŞINDI
// --------- STATİK DOSYA SERVİSİ (ÜRETİM) ---------
const distPath = path.join(__dirname, 'mini-app', 'dist');

if (!fs.existsSync(distPath)) {
    console.warn(`⚠️ UYARI: Statik dosya klasörü bulunamadı: ${distPath}`);
}

app.use(express.static(distPath));

app.get('*', (req, res) => {
    // API isteklerini pas geç, diğerlerini index.html'e yönlendir
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "Endpoint not found" });
    
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Mini uygulama dosyaları henüz hazır değil veya derlenmemiş. Lütfen biraz bekleyip sayfayı yenileyin.");
    }
});

bot.catch((err, ctx) => {
    console.error(`❌ Telegraf Hatası (${ctx.updateType}):`, err.message);
});

async function startBot() {
    try {
        await bot.telegram.deleteWebhook();
        console.log("🧹 Eski Webhook temizlendi.");
        
        // Menü butonunu küresel olarak güncelle (yeni URL ile)
        const miniAppUrl = (process.env.MINI_APP_URL || '').replace(/\/+$/, '');
        if (miniAppUrl) {
            await bot.telegram.setChatMenuButton({
                menu_button: {
                    type: 'web_app',
                    text: '🚀 Kelime Avı',
                    web_app: { url: miniAppUrl } // No ctx.from.id here, as it's a global menu button
                }
            });
            console.log("📍 Menü butonu URL'si güncellendi:", miniAppUrl);
        }

        bot.launch();
        console.log("🚀 Bot Polling (Sürekli Kontrol) Modunda Başlatıldı!");
    } catch (e) {
        console.error("❌ Bot başlatma hatası:", e.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API Sunucusu Port ${PORT}'de Başlatıldı!`);
    startBot();
});

bot.command('post', async (ctx) => {
    if (ctx.from.id.toString() === "6429306893" || ctx.from.id.toString() === "7360824809" || ctx.from.username === "k_yasin") { // Yetkili ID'ler
        const topic = ctx.message.text.split(' ').slice(1).join(' '); // Komuttan sonraki metni al
        await ctx.reply(`🚀 "${topic || 'Genel Türkçe'}" konusu kanala gönderiliyor...`);
        await postToChannel(topic);
    } else {
        ctx.reply("❌ Yetkiniz yok!");
    }
});

bot.start(async (ctx) => {
    ensureUser('guest_user', ctx.chat.id); // 'guest_user' holds the chatId for current demo
    const miniAppUrl = (process.env.MINI_APP_URL || 'https://holes-green-euro-heavily.trycloudflare.com').replace(/\/+$/, '');
    try {
        await ctx.telegram.setChatMenuButton({ menu_button: { type: 'web_app', text: '🚀 Kelime Avı', web_app: { url: `${miniAppUrl}?uid=${ctx.from.id}` } } });
    } catch (e) {}
    ctx.reply(`Hoş Geldin ${ctx.from.first_name}! 👋\n\nBen Yasin Hoca! İstanbul Türkçesini mükemmel şekilde konuşan, son derece kültürlü ve disiplinli bir Türkçe öğretmeniyim. Dersimize hazırsan aşağıdaki menüden çalışmayı başlatabilirsin.`, 
    Markup.keyboard([
        [Markup.button.webApp("🚀 Mini Uygulama (Kelime Avı)", `${miniAppUrl}?uid=${ctx.from.id}`)],
        ["🎙 Telaffuz Pratiği Yap", "☕ Serbest Sohbet Et"]
    ]).resize());
});

// GÜNLÜK BİLDİRİM SİSTEMİ (Örn: Her gün saat 10:00'da)
function sendDailyReminders() {
    const users = readUsers();
    Object.values(users).forEach(user => {
        if (user.chatId) {
            bot.telegram.sendMessage(user.chatId, "👨‍🏫 Günaydın! Yasin Hoca burada. Bugünün ödevlerini yaptın mı? Kendini geliştirmek istiyorsan her gün düzenli çalışmalısın. Eğer aksatırsan eksi puan ve ceza alabilirsin, haberin olsun. Hemen Kelime Avı'na gir ve başla! 🚀").catch(e => {});
        }
    });
}

// KANALA GÜNLÜK POST GÖNDERME (Akıllı Yönlendirme: Birleşik veya Ayrı)
async function postToChannel(topic = "", fileId = null, fileType = "photo") {
    const channelId = process.env.CHANNEL_ID;
    if (!channelId) return;

    try {
        const selectedTopic = topic || "Genel Türkçe Dil Bilgisi";
        // Kullanıcı "detaylı" istiyorsa veya bir ders anlatımı bekliyorsa kilitleri aç
        const isDetailed = /detaylı|uzun|geniş|açıklayıcı|anlat|bilgi|nedir|öğret|notlar/i.test(selectedTopic);
        const charLimit = isDetailed ? 4000 : 950;

        const comp = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: `Sen Yasin Hoca'sın. Her zaman şu şık formatla başla:
🏛️ <b>Yasin Hoca'dan Türkçe Notları</b>

🌟 <b>[Konu Başlığı]</b> 🌟

İçerik kuralları:
1. Son derece zarif, profesyonel ve yüksek seviyede bir 'kanal vizyonu' olan üslup kullan. "Değerli öğrencilerim," veya "Kıymetli arkadaşlar," gibi saygın bir hitapla başla.
2. ASLA ama ASLA Türkçe dışında bir kelime veya Latin alfabesi dışı (Arapça, Farsça, Kiril vb.) bir karakter kullanma. Metin %100 temiz, duru ve hatasız bir İstanbul Türkçesi olmalıdır.
3. Emojileri ciddi oranda azalt. Sadece başlıklar veya çok önemli vurgular için sembolik ve seçkin bir şekilde kullan. Her cümlede emoji olmasın.
4. Bilgiyi derin, akademik bir altyapıyla ama akıcı ve ilgi çekici bir üslupla sun. Başka hiçbir kanalda bulunmayan bir kalite ve derinlik hissi ver.
5. Metin düzeni tertemiz ve dengeli olmalı. HTML (<b>, <i>, <u>) kullanarak profesyonel bir tipografi oluştur. En sona 2-3 hashtag ekle.` },
                { role: "user", content: `Öğrencilerine şu konuyu anlat: ${selectedTopic}` }
            ],
            temperature: 0.8
        });
        const text = comp.choices[0].message.content;

        if (fileId) {
            if (isDetailed || text.length > 1024) {
               // Ayrı gönder
               if (fileType === "document") await bot.telegram.sendDocument(channelId, fileId);
               else await bot.telegram.sendPhoto(channelId, fileId);
               await bot.telegram.sendMessage(channelId, text, { parse_mode: 'HTML' });
            } else {
               // Birleşik gönder
               if (fileType === "document") await bot.telegram.sendDocument(channelId, fileId, { caption: text, parse_mode: 'HTML' });
               else await bot.telegram.sendPhoto(channelId, fileId, { caption: text, parse_mode: 'HTML' });
            }
        } else {
            await bot.telegram.sendMessage(channelId, text, { parse_mode: 'HTML' });
        }
        
        console.log(`✅ Kanal postu (${isDetailed ? 'Derin - Ayrı' : 'Kısa - Birleşik'}) paylaşıldı!`);
    } catch (e) {
        console.error("❌ Kanal post hatası:", e.message);
    }
}

// FOTOĞRAFLI POST HAZIRLAMA KOMUTU
bot.on(['photo', 'document'], async (ctx) => {
    if (ctx.from.id.toString() === "6429306893" || ctx.from.id.toString() === "7360824809" || ctx.from.username === "k_yasin") {
        let topic = ctx.message.caption || "Genel Türkçe Bilgisi";
        // '/post' komutunu ve başındaki boşlukları temizle
        topic = topic.replace(/^\/post\s*/i, '').trim() || "Genel Türkçe Bilgisi";
        
        let fileId;
        let type = "photo";

        if (ctx.message.photo) {
            fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            type = "photo";
        } else if (ctx.message.document && ctx.message.document.mime_type.startsWith('image/')) {
            fileId = ctx.message.document.file_id;
            type = "document";
        } else {
            return ctx.reply("❌ Lütfen sadece fotoğraf gönderin!");
        }

        await ctx.reply(`📸 Görseliniz alındı! "${topic}" konusu özel ders tadında hazırlanıp kanala gönderiliyor...`);
        await postToChannel(topic, fileId, type);
    } else {
        ctx.reply("❌ Post hazırlama yetkiniz bulunmuyor.");
    }
});

// Her saat başı kontrol et (Basit Cron)
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 10) { // Her sabah 10'da
        sendDailyReminders();
        postToChannel();
    }
}, 3600000); 


bot.hears('🎙 Telaffuz Pratiği Yap', (ctx) => ctx.reply("Harika! Telaffuz yeteneklerini geliştirelim. Lütfen aşağıdaki cümleyi sesli olarak oku:\n🎤 'Bugün hava çok güzel!'"));
bot.hears('☕ Serbest Sohbet Et', (ctx) => ctx.reply("Serbest sohbet moduna geçtik. Seni dinliyorum; dilediğin konuda Türkçe olarak sohbet edebilirsin. 😊"));

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
        const path = `./${ctx.message.voice.file_id}.ogg`;
        const writer = fs.createWriteStream(path);
        res.data.pipe(writer);
        await new Promise(r => writer.on('finish', r));
        const trans = await openai.audio.transcriptions.create({ file: fs.createReadStream(path), model: "whisper-large-v3", language: "tr" });
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
        fs.unlinkSync(path);
    } catch (e) {
        console.error("❌ AI Hatası:", e.message);
        ctx.reply("❌ Bir hata oluştu!");
    }
});

bot.on('text', async (ctx) => {
    console.log("📨 Gelen Mesaj Chat ID:", ctx.chat.id);
    if (ctx.message.forward_from_chat) console.log("📢 İletilen Kanal ID:", ctx.message.forward_from_chat.id);
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
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
