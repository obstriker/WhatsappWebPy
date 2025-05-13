const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
app.use(express.json());

const registeredCallbacks = new Map(); // Changed from Set to Map

const logFile = path.join(__dirname, 'whatsapp.log');
const audioDir = path.join(__dirname, '../audio');

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, line);
}

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Show QR code for login
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    logToFile('📱 Scan the QR code to login');
});

// Handle incoming messages from WhatsApp
client.on('message', async msg => {
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir);
    }

    const payload = {
        from: msg.from,
        body: msg.body,
        type: msg.type,
        groupName: null,
        chatId: msg.from,
    };

    const chat = await client.getChatById(msg.from);
    payload.chat = chat;

    if (msg.from.includes('@g.us') && chat && chat.name) {
        payload.groupName = chat.name;
    }

    logToFile(`📩 Message received: ${JSON.stringify(payload)}`);
    
    // Check if the received message is a voice recording
    if (msg.type === 'ptt') { // 'ptt' indicates a voice note
        try {
            const media = await msg.downloadMedia();
            if (media) {
                const voiceFileName = `voice_${Date.now()}.ogg`;
                const voiceFilePath = path.join(audioDir, voiceFileName); // Using audioDir variable to ensure the correct path
                // Save the voice recording
                fs.writeFileSync(voiceFilePath, Buffer.from(media.data, 'base64'));
                logToFile(`🎤 Voice message saved as: ${voiceFileName}`);

                // Attach the voice message file path to the payload
                payload.voiceFilePath = voiceFilePath;
            }
        } catch (err) {
        logToFile(`❌ Error processing voice message: ${err.message}`);
    }
    }

    for (const [url, filters] of registeredCallbacks.entries()) {
        const shouldForward =
        (filters.chatId && payload.chatId === filters.chatId) ||
        (filters.groupName && payload.groupName === filters.groupName) ||
        (!filters.chatId && !filters.groupName && !msg.from.includes('@g.us')); // default: only private messages

        if (shouldForward) {
            try {
                logToFile(`➡️  POST ${url}`);
                await axios.post(url, payload);
                logToFile(`✅ Successfully forwarded to ${url}`);
            } catch (err) {
                logToFile(`❌ Error forwarding to ${url}: ${err.message}`);
            }
        }
    }
});

// Register webhook callback
app.post('/register', (req, res) => {
    const { url, filters } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    // Normalize filters to ensure groupName and chatId are defined
    const normalizedFilters = {
        groupName: filters && filters.groupName ? filters.groupName : null,
        chatId: filters && filters.chatId ? filters.chatId : null,
    };

    if (registeredCallbacks.has(url)) {
        logToFile(`⚠️ Callback already registered: ${url}`);
    } else {
        registeredCallbacks.set(url, normalizedFilters);
        logToFile(`✅ Registered new callback: ${url} with filters: ${JSON.stringify(normalizedFilters)}`);
    }

    res.json({ status: 'Callback registered' });
});

// Unregister webhook callback
app.post('/unregister', (req, res) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    if (registeredCallbacks.delete(url)) {
        logToFile(`✅ Unregistered callback: ${url}`);
        res.json({ status: 'Callback unregistered' });
    } else {
        logToFile(`⚠️ Callback not found: ${url}`);
        res.status(404).json({ error: 'Callback not found' });
    }
});

// Send message endpoint
app.post('/send', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing "to" or "message"' });
    }

    try {
        await client.sendMessage(to, message);
        logToFile(`📤 Message sent to ${to}: ${message}`);
        res.json({ status: 'Message sent' });
    } catch (err) {
        logToFile(`❌ Failed to send message: ${err.message}`);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// WhatsApp client ready
client.on('ready', () => {
    logToFile('✅ WhatsApp client is ready!');
});

// Graceful shutdown
function shutdown() {
    logToFile('🚨 Shutting down gracefully...');
    client.destroy()
        .then(() => {
            logToFile('✅ WhatsApp client closed.');
            process.exit(0);
        })
        .catch(err => {
            logToFile(`❌ Error closing WhatsApp client: ${err.message}`);
            process.exit(1);
        });
}

process.on('SIGINT', shutdown);
process.on('unhandledRejection', (reason) => {
    logToFile(`🛑 Unhandled Promise Rejection: ${reason.stack || reason}`);
});
process.on('uncaughtException', (err) => {
    logToFile(`💥 Uncaught Exception: ${err.stack || err}`);
});

// Start server and client
app.listen(port, () => {
    logToFile(`🚀 Express server running on http://localhost:${port}`);
});

console.log("🔧 Initializing WhatsApp client...");
client.initialize();
