/**
 * Minimal PDF text extractor — no external dependencies.
 *
 * Handles: FlateDecode streams · ToUnicode CMaps (bfchar / bfrange) ·
 *          Tm / Td / TD / T* positioning · Tj / TJ text operators
 *
 * @module pdf-text-extractor
 */
import { inflateSync } from "zlib";

const tryInflate = (buf) => {
  try { return inflateSync(buf); } catch { /* try next */ }
  try { return inflateSync(buf.slice(2)); } catch { /* try next */ }
  return null;
};

/** Parse a PDF literal-string body (contents between the outer parens). */
const parseLiteralBytes = (raw) => {
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c === 0x5c) {
      i++;
      const n = raw.charCodeAt(i);
      if (n >= 0x30 && n <= 0x37) {
        let octal = raw[i];
        if (raw.charCodeAt(i + 1) >= 0x30 && raw.charCodeAt(i + 1) <= 0x37) octal += raw[++i];
        if (raw.charCodeAt(i + 1) >= 0x30 && raw.charCodeAt(i + 1) <= 0x37) octal += raw[++i];
        out.push(parseInt(octal, 8));
      } else if (n === 0x6e) out.push(0x0a);
      else if (n === 0x72) out.push(0x0d);
      else if (n === 0x74) out.push(0x09);
      else out.push(n);
    } else {
      out.push(c);
    }
  }
  return out;
};

// A bfrange covering more codes than this is malformed (or hostile); skip it.
const MAX_BFRANGE_SPAN = 0x10000;

/**
 * @param {string} hex
 * @returns {number[]} UTF-16 code units
 */
const hexToCodeUnits = (hex) => {
  const padded = hex.padStart(Math.ceil(hex.length / 4) * 4, "0");
  const units = [];
  for (let i = 0; i < padded.length; i += 4) {
    units.push(parseInt(padded.slice(i, i + 4), 16));
  }
  return units;
};

const unitsToString = (units) => String.fromCharCode(...units);

/**
 * @param {string} text decompressed CMap stream
 * @param {number} keyLen source code length in bytes (from the codespace range)
 * @returns {Map<string, string>} source code hex (lowercase) -> Unicode string
 */
export const parseToUnicodeCMap = (text, keyLen) => {
  const charMap = new Map();
  const key = (code) => code.toString(16).padStart(keyLen * 2, "0");

  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      if (!m[2]) continue;
      charMap.set(key(parseInt(m[1], 16)), unitsToString(hexToCodeUnits(m[2])));
    }
  }

  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g,
    )) {
      const start = parseInt(m[1], 16);
      const end = parseInt(m[2], 16);
      if (end < start || end - start >= MAX_BFRANGE_SPAN) continue;

      if (m[3] !== undefined) {
        // Hex destination: each successive source code increments the last code unit.
        const units = hexToCodeUnits(m[3]);
        const last = units.length - 1;
        for (let code = start; code <= end; code++) {
          const next = [...units];
          next[last] = (units[last] + (code - start)) & 0xffff;
          charMap.set(key(code), unitsToString(next));
        }
      } else {
        // Array destination: one string per source code, in order.
        const dsts = [...m[4].matchAll(/<([0-9a-fA-F]*)>/g)].map((d) => d[1]);
        for (let i = 0; i < dsts.length && start + i <= end; i++) {
          if (!dsts[i]) continue;
          charMap.set(key(start + i), unitsToString(hexToCodeUnits(dsts[i])));
        }
      }
    }
  }

  return charMap;
};

/**
 * Parse all ToUnicode CMap streams.
 * @returns {Map<string, { keyLen: number, map: Map<string, string> }>}
 */
const parseCMaps = (decompressedStreams) => {
  const result = new Map();

  for (const text of decompressedStreams) {
    if (!text.includes("begincmap")) continue;

    const nameMatch = text.match(/\/CMapName\s+\/(\S+)/);
    if (!nameMatch) continue;
    const cmapName = nameMatch[1];

    const codeSpaceMatch = text.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
    const keyLen = codeSpaceMatch ? codeSpaceMatch[1].length / 2 : 1;

    const charMap = parseToUnicodeCMap(text, keyLen);
    if (charMap.size > 0) result.set(cmapName, { keyLen, map: charMap });
  }

  return result;
};

/**
 * Build a mapping of PDF font resource keys to their CMap.
 * Links: /Font << /key N 0 R >> → N 0 obj /BaseFont /Name → CMap by name.
 */
const buildFontCMapIndex = (rawPdfStr, cmaps) => {
  const fontCMapIndex = new Map();

  const fontDictMatch = rawPdfStr.match(/\/Font\s*<<([^>]*)>>/);
  if (!fontDictMatch) return fontCMapIndex;

  const fontKeyToObj = new Map();
  for (const m of fontDictMatch[1].matchAll(/\/(\S+)\s+(\d+)\s+0\s+R/g)) {
    fontKeyToObj.set(m[1], parseInt(m[2]));
  }

  const objToBaseFont = new Map();
  for (const objNum of fontKeyToObj.values()) {
    const idx = rawPdfStr.indexOf(`\n${objNum} 0 obj`);
    if (idx === -1) continue;
    const slice = rawPdfStr.slice(idx, idx + 600);
    const bfm = slice.match(/\/BaseFont\s+\/(\S+)/);
    if (bfm) objToBaseFont.set(objNum, bfm[1]);
  }

  for (const [fontKey, objNum] of fontKeyToObj) {
    const baseFont = objToBaseFont.get(objNum);
    if (baseFont && cmaps.has(baseFont)) {
      fontCMapIndex.set(fontKey, cmaps.get(baseFont));
    }
  }

  return fontCMapIndex;
};

