export function encodeTIFF(
    canvas: HTMLCanvasElement,
    dpi: number
): ArrayBuffer {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const rgb = new Uint8Array(width * height * 3);

    for (let src = 0, dst = 0; src < rgba.length; src += 4) {
        rgb[dst++] = rgba[src];
        rgb[dst++] = rgba[src + 1];
        rgb[dst++] = rgba[src + 2];
    }

    const entryCount = 13;
    const ifdSize = 2 + entryCount * 12 + 4;
    let offset = 8 + ifdSize;

    const bitsPerSampleOffset = offset;
    offset += 6;
    if (offset % 2 !== 0) offset += 1;

    const xResOffset = offset;
    offset += 8;
    if (offset % 2 !== 0) offset += 1;

    const yResOffset = offset;
    offset += 8;
    if (offset % 2 !== 0) offset += 1;

    const imageOffset = offset;
    const totalSize = imageOffset + rgb.length;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const little = true;

    const writeShort = (pos: number, value: number) => view.setUint16(pos, value, little);
    const writeLong = (pos: number, value: number) => view.setUint32(pos, value, little);
    const writeRational = (pos: number, numerator: number, denominator: number) => {
        writeLong(pos, numerator);
        writeLong(pos + 4, denominator);
    };

    bytes[0] = 0x49;
    bytes[1] = 0x49;
    writeShort(2, 42);
    writeLong(4, 8);

    let ifd = 8;
    writeShort(ifd, entryCount);
    ifd += 2;

    const writeEntry = (
        tag: number,
        type: number,
        count: number,
        value: number
    ) => {
        writeShort(ifd, tag);
        writeShort(ifd + 2, type);
        writeLong(ifd + 4, count);
        if (type === 3 && count === 1) {
            writeShort(ifd + 8, value);
        } else {
            writeLong(ifd + 8, value);
        }
        ifd += 12;
    };

    writeEntry(256, 4, 1, width);
    writeEntry(257, 4, 1, height);
    writeEntry(258, 3, 3, bitsPerSampleOffset);
    writeEntry(259, 3, 1, 1);
    writeEntry(262, 3, 1, 2);
    writeEntry(273, 4, 1, imageOffset);
    writeEntry(277, 3, 1, 3);
    writeEntry(278, 4, 1, height);
    writeEntry(279, 4, 1, rgb.length);
    writeEntry(282, 5, 1, xResOffset);
    writeEntry(283, 5, 1, yResOffset);
    writeEntry(284, 3, 1, 1);
    writeEntry(296, 3, 1, 2);

    writeLong(ifd, 0);

    const pos = bitsPerSampleOffset;
    writeShort(pos, 8);
    writeShort(pos + 2, 8);
    writeShort(pos + 4, 8);

    writeRational(xResOffset, dpi, 1);
    writeRational(yResOffset, dpi, 1);

    bytes.set(rgb, imageOffset);

    return buffer;
}