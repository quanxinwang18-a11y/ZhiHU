let started = false;
let toneModule: typeof import("tone") | undefined;
let loop: import("tone").Loop | undefined;

export async function startSound() {
  if (started) return;
  const Tone = await import("tone");
  toneModule = Tone;
  await Tone.start();
  const filter = new Tone.Filter(1150, "lowpass").toDestination();
  const reverb = new Tone.Reverb({ decay: 4.8, wet: 0.34 }).connect(filter);
  const piano = new Tone.FMSynth({
    harmonicity: 1.45,
    modulationIndex: 2,
    envelope: { attack: 0.03, decay: 0.8, sustain: 0.08, release: 2.7 },
  }).connect(reverb);
  piano.volume.value = -24;
  const notes = ["D4", "A4", "E4", "F#4", "C#4", "A3", "B3", "E4"];
  let index = 0;
  Tone.getTransport().bpm.value = 62;
  loop = new Tone.Loop((time) => {
    piano.triggerAttackRelease(notes[index % notes.length], "8n", time);
    index += 1;
  }, "2n");
  loop.start(0);
  Tone.getTransport().start();
  started = true;
}

export function stopSound() {
  if (!started || !toneModule) return;
  loop?.stop();
  toneModule.getTransport().stop();
  started = false;
}
