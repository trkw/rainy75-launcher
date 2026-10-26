/*
 * Minimal SMP/mcumgr client for the Rainy 75 runtime settings (group 67).
 *
 * The CBOR subset, SMP framing, and mcumgr serial framing are adapted from
 * scholzri/rainy75-zmk web/config/index.html (Apache-2.0). Only what the
 * launcher needs is included: INFO / GET / SET over the console CDC-ACM port.
 */
export const SMP = {
  READ: 0,
  WRITE: 2,
  HDR: 8,
  GROUP_CFG: 67,
} as const;

export const CMD = {
  INFO: 0,
  LIST: 1,
  GET: 2,
  SET: 3,
  RESET: 4,
} as const;

export const RC = {
  EINVAL: 3,
  ENOENT: 5,
  ENOTSUP: 8,
  EACCESSDENIED: 11,
} as const;

export class DeviceError extends Error {
  constructor(public rc: number) {
    super(`device refused the request (rc ${rc})`);
    this.name = "DeviceError";
  }
}

export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportError";
  }
}

/* ------------------------------------------------------------------ CBOR */

function cborHead(out: number[], major: number, n: number): void {
  if (n < 24) {
    out.push((major << 5) | n);
  } else if (n <= 0xff) {
    out.push((major << 5) | 24, n);
  } else if (n <= 0xffff) {
    out.push((major << 5) | 25, n >> 8, n & 0xff);
  } else {
    out.push(
      (major << 5) | 26,
      (n >>> 24) & 0xff,
      (n >>> 16) & 0xff,
      (n >>> 8) & 0xff,
      n & 0xff
    );
  }
}

function cborItem(out: number[], value: unknown): void {
  if (value === null) {
    out.push(0xf6);
  } else if (value === false) {
    out.push(0xf4);
  } else if (value === true) {
    out.push(0xf5);
  } else if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("CBOR: only integer numbers are supported");
    }
    if (value >= 0) {
      cborHead(out, 0, value);
    } else {
      cborHead(out, 1, -1 - value);
    }
  } else if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    cborHead(out, 3, bytes.length);
    out.push(...bytes);
  } else if (value instanceof Uint8Array) {
    cborHead(out, 2, value.length);
    out.push(...value);
  } else if (Array.isArray(value)) {
    cborHead(out, 4, value.length);
    for (const item of value) cborItem(out, item);
  } else if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    cborHead(out, 5, keys.length);
    for (const key of keys) {
      cborItem(out, key);
      cborItem(out, (value as Record<string, unknown>)[key]);
    }
  } else {
    throw new Error(`CBOR: unsupported value ${String(value)}`);
  }
}

export function cborEncode(value: unknown): Uint8Array {
  const out: number[] = [];
  cborItem(out, value);
  return new Uint8Array(out);
}

function readArg(
  data: Uint8Array,
  offset: number,
  minor: number
): [number, number] {
  if (minor < 24) return [minor, offset];
  if (minor === 24) return [data[offset], offset + 1];
  if (minor === 25) {
    return [(data[offset] << 8) | data[offset + 1], offset + 2];
  }
  if (minor === 26) {
    return [
      ((data[offset] << 24) |
        (data[offset + 1] << 16) |
        (data[offset + 2] << 8) |
        data[offset + 3]) >>>
        0,
      offset + 4,
    ];
  }
  if (minor === 27) {
    const hi =
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3];
    const lo =
      (data[offset + 4] << 24) |
      (data[offset + 5] << 16) |
      (data[offset + 6] << 8) |
      data[offset + 7];
    return [hi * 0x100000000 + (lo >>> 0), offset + 8];
  }
  throw new Error(`CBOR: unsupported length minor ${minor}`);
}

