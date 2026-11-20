import { useRpc, useSubscription, type PluginScreenProps } from "@getpaseo/plugin/client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  whatsappEvent,
  whatsappListAccounts,
  whatsappReconnect,
  whatsappReadRecent,
  whatsappStart,
  whatsappStop,
} from "../shared/whatsapp";

type Account = { id: string; name: string; phone: string; authenticated: boolean; running: boolean };
type Message = { id: string; chat: string; sender: string; timestamp: string; text: string; fromMe: boolean };
type ScreenMode = "list" | "pair" | "webhook";

export function WaseoScreen({ theme, layout }: PluginScreenProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [supportsMultiple, setSupportsMultiple] = useState(false);
  const [mode, setMode] = useState<ScreenMode>("list");
  const [pairAccountId, setPairAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [webhookAccountId, setWebhookAccountId] = useState("");
  const [webhooks, setWebhooks] = useState<Record<string, { url: string; secret: string }>>({});
  const [qrByAccount, setQrByAccount] = useState<Record<string, string>>({});
  const [statusByAccount, setStatusByAccount] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);

  const listAccounts = useRpc(whatsappListAccounts);
  const startAccount = useRpc(whatsappStart);
  const reconnectAccount = useRpc(whatsappReconnect);
  const stopAccount = useRpc(whatsappStop);
  const readRecent = useRpc(whatsappReadRecent);

  const refresh = useMutation({
    mutationFn: listAccounts,
    onSuccess: (result) => {
      setAccounts(result.accounts);
      setSupportsMultiple(result.supportsMultiple);
    },
  });
  const pair = useMutation({
    mutationFn: startAccount,
    onSuccess: async (result, input) => {
      setPairAccountId(input.accountId);
      setStatusByAccount((previous) => ({ ...previous, [input.accountId]: result.message }));
      setQrByAccount((previous) => {
        const next = { ...previous };
        delete next[input.accountId];
        return next;
      });
      await refresh.mutateAsync({});
    },
  });
  const reconnect = useMutation({
    mutationFn: reconnectAccount,
    onSuccess: async (result, input) => {
      setStatusByAccount((previous) => ({ ...previous, [input.accountId]: result.message }));
      await refresh.mutateAsync({});
    },
  });
  const disconnect = useMutation({
    mutationFn: stopAccount,
    onSuccess: async (_result, input) => {
      setStatusByAccount((previous) => ({ ...previous, [input.accountId]: "Disconnecting…" }));
      await refresh.mutateAsync({});
    },
  });
  const recent = useMutation({
    mutationFn: readRecent,
    onSuccess: (result) => setMessages(result.messages),
  });

  const subscription = useSubscription(whatsappEvent, {}, (event) => {
    if (event.type === "accounts") {
      setAccounts(event.accounts);
      setSupportsMultiple(event.supportsMultiple);
      return;
    }
    if (event.type === "qr") {
      setPairAccountId(event.accountId);
      setQrByAccount((previous) => ({ ...previous, [event.accountId]: event.matrix }));
      setStatusByAccount((previous) => ({ ...previous, [event.accountId]: "Scan this code in WhatsApp → Linked Devices." }));
      return;
    }
    setStatusByAccount((previous) => ({ ...previous, [event.accountId]: event.message }));
    if (event.type === "error" || event.message.startsWith("Pairing complete")) {
      setQrByAccount((previous) => {
        const next = { ...previous };
        delete next[event.accountId];
        return next;
      });
    }
  });

  useEffect(() => { refresh.mutate({}); }, []);

  const pairTarget = supportsMultiple ? newAccountName.trim() : (pairAccountId || "@default-store");
  const webhook = webhooks[webhookAccountId] ?? { url: "", secret: "" };
  const styles = useMemo(() => ({
    screen: { flex: 1, backgroundColor: theme.colors.surface0 },
    content: { padding: layout.compact ? 16 : 24, gap: 14 },
    header: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12 },
    title: { color: theme.colors.foreground, fontSize: 22, fontWeight: "600" as const },
    text: { color: theme.colors.foreground },
    muted: { color: theme.colors.foregroundMuted },
    input: { color: theme.colors.foreground, backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 11 },
    primary: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, backgroundColor: theme.colors.accent, alignItems: "center" as const },
    secondary: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderColor: theme.colors.border, borderWidth: 1, alignItems: "center" as const },
    danger: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderColor: theme.colors.border, borderWidth: 1, alignItems: "center" as const },
    buttonText: { color: theme.colors.accentForeground, fontWeight: "600" as const },
    row: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 4 },
    card: { padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, gap: 8 },
    status: { color: theme.colors.foreground, fontWeight: "600" as const },
    qrBox: { alignSelf: "center" as const, padding: 8, backgroundColor: "white", marginVertical: 8 },
    qrCode: { color: "#000000", fontFamily: "monospace", fontSize: 4, lineHeight: 4, includeFontPadding: false, textAlign: "center" as const },
    separator: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4 },
  }), [theme, layout.compact]);

  function openPairMode() {
    const existingUnpaired = accounts.find((account) => !account.authenticated);
    setPairAccountId(supportsMultiple ? "" : existingUnpaired?.id ?? "");
    setNewAccountName(supportsMultiple ? `whatsapp-${accounts.length + 1}` : "");
    setMode("pair");
    setMessages([]);
  }

  function submitPairing() {
    const accountId = supportsMultiple ? newAccountName.trim() : (pairAccountId || "@default-store");
    if (!accountId) return;
    setPairAccountId(accountId);
    setQrByAccount((previous) => {
      const next = { ...previous };
      delete next[accountId];
      return next;
    });
    const config = webhooks[accountId] ?? { url: "", secret: "" };
    pair.mutate({
      accountId,
      webhookUrl: config.url.trim() || undefined,
      webhookSecret: config.secret,
    });
  }

  function openWebhookSettings(accountId: string) {
    setWebhookAccountId(accountId);
    setMode("webhook");
    setMessages([]);
  }

  const targetAccount = accounts.find((account) => account.id === webhookAccountId);
  const qr = pairAccountId ? qrByAccount[pairAccountId] : undefined;
  const pairStatus = pairAccountId ? statusByAccount[pairAccountId] : undefined;
  const pairNameValid = !supportsMultiple || /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(newAccountName.trim());
  const pairNameExists = supportsMultiple && accounts.some((account) => account.id === newAccountName.trim() && account.authenticated);
  const canAddNumber = supportsMultiple || !accounts.some((account) => account.authenticated);
  const pairingInProgress = accounts.some((account) => account.id === pairTarget && account.running && !account.authenticated);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {mode === "list" ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>WhatsApp numbers</Text>
            <Pressable accessibilityRole="button" disabled={!canAddNumber} style={styles.primary} onPress={openPairMode}>
              <Text style={styles.buttonText}>Pair new</Text>
            </Pressable>
          </View>

          {refresh.error ? <Text style={styles.text}>{refresh.error.message}</Text> : null}
          {!supportsMultiple && accounts.length > 0 ? <Text style={styles.muted}>This WACLI version supports its existing store. Update WACLI to pair additional numbers.</Text> : null}
          {accounts.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.text}>No WhatsApp numbers paired</Text>
              <Text style={styles.muted}>Pair a number to start syncing messages through WACLI.</Text>
            </View>
          ) : accounts.map((account) => {
            const connected = account.authenticated && account.running;
            const pairing = !account.authenticated && account.running;
            return (
              <View key={account.id} style={styles.card}>
                <View style={styles.header}>
                  <Text style={styles.text}>{account.name}</Text>
                  <Text style={styles.status}>{connected ? "Connected" : pairing ? "Pairing" : "Disconnected"}</Text>
                </View>
                <Text style={styles.muted}>{account.phone || "Phone number unavailable"}</Text>
                <View style={styles.row}>
                  {account.authenticated ? (
                    <Pressable accessibilityRole="button" disabled={reconnect.isPending} style={styles.secondary} onPress={() => reconnect.mutate({ accountId: account.id })}>
                      <Text style={styles.text}>{reconnect.isPending ? "Refreshing…" : "Refresh connection"}</Text>
                    </Pressable>
                  ) : (
                    <Pressable accessibilityRole="button" disabled={pair.isPending} style={styles.secondary} onPress={() => {
                      setPairAccountId(account.id);
                      setNewAccountName(account.id);
                      setMode("pair");
                    }}>
                      <Text style={styles.text}>{pairing ? "Pairing…" : "Pair with QR"}</Text>
                    </Pressable>
                  )}
                  <Pressable accessibilityRole="button" disabled={!account.running || disconnect.isPending} style={styles.secondary} onPress={() => disconnect.mutate({ accountId: account.id })}>
                    <Text style={styles.text}>{disconnect.isPending ? "Disconnecting…" : "Disconnect"}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => openWebhookSettings(account.id)}>
                    <Text style={styles.text}>Webhook</Text>
                  </Pressable>
                </View>
                {statusByAccount[account.id] ? <Text style={styles.muted}>{statusByAccount[account.id]}</Text> : null}
              </View>
            );
          })}
          <Pressable accessibilityRole="button" disabled={refresh.isPending} style={styles.secondary} onPress={() => refresh.mutate({})}>
            <Text style={styles.text}>{refresh.isPending ? "Checking…" : "Refresh list"}</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.muted}>
            {subscription.status === "error" ? subscription.error.message : subscription.status === "connecting" ? "Connecting to Waseo…" : ""}
          </Text>
        </>
      ) : null}

      {mode === "pair" ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Pair a WhatsApp number</Text>
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setMode("list")}>
              <Text style={styles.text}>Back</Text>
            </Pressable>
          </View>
          {supportsMultiple ? (
            <>
              <Text style={styles.text}>Name</Text>
              <TextInput accessibilityLabel="WhatsApp account name" autoCapitalize="none" autoCorrect={false} placeholder="e.g. work or support" placeholderTextColor={theme.colors.foregroundMuted} style={styles.input} value={newAccountName} onChangeText={setNewAccountName} />
            </>
          ) : <Text style={styles.muted}>Waseo will pair the default WACLI account.</Text>}

          <Text style={styles.muted}>Webhook settings are optional. Add them if a bot should receive new WhatsApp events.</Text>
          <Text style={styles.text}>Webhook URL</Text>
          <TextInput accessibilityLabel="Webhook URL" autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://your-bot.example/webhook" placeholderTextColor={theme.colors.foregroundMuted} style={styles.input} value={(webhooks[pairTarget] ?? { url: "", secret: "" }).url} onChangeText={(url) => setWebhooks((previous) => ({ ...previous, [pairTarget]: { ...(previous[pairTarget] ?? { url: "", secret: "" }), url } }))} />
          <Text style={styles.text}>Webhook signing secret (optional)</Text>
          <TextInput accessibilityLabel="Webhook signing secret" autoCapitalize="none" autoCorrect={false} placeholder="Secret verified by your endpoint" placeholderTextColor={theme.colors.foregroundMuted} secureTextEntry style={styles.input} value={(webhooks[pairTarget] ?? { url: "", secret: "" }).secret} onChangeText={(secret) => setWebhooks((previous) => ({ ...previous, [pairTarget]: { ...(previous[pairTarget] ?? { url: "", secret: "" }), secret } }))} />
          <Pressable accessibilityRole="button" disabled={!pairNameValid || pairNameExists || pair.isPending || pairingInProgress} style={styles.primary} onPress={submitPairing}>
            <Text style={styles.buttonText}>{pair.isPending ? "Starting…" : pairingInProgress ? "Waiting for scan" : qr ? "Regenerate QR code" : "Show QR code"}</Text>
          </Pressable>
          {pairNameExists ? <Text style={styles.text}>That number is already paired. Choose another name or return to the list.</Text> : null}
          {!pairNameValid ? <Text style={styles.text}>Use a name with letters, numbers, dots, underscores, or hyphens.</Text> : null}
          {pair.error ? <Text style={styles.text}>{pair.error.message}</Text> : null}
          {qr ? <View style={styles.qrBox}><Text accessibilityLabel="Scan with WhatsApp linked devices" style={styles.qrCode}>{qr}</Text></View> : null}
          {pairStatus ? <Text accessibilityLiveRegion="polite" style={styles.text}>{pairStatus}</Text> : null}
          {pairStatus?.startsWith("Pairing complete") ? (
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setMode("list")}>
              <Text style={styles.text}>Done</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {mode === "webhook" ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Webhook</Text>
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setMode("list")}>
              <Text style={styles.text}>Back</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>{targetAccount?.name ?? webhookAccountId}</Text>
          <Text style={styles.text}>Webhook URL</Text>
          <TextInput accessibilityLabel="Webhook URL" autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://your-bot.example/webhook" placeholderTextColor={theme.colors.foregroundMuted} style={styles.input} value={webhook.url} onChangeText={(url) => setWebhooks((previous) => ({ ...previous, [webhookAccountId]: { ...webhook, url } }))} />
          <Text style={styles.text}>Webhook signing secret (optional)</Text>
          <TextInput accessibilityLabel="Webhook signing secret" autoCapitalize="none" autoCorrect={false} placeholder="Secret verified by your endpoint" placeholderTextColor={theme.colors.foregroundMuted} secureTextEntry style={styles.input} value={webhook.secret} onChangeText={(secret) => setWebhooks((previous) => ({ ...previous, [webhookAccountId]: { ...webhook, secret } }))} />
          <Text style={styles.muted}>The signing secret stays in memory and needs to be entered again after Waseo or the daemon restarts. Waseo adds a `waseo_account` query parameter to distinguish numbers.</Text>
          <Pressable accessibilityRole="button" disabled={reconnect.isPending} style={styles.primary} onPress={() => reconnect.mutate({ accountId: webhookAccountId, webhookUrl: webhook.url.trim(), webhookSecret: webhook.secret })}>
            <Text style={styles.buttonText}>{reconnect.isPending ? "Saving…" : "Save and refresh connection"}</Text>
          </Pressable>
          {reconnect.error ? <Text style={styles.text}>{reconnect.error.message}</Text> : null}
          {statusByAccount[webhookAccountId] ? <Text style={styles.muted}>{statusByAccount[webhookAccountId]}</Text> : null}
          <View style={styles.separator} />
          <Pressable accessibilityRole="button" disabled={recent.isPending} style={styles.secondary} onPress={() => recent.mutate({ accountId: webhookAccountId, limit: 20 })}>
            <Text style={styles.text}>{recent.isPending ? "Loading…" : "Load recent messages"}</Text>
          </Pressable>
          {recent.error ? <Text style={styles.text}>{recent.error.message}</Text> : null}
          {messages.map((message) => (
            <View key={`${message.chat}:${message.id}`} style={styles.card}>
              <Text style={styles.text}>{message.fromMe ? "You" : message.sender || message.chat}</Text>
              <Text style={styles.text}>{message.text || "(media or non-text message)"}</Text>
              <Text style={styles.muted}>{message.timestamp}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
