# Waseo

A Paseo plugin that uses WACLI to detect and manage multiple WhatsApp linked devices, show pairing QR codes in Paseo, keep per-number sync running, forward signed webhook events, and read recent messages from each local archive.

See [PLAN.md](PLAN.md) for prioritized improvements.

## Requirements

- Paseo 0.16.2 or later.
- WACLI available on the machine running the Paseo daemon. On Linux x64 and ARM64, it can be installed from **Paseo Settings → Plugins → Waseo → WACLI**.
- A WACLI release with named account support to connect more than one number. Older installs can still use their default store.
- A webhook endpoint reachable from the daemon. HTTPS is required except for localhost.

If WACLI is outside the daemon's `PATH`, set `WACLI_BINARY` in the daemon environment to its executable path. Binaries managed by Homebrew or another package manager should be removed through that manager.

## Use

Open **Waseo** in Paseo. It checks the existing WACLI default store and named accounts and shows which numbers are already paired. Choose **Pair new** to create or pair an account and scan its QR from WhatsApp → **Linked Devices**. Each number has its own session, archive, webhook URL, and signing secret. Waseo adds a `waseo_account` query parameter to each webhook URL so a shared bot endpoint can identify the source account.

The signing secret is passed to WACLI as a process argument at runtime and is not saved by the plugin. Enter it again after a daemon or plugin restart. WACLI signs requests with `X-Wacli-Signature`; verify the HMAC at your bot endpoint. Per-number **Disconnect** stops live sync while retaining the linked-device session. The WACLI settings page can run or stop sync for all paired numbers, restart WACLI processes, or run sync on Waseo startup. Uninstalling the standalone binary keeps data; **Wipe WACLI data** removes paired sessions, account configuration, archives, and media.

Use **Load recent messages** for recent synced history from the selected number. It is read-only and visible in Paseo. A bot can consume live webhook events; to recover history or webhook gaps, it needs read access to that account's local WACLI archive. WACLI history is best-effort, and webhook delivery is best-effort without retries.

## Agent sessions and Bots

Interactive Paseo agent sessions receive Waseo tools to list configured WhatsApp accounts and connection status, search synced contacts, read recent messages, and send text messages. The Bots plugin starts normal Paseo agent sessions, so its interactive bot chats receive the same tools without changing each bot's MCP configuration.

Reading messages does not require confirmation. Reads use WACLI's local archive even while sync is disconnected; Waseo reports the last sync time when available so the agent can explain that stored messages may be stale.

Waseo automatically accepts Paseo's tool-run permission prompts for Waseo tools only. Before sending, the agent must ask you to approve the exact account and contact name and phone number. It then shows the full message and asks for a second approval. Waseo generates a short-lived code for each send approval and checks that the code appears in a later user message in the same agent chat. Each approval is bound to its account, contact, and action, and can be used once. Sending requires a paired account with an active sync process, disables link previews, and does not automatically retry an uncertain result.

## Data and protocol

WACLI stores linked-device credentials and message history on the daemon machine. The configured webhook receives live message content and selected receipt and presence events. Anyone with access to the daemon account or webhook endpoint may be able to access that data. The webhook signing secret is optional but recommended.

WACLI is a third-party client of the WhatsApp Web protocol, not an official WhatsApp or Meta API. The protocol can change, and linked-device automation is subject to WhatsApp's terms.
