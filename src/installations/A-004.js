// candle
export async function onChange(data) {
  const { status } = data;

  if (status) {
    console.log("LED status:", status);
    setStatus(status);
  }

  console.log("✅ Playback + Lights completed.");
}
