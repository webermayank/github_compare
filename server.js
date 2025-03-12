// server.js
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const { diffLines } = require('diff');
const langdetect = require('langdetect'); // Replace franc with langdetect

const app = express();
const port = 8080;

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

// Mapping ISO 639-3 (franc) to ISO 639-1 (Google)
const iso6393to1 = {
  eng: 'en', spa: 'es', fra: 'fr', deu: 'de', ita: 'it', por: 'pt', rus: 'ru', hin: 'hi', 
  jpn: 'ja', zho: 'zh', ara: 'ar', kor: 'ko', tur: 'tr', tam: 'ta'
};

// Function to translate text using Google Translate API
async function translateText(text, sourceLang, targetLang = 'en') {
  try {
    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2`,
      null,
      {
        params: {
          q: text,
          source: sourceLang,
          target: targetLang,
          format: "text",
          key: GOOGLE_API_KEY,
        },
      }
    );
    return response.data.data.translations[0].translatedText;
  } catch (error) {
    console.error("Google Translate API error:", error.message);
    return text; // Return original text if translation fails
  }
}

app.get('/compare', async (req, res) => {
  try {
    // Read the .md files
    const file1 = fs.readFileSync('english.md', 'utf8'); // English
    const file2 = fs.readFileSync('spanish.md', 'utf8'); // Other language

    // Detect languages
    const lang1 = langdetect.detectOne(file1);
    const lang2 = langdetect.detectOne(file2);
    console.log(`Detected languages: file1=${lang1}, file2=${lang2}`);

    const file1Lang = iso6393to1[lang1] || 'en';
    const file2Lang = iso6393to1[lang2] || 'unknown';

    let translatedFile2 = file2;

    // Translate only if file2 is not English
    if (file1Lang !== 'en' && file2Lang !== 'unknown') {
      console.log(`Translating file2 from ${file2Lang} to en...`);
      translatedFile2 = await translateText(file2, file2Lang, 'en');
    } else if (file2Lang === 'unknown') {
      console.warn('Warning: Unable to detect the language of file2. Skipping translation.');
    }

    // Compare the English file and the translated file
    const diff = diffLines(file1, translatedFile2);
    let changes = [];
    let currentLine = 0;

    diff.forEach(part => {
      if (part.added || part.removed) {
        changes.push({ line: currentLine + 1, text: part.value.trim() });
      }
      currentLine += part.count || 0;
    });

    if (changes.length > 0) {
      res.json({
        message: 'Changes detected. Update the translation accordingly.',
        changes
      });
    } else {
      res.json({ message: 'No changes detected.' });
    }

  } catch (error) {
    console.error('Error during comparison:', error);
    res.status(500).send('Error during comparison');
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});