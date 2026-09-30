"""由主图生成 Chrome 扩展所需的各尺寸 PNG 图标。

`icons/icon-master.png` 是唯一的源文件（1024x1024，透明背景 + 深色圆角方块 + 图形标识）。
Chrome 的扩展图标不支持 SVG，必须是位图，所以这里直接用 Pillow 从主图降采样，
不需要浏览器参与。

为让图形在 16px 下也尽量占满画布，脚本先按不透明像素求内容包围盒，以内容中心
取正方形、只留一点点透明边距，再缩放。

降采样前会把完全透明像素的 RGB 统一成图形底色：主图是带压缩噪点的位图，透明
区域的 RGB 并不干净，直接做非预乘的 RGBA 缩放容易在边缘混出杂色。

用法：
    pip install pillow
    python icons/render_icons.py
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, "icon-master.png")
SIZES = (16, 32, 48, 128)

# alpha 高于该值才算图形本体，用来求内容包围盒（排除压缩噪点）
ALPHA_THRESHOLD = 200
# 内容之外保留的透明边距比例（相对于内容边长）
MARGIN_RATIO = 0.03


def dominant_color(im):
    """取不透明像素里出现最多的颜色，作为透明区域的填充底色。"""
    small = im.resize((96, 96), Image.NEAREST)
    px = small.load()
    counts = {}
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            if a >= 250:
                counts[(r, g, b)] = counts.get((r, g, b), 0) + 1
    if not counts:
        raise RuntimeError("主图里找不到不透明内容")
    return max(counts.items(), key=lambda kv: kv[1])[0]


def content_square(im):
    """按内容包围盒给出正方形裁切框，四周留 MARGIN_RATIO 的透明边距。"""
    alpha = im.getchannel("A")
    mask = alpha.point(lambda v: 255 if v >= ALPHA_THRESHOLD else 0)
    box = mask.getbbox()
    if box is None:
        raise RuntimeError("主图里找不到不透明内容")
    left, top, right, bottom = box
    cx = (left + right) / 2.0
    cy = (top + bottom) / 2.0
    side = max(right - left, bottom - top) * (1 + 2 * MARGIN_RATIO)
    half = side / 2.0
    return (cx - half, cy - half, cx + half, cy + half)


def main():
    master = Image.open(MASTER).convert("RGBA")

    # 透明像素的 RGB 统一成图形底色，避免缩放时在边缘混出杂色
    alpha = master.getchannel("A")
    background = Image.new("RGBA", master.size, dominant_color(master) + (255,))
    mask = alpha.point(lambda v: 255 if v > 0 else 0)
    master = Image.composite(master, background, mask)
    master.putalpha(alpha)

    # 裁切框可能略微超出原图，先贴到一张更大的透明画布上再裁
    box = content_square(master)
    pad = int(max(0.0, -min(box[0], box[1]), box[2] - master.width, box[3] - master.height)) + 2
    canvas = Image.new("RGBA", (master.width + 2 * pad, master.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(master, (pad, pad))
    square = canvas.crop(tuple(int(round(v + pad)) for v in box))
    print("内容裁切框 %s，输出正方形 %dx%d" % (box, square.width, square.height))

    for size in SIZES:
        out = os.path.join(HERE, "icon%d.png" % size)
        square.resize((size, size), Image.LANCZOS).save(out)
        print("wrote %s (%dx%d)" % (out, size, size))


if __name__ == "__main__":
    main()
