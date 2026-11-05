#!/usr/bin/env python3
"""Render the project's original navigation paths as antialiased PNGs; stdlib only."""
import math
from pathlib import Path
import struct
import zlib

SIZE, SCALE = 81, 4
STROKE = 5
ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'navigation'


def arc(cx, cy, rx, ry, start, end, count=64):
    return [(cx + rx * math.cos(start + (end - start) * i / count),
             cy + ry * math.sin(start + (end - start) * i / count)) for i in range(count + 1)]


PATHS = {
    'work': [[(16, 37), (40.5, 16), (65, 37)], [(21, 37), (21, 66), (60, 66), (60, 37)],
             [(34, 66), (34, 48), (47, 48), (47, 66)]],
    'ledger': [[(22, 15), (50, 15), (62, 27), (62, 66), (22, 66), (22, 15)],
               [(50, 15), (50, 27), (62, 27)], [(31, 39), (52, 39)], [(31, 49), (52, 49)], [(31, 59), (46, 59)]],
    'reports': [[(18, 17), (18, 65), (66, 65)], [(30, 50), (30, 59)],
                [(44, 37), (44, 59)], [(58, 23), (58, 59)]],
    'mine': [arc(40.5, 25, 12, 12, 0, math.tau), arc(40.5, 66, 24, 22, math.pi, math.tau), [(17, 66), (64, 66)]]
}


def png(paths, color):
    side = SIZE * SCALE
    pixels = bytearray(side * side)
    radius = STROKE * SCALE / 2
    for path in paths:
        for a, b in zip(path, path[1:]):
            ax, ay, bx, by = *(v * SCALE for v in a), *(v * SCALE for v in b)
            dx, dy = bx - ax, by - ay
            length = dx * dx + dy * dy
            for y in range(max(0, int(min(ay, by) - radius)), min(side, math.ceil(max(ay, by) + radius))):
                for x in range(max(0, int(min(ax, bx) - radius)), min(side, math.ceil(max(ax, bx) + radius))):
                    t = max(0, min(1, ((x + .5 - ax) * dx + (y + .5 - ay) * dy) / length)) if length else 0
                    if (x + .5 - ax - t * dx) ** 2 + (y + .5 - ay - t * dy) ** 2 <= radius ** 2:
                        pixels[y * side + x] = 255
    rgb = bytes.fromhex(color)
    rows = bytearray()
    for y in range(SIZE):
        rows.append(0)
        for x in range(SIZE):
            alpha = sum(pixels[(y * SCALE + j) * side + x * SCALE + i] for j in range(SCALE) for i in range(SCALE)) // (SCALE * SCALE)
            rows.extend(rgb + bytes([alpha]))

    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, paths in PATHS.items():
        for state, color in [('normal', '52647c'), ('selected', '0052d9')]:
            (ROOT / f'{name}-{state}.png').write_bytes(png(paths, color))
    print('Generated 8 original 81x81 navigation icons')
