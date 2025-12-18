import { init, moveToAngle } from '../servos.js';

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
  const { base, shoulder, elbow, wristPitch, wristRoll, gripperOpen } = data;

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
