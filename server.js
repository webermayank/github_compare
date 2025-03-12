const express = require('express');
const fs = require('fs');
const axios = require('axios');
const { diffLines } = require('diff');
const franc = require('franc');

const app = express();
const port = 8080;

// Mapping from ISO 639-3 (returned by franc) to ISO 639-1 for common languages
const iso6393to1 = {
  eng: 'en', spa: 'es', fra: 'fr', deu: 'de',
  ita: 'it', por: 'pt', rus: 'ru', jpn: 'ja', 
  zho: 'zh', hin: 'hi', ara: 'ar'
  // Add more mappings as needed
};

// Function to translate text using LibreTranslate
async function translateText(text, sourceLang, targetLang = 'en') {
  try {
    const response = await axios.post('https://libretranslate.de/translate', {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: "text"
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data.translatedText;
  } catch (error) {
    console.error("Translation error:", error.message);
    throw error;
  }
}

app.get('/compare', async (req, res) => {
  try {
    // Read the markdown files
    const file1 = fs.readFileSync('english.md', 'utf8'); // Expected to be in English
    const file2 = fs.readFileSync('spanish.md', 'utf8'); // Other language

    // Detect languages using franc
    const lang1 = franc(file1);
    const lang2 = franc(file2);
    console.log(`Detected languages: file1=${lang1}, file2=${lang2}`);

    // Convert detected language codes using our mapping
    const file1Lang = iso6393to1[lang1] || 'en'; // Default to English
    const file2Lang = iso6393to1[lang2] || 'unknown'; // Default to unknown if not detected

    let translatedFile2 = file2;

    // If file2 is not in English and has a valid language code, translate it
    if (file2Lang !== 'en' && file2Lang !== 'unknown') {
      console.log(`Translating file2 from ${file2Lang} to en...`);
      translatedFile2 = await translateText(file2, file2Lang, 'en');
    } else if (file2Lang === 'unknown') {
      console.warn('Warning: Unable to detect the language of file2. Skipping translation.');
    }

    // Compare file1 and the translated version of file2 line-by-line
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
        message: 'Change detected in the English file. Please update the corresponding translation in the other language file.',
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
  console.log(`Server running on http://localhost:${port}`);
});
