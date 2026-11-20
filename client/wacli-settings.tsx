import { useRpc, useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { SettingsAction, SettingsCard, SettingsRow, SettingsSection, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { wacliManage, wacliStatus } from "../shared/whatsapp";
import { wacliPreferences } from "../shared/wacli-settings";

export function WacliSettingsScreen({ theme, layout }: PluginSurfaceProps) {
  const preferences = useSettings(wacliPreferences);
  const readStatus = useRpc(wacliStatus);
  const manageWacli = useRpc(wacliManage);
  const [notice, setNotice] = useState("");
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const status = useMutation({ mutationFn: readStatus });
  const operation = useMutation({
    mutationFn: manageWacli,
    onSuccess: async (result, input) => {
      setNotice(result.message);
      if (input.action === "uninstall") setConfirmUninstall(false);
      if (input.action === "wipe-data") setConfirmWipe(false);
      await status.mutateAsync({});
    },
  });

  useEffect(() => { status.mutate({}); }, []);

  const styles = useMemo(() => ({
    page: { gap: 18, padding: layout.compact ? 16 : 24 },
    text: { color: theme.colors.foreground },
    muted: { color: theme.colors.foregroundMuted },
    error: { color: theme.colors.foreground },
  }), [theme, layout.compact]);

  const info = status.data;
  const busy = operation.isPending || status.isPending;
  const primaryAction = !info?.installed ? "install" : info.running ? "stop" : "run";
  const primaryLabel = primaryAction === "install" ? "Install WACLI" : primaryAction === "stop" ? "Stop WACLI" : "Run WACLI";

  function perform(action: "run" | "stop" | "restart" | "install" | "uninstall" | "wipe-data") {
    setNotice("");
    operation.mutate({ action });
  }

  function saveStartup(value: boolean) {
    if (preferences.status !== "ready") return;
    void preferences.save({ ...preferences.values, runOnStartup: value }, preferences.revision);
  }

  return (
    <View style={styles.page}>
      <SettingsSection title="WACLI" info="WACLI runs as a sync process for each paired WhatsApp number. Waseo manages those long-running processes on this Paseo daemon.">
        <SettingsCard>
          <SettingsRow
            label="Installation"
            hint={!info ? "Checking the Paseo daemon…" : info.installed ? `${info.version || "WACLI installed"}${info.running ? ` · ${info.processCount} process${info.processCount === 1 ? "" : "es"} running` : " · Not running"}` : "WACLI is not installed on the Paseo daemon machine."}
          />
          <SettingsAction
            label="WACLI process"
            hint={primaryAction === "run" ? "Starts sync for every paired number." : primaryAction === "stop" ? "Stops WACLI sync and pairing processes. Saved pairings remain available." : "Downloads and verifies the latest Linux release."}
            actionLabel={busy ? "Working…" : primaryLabel}
            disabled={!info || busy || (primaryAction === "install" && !info.canInstall)}
            onPress={() => perform(primaryAction)}
          />
          {info?.installed && info.running ? (
            <SettingsAction
              label="Restart WACLI"
              hint="Stops active WACLI processes, then starts sync again for all paired numbers."
              actionLabel={busy ? "Working…" : "Restart"}
              disabled={busy}
              onPress={() => perform("restart")}
            />
          ) : null}
          {info && !info.canInstall && !info.installed ? (
            <SettingsRow label="Installer unavailable" hint="Automatic installation currently supports Linux x64 and ARM64. Install WACLI with its official instructions on this machine." />
          ) : null}
          <SettingsRow
            label="Status"
            hint={!info ? "Loading…" : info.running ? "Running" : "Not running"}
          />
          <SettingsAction label="Refresh status" hint="Check the WACLI binary and active sync processes again." actionLabel="Refresh" disabled={busy} onPress={() => status.mutate({})} />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Startup">
        <SettingsCard>
          <SettingsSwitch
            label="Run WACLI on startup"
            hint="Start sync for paired numbers when Waseo loads with the Paseo daemon."
            value={preferences.status === "ready" && preferences.values.runOnStartup}
            onValueChange={saveStartup}
            disabled={preferences.status !== "ready" || preferences.saving}
          />
          {preferences.status === "error" || preferences.status === "invalid" ? (
            <SettingsRow label="Startup preference" hint={preferences.error} />
          ) : null}
          {preferences.saveError ? <SettingsRow label="Could not save" hint={preferences.saveError} /> : null}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Uninstall WACLI" info="Uninstalling the binary does not remove WhatsApp sessions or message archives.">
        <SettingsCard>
          {confirmUninstall ? (
            <>
              <SettingsRow label="Confirm uninstall" hint="This removes the standalone WACLI binary. Your WACLI data stays on disk." />
              <SettingsAction label="Uninstall WACLI" actionLabel="Confirm uninstall" disabled={busy || !info?.canUninstall} onPress={() => perform("uninstall")} />
              <SettingsAction label="Cancel" actionLabel="Cancel" disabled={busy} onPress={() => setConfirmUninstall(false)} />
            </>
          ) : (
            <SettingsAction
              label="WACLI binary"
              hint={!info?.installed ? "WACLI is not installed." : info.canUninstall ? "Remove the standalone binary installed under ~/.local/bin." : "This binary is managed outside Waseo. Use its package manager to uninstall it."}
              actionLabel="Uninstall WACLI"
              disabled={!info?.installed || busy || !info.canUninstall}
              onPress={() => setConfirmUninstall(true)}
            />
          )}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Wipe WACLI data" info="This removes linked-device sessions, local message archives, media, and account configuration. You will need to pair the numbers again.">
        <SettingsCard>
          {info?.dataPaths.map((path) => <SettingsRow key={path} label="Data path" hint={path} />)}
          {confirmWipe ? (
            <>
              <SettingsRow label="Confirm data wipe" hint="This is permanent. All listed WACLI data paths will be removed after active sync processes stop." />
              <SettingsAction label="WACLI data" actionLabel="Confirm wipe data" disabled={busy} onPress={() => perform("wipe-data")} />
              <SettingsAction label="Cancel" actionLabel="Cancel" disabled={busy} onPress={() => setConfirmWipe(false)} />
            </>
          ) : (
            <SettingsAction label="WACLI data" hint="WACLI stays installed; this only deletes its data." actionLabel="Wipe WACLI data" disabled={busy} onPress={() => setConfirmWipe(true)} />
          )}
        </SettingsCard>
      </SettingsSection>

      {status.error ? <Text style={styles.error}>{status.error.message}</Text> : null}
      {operation.error ? <Text style={styles.error}>{operation.error.message}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text> : null}
      <Text style={styles.muted}>WACLI data is stored on the daemon machine. Wiping it deletes paired sessions and local message history.</Text>
    </View>
  );
}
