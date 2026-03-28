const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const WORDS_FILE = path.join(__dirname, 'words.json');

async function sync() {
    try {
        const content = fs.readFileSync(WORDS_FILE, 'utf-8');
        const files = { "words.json": { content } };
        await axios.patch(`https://api.github.com/gists/${GIST_ID}`, { files }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }
        });
        console.log("✅ Gist internet hafızası güncellendi!");
    } catch(err) {
        console.error("❌ Hata:", err.response ? err.response.data : err.message);
    }
}
sync();
