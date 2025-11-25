// claygon
export async function onChange(data) {
  const { status } = data;

  if (status) {
    console.log("LED status:", status);
    setStatus(status);
  }

  /* 
    when status is 'GENERATING'
    open a browser with: https://tim-os.web.app/A-001/edge/running
    when status is 'RESETTING'
    close the browser
  */

  console.log("✅ Playback + Lights completed.");
}
