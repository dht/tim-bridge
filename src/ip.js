import { internalIpV4 } from "internal-ip";

export async function getIp() {
  const ip = await internalIpV4(); // or v6()
  return ip || "";
}
