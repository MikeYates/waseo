import type { PaseoAgent } from "@getpaseo/client";
import type { PluginButtonRegistration, PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { WaseoScreen } from "./client/whatsapp";
import { WacliSettingsScreen } from "./client/wacli-settings";

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

  const pills = new Map<string, PluginButtonRegistration>();
  const lifetime = new AbortController();
  const registerPill = (agent: PaseoAgent) => {
    if (!agent.workspaceId || agent.background) return;

    const enabled = agent.metadata?.waseoToolsEnabled === true;
    const busy = agent.status === "running" || Boolean(agent.pendingPermissions?.length);
    const button = {
      title: enabled ? "Waseo tools are enabled for this agent" : "Waseo tools are off for this agent",
      icon: "MessageCircle" as const,
      label: enabled ? "Waseo on" : "Waseo off",
      behavior: {
        kind: "menu" as const,
        items: [
          {
            kind: "item" as const,
            id: "toggle-waseo-tools",
            title: enabled ? "Disable Waseo tools and reload" : "Enable Waseo tools and reload",
            disabled: busy,
            behavior: {
              kind: "action" as const,
              onPress: async () => {
                const ref = client.paseo.agents.ref(agent.id);
                const current = ref.current() ?? agent;
                if (current.status === "running" || current.pendingPermissions?.length) {
                  throw new Error("Wait for this agent to finish and clear pending approvals before changing Waseo access.");
                }

                const nextEnabled = current.metadata?.waseoToolsEnabled !== true;
                await ref.setMetadata({ waseoToolsEnabled: nextEnabled });
                try {
                  await ref.reload();
                } catch (error) {
                  await ref.setMetadata({ waseoToolsEnabled: current.metadata?.waseoToolsEnabled === true });
                  throw error;
                }
              },
            },
          },
        ],
      },
    };

    const existing = pills.get(agent.id);
    if (existing) {
      existing.update(button);
      return;
    }
    pills.set(agent.id, client.addComposerPill({
      id: "waseo-access",
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      button,
    }));
  };
  const removeAll = () => {
    for (const pill of pills.values()) pill.remove();
    pills.clear();
  };

  void client.paseo.agents.list({ subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries }) => {
          removeAll();
          for (const { agent } of entries) registerPill(agent);
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "upsert") return registerPill(update.agent);
          pills.get(update.agentId)?.remove();
          pills.delete(update.agentId);
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
