# Waseo improvement plan

This plan is based on the current plugin source and its documented behavior. It prioritizes the recent read-versus-send approval failure, then reliability, data handling, and public distribution.

## 1. Make agent tool routing dependable

- Add regression coverage for Bots and regular Paseo sessions: listing paired numbers, reading one or many chats by date, and sending only after the recipient and exact message are separately confirmed.
- Verify a broad read request calls the read tool directly, does not ask for chat selection, and does not enter the send-recipient flow.
- Use exact `toolPolicy.preapproved` server/tool references for new agents. Keep the narrow prompt-text fallback only for existing saved agents until Paseo provides a supported way to update their saved tool policy.
- Exercise the permission hook with other Paseo tools and with non-Waseo permission requests to confirm they remain user-controlled.
- Document that send approvals expire and are held in memory, so restarting Waseo invalidates any pending approval.

**Done when:** read requests complete without approval cards; send requests still require the exact recipient and message codes; unrelated tool approvals are unchanged.

## 2. Improve message history and contact handling

- Add pagination for large date ranges. Reads currently return at most 200 messages per call, with a default of 50.
- Make the date/time-zone interpretation explicit in the UI and agent results, and cover exact dates, rolling day counts, last week, last month, and custom ranges.
- Add clear partial-result metadata when WACLI is disconnected or its local archive is behind, including which accounts and chats were queried.
- Add regression cases for duplicate contact names, phone-number matches, multiple accounts, and empty chats.

**Done when:** the agent can page through multi-chat history without silently truncating results and can explain the age and scope of the archive it read.

## 3. Strengthen sync and webhook reliability

- Add a process health view with last successful sync, reconnect attempts, and the most recent WACLI error per number.
- Test restart, disconnect, logged-out, and multi-number behavior across daemon/plugin restarts.
- Add bounded webhook retries with backoff and a visible delivery log or replay action. Webhook delivery is currently documented as best-effort without retries.
- Review shutdown and wipe behavior so concurrent WACLI processes cannot write to a data directory while it is being removed.

**Done when:** users can tell whether each number is live, when it last synced, and whether webhook events were delivered or need replay.

## 4. Reduce secret exposure and clarify data controls

- Review how the webhook signing secret reaches WACLI. It is currently passed as a process argument and must be re-entered after restart; use a safer WACLI-supported mechanism if available.
- Redact secret values from UI errors, logs, and process status; keep the existing HTTPS and localhost URL restrictions.
- Document exactly what stays on the daemon, what is sent to webhooks, and what Wipe WACLI data deletes.
- Add security reporting and a clear privacy/data-retention section before wider public distribution.

**Done when:** secret handling is documented and tested, and no Waseo log or diagnostic output exposes the configured value.

## 5. Prepare the public project for contributors and releases

- Add CI for typecheck and automated tests, then cover the supported Paseo and WACLI version combinations.
- Add a changelog and release/version workflow; decide separately whether Waseo should be published to npm or remain a Git-installed plugin.
- Choose a license before inviting reuse, and add contribution and security-reporting guidance.
- Review the package manifest and supported-platform documentation against the actual build and install paths.

**Done when:** a clean checkout has a documented setup path, CI checks pass, and maintainers can make a traceable release.
