import * as sdk from "microsoft-cognitiveservices-speech-sdk";

export interface SpeechSettings {
  token: string;
  region: string;
  voice: string;
}

export const SAMPLE_RATE = 24000;

/** A sentence ends at . ! ? or the Devanagari danda, followed by a space. */
const SENTENCE_END = /[.!?।]+["')\]]*\s+/;
/** Text longer than this with no sentence end is cut at the last comma or space. */
const MAX_CHUNK = 220;
/** The opening clause of a reply is spoken on its own once it is this long, so Meera starts sooner. */
const MIN_OPENING_CLAUSE = 12;
/** The model sometimes runs sentences together, as in "availability.For Goa". */
const MISSING_SPACE = /([.!?।])(?=[A-Zऄ-ह])/g;

const escapeXml = (text: string) =>
  text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * Speaks streamed reply text with an Azure neural voice. Text is sent to Azure
 * one sentence at a time, and audio is played as it arrives, so Meera starts
 * talking while the rest of her reply is still being synthesised.
 */
export class SpeechOutput {
  private readonly config: sdk.SpeechConfig;
  private synthesizer: sdk.SpeechSynthesizer;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private playhead = 0;
  private pending = "";
  private replyStarted = false;
  private inFlight = 0;
  private speaking = false;
  // Bumped on every interruption, so audio from a cancelled reply is dropped.
  private generation = 0;

  constructor(
    settings: SpeechSettings,
    private readonly context: AudioContext,
    private readonly onSpeakingChange: (speaking: boolean) => void,
  ) {
    this.config = sdk.SpeechConfig.fromAuthorizationToken(settings.token, settings.region);
    this.config.speechSynthesisVoiceName = settings.voice;
    this.config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm;
    this.synthesizer = this.createSynthesizer();
  }

  /** Adds streamed reply text; every complete sentence is spoken right away. */
  addText(delta: string) {
    this.pending = (this.pending + delta).replace(MISSING_SPACE, "$1 ");
    for (;;) {
      const end = SENTENCE_END.exec(this.pending);
      const comma = this.replyStarted ? -1 : this.pending.indexOf(", ", MIN_OPENING_CLAUSE);
      if (comma !== -1 && (!end || comma < end.index)) {
        this.speak(this.pending.slice(0, comma + 2));
        this.pending = this.pending.slice(comma + 2);
      } else if (end) {
        this.speak(this.pending.slice(0, end.index + end[0].length));
        this.pending = this.pending.slice(end.index + end[0].length);
      } else if (this.pending.length > MAX_CHUNK) {
        const cut = Math.max(this.pending.lastIndexOf(", "), this.pending.lastIndexOf(" ")) + 1;
        if (cut <= 0) return;
        this.speak(this.pending.slice(0, cut));
        this.pending = this.pending.slice(cut);
      } else {
        return;
      }
    }
  }

  /** Speaks whatever is left of the reply. */
  finish() {
    this.speak(this.pending);
    this.pending = "";
    this.replyStarted = false;
  }

  /** Stops speaking at once, for when the member talks over Meera. */
  interrupt() {
    if (!this.speaking && !this.pending) return;
    this.generation += 1;
    this.pending = "";
    this.replyStarted = false;
    this.inFlight = 0;
    this.sources.forEach((source) => source.stop());
    this.sources.clear();
    this.playhead = 0;
    // A closed synthesizer drops its queued sentences; open a fresh connection
    // now, while the member is still talking.
    this.synthesizer.close();
    this.synthesizer = this.createSynthesizer();
    this.updateSpeaking();
  }

  close() {
    this.generation += 1;
    this.sources.forEach((source) => source.stop());
    this.sources.clear();
    this.synthesizer.close();
  }

  private createSynthesizer() {
    const synthesizer = new sdk.SpeechSynthesizer(this.config, null);
    const generation = this.generation;
    synthesizer.synthesizing = (_sender, event) => {
      if (generation === this.generation) this.play(event.result.audioData);
    };
    // Connect before the first reply so it does not wait on the handshake.
    sdk.Connection.fromSynthesizer(synthesizer).openConnection();
    return synthesizer;
  }

  private speak(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.replyStarted = true;
    const generation = this.generation;
    const done = () => {
      if (generation !== this.generation) return;
      this.inFlight -= 1;
      this.updateSpeaking();
    };
    this.inFlight += 1;
    this.updateSpeaking();
    this.synthesizer.speakSsmlAsync(
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">` +
        `<voice name="${this.config.speechSynthesisVoiceName}">${escapeXml(trimmed)}</voice></speak>`,
      (result) => {
        if (result.reason === sdk.ResultReason.Canceled) {
          console.error("Speech synthesis failed:", result.errorDetails);
        }
        done();
      },
      (error) => {
        console.error("Speech synthesis failed:", error);
        done();
      },
    );
  }

  /** Queues a chunk of 16-bit PCM right after the audio already scheduled. */
  private play(data: ArrayBuffer) {
    const samples = new Int16Array(data, 0, Math.floor(data.byteLength / 2));
    if (!samples.length) return;
    const buffer = this.context.createBuffer(1, samples.length, SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const start = Math.max(this.playhead, this.context.currentTime + 0.02);
    source.start(start);
    this.playhead = start + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      this.updateSpeaking();
    };
    this.updateSpeaking();
  }

  /** Meera counts as speaking from the first queued sentence to the last sample played. */
  private updateSpeaking() {
    const speaking = this.inFlight > 0 || this.sources.size > 0;
    if (speaking === this.speaking) return;
    this.speaking = speaking;
    this.onSpeakingChange(speaking);
  }
}
