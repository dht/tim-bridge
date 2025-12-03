export function mapStatusToLedMode(status) {
  if (!status) return "IDLE";

  if (status.startsWith("1.")) return "IDLE";
  if (status.startsWith("2a.")) return "GENERATING";
  if (status.startsWith("2b.")) return "READY";
  if (status.startsWith("3a.")) return "PLAYBACK";
  if (status.startsWith("3b.")) return "DONE";
  if (status.startsWith("4.")) return "RESETTING";
  if (status.startsWith("0.")) return "ERROR";
  return "IDLE";
}
