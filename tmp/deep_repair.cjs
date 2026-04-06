const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

const mapping = {
    // Éléments les plus courants (Chronique, Silhouettes, Peluches)
    'ðŸ“—': '📓',
    'ðŸ™‚': '👤',
    'ðŸ ¾': '🐾',
    'âš–ï¸': '⚖️',
    'â˜£ï¸': '☣️',
    'ðŸ ˜ï¸': '🏰',
    'âœ¦': '✧',
    'âœ✨': '✨',
    'â˜ ï¸': '☠️',
    'â ¤ï¸': '❤️',
    'ðŸŽ­': '🎭',
    'ðŸŽ–ï¸': '🎖️',
    'ðŸ‘¤': '👤',
    'Ã©': 'é',
    'Ã¨': 'è',
    'Ã ': 'à',
    'Ã¹': 'ù',
    'Ã´': 'ô',
    'Ã»': 'û',
    'Ãª': 'ê',
    'Ã«': 'ë',
    'Ã®': 'î',
    'Ã‰': 'É',
    'â€¦': '…',
    'â€”': '—',
    'â€“': '–',
    'â†©': '↩',
    'â•': '═',
    'â”€': '─',
    'ðŸ§ª': '🧪',
    'ðŸ’Š': '💊',
    'ðŸ“‹': '📋',
    'â “': '❓',
    'ðŸ’€': '💀',
    'ðŸ’–': '💖',
    'ðŸŒ¿': '🌿',
    'â˜€ï¸': '☀️',
    'ðŸŒ™': '🌙',
    'ðŸ§¸': '🧸',
    'ðŸ ¹': '🍷',
    'ðŸŽ²': '🎲',
    'ðŸŽ¶': '🎶',
    'ðŸ¤–': '🤖',
    'ðŸ“Š': '📊',
    'ðŸª“': '🪓',
    'ðŸ›¡ï¸': '🛡️',
    'âœ–': '✖️',
    'ðŸ•µï¸': '🕵️',
    'ðŸ º': '🐺',
    'ðŸ ±': '🐱',
    'ðŸ ¥': '🐣',
    'ðŸ »': '🐻',
    'ðŸŒ ': '🌐',
    'ðŸ“£': '📢',
    'ðŸŽ­': '🎭'
};

function walkSync(dir, filelist) {
    const files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function(file) {
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
            filelist = walkSync(path.join(dir, file), filelist);
        } else {
            filelist.push(path.join(dir, file));
        }
    });
    return filelist;
}

const files = walkSync(srcDir);

files.forEach(file => {
    if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
        let content = fs.readFileSync(file, 'utf8');
        let newContent = content;

        for (const [key, value] of Object.entries(mapping)) {
            // Utilisation d'un remplacement global robuste
            newContent = newContent.split(key).join(value);
        }

        if (newContent !== content) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log(`✅ FIXED: ${path.relative(srcDir, file)}`);
        }
    }
});

console.log("\nDeep Repair (V3) Completed Successfully.");
