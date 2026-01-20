import { internalIpV4 } from "internal-ip";

export async function getIp() {
  const ip = await internalIpV4(); // or v6()
  return ip || "";
}

export const checkIsDevHost = (url) => {
  //  http://localhost:3000/ or port 3000

  try {
    const u = new URL(url);
    if (u.hostname === "localhost") return true;

    const port = Number(u.port);
    if (port === 3000) return true;

    return false;
  } catch {
    return false;
  }
};
