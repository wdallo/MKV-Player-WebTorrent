/**
 * Client-side Torrent File Parser
 * Extracts magnet links from .torrent files without server upload
 */

class TorrentParser {
  constructor() {
    this.pos = 0;
  }

  /**
   * Parse a torrent file buffer and extract magnet URI
   * @param {Uint8Array} buffer - The torrent file data
   * @returns {Promise<string>} - The magnet URI
   */
  async parseTorrentFile(buffer) {
    // Basic validation
    if (buffer[0] !== 100) {
      // 'd'
      throw new Error("Invalid torrent file format");
    }

    // Decode the torrent file
    const torrent = this.decodeBencode(buffer);

    if (!torrent.info) {
      throw new Error("No info section found in torrent");
    }

    // Re-encode the info dictionary and calculate SHA-1 hash
    const infoBytes = this.encodeBencode(torrent.info);
    const infoHash = await this.sha1(infoBytes);
    const infoHashHex = this.bytesToHex(infoHash);

    // Extract name if available
    let name = "";
    if (torrent.info.name) {
      name = new TextDecoder().decode(torrent.info.name);
    }

    // Extract trackers
    const trackers = [];

    // Single announce URL
    if (torrent.announce) {
      try {
        const announceUrl = new TextDecoder().decode(torrent.announce);
        if (this.isValidTrackerUrl(announceUrl)) {
          trackers.push(announceUrl);
        }
      } catch (e) {
        console.warn("Failed to decode announce URL:", e);
      }
    }

    // Multiple announce URLs (announce-list)
    if (torrent["announce-list"] && Array.isArray(torrent["announce-list"])) {
      for (const tierArray of torrent["announce-list"]) {
        if (Array.isArray(tierArray)) {
          for (const tracker of tierArray) {
            if (tracker instanceof Uint8Array) {
              try {
                const trackerUrl = new TextDecoder().decode(tracker);
                if (
                  this.isValidTrackerUrl(trackerUrl) &&
                  !trackers.includes(trackerUrl)
                ) {
                  trackers.push(trackerUrl);
                }
              } catch (e) {
                console.warn("Failed to decode tracker URL:", e);
              }
            }
          }
        }
      }
    }

    // Build magnet URI with all available information
    let magnetURI = `magnet:?xt=urn:btih:${infoHashHex}`;

    // Add display name (preserve original formatting)
    if (name) {
      magnetURI += `&dn=${encodeURIComponent(name)}`;
    }

    // Add trackers (increase limit for better peer discovery)
    const maxTrackers = 15; // Increased from 10
    for (let i = 0; i < Math.min(trackers.length, maxTrackers); i++) {
      try {
        magnetURI += `&tr=${encodeURIComponent(trackers[i])}`;
      } catch (e) {
        console.warn("Failed to encode tracker URL:", trackers[i], e);
      }
    }

    console.log(
      `Generated magnet with ${Math.min(trackers.length, maxTrackers)} trackers`
    );
    console.log("Magnet URI:", magnetURI);

    return magnetURI;
  }

  /**
   * Validate if a URL is a proper tracker URL
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid
   */
  isValidTrackerUrl(url) {
    try {
      const parsed = new URL(url);
      return ["http:", "https:", "udp:"].includes(parsed.protocol);
    } catch (e) {
      return false;
    }
  }

  /**
   * Simple bencode decoder for extracting info hash from torrent files
   * @param {Uint8Array} data - The bencode data
   * @returns {Object} - Decoded object
   */
  decodeBencode(data) {
    this.pos = 0;

    const decodeNext = () => {
      if (this.pos >= data.length) throw new Error("Unexpected end of data");

      const byte = data[this.pos];

      if (byte >= 48 && byte <= 57) {
        // 0-9, string
        return this.decodeString(data);
      } else if (byte === 105) {
        // 'i', integer
        return this.decodeInteger(data);
      } else if (byte === 108) {
        // 'l', list
        return this.decodeList(data, decodeNext);
      } else if (byte === 100) {
        // 'd', dictionary
        return this.decodeDictionary(data, decodeNext);
      } else {
        throw new Error(`Invalid bencode at position ${this.pos}`);
      }
    };

    return decodeNext();
  }

  decodeString(data) {
    const colonPos = data.indexOf(58, this.pos); // ':'
    if (colonPos === -1) throw new Error("Invalid string length");

    const lengthStr = new TextDecoder().decode(data.slice(this.pos, colonPos));
    const length = parseInt(lengthStr, 10);
    this.pos = colonPos + 1;

    const result = data.slice(this.pos, this.pos + length);
    this.pos += length;
    return result;
  }

  decodeInteger(data) {
    this.pos++; // skip 'i'
    const endPos = data.indexOf(101, this.pos); // 'e'
    if (endPos === -1) throw new Error("Invalid integer");

    const intStr = new TextDecoder().decode(data.slice(this.pos, endPos));
    this.pos = endPos + 1;
    return parseInt(intStr, 10);
  }

  decodeList(data, decodeNext) {
    this.pos++; // skip 'l'
    const result = [];

    while (data[this.pos] !== 101) {
      // 'e'
      result.push(decodeNext());
    }
    this.pos++; // skip 'e'
    return result;
  }

  decodeDictionary(data, decodeNext) {
    this.pos++; // skip 'd'
    const result = {};

    while (data[this.pos] !== 101) {
      // 'e'
      const key = new TextDecoder().decode(this.decodeString(data));
      const value = decodeNext();
      result[key] = value;
    }
    this.pos++; // skip 'e'
    return result;
  }

  /**
   * Convert bytes to hex string
   * @param {Uint8Array} bytes - The bytes to convert
   * @returns {string} - Hex string
   */
  bytesToHex(bytes) {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Calculate SHA-1 hash
   * @param {Uint8Array} data - Data to hash
   * @returns {Promise<Uint8Array>} - SHA-1 hash
   */
  async sha1(data) {
    const hash = await crypto.subtle.digest("SHA-1", data);
    return new Uint8Array(hash);
  }

  /**
   * Re-encode info dictionary to calculate hash
   * @param {*} obj - Object to encode
   * @returns {Uint8Array} - Bencode encoded data
   */
  encodeBencode(obj) {
    if (obj instanceof Uint8Array) {
      const length = new TextEncoder().encode(obj.length.toString());
      const result = new Uint8Array(length.length + 1 + obj.length);
      result.set(length, 0);
      result[length.length] = 58; // ':'
      result.set(obj, length.length + 1);
      return result;
    } else if (typeof obj === "number") {
      const str = `i${obj}e`;
      return new TextEncoder().encode(str);
    } else if (Array.isArray(obj)) {
      const parts = [new Uint8Array([108])]; // 'l'
      for (const item of obj) {
        parts.push(this.encodeBencode(item));
      }
      parts.push(new Uint8Array([101])); // 'e'

      const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
      }
      return result;
    } else if (typeof obj === "object") {
      const parts = [new Uint8Array([100])]; // 'd'
      const keys = Object.keys(obj).sort();

      for (const key of keys) {
        const keyBytes = new TextEncoder().encode(key);
        parts.push(this.encodeBencode(keyBytes));
        parts.push(this.encodeBencode(obj[key]));
      }
      parts.push(new Uint8Array([101])); // 'e'

      const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
      }
      return result;
    }
    throw new Error("Unsupported type for bencode encoding");
  }
}

// Export for use
window.TorrentParser = TorrentParser;
