// Embeddings are stored as packed little-endian float32 bytes: 3 KB for 768
// dims instead of about 10 KB as a BSON array of doubles.

/**
 * @param {ArrayLike<number>} values
 * @returns {Buffer}
 */
export const encodeEmbedding = (values) => {
  const floats = Float32Array.from(values);
  return Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength);
};

/**
 * Decodes a stored embedding (packed bytes, BSON Binary or a legacy number
 * array) into `target` without allocating, for bulk loads.
 * @param {unknown} stored
 * @param {Float32Array} target
 * @returns {number} dimensions read (0 if `target` is too small)
 */
export const readEmbeddingInto = (stored, target) => {
  if (Array.isArray(stored)) {
    if (stored.length > target.length) return 0;
    for (let i = 0; i < stored.length; i++) target[i] = stored[i];
    return stored.length;
  }
  const bytes = /** @type {any} */ (stored)?.buffer instanceof Uint8Array
    ? /** @type {any} */ (stored).buffer
    : stored;
  if (!(bytes instanceof Uint8Array)) return 0;
  const dims = Math.floor(bytes.byteLength / 4);
  if (dims > target.length) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < dims; i++) target[i] = view.getFloat32(i * 4, true);
  return dims;
};
