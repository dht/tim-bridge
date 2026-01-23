import fs from "fs";

function getArmVersion() {
  try {
    const armVersion = parseInt(process.config?.variables?.arm_version);
    return isNaN(armVersion) ? null : armVersion;
  } catch {
    return null;
  }
}

function getCpuModel() {
  try {
    const cpuinfo = fs.readFileSync("/proc/cpuinfo", "utf8");
    const modelLine = cpuinfo
      .split("\n")
      .find(
        (line) =>
          line.toLowerCase().startsWith("model") ||
          line.toLowerCase().startsWith("hardware"),
      );
    return modelLine ? modelLine.split(":")[1].trim() : null;
  } catch {
    return null;
  }
}

export function identifyDevice() {
  const arch = process.arch; // 'arm', 'arm64', ...
  const armVersion = getArmVersion(); // 6,7,8,... or null
  const platform = process.platform; // 'linux', 'darwin', ...
  const cpuModel = platform === "linux" ? getCpuModel() : null;

  // existing classifications
  const isPiZero1 = arch === "arm" && armVersion === 6;
  const isPiZero2 = arch === "arm" && armVersion >= 7 && armVersion < 8;
  const isMacArm = arch === "arm64" && platform === "darwin";

  // Raspberry Pi 4 / 4B detection
  const isPi4 = cpuModel && /raspberry pi 4|bcm2711/i.test(cpuModel);

  // Raspberry Pi 5 detection
  const isPi5 =
    cpuModel && (/raspberry pi 5/i.test(cpuModel) || /bcm2712/i.test(cpuModel));

  const output = isPiZero1
    ? "pi-zero-1"
    : isPiZero2
      ? "pi-zero-2"
      : isPi5
        ? "pi-5"
        : isPi4
          ? "pi-4"
          : isMacArm
            ? "mac"
            : "other";

  return { device: output, arch, armVersion, platform, cpuModel };
}

export function logDevice() {
  const info = identifyDevice();
  console.table(info);
}
