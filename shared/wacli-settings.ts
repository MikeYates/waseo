import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const wacliPreferences = defineSettings({
  id: "wacli",
  scope: "host",
  version: 1,
  schema: z.object({ runOnStartup: z.boolean().default(false) }),
});
