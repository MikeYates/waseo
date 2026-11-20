![Waseo logo](https://raw.githubusercontent.com/MikeYates/waseo/main/assets/waseo-logo.png)

# Waseo

WhatsApp for Paseo agents, powered by WACLI.

Waseo connects WhatsApp linked devices to Paseo. It helps you pair multiple numbers, manage sync, read local message history, search synced contacts, and forward live events to a webhook you choose.

Waseo uses [WACLI](https://github.com/openclaw/wacli), a lightweight Go command-line client with a local SQLite message archive. WACLI keeps account credentials and synced history on the Paseo daemon machine. Local history can be searched while the live connection is unavailable, though WhatsApp history coverage is best-effort.

Interactive Paseo sessions and the [Bots plugin](https://paseo.sh/plugins/oliexe/bots) can use Waseo. Access is off by default. In a regular workspace, use the Waseo logo control in the workspace header to choose agents. In a Bots chat, use its **Active** or **Inactive** composer control. Bot access applies to that Bot's chats. Waseo reloads an idle agent when access changes. Agents can read messages without confirmation. Sending requires separate confirmation of the exact recipient and the complete message.

To connect an account, open Waseo, install WACLI if it is not already available, then choose **Pair new** and scan the QR code from WhatsApp under **Linked Devices**. Waseo's built-in installer supports Linux x64 and ARM64. Multiple numbers require WACLI named account support.

Webhook events go to the URL you configure. Use HTTPS except for localhost. Delivery is best-effort. A signing secret is optional and can be used by your endpoint to verify requests. Messages shared with an agent are sent to its configured model provider. WACLI uses the WhatsApp Web protocol and is not an official WhatsApp or Meta API.

Requires Paseo 0.16.2 or later and WACLI on the daemon machine.
