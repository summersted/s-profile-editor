/**
 * Web Worker wrapper around GifWriter, so quantizing + LZW for dozens of
 * panel-sized frames doesn't freeze the page. Protocol: start → frame* → finish.
 * Every frame is acknowledged, which the client uses for back-pressure.
 */
import { GifWriter } from "./encode";

export type EncoderRequest =
  | { type: "start"; width: number; height: number }
  | { type: "frame"; index: number; delayCs: number; rgba: ArrayBuffer }
  | { type: "finish" };

export type EncoderResponse =
  | { type: "frame-done"; index: number }
  | { type: "done"; bytes: ArrayBuffer }
  | { type: "error"; message: string };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<EncoderRequest>) => void) | null;
  postMessage(message: EncoderResponse, transfer?: Transferable[]): void;
};

let writer: GifWriter | null = null;

scope.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === "start") {
      writer = new GifWriter(msg.width, msg.height);
    } else if (msg.type === "frame") {
      if (!writer) throw new Error("encoder not started");
      writer.addFrame(new Uint8ClampedArray(msg.rgba), msg.delayCs);
      scope.postMessage({ type: "frame-done", index: msg.index });
    } else if (msg.type === "finish") {
      if (!writer) throw new Error("encoder not started");
      const bytes = writer.finish();
      writer = null;
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      scope.postMessage({ type: "done", bytes: buffer }, [buffer]);
    }
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
