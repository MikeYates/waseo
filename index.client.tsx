import {
  useAgent,
  useAgents,
  type AgentRef,
  type PluginButtonContentProps,
  type PluginButtonIconProps,
  type PluginButtonRegistration,
  type PluginClientContext,
  type PluginSidebarItemProps,
} from "@getpaseo/plugin/client";
import { Icon, SidebarRow } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { WaseoScreen } from "./client/whatsapp";
import { WacliSettingsScreen } from "./client/wacli-settings";

type AgentEntry = {
  id: string;
  workspaceId?: string | null;
  background?: boolean;
  labels?: Readonly<Record<string, string>>;
  metadata?: Readonly<Record<string, unknown>>;
};

function createWaseoLogoIcon(muted: boolean) {
  return function WaseoLogoIcon({ size, color, theme }: PluginButtonIconProps) {
    const background = muted ? theme.colors.surface2 : "#103b2b";
    const foreground = muted ? theme.colors.foregroundMuted : "#ffffff";
    const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="19" fill="${background}"/><path d="M18 35c5-3 11-5 15-2 5 4-1 18-1 27 0 6 3 9 7 7 7-4 10-21 12-32h9c-1 11-4 26-2 31 2 5 6 4 9-2 5-7 7-20 7-29h10c0 12-3 27-9 35-9 12-21 9-26-1-6 10-20 13-28 5-8-9-7-25-3-39z" fill="${foreground}"/></svg>`;
    return <Icon icon={{ svg }} size={size} color={muted ? color : foreground} />;
  };
}

function AgentAccessRow({ agentRef, client, theme }: { agentRef: AgentRef; client: PluginClientContext; theme: PluginButtonContentProps["theme"] }) {
  const agent = useAgent(agentRef);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!agent) return null;

  const enabled = agent.metadata.waseoToolsEnabled === true;
  const unavailable = agent.status === "running" || agent.status === "initializing";

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const ref = client.paseo.agents.ref(agent.id);
      let current = ref.current();
      if (!current) {
        await ref.refresh();
        current = ref.current();
      }
      if (!current) throw new Error("This agent is no longer available.");
      if (current.status === "running" || current.status === "initializing" || current.pendingPermissions?.length) {
        throw new Error("Wait for this agent to finish and clear pending approvals before changing Waseo access.");
      }

      const previousValue = current.metadata?.waseoToolsEnabled;
      const nextEnabled = previousValue !== true;
      await ref.setMetadata({ waseoToolsEnabled: nextEnabled });
      try {
        await ref.reload();
      } catch (error) {
        await ref.setMetadata({ waseoToolsEnabled: previousValue ?? null });
        throw error;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update Waseo access.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "600" }}>{enabled ? "Active" : "Inactive"}</Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`${enabled ? "Disable" : "Enable"} Waseo`}
          accessibilityState={{ checked: enabled, disabled: busy || unavailable }}
          disabled={busy || unavailable}
          onPress={() => void toggle()}
          style={{ minWidth: 58, alignItems: "center", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: enabled ? theme.colors.accent : theme.colors.surface2, opacity: busy || unavailable ? 0.5 : 1 }}
        >
          <Text style={{ color: enabled ? theme.colors.accentForeground : theme.colors.foreground, fontSize: 12, fontWeight: "600" }}>{busy ? "…" : enabled ? "On" : "Off"}</Text>
        </Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.statusDanger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

function createWaseoAccessPopover(client: PluginClientContext) {
  return function WaseoAccessPopover({ workspaceId, theme }: PluginButtonContentProps) {
    const agentRefs = useAgents({
      where: (agent) => agent.workspaceId === workspaceId && !agent.background && !agent.labels?.["paseo-bots.bot"],
    });

    return (
      <View style={{ minWidth: 280, maxWidth: 420, gap: 8 }}>
        {agentRefs.length === 0 ? (
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, paddingVertical: 10 }}>No interactive agents in this workspace.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {agentRefs.map((agentRef) => <AgentAccessRow key={agentRef.id} agentRef={agentRef} client={client} theme={theme} />)}
          </ScrollView>
        )}
      </View>
    );
  };
}

function createBotAccessPopover(
  client: PluginClientContext,
  onWorkspaceAccessChange: (workspaceId: string, enabled: boolean) => void,
) {
  function BotAccessControls({ workspaceId, agentId, theme }: { workspaceId: string; agentId: string; theme: PluginButtonContentProps["theme"] }) {
    const agent = useAgent(agentId);
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let mounted = true;
      setLoading(true);
      void client.paseo.workspaces.ref(workspaceId).refresh()
        .then((workspace) => {
          if (mounted) setEnabled(workspace?.metadata?.["waseo.toolsEnabled"] === true);
        })
        .catch((caught: unknown) => {
          if (mounted) setError(caught instanceof Error ? caught.message : "Could not read Waseo access for this bot.");
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => { mounted = false; };
    }, [client, workspaceId]);

    const unavailable = !agent || agent.status === "running" || agent.status === "initializing";
    const toggle = async () => {
      setBusy(true);
      setError(null);
      try {
        const agentRef = client.paseo.agents.ref(agentId);
        let currentAgent = agentRef.current();
        if (!currentAgent) {
          await agentRef.refresh();
          currentAgent = agentRef.current();
        }
        if (!currentAgent) throw new Error("This bot chat is no longer available.");
        if (currentAgent.status === "running" || currentAgent.status === "initializing" || currentAgent.pendingPermissions?.length) {
          throw new Error("Wait for this bot to finish and clear pending approvals before changing Waseo access.");
        }

        const workspaceRef = client.paseo.workspaces.ref(workspaceId);
        const currentWorkspace = await workspaceRef.refresh();
        if (!currentWorkspace) throw new Error("This bot workspace is no longer available.");
        const previousValue = currentWorkspace.metadata?.["waseo.toolsEnabled"];
        const nextEnabled = previousValue !== true;
        await workspaceRef.setMetadata({ "waseo.toolsEnabled": nextEnabled });
        try {
          await agentRef.reload();
        } catch (caught) {
          await workspaceRef.setMetadata({ "waseo.toolsEnabled": previousValue ?? null });
          throw caught;
        }
        setEnabled(nextEnabled);
        onWorkspaceAccessChange(workspaceId, nextEnabled);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update Waseo access.");
      } finally {
        setBusy(false);
      }
    };

    return (
      <View style={{ minWidth: 280, maxWidth: 420, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "600" }}>{loading ? "Loading" : enabled ? "Active" : "Inactive"}</Text>
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>Applies to this Bot’s chats.</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={`${enabled ? "Disable" : "Enable"} Waseo for this bot`}
            accessibilityState={{ checked: enabled, disabled: loading || busy || unavailable }}
            disabled={loading || busy || unavailable}
            onPress={() => void toggle()}
            style={{ minWidth: 58, alignItems: "center", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: enabled ? theme.colors.accent : theme.colors.surface2, opacity: loading || busy || unavailable ? 0.5 : 1 }}
          >
            <Text style={{ color: enabled ? theme.colors.accentForeground : theme.colors.foreground, fontSize: 12, fontWeight: "600" }}>{busy ? "…" : enabled ? "On" : "Off"}</Text>
          </Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.statusDanger, fontSize: 12 }}>{error}</Text> : null}
      </View>
    );
  }

  return function BotAccessPopover(props: PluginButtonContentProps) {
    if (props.context !== "agent") return null;
    return <BotAccessControls workspaceId={props.workspaceId} agentId={props.agentId} theme={props.theme} />;
  };
}

function WhatsAppItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="MessageCircle"
      active={currentScreen?.screenId === "waseo"}
      onPress={() => openScreen({ screenId: "waseo" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "waseo", title: "Waseo", Component: WaseoScreen });
  client.addSidebarHeaderItem({ id: "waseo", title: "Waseo", Component: WhatsAppItem });
  client.addSettingsScreen({ id: "wacli", title: "WACLI", icon: "Settings", Component: WacliSettingsScreen });

  const headerButtons = new Map<string, PluginButtonRegistration>();
  const botPills = new Map<string, PluginButtonRegistration>();
  const agentsByWorkspace = new Map<string, Map<string, AgentEntry>>();
  const botAgentsByWorkspace = new Map<string, Map<string, AgentEntry>>();
  const agentWorkspaces = new Map<string, string>();
  const botAgentWorkspaces = new Map<string, string>();
  const enabledByWorkspace = new Map<string, boolean>();
  const botEnabledByWorkspace = new Map<string, boolean>();
  const lifetime = new AbortController();

  const accessPopover = createWaseoAccessPopover(client);
  const updateBotPills = (workspaceId: string) => {
    const enabled = botEnabledByWorkspace.get(workspaceId) === true;
    for (const agent of botAgentsByWorkspace.get(workspaceId)?.values() ?? []) {
      const button = {
        title: enabled ? "Waseo is active for this Bot" : "Waseo is inactive for this Bot",
        icon: createWaseoLogoIcon(!enabled),
        label: enabled ? "Active" : "Inactive",
        behavior: { kind: "popover" as const, Content: botAccessPopover },
      };
      const existing = botPills.get(agent.id);
      if (existing) {
        existing.update(button);
        continue;
      }
      botPills.set(agent.id, client.addComposerPill({
        id: "waseo-access",
        workspaceId,
        agentId: agent.id,
        button,
      }));
    }
  };
  const botAccessPopover = createBotAccessPopover(client, (workspaceId, enabled) => {
    botEnabledByWorkspace.set(workspaceId, enabled);
    updateBotPills(workspaceId);
  });
  const loadBotAccess = (workspaceId: string) => {
    if (botEnabledByWorkspace.has(workspaceId)) return;
    void client.paseo.workspaces.ref(workspaceId).refresh()
      .then((workspace) => {
        if (lifetime.signal.aborted || !botAgentsByWorkspace.has(workspaceId)) return;
        botEnabledByWorkspace.set(workspaceId, workspace?.metadata?.["waseo.toolsEnabled"] === true);
        updateBotPills(workspaceId);
      })
      .catch((error: unknown) => {
        if (!lifetime.signal.aborted) console.error("Waseo Bot access lookup failed", error);
      });
  };
  const updateWorkspaceButton = (workspaceId: string) => {
    const agents = [...(agentsByWorkspace.get(workspaceId)?.values() ?? [])].filter((agent) => !agent.background);
    if (agents.length === 0) {
      headerButtons.get(workspaceId)?.remove();
      headerButtons.delete(workspaceId);
      enabledByWorkspace.delete(workspaceId);
      return;
    }

    const enabled = agents.some((agent) => agent.metadata?.waseoToolsEnabled === true);
    const existing = headerButtons.get(workspaceId);
    if (existing && enabledByWorkspace.get(workspaceId) === enabled) return;
    enabledByWorkspace.set(workspaceId, enabled);
    const button = {
      title: enabled ? "Waseo access is enabled in this workspace" : "Waseo access is off in this workspace",
      icon: createWaseoLogoIcon(!enabled),
      behavior: { kind: "popover" as const, Content: accessPopover },
    };
    if (existing) {
      existing.update({ title: button.title, icon: button.icon });
      return;
    }
    headerButtons.set(workspaceId, client.addHeaderButton({ id: "waseo-access", workspaceId, button }));
  };

  const removeAgent = (agentId: string, workspaceId?: string) => {
    const owner = agentWorkspaces.get(agentId);
    const botOwner = botAgentWorkspaces.get(agentId);
    const targetWorkspace = workspaceId ?? owner;
    if ((owner && workspaceId && owner !== workspaceId) || (botOwner && workspaceId && botOwner !== workspaceId)) return;
    if (botOwner && (!targetWorkspace || botOwner === targetWorkspace)) {
      botPills.get(agentId)?.remove();
      botPills.delete(agentId);
      const botAgents = botAgentsByWorkspace.get(botOwner);
      botAgents?.delete(agentId);
      if (botAgents?.size === 0) {
        botAgentsByWorkspace.delete(botOwner);
        botEnabledByWorkspace.delete(botOwner);
      } else {
        updateBotPills(botOwner);
      }
      botAgentWorkspaces.delete(agentId);
    }
    for (const [candidateId, agents] of agentsByWorkspace) {
      if (targetWorkspace && candidateId !== targetWorkspace) continue;
      if (!agents.delete(agentId)) continue;
      if (agents.size === 0) agentsByWorkspace.delete(candidateId);
      agentWorkspaces.delete(agentId);
      updateWorkspaceButton(candidateId);
      return;
    }
    agentWorkspaces.delete(agentId);
  };

  const registerAgent = (agent: AgentEntry) => {
    const previousWorkspaceId = agentWorkspaces.get(agent.id);
    if (previousWorkspaceId && previousWorkspaceId !== agent.workspaceId) removeAgent(agent.id, previousWorkspaceId);
    const previousBotWorkspaceId = botAgentWorkspaces.get(agent.id);
    if (previousBotWorkspaceId && previousBotWorkspaceId !== agent.workspaceId) removeAgent(agent.id, previousBotWorkspaceId);
    if (!agent.workspaceId) {
      removeAgent(agent.id);
      return;
    }
    const workspaceId = agent.workspaceId;
    const isBotAgent = Boolean(agent.labels?.["paseo-bots.bot"]) && !agent.background;
    if (isBotAgent) {
      if (previousWorkspaceId) {
        const previousAgents = agentsByWorkspace.get(previousWorkspaceId);
        previousAgents?.delete(agent.id);
        if (previousAgents?.size === 0) agentsByWorkspace.delete(previousWorkspaceId);
        agentWorkspaces.delete(agent.id);
        updateWorkspaceButton(previousWorkspaceId);
      }
      const botAgents = botAgentsByWorkspace.get(workspaceId) ?? new Map<string, AgentEntry>();
      botAgents.set(agent.id, agent);
      botAgentsByWorkspace.set(workspaceId, botAgents);
      botAgentWorkspaces.set(agent.id, workspaceId);
      updateBotPills(workspaceId);
      loadBotAccess(workspaceId);
      return;
    }
    if (previousBotWorkspaceId) removeAgent(agent.id, previousBotWorkspaceId);
    if (agent.background) {
      removeAgent(agent.id, workspaceId);
      return;
    }
    const agents = agentsByWorkspace.get(workspaceId) ?? new Map<string, AgentEntry>();
    agents.set(agent.id, agent);
    agentsByWorkspace.set(workspaceId, agents);
    agentWorkspaces.set(agent.id, workspaceId);
    updateWorkspaceButton(workspaceId);
  };

  const removeAll = () => {
    for (const button of headerButtons.values()) button.remove();
    for (const pill of botPills.values()) pill.remove();
    headerButtons.clear();
    botPills.clear();
    agentsByWorkspace.clear();
    botAgentsByWorkspace.clear();
    agentWorkspaces.clear();
    botAgentWorkspaces.clear();
    enabledByWorkspace.clear();
    botEnabledByWorkspace.clear();
  };

  void client.paseo.agents.list({ subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries }) => {
          removeAll();
          for (const { agent } of entries) registerAgent(agent);
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "upsert") return registerAgent(update.agent);
          removeAgent(update.agentId);
        },
      });
    })
    .catch((error: unknown) => {
      if (!lifetime.signal.aborted) console.error("Waseo agent observation failed", error);
    });

  return () => {
    lifetime.abort();
    removeAll();
  };
}
