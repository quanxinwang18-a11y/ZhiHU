export class Utf8ChunkDecoder {
  private pending: number[] = [];

  decode(buffer: ArrayBuffer) {
    const input = [...this.pending, ...Array.from(new Uint8Array(buffer))];
    this.pending = [];
    let output = "";
    let index = 0;

    while (index < input.length) {
      const first = input[index];
      let length = 1;
      let codePoint = first;
      if ((first & 0xe0) === 0xc0) {
        length = 2;
        codePoint = first & 0x1f;
      } else if ((first & 0xf0) === 0xe0) {
        length = 3;
        codePoint = first & 0x0f;
      } else if ((first & 0xf8) === 0xf0) {
        length = 4;
        codePoint = first & 0x07;
      } else if ((first & 0x80) !== 0) {
        output += "\ufffd";
        index += 1;
        continue;
      }

      if (index + length > input.length) {
        this.pending = input.slice(index);
        break;
      }
      let valid = true;
      for (let offset = 1; offset < length; offset += 1) {
        const next = input[index + offset];
        if ((next & 0xc0) !== 0x80) {
          valid = false;
          break;
        }
        codePoint = (codePoint << 6) | (next & 0x3f);
      }
      if (!valid) {
        output += "\ufffd";
        index += 1;
        continue;
      }
      output += String.fromCodePoint(codePoint);
      index += length;
    }

    return output;
  }

  flush() {
    const output = this.pending.length > 0 ? "\ufffd" : "";
    this.pending = [];
    return output;
  }
}

