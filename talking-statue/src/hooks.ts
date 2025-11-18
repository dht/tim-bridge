import { useConversation } from "@elevenlabs/react";
import { useState } from "react";

type InstallationMacState = {
  isActive: boolean;
  status: ReturnType<typeof useConversation>["status"];
  isSpeaking: ReturnType<typeof useConversation>["isSpeaking"];
  micMuted: ReturnType<typeof useConversation>["micMuted"];
};

type InstallationMacActions = {
  start: () => Promise<void>;
  end: () => Promise<void>;
};

type InstallationMacHook = [InstallationMacState, InstallationMacActions];

export function useInstallationMac(): InstallationMacHook {
  const { startSession, endSession, status, isSpeaking, micMuted } =
    useConversation();
  const [isActive, setIsActive] = useState(false);

  async function start() {
    await startSession({
      agentId: "agent_6601k8jrhpwzfhtv8w362nh6ees4",
      connectionType: "webrtc",
    });
    setIsActive(true);
  }

  async function end() {
    await endSession();
    setIsActive(false);
  }

  const installationState: InstallationMacState = {
    isActive,
    status,
    isSpeaking,
    micMuted,
  };

  const installationActions: InstallationMacActions = {
    start,
    end,
  };

  return [installationState, installationActions];
}
