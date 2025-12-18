import { init, moveToAngle } from "../servos.js";

let lastValues = {};

init();

export function onChange(data) {
  const { base, shoulder, elbow, wristPitch, wristRoll, gripperOpen } = data;

  if (lastValues.base !== base) {
    moveToAngle(0, base);
    lastValues.base = base;
  }
  if (lastValues.shoulder !== shoulder) {
    moveToAngle(1, shoulder);
    lastValues.shoulder = shoulder;
  }
  if (lastValues.elbow !== elbow) {
    moveToAngle(2, elbow);
    lastValues.elbow = elbow;
  }
  if (lastValues.wristPitch !== wristPitch) {
    moveToAngle(3, wristPitch);
    lastValues.wristPitch = wristPitch;
  }
  if (lastValues.wristRoll !== wristRoll) {
    moveToAngle(4, wristRoll);
    lastValues.wristRoll = wristRoll;
  }
  if (lastValues.gripperOpen !== gripperOpen) {
    moveToAngle(5, gripperOpen);
    lastValues.gripperOpen = gripperOpen;
  }

  lastValues = { ...data };
}
