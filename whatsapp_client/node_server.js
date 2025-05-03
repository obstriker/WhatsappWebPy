const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;
app.use(express.json());

const registeredCallbacks = new Set();

const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'whatsapp.log');
const audioDir = path.join(__dirname, '../audio');

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, line);
    // console.log(message); // still print to console too
}

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
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

    // Create 'audio' directory if it doesn't exist
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir);
    }

    const payload = {
        from: msg.from,
        body: msg.body,
        type: msg.type,
    };

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

    // Forward the message (including voice recordings) to registered callbacks
    for (const url of registeredCallbacks) {
        try {
            logToFile(`➡️  POST ${url}`);
            await axios.post(url, payload);
            logToFile(`✅ Successfully forwarded to ${url}`);
        } catch (err) {
            logToFile(`❌ Error forwarding to ${url}: ${err.message}`);
        }
    }
});

app.post('/register', (req, res) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    if (registeredCallbacks.has(url)) {
        logToFile(`⚠️ Callback already registered: ${url}`);
    } else {
        registeredCallbacks.add(url);
        logToFile(`✅ Registered new callback: ${url}`);
    }

    res.json({ status: 'Callback registered' });
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

// Start the Express server
app.listen(port, () => {
    logToFile(`🚀 Express server running on http://localhost:${port}`);
});

// WhatsApp client ready
client.on('ready', () => {
    logToFile('✅ WhatsApp client is ready!');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

process.on('unhandledRejection', (reason) => {
    logToFile(`🛑 Unhandled Promise Rejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
    logToFile(`💥 Uncaught Exception: ${err.stack || err}`);
});

client.initialize();