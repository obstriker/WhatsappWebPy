# WhatsApp Web Python Client

A Python wrapper around [`whatsapp-web.js`](https://docs.wwebjs.dev) using FastAPI, allowing you to send and receive WhatsApp messages via a Python interface — while internally using a Node.js-powered headless WhatsApp Web session.

---

## 🚀 Features

- ✅ Send and receive WhatsApp messages using Python
- ✅ Automatically starts a `whatsapp-web.js` Node.js server
- ✅ Persistent login with QR-based authentication
- ✅ Clean callback API for message handling
- ✅ CLI entry point support (`whatsapp-bot`)

---

## 📦 Prerequisites

### 🧰 Node.js (v18+ recommended)

Install Node.js from [nodejs.org](https://nodejs.org/).

Verify installation:

```bash
node -v
npm -v
```

## 🛠️ One-Time Node.js Setup
Although the Node script (node_server.js) is bundled with the package, you must install its required dependencies.

### 📥 Install Dependencies
From the root of your Python project:

```bash
cd your/project/path
npm init -y
npm install whatsapp-web.js puppeteer express axios qrcode-terminal
```

⚠️ Use puppeteer (not puppeteer-core) so it automatically installs Chromium.