function cborDecodeItem(
  data: Uint8Array,
  offset: number
): [unknown, number] {
  if (offset >= data.length) throw new Error("CBOR: unexpected end");
  const byte = data[offset++];
  const major = byte >> 5;
  const minor = byte & 0x1f;

  if (major === 0) return readArg(data, offset, minor);
  if (major === 1) {
    const [n, off] = readArg(data, offset, minor);
    return [-1 - n, off];
  }
  if (major === 2) {
    if (minor === 31) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        if (offset >= data.length) throw new Error("CBOR: broken bytes");
        if (data[offset] === 0xff) {
          offset++;
          break;
        }
        const [chunk, off] = cborDecodeItem(data, offset);
        if (!(chunk instanceof Uint8Array)) {
          throw new Error("CBOR: chunk is not a byte string");
        }
        chunks.push(chunk);
        total += chunk.length;
        offset = off;
      }
      const out = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      return [out, offset];
    }
    const [len, off] = readArg(data, offset, minor);
    return [data.slice(off, off + len), off + len];
  }
  if (major === 3) {
    if (minor === 31) {
      let text = "";
      for (;;) {
        if (offset >= data.length) throw new Error("CBOR: broken text");
        if (data[offset] === 0xff) {
          offset++;
          break;
        }
        const [chunk, off] = cborDecodeItem(data, offset);
        if (typeof chunk !== "string") {
          throw new Error("CBOR: chunk is not text");
        }
        text += chunk;
        offset = off;
      }
      return [text, offset];
    }
    const [len, off] = readArg(data, offset, minor);
    return [
      new TextDecoder().decode(data.subarray(off, off + len)),
      off + len,
    ];
  }
  if (major === 4) {
    const out: unknown[] = [];
    if (minor === 31) {
      for (;;) {
        if (offset >= data.length) throw new Error("CBOR: broken array");
        if (data[offset] === 0xff) {
          offset++;
          break;
        }
        const [item, off] = cborDecodeItem(data, offset);
        out.push(item);
        offset = off;
      }
      return [out, offset];
    }
    const [len, off] = readArg(data, offset, minor);
    offset = off;
    for (let i = 0; i < len; i++) {
      const [item, next] = cborDecodeItem(data, offset);
      out.push(item);
      offset = next;
    }
    return [out, offset];
  }
  if (major === 5) {
    const out: Record<string, unknown> = {};
    if (minor === 31) {
      for (;;) {
        if (offset >= data.length) throw new Error("CBOR: broken map");
        if (data[offset] === 0xff) {
          offset++;
          break;
        }
        const [key, afterKey] = cborDecodeItem(data, offset);
        const [value, afterValue] = cborDecodeItem(data, afterKey);
        out[String(key)] = value;
        offset = afterValue;
      }
      return [out, offset];
    }
    const [len, off] = readArg(data, offset, minor);
    offset = off;
    for (let i = 0; i < len; i++) {
      const [key, afterKey] = cborDecodeItem(data, offset);
      const [value, afterValue] = cborDecodeItem(data, afterKey);
      out[String(key)] = value;
      offset = afterValue;
    }
    return [out, offset];
  }
  if (major === 6) {
    // Tag: skip the tag number and decode the tagged value.
    const [, off] = readArg(data, offset, minor);
    return cborDecodeItem(data, off);
  }
  if (major === 7) {
    if (minor === 20) return [false, offset];
    if (minor === 21) return [true, offset];
    if (minor === 22) return [null, offset];
    if (minor === 25) {
      // half float
      const half = (data[offset] << 8) | data[offset + 1];
      const sign = half & 0x8000 ? -1 : 1;
      const exp = (half >> 10) & 0x1f;
      const frac = half & 0x3ff;
      const value =
        exp === 0
          ? sign * Math.pow(2, -14) * (frac / 1024)
          : exp === 31
            ? frac
              ? NaN
              : sign * Infinity
            : sign * Math.pow(2, exp - 15) * (1 + frac / 1024);
      return [value, offset + 2];
    }
    if (minor === 26) {
      const view = new DataView(
        data.buffer,
        data.byteOffset + offset,
        4
      );
      return [view.getFloat32(0), offset + 4];
    }
    if (minor === 27) {
      const view = new DataView(
        data.buffer,
        data.byteOffset + offset,
        8
      );
      return [view.getFloat64(0), offset + 8];
    }
    if (minor === 31) return [undefined, offset];
    return [minor, offset];
  }
  throw new Error(`CBOR: unsupported major ${major}`);
}

export function cborDecode(data: Uint8Array): unknown {
  return cborDecodeItem(data, 0)[0];
}

/* ------------------------------------------------------------- SMP frame */

export function smpFrame(
  op: number,
  group: number,
  cmd: number,
  seq: number,
  payload: Uint8Array
): Uint8Array {
  if (payload.length > 0xffff) throw new RangeError("SMP payload too large");
  const frame = new Uint8Array(SMP.HDR + payload.length);
  frame.set(
    [
      op & 7,
      0,
      payload.length >> 8,
      payload.length & 0xff,
      group >> 8,
      group & 0xff,
      seq & 0xff,
      cmd & 0xff,
    ],
    0
  );
  frame.set(payload, SMP.HDR);
  return frame;
}

