import { describe, it, expect } from "vitest";
import { encodeEmbedding, readEmbeddingInto } from "./embedding-codec.js";

const read = (stored, size = 8) => {
  const target = new Float32Array(size);
  return [...target.subarray(0, readEmbeddingInto(stored, target))];
};

describe("embedding codec", () => {
  it("round-trips through packed float32 bytes", () => {
    const packed = encodeEmbedding([0.5, -0.25, 1]);

    expect(packed.byteLength).toBe(12);
    expect(read(packed)).toEqual([0.5, -0.25, 1]);
  });

  it("reads BSON Binary-like values and misaligned bytes", () => {
    const packed = encodeEmbedding([0.5, 2]);
    const misaligned = new Uint8Array(packed.byteLength + 1).subarray(1);
    misaligned.set(packed);

    expect(read({ buffer: packed })).toEqual([0.5, 2]);
    expect(read(misaligned)).toEqual([0.5, 2]);
  });

  it("reads legacy number arrays", () => {
    expect(read([1, 2])).toEqual([1, 2]);
  });

  it("reads nothing when the target is too small or the value isn't an embedding", () => {
    expect(read([1, 2, 3], 2)).toEqual([]);
    expect(read("nope")).toEqual([]);
  });
});
