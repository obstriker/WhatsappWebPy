from .client import WhatsAppWebhookClient

def main():
    def on_message(sender, message):
        print(f"[📩 {sender}] {message}")

    bot = WhatsAppWebhookClient()
    bot.run(quiet=True, callback=on_message)
