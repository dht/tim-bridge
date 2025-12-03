export function identifyDevice() {
  const arch = process.arch; // 'arm', 'arm64', 'x64', etc.
  const armVersion = process.config?.variables?.arm_version;
  const platform = process.platform; // 'darwin', 'linux', etc.

  console.log('Device architecture:', arch, 'Arm version:', armVersion, 'Platform:', platform);

  const isPiZero = arch === 'arm' && armVersion === 6;
  const isPiZero2 = arch === 'arm' && armVersion >= 7; // armv7 or armv8
  const isMac = arch === 'arm64' && platform === 'darwin';

  return isPiZero ? 'pi-zero-1' : isPiZero2 ? 'pi-zero-2' : isMac ? 'mac-arm64' : 'other';
}
