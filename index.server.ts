import type { PluginServerContext } from "@getpaseo/plugin/server";
import { contributeWaseo } from "./server/whatsapp";

export default function contribute(server: PluginServerContext) {
  return contributeWaseo(server);
}
