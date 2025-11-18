import { useMount } from "react-use";
import { useInstallationMac } from "./hooks";

export function PageRunning() {
  const [state, actions] = useInstallationMac();

  useMount(() => {
    void actions.start();
  });

  function toggleConversation() {
    if (state.isActive) {
      void actions.end();
    } else {
      void actions.start();
    }
  }

  return (
    <>
      <button onClick={toggleConversation}>
        {state.isActive ? "Pause" : "Start"}
      </button>
      <br />
      <br />
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </>
  );
}
