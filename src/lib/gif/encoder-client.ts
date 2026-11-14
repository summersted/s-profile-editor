import { AppError } from "../errors";
import type { EncoderRequest, EncoderResponse } from "./encode.worker";

/** Frames allowed in flight before `addFrame` waits for the worker. */
const MAX_IN_FLIGHT = 2;

export interface GifEncoder {
  /** Queue a frame; resolves once it's safe to render the next one. */
  addFrame(rgba: Uint8ClampedArray, delayCs: number): Promise<void>;
  finish(): Promise<Uint8Array>;
  /** Kill the worker (on abort). */
  dispose(): void;
}

/** Streaming GIF encoder running in a Web Worker. Frame buffers are transferred, not copied. */
export function createGifEncoder(width: number, height: number, onFrameDone?: (n: number) => void): GifEncoder {
  const worker = new Worker(new URL("./encode.worker.ts", import.meta.url), { type: "module" });
  let sent = 0;
  let done = 0;
  let failure: Error | null = null;
  let waiter: (() => void) | null = null;
  let finished: ((bytes: Uint8Array) => void) | null = null;
  let finishFailed: ((e: Error) => void) | null = null;

  const post = (msg: EncoderRequest, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);

  worker.onmessage = (e: MessageEvent<EncoderResponse>) => {
    const msg = e.data;
    if (msg.type === "frame-done") {
      done++;
      onFrameDone?.(done);
      waiter?.();
      waiter = null;
    } else if (msg.type === "done") {
      finished?.(new Uint8Array(msg.bytes));
      worker.terminate();
    } else {
      failure = new AppError("encodeFailed", { detail: msg.message });
      waiter?.();
      finishFailed?.(failure);
    }
  };
  worker.onerror = (e) => {
    failure = new AppError("encodeFailed", { detail: e.message });
    waiter?.();
    finishFailed?.(failure);
  };

  post({ type: "start", width, height });

  return {
    async addFrame(rgba, delayCs) {
      if (failure) throw failure;
      const buffer = rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength) as ArrayBuffer;
      post({ type: "frame", index: sent++, delayCs, rgba: buffer }, [buffer]);
      while (sent - done >= MAX_IN_FLIGHT && !failure) {
        await new Promise<void>((resolve) => (waiter = resolve));
      }
      if (failure) throw failure;
    },
    finish() {
      if (failure) return Promise.reject(failure);
      return new Promise<Uint8Array>((resolve, reject) => {
        finished = resolve;
        finishFailed = reject;
        post({ type: "finish" });
      });
    },
    dispose() {
      worker.terminate();
    },
  };
}
