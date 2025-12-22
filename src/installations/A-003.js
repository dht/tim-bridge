import { init, moveToAngle, shutdown as shutdownServos } from '../servos.js';

let lastValues = {};

init();

// Log initial values after initialization
console.log('A-003 initialized. Current values:');
console.log('  base:', lastValues.base);
console.log('  shoulder:', lastValues.shoulder);
console.log('  elbow:', lastValues.elbow);
console.log('  wristPitch:', lastValues.wristPitch);
console.log('  wristRoll:', lastValues.wristRoll);
console.log('  gripperOpen:', lastValues.gripperOpen);

export function onChange(data) {
  // If isActive flag is present, control servo power here
  if (typeof data.isActive === 'boolean') {
    if (data.isActive === false) {
      console.log('A-003: isActive=false — shutting down servos (no power)');
      try {
        shutdownServos();
      } catch (err) {
        console.error('A-003: error shutting down servos:', err);
      }
      return;
    } else {
      // ensure servos are initialized/powered when active
      try {
        init();
      } catch (err) {
        console.error('A-003: error initializing servos:', err);
      }
    }
  }

  const { base, shoulder, elbow, wristPitch, wristRoll, gripperOpen } = data;
  console.log({ base, shoulder, elbow, wristPitch, wristRoll, gripperOpen });

  if (lastValues.base !== base) {
    moveToAngle(1, base);
    lastValues.base = base;
  }
  if (lastValues.shoulder !== shoulder) {
    moveToAngle(2, shoulder);
    lastValues.shoulder = shoulder;
  }
  if (lastValues.elbow !== elbow) {
    moveToAngle(3, elbow);
    lastValues.elbow = elbow;
  }
  if (lastValues.wristPitch !== wristPitch) {
    moveToAngle(4, wristPitch);
    lastValues.wristPitch = wristPitch;
  }
  if (lastValues.wristRoll !== wristRoll) {
    moveToAngle(5, wristRoll);
    lastValues.wristRoll = wristRoll;
  }
  if (lastValues.gripperOpen !== gripperOpen) {
    moveToAngle(6, gripperOpen);
    lastValues.gripperOpen = gripperOpen;
  }

  lastValues = { ...data };

  // Log each value on every change
  console.log('A-003 onChange values:');
  console.log('  base:', lastValues.base);
  console.log('  shoulder:', lastValues.shoulder);
  console.log('  elbow:', lastValues.elbow);
  console.log('  wristPitch:', lastValues.wristPitch);
  console.log('  wristRoll:', lastValues.wristRoll);
  console.log('  gripperOpen:', lastValues.gripperOpen);
}
