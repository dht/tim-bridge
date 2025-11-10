const { Light } = require("./light");

/*
sudo node demo.js
*/

(async () => {
  const light = await Light.create({
    driver: "gpio", // 'gpio' | 'neopixel' | 'console'
    gpio: { r: 17, g: 27, b: 22, common: "cathode" },
    // neopixel: { pin: 18, brightness: 128 },
    fps: 60,
  });

  // demo cycle
  const steps = [
    () => light.setState("IDLE"),
    () => light.setState("GENERATING"),
    () => light.setState("LISTENING"),
    () => light.setState("SPEAKING"),
    () => light.setState("RESETTING"),
    () => light.setError("noInternet"),
    () => light.setError("resetFail"),
    () => light.setError("genFail"),
    () => light.setError("internal"),
    () => light.setError("timeout"),
    () => light.clearError(),
  ];

  let i = 0;
  setInterval(() => {
    steps[i % steps.length]();
    i++;
  }, 4000);

  // simulate amplitude when SPEAKING
  setInterval(() => {
    const t = Date.now() / 1000;
    light.feedAmplitude((Math.sin(t * 4) + 1) / 2); // 0..1
  }, 50);
})();
