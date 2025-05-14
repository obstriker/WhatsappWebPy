import os
import subprocess
import threading
import time
import platform
import signal
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import requests
import uvicorn
import urllib

DETACHED = 0x00000008  # Windows CREATE_NEW_CONSOLE
DETACHED_PROCESS = 0x00000008

def load_model():
    import whisper
    return whisper.load_model("base")

def transcribe_audio(voice_file_path, model):
    return model.transcribe(voice_file_path)["text"]

# TODO: add layer for AI functions
# TODO: let users implement functions easily like:
#          - Summarize youtube
#          - Schedule X
#          - TickTick operations
#          - Obsidian operations

class WhatsAppWebClient:
    def __init__(
        self,
        node_server_url: str = "http://127.0.0.1:3000",
        callback_host: str = "http://127.0.0.1:8000",
        callback_path: str = "/whatsapp-webhook",
        transcribe=False,
        setup_node = True,
        port=8000,
        hostname="0.0.0.0"
    ):
        self.app = FastAPI()
        self.node_server_url = node_server_url
        self.callback_host = callback_host
        self.callback_path = callback_path
        self.callback_url = callback_host + callback_path
        self.node_script_path = self._resolve_node_script_path()
        self.node_process = None
        self.message_callback = None
        self.voice_message_callback = None
        self.setup_node = setup_node
        self.transcribe = transcribe

        parsed_url = urllib.parse.urlparse(self.callback_url)
        self.port = parsed_url.port
        self.host = hostname

        if self.transcribe:
            self.model = load_model()
        self._setup_routes(),
    

    def set_message_callback(self, callback):
        self.message_callback = callback

    def set_voice_message_callback(self, callback):
        self.voice_message_callback = callback

    def _resolve_node_script_path(self):
        here = os.path.dirname(os.path.abspath(__file__))
        node_path = os.path.join(here, "node_server.js")
        if not os.path.exists(node_path):
            raise FileNotFoundError(f"❌ node_server.js not found at {node_path}")
        return node_path

    def send(self, to: str, message: str) -> dict:
        if not to or not message:
            raise ValueError("Both 'to' and 'message' are required.")

        try:
            response = requests.post(
                f"{self.node_server_url}/send",
                json={"to": to, "message": message}
            )
            response.raise_for_status()
            print(f"📤 Message sent to {to}: {message}")
            return response.json()
        except requests.RequestException as e:
            print(f"❌ Failed to send message to {to}: {e}")
            raise

    def _setup_routes(self):
        @self.app.post(self.callback_path)
        async def whatsapp_webhook(request: Request):
            data = await request.json()
            sender = data.get("from")
            message = data.get("body")
            message_type = data.get("type")
            voice_file_path = data.get("voiceFilePath")

            print(f"📥 Incoming WhatsApp message from {sender}: {message} (type: {message_type})")

            # Handle text or other types of messages
            if message_type != "ptt":
                if self.message_callback:
                    try:
                        self.message_callback(sender, message)
                    except Exception as e:
                        print(f"⚠️ Error in message callback: {e}")
            else:
                # Handle voice recordings
                if self.transcribe and message_type == "ptt":
                    message = transcribe_audio(voice_file_path, self.model)
                    self.message_callback(sender, message)
                elif self.voice_message_callback:
                    try:
                        self.voice_message_callback(sender, voice_file_path)
                    except Exception as e:
                        print(f"⚠️ Error in voice message callback: {e}")

            return JSONResponse(content={"status": "received"})

    def register_callback(self, filters = None):
        try:
            res = requests.post(f"{self.node_server_url}/register", json={"url": self.callback_url, "filters": filters})
            res.raise_for_status()
            print(f"✅ Registered callback: {res.json()}")
        except requests.RequestException as e:
            print(f"❌ Failed to register callback: {e}")

    def register(self, groupname=None, chatid=None):
        filters = {
            "groupName": groupname,
            "chatId": chatid
        }
        
        # Call the existing register_callback method with the filters
        self.register_callback(filters)
        
    def unregister(self):
        """Unregister the callback URL from the Node.js server."""
        try:
            res = requests.post(f"{self.node_server_url}/unregister", json={"url": self.callback_url})
            res.raise_for_status()
            print(f"✅ Unregistered callback: {res.json()}")
        except requests.RequestException as e:
            print(f"❌ Failed to unregister callback: {e}")


    def _start_node_process(self, quiet=True):
        if self._node_alive():
            print("🟢 Detected existing Node.js server — reusing.")
            return

        is_windows = platform.system() == "Windows"
        creationflags = DETACHED_PROCESS if (self.setup_node and is_windows) else 0

        stdout = subprocess.DEVNULL if quiet else subprocess.PIPE
        stderr = subprocess.DEVNULL if quiet else subprocess.STDOUT

        print("🚀 Starting Node.js server...")

        self.node_process = subprocess.Popen(
            ["node", self.node_script_path],
            stdout=stdout,
            stderr=stderr,
            stdin=subprocess.DEVNULL,
            creationflags=creationflags if is_windows else 0,
            text=True,
            encoding="utf-8"
        )

        if not quiet:
            def stream_output():
                for line in self.node_process.stdout:
                    print(f"[node] {line.strip()}")
            threading.Thread(target=stream_output, daemon=True).start()

        time.sleep(5)

    def run(self, quiet=True, callback=None, voice_callback=None, setup_node=False, transcribe=True, groupname = None, chatid = None):
        """
        Start Node.js and FastAPI server, and block the main thread.
        """
        if callback:
            self.message_callback = callback
        if voice_callback:
            self.voice_message_callback = voice_callback

        self.transcribe = transcribe

        if transcribe:
            self.model = load_model()

        self.setup_node = setup_node
        if self.setup_node:
            self._start_node_process(quiet=quiet)
        self.register(groupname = groupname, chatid = chatid)

        def start_fastapi():
            uvicorn.run(self.app, host=self.host, port=self.port)

        threading.Thread(target=start_fastapi, daemon=True).start()
        self.wait_forever()

    def wait_forever(self):
        """Blocks the main thread and gracefully shuts down on Ctrl+C."""
        def handle_sigint(sig, frame):
            print("\n🛑 Caught Ctrl+C, shutting down...")
            self.stop()
            os._exit(0)  # ensure all threads and servers are killed

        signal.signal(signal.SIGINT, handle_sigint)
        print("🕓 WhatsAppWebhookClient is running. Press Ctrl+C to stop.")
        while True:
            time.sleep(1)

    def stop(self):
        if self.setup_node:
            return
        
        self.unregister()

        if self.node_process:
            print("🛑 Stopping Node.js server...")
            self.node_process.terminate()
            self.node_process = None
    
    def _node_alive(self) -> bool:
        try:
            res = requests.get(f"{self.node_server_url}/health", timeout=2)
            return res.status_code == 200
        except Exception:
            return False