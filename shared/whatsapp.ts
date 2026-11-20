import { defineRpc, defineSubscription } from "@getpaseo/plugin";
import { z } from "zod";

export const whatsappEvent = defineSubscription({
  name: "waseo.events",
  input: z.object({}),
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("accounts"), supportsMultiple: z.boolean(), accounts: z.array(z.object({
      id: z.string(), name: z.string(), phone: z.string(), authenticated: z.boolean(), running: z.boolean(),
    })) }),
    z.object({ type: z.literal("status"), accountId: z.string(), message: z.string() }),
    z.object({ type: z.literal("qr"), accountId: z.string(), matrix: z.string() }),
    z.object({ type: z.literal("error"), accountId: z.string(), message: z.string() }),
  ]),
});

export const whatsappStart = defineRpc({
  name: "waseo.account.start",
  input: z.object({ accountId: z.string(), webhookUrl: z.string().url().optional(), webhookSecret: z.string().max(512).optional() }),
  output: z.object({ started: z.boolean(), message: z.string() }),
});

export const whatsappReconnect = defineRpc({
  name: "waseo.account.reconnect",
  input: z.object({
    accountId: z.string(),
    webhookUrl: z.string().optional(),
    webhookSecret: z.string().max(512).optional(),
  }),
  output: z.object({ started: z.boolean(), message: z.string() }),
});

export const whatsappStop = defineRpc({
  name: "waseo.account.stop",
  input: z.object({ accountId: z.string() }),
  output: z.object({ stopped: z.boolean() }),
});

export const whatsappListAccounts = defineRpc({
  name: "waseo.accounts.list",
  input: z.object({}),
  output: z.object({ supportsMultiple: z.boolean(), accounts: z.array(z.object({
    id: z.string(), name: z.string(), phone: z.string(), authenticated: z.boolean(), running: z.boolean(),
  })) }),
});

export const whatsappReadRecent = defineRpc({
  name: "waseo.messages.recent",
  input: z.object({ accountId: z.string(), limit: z.number().int().min(1).max(50) }),
  output: z.object({ messages: z.array(z.object({
    id: z.string(),
    chat: z.string(),
    sender: z.string(),
    timestamp: z.string(),
    text: z.string(),
    fromMe: z.boolean(),
  })) }),
});

export const wacliStatus = defineRpc({
  name: "waseo.wacli.status",
  input: z.object({}),
  output: z.object({
    installed: z.boolean(),
    version: z.string(),
    running: z.boolean(),
    processCount: z.number().int().nonnegative(),
    dataPaths: z.array(z.string()),
    canUninstall: z.boolean(),
    canInstall: z.boolean(),
  }),
});

export const wacliManage = defineRpc({
  name: "waseo.wacli.manage",
  input: z.object({ action: z.enum(["run", "stop", "restart", "install", "uninstall", "wipe-data"]) }),
  output: z.object({ success: z.boolean(), message: z.string() }),
});
