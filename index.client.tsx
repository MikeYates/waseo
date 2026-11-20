import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
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
  return () => {};
}