export interface SmpMessage {
  op: number;
  group: number;
  cmd: number;
  seq: number;
  body: Record<string, unknown>;
}

export function smpParse(frame: Uint8Array): SmpMessage {
  if (frame.length < SMP.HDR) throw new Error("SMP frame too short");
  const len = (frame[2] << 8) | frame[3];
  if (frame.length < SMP.HDR + len) {
    throw new Error("SMP frame shorter than its header says");
  }
  return {
    op: frame[0],
    group: (frame[4] << 8) | frame[5],
    seq: frame[6],
    cmd: frame[7],
    body: len
      ? (cborDecode(frame.subarray(SMP.HDR, SMP.HDR + len)) as Record<
          string,
          unknown
        >)
      : {},
  };
}

/* ---------------------------------------------------------- serial framing */

const SERIAL_LINE_MAX = 127;

function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function b64encode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64decode(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function serialEncode(packet: Uint8Array): Uint8Array[] {
  const payload = new Uint8Array(2 + packet.length + 2);
  const total = packet.length + 2;
  payload[0] = total >> 8;
  payload[1] = total & 0xff;
  payload.set(packet, 2);
  const crc = crc16(packet);
  payload[2 + packet.length] = crc >> 8;
  payload[2 + packet.length + 1] = crc & 0xff;

  const encoded = b64encode(payload);
  const chunk = SERIAL_LINE_MAX - 3;
  const lines: Uint8Array[] = [];
  for (let pos = 0; pos < encoded.length; pos += chunk) {
    const first = pos === 0;
    const text = encoded.slice(pos, pos + chunk);
    const line = new Uint8Array(2 + text.length + 1);
    line[0] = first ? 0x06 : 0x04;
    line[1] = first ? 0x09 : 0x14;
    for (let i = 0; i < text.length; i++) line[2 + i] = text.charCodeAt(i);
    line[line.length - 1] = 0x0a;
    lines.push(line);
  }
  return lines;
}

export class SerialDecoder {
  private buffer = new Uint8Array(0);
  private b64 = "";
  private active = false;

  push(chunk: Uint8Array): Uint8Array[] {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;

    const packets: Uint8Array[] = [];
    for (;;) {
      const newline = this.buffer.indexOf(0x0a);
      if (newline < 0) break;
      const lineBytes = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      const line = String.fromCharCode(...lineBytes);
      if (line.startsWith("\x06\x09")) {
        this.b64 = line.slice(2);
        this.active = true;
      } else if (line.startsWith("\x04\x14") && this.active) {
        this.b64 += line.slice(2);
      } else {
        continue;
      }
      const packet = this.tryDecode();
      if (packet) packets.push(packet);
    }
    return packets;
  }

  private tryDecode(): Uint8Array | null {
    if (!this.active || !this.b64) return null;
    let raw: Uint8Array;
    try {
      raw = b64decode(this.b64);
    } catch {
      return null;
    }
    if (raw.length < 4) return null;
    const len = (raw[0] << 8) | raw[1];
    if (raw.length < 2 + len) return null;
    const packet = raw.slice(2, 2 + len - 2);
    const expected = (raw[2 + len - 2] << 8) | raw[2 + len - 2 + 1];
    if (crc16(packet) !== expected) return null;
    this.b64 = "";
    this.active = false;
    return packet;
  }
}

/* ---------------------------------------------------------------- client */

interface Waiter {
  group: number;
  cmd: number;
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ConfigClient {
  private port: SerialPort;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private decoder = new SerialDecoder();
  private waiters = new Map<number, Waiter>();
  private seq = 0;
  private closed = false;

  constructor(port: SerialPort) {
    this.port = port;
  }

  static async requestPort(): Promise<SerialPort> {
    if (!navigator.serial) {
      throw new TransportError("Web Serial needs Chrome or Edge");
    }
    return navigator.serial.requestPort({
      filters: [{ usbVendorId: 0x1d50, usbProductId: 0x615e }],
    });
  }

  static async open(port: SerialPort): Promise<ConfigClient> {
    const client = new ConfigClient(port);
    await client.open();
    return client;
  }

  async open(): Promise<void> {
    await this.port.open({ baudRate: 115200 });
    if (!this.port.readable || !this.port.writable) {
      throw new TransportError("serial port has no readable/writable stream");
    }
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    void this.readLoop();
  }

  private async readLoop(): Promise<void> {
    try {
      for (;;) {
        const { value, done } = await this.reader!.read();
        if (done) break;
        if (!value) continue;
        for (const packet of this.decoder.push(value)) {
          let msg: SmpMessage;
          try {
            msg = smpParse(packet);
          } catch {
            continue;
          }
          const waiter = this.waiters.get(msg.seq);
          if (!waiter || waiter.group !== msg.group || waiter.cmd !== msg.cmd) {
            continue;
          }
          clearTimeout(waiter.timer);
          this.waiters.delete(msg.seq);
          const rc = msg.body.rc;
          if (typeof rc === "number" && rc !== 0) {
            waiter.reject(new DeviceError(rc));
          } else {
            waiter.resolve(msg.body);
          }
        }
      }
    } catch (error) {
      for (const waiter of this.waiters.values()) {
        clearTimeout(waiter.timer);
        waiter.reject(new TransportError(String(error)));
      }
      this.waiters.clear();
    }
  }

  private async requestOnce(
    op: number,
    group: number,
    cmd: number,
    body: Record<string, unknown>,
    timeoutMs: number
  ): Promise<Record<string, unknown>> {
    if (!this.writer) throw new TransportError("serial port is not open");
    const seq = this.seq++ & 0xff;
    const packet = smpFrame(op, group, cmd, seq, cborEncode(body));

    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(seq);
        reject(new TransportError("no answer from the keyboard"));
      }, timeoutMs);
      this.waiters.set(seq, { group, cmd, resolve, reject, timer });
    });

    try {
      for (const line of serialEncode(packet)) {
        await this.writer.write(line);
      }
    } catch (error) {
      const waiter = this.waiters.get(seq);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.waiters.delete(seq);
        waiter.reject(new TransportError(String(error)));
      }
    }
    return promise;
  }

  async request(
    op: number,
    group: number,
    cmd: number,
    body: Record<string, unknown>,
    timeoutMs = 2000,
    retries = 1
  ): Promise<Record<string, unknown>> {
    let last: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.requestOnce(op, group, cmd, body, timeoutMs);
      } catch (error) {
        last = error;
        if (error instanceof DeviceError) throw error;
      }
    }
    throw last instanceof Error
      ? last
      : new TransportError("no answer from the keyboard");
  }

  async getInfo(): Promise<Record<string, unknown>> {
    return this.request(SMP.READ, SMP.GROUP_CFG, CMD.INFO, {});
  }

  async getSetting(key: string): Promise<unknown> {
    const r = await this.request(SMP.READ, SMP.GROUP_CFG, CMD.GET, {
      k: [key],
    });
    const values = r.v as Record<string, unknown> | undefined;
    return values?.[key];
  }

  async setSetting(key: string, value: unknown): Promise<unknown> {
    const r = await this.request(SMP.WRITE, SMP.GROUP_CFG, CMD.SET, {
      k: key,
      v: value,
    });
    return r.v;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new TransportError("connection closed"));
    }
    this.waiters.clear();
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      this.reader?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.writer?.close();
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.port.close();
    } catch {
      /* ignore */
    }
  }
}

/** Probe an already-granted console port, or ask the user for one. */
export async function findConfigClient(): Promise<ConfigClient> {
  if (!navigator.serial) {
    throw new TransportError("Web Serial needs Chrome or Edge");
  }

  const ports = await navigator.serial.getPorts();
  for (const port of ports) {
    let client: ConfigClient | undefined;
    try {
      client = await ConfigClient.open(port);
      await client.request(SMP.READ, SMP.GROUP_CFG, CMD.INFO, {}, 1200, 0);
      return client;
    } catch {
      await client?.close();
    }
  }

  const port = await ConfigClient.requestPort();
  let client: ConfigClient | undefined;
  try {
    client = await ConfigClient.open(port);
    await client.request(SMP.READ, SMP.GROUP_CFG, CMD.INFO, {}, 1500, 1);
    return client;
  } catch (error) {
    await client?.close();
    throw new TransportError(
      "No Rainy 75 settings port answered. If the picker showed two " +
        "\"Rainy 75\" entries, try the other one (the console port, not the " +
        "ZMK Studio port)."
    );
  }
}