/** Decode byte array using a CMap with the given key length. */
const applyCharMap = (bytes, charMap, keyLen) => {
  let result = "";
  for (let i = 0; i < bytes.length; i += keyLen) {
    const hexKey = bytes
      .slice(i, i + keyLen)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    result += charMap.get(hexKey) ?? String.fromCharCode(bytes[i] ?? 0x3f);
  }
  return result;
};

/**
 * Parse a single decompressed content stream.
 * @returns {Array<{str: string, x: number, y: number}>}
 */
const parseContentItems = (content, fontCMapIndex) => {
  const items = [];
  const len = content.length;
  let i = 0;

  let x = 0, y = 0, lineX = 0, lineY = 0, leading = 0;
  let inBT = false;
  let currentCMap = null;
  let currentKeyLen = 1;
  const stack = [];

  const skipWS = () => {
    while (i < len && " \t\r\n\f".includes(content[i])) i++;
  };

  const readNumber = () => {
    let s = "";
    if (content[i] === "-" || content[i] === "+") s += content[i++];
    while (
      i < len &&
      (content[i] === "." || (content[i] >= "0" && content[i] <= "9"))
    ) s += content[i++];
    return parseFloat(s);
  };

  const readLiteral = () => {
    i++;
    let depth = 1, raw = "";
    while (i < len && depth > 0) {
      const ch = content[i];
      if (ch === "\\" && i + 1 < len) {
        raw += content[i] + content[i + 1];
        i += 2;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") {
        if (--depth === 0) { i++; break; }
      }
      raw += ch;
      i++;
    }
    return parseLiteralBytes(raw);
  };

  const readHex = () => {
    i++;
    let hexStr = "";
    while (i < len && content[i] !== ">") {
      if (!" \t\r\n".includes(content[i])) hexStr += content[i];
      i++;
    }
    i++;
    if (hexStr.length % 2) hexStr += "0";
    const bytes = [];
    for (let j = 0; j < hexStr.length; j += 2)
      bytes.push(parseInt(hexStr.slice(j, j + 2), 16));
    return bytes;
  };

  const decodeBytes = (bytes) => {
    if (currentCMap) return applyCharMap(bytes, currentCMap, currentKeyLen);
    return bytes.map((b) => String.fromCharCode(b)).join("");
  };

  const readKeyword = () => {
    let kw = "";
    while (i < len && !/[\s\t\r\n\f()[\]{}<>/]/.test(content[i]))
      kw += content[i++];
    return kw;
  };

  while (i < len) {
    skipWS();
    if (i >= len) break;
    const ch = content[i];

    if (ch === "%") {
      while (i < len && content[i] !== "\n" && content[i] !== "\r") i++;
      continue;
    }

    if (ch === "/") {
      i++;
      let name = "";
      while (i < len && !/[\s\t\r\n\f()[\]{}<>/]/.test(content[i]))
        name += content[i++];
      stack.push({ type: "name", value: name });
      continue;
    }

    if (ch === "(") {
      stack.push({ type: "bytes", value: readLiteral() });
      continue;
    }

    if (ch === "<") {
      if (content[i + 1] === "<") {
        let depth = 0;
        while (i < len) {
          if (content[i] === "<" && content[i + 1] === "<") { depth++; i += 2; }
          else if (content[i] === ">" && content[i + 1] === ">") {
            depth--; i += 2;
            if (depth === 0) break;
          } else i++;
        }
        stack.push({ type: "dict" });
        continue;
      }
      stack.push({ type: "bytes", value: readHex() });
      continue;
    }

    if (ch === "[") {
      i++;
      const arr = [];
      while (i < len) {
        skipWS();
        if (content[i] === "]") { i++; break; }
        if (content[i] === "(") {
          arr.push({ type: "bytes", value: readLiteral() });
        } else if (content[i] === "<" && content[i + 1] !== "<") {
          arr.push({ type: "bytes", value: readHex() });
        } else if (
          content[i] === "-" || content[i] === "+" ||
          (content[i] >= "0" && content[i] <= "9") ||
          content[i] === "."
        ) {
          arr.push({ type: "num", value: readNumber() });
        } else { i++; }
      }
      stack.push({ type: "arr", value: arr });
      continue;
    }

    if (
      ch === "-" || ch === "+" ||
      (ch >= "0" && ch <= "9") ||
      (ch === "." && i + 1 < len && content[i + 1] >= "0" && content[i + 1] <= "9")
    ) {
      stack.push({ type: "num", value: readNumber() });
      continue;
    }

    if (/[A-Za-z*'"_]/.test(ch)) {
      const op = readKeyword();
      if (!inBT && op !== "BT") { stack.length = 0; continue; }

      switch (op) {
        case "BT":
          inBT = true; x = 0; y = 0; lineX = 0; lineY = 0;
          stack.length = 0; break;

        case "ET":
          inBT = false; stack.length = 0; break;

        case "Tf": {
          const names = stack.filter((t) => t.type === "name");
          if (names.length > 0) {
            const entry = fontCMapIndex.get(names[names.length - 1].value);
            if (entry) { currentCMap = entry.map; currentKeyLen = entry.keyLen; }
            else { currentCMap = null; currentKeyLen = 1; }
          }
          stack.length = 0; break;
        }

        case "Tm": {
          const nums = stack.filter((t) => t.type === "num");
          if (nums.length >= 6) {
            x = nums[nums.length - 2].value;
            y = nums[nums.length - 1].value;
            lineX = x; lineY = y;
          }
          stack.length = 0; break;
        }

        case "Td": case "TD": {
          const nums = stack.filter((t) => t.type === "num");
          if (nums.length >= 2) {
            x = lineX + nums[nums.length - 2].value;
            y = lineY + nums[nums.length - 1].value;
            lineX = x; lineY = y;
            if (op === "TD") leading = -nums[nums.length - 1].value;
          }
          stack.length = 0; break;
        }

        case "T*":
          y = lineY - leading; lineY = y;
          stack.length = 0; break;

        case "TL": {
          const nums = stack.filter((t) => t.type === "num");
          if (nums.length) leading = nums[nums.length - 1].value;
          stack.length = 0; break;
        }

        case "Tj": {
          const top = stack[stack.length - 1];
          if (top?.type === "bytes") {
            const str = decodeBytes(top.value).replace(/\s+/g, " ").trim();
            if (str) items.push({ str, x, y });
          }
          stack.length = 0; break;
        }

        case "'": case '"': {
          y = lineY - leading; lineY = y;
          const top = stack[stack.length - 1];
          if (top?.type === "bytes") {
            const str = decodeBytes(top.value).replace(/\s+/g, " ").trim();
            if (str) items.push({ str, x, y });
          }
          stack.length = 0; break;
        }

        case "TJ": {
          const top = stack[stack.length - 1];
          if (top?.type === "arr") {
            const str = top.value
              .filter((t) => t.type === "bytes")
              .map((t) => decodeBytes(t.value))
              .join("")
              .replace(/\s+/g, " ")
              .trim();
            if (str) items.push({ str, x, y });
          }
          stack.length = 0; break;
        }

        default:
          stack.length = 0; break;
      }
      continue;
    }

    i++;
  }

  return items;
};

/**
 * Extract all text items with page coordinates from a PDF buffer.
 * @param {Buffer} pdfBuffer
 * @returns {Array<{str: string, x: number, y: number, page: number}>}
 */
export const extractPdfTextItems = (pdfBuffer) => {
  const pdf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  const rawPdfStr = pdf.toString("latin1");

  // Step 1: decompress all FlateDecode streams
  const decompressedStreams = [];
  let pos = 0;

  while (pos < pdf.length) {
    const streamKeyword = pdf.indexOf(Buffer.from("stream"), pos);
    if (streamKeyword === -1) break;

    let dataStart = streamKeyword + 6;
    if (pdf[dataStart] === 0x0d && pdf[dataStart + 1] === 0x0a) dataStart += 2;
    else if (pdf[dataStart] === 0x0a) dataStart += 1;
    else { pos = streamKeyword + 1; continue; }

    const endStream = pdf.indexOf(Buffer.from("endstream"), dataStart);
    if (endStream === -1) break;

    const header = pdf
      .slice(Math.max(0, streamKeyword - 512), streamKeyword)
      .toString("latin1");
    const isFlate =
      /\/Filter\s*\/FlateDecode/.test(header) ||
      /\/Filter\s*\[.*\/FlateDecode/.test(header);

    if (isFlate) {
      let raw = pdf.slice(dataStart, endStream);
      while (
        raw.length > 0 &&
        (raw[raw.length - 1] === 0x0a || raw[raw.length - 1] === 0x0d)
      ) {
        raw = raw.slice(0, -1);
      }
      const decoded = tryInflate(raw);
      if (decoded) decompressedStreams.push(decoded.toString("latin1"));
    }

    pos = endStream + 9;
  }

  // Step 2: parse CMaps
  const cmaps = parseCMaps(decompressedStreams);

  // Step 3: build fontKey → CMap index
  const fontCMapIndex = buildFontCMapIndex(rawPdfStr, cmaps);

  // Step 4: parse content streams
  const allItems = [];
  let pageNum = 0;

  for (const streamText of decompressedStreams) {
    if (!streamText.includes("BT")) continue;
    if (!streamText.includes("Tj") && !streamText.includes("TJ")) continue;
    if (streamText.includes("begincmap")) continue;

    pageNum++;
    const items = parseContentItems(streamText, fontCMapIndex);
    allItems.push(...items.map((it) => ({ ...it, page: pageNum })));
  }

  return allItems;
};
