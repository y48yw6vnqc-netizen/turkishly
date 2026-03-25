require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERS_FILE = path.join(__dirname, 'users.json');
const WORDS_FILE = path.join(__dirname, 'words.json');
const SUBJECTS_FILE = path.join(__dirname, 'subjects.json');

async function createGist() {
    try {
        const files = {
            "users.json": { content: fs.existsSync(USERS_FILE) ? fs.readFileSync(USERS_FILE, 'utf-8') : "{}" },
            "words.json": { content: fs.existsSync(WORDS_FILE) ? fs.readFileSync(WORDS_FILE, 'utf-8') : "[]" },
            "subjects.json": { content: fs.existsSync(SUBJECTS_FILE) ? fs.readFileSync(SUBJECTS_FILE, 'utf-8') : "[]" }
        };

        const res = await axios.post(`https://api.github.com/gists`, {
            description: "Turkishly Bot (Gizli Veritabanı Yedekleri)",
            public: false,
            files
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }
        });
        
        console.log("=========================================");
        console.log("GIST ID OLUŞTURULDU: " + res.data.id);
        console.log("=========================================");
        
        fs.appendFileSync(path.join(__dirname, '.env'), `\nGIST_ID=${res.data.id}\n`);
    } catch(err) {
        console.error("Hata:", err.response ? err.response.data : err.message);
    }
}
createGist();
