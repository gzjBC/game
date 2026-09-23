#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_pixel_villager.py
《High》原始人像素小人 Sprite Sheet 生成脚本（可复现）

产出（写入 assets/sprites/）：
  - villager_high_walk.png            默认配色 4 方向 × 4 帧 = 16 帧 sprite sheet
  - villager_high_{state}.png         5 种状态配色变体（同行走帧换配色）
  - _preview_*.png                    8 倍放大预览图（供人工检查，非游戏资源）

规格：
  - 单帧 32×32 像素，透明底（RGBA）
  - 4 方向：下(down) / 左(left) / 右(right) / 上(up)，sheet 行序 0=down 1=left 2=right 3=up
  - 4 帧行走循环：帧 0 站姿 / 帧 1 迈左腿 / 帧 2 过渡站姿 / 帧 3 迈右腿
  - 锚点：脚底中心 (16, 31)
  - 5 状态配色：idle(灰) pathfinding(蓝) moving(绿) harvesting(橙) returning(深蓝)

依赖：Python 3 + Pillow
运行：python3 generate_pixel_villager.py
"""

import os
from PIL import Image

# ---------------------------------------------------------------------------
# 1. 路径与常量
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(BASE_DIR, "assets", "sprites")
os.makedirs(OUT_DIR, exist_ok=True)

FRAME = 32            # 单帧 32×32
ROWS = ["down", "left", "right", "up"]   # sheet 行序
COLS = [0, 1, 2, 3]                       # 帧序
ANCHOR = (16, 31)     # 锚点：脚底中心

# ---------------------------------------------------------------------------
# 2. 调色板（每状态一套，字符 -> RGB）
#    H=头发  S=皮肤  E=眼睛  M=嘴  B=兽皮裙  L=腿/脚(略深于皮肤)  A=手臂(=皮肤)
# ---------------------------------------------------------------------------
PALETTES = {
    # 默认：自然原始人配色（主 sheet）  A=手臂(皮肤阴影色)
    "default": {
        "H": (58, 44, 36), "S": (178, 128, 88), "E": (40, 30, 24),
        "M": (112, 62, 44), "B": (124, 88, 52), "L": (158, 110, 76),
        "A": (148, 100, 64),
    },
    # idle 灰
    "idle": {
        "H": (92, 92, 94), "S": (178, 178, 180), "E": (52, 52, 54),
        "M": (122, 104, 104), "B": (142, 142, 144), "L": (158, 158, 160),
        "A": (146, 146, 148),
    },
    # pathfinding 蓝
    "pathfinding": {
        "H": (48, 64, 104), "S": (140, 160, 196), "E": (30, 40, 70),
        "M": (112, 122, 152), "B": (66, 104, 170), "L": (120, 140, 176),
        "A": (108, 128, 164),
    },
    # moving 绿
    "moving": {
        "H": (46, 84, 58), "S": (158, 190, 150), "E": (30, 56, 38),
        "M": (100, 132, 110), "B": (74, 146, 96), "L": (138, 170, 130),
        "A": (126, 158, 118),
    },
    # harvesting 橙
    "harvesting": {
        "H": (110, 66, 36), "S": (208, 166, 116), "E": (70, 44, 26),
        "M": (152, 90, 60), "B": (214, 134, 52), "L": (188, 146, 98),
        "A": (176, 134, 86),
    },
    # returning 深蓝
    "returning": {
        "H": (28, 40, 74), "S": (118, 142, 184), "E": (20, 28, 52),
        "M": (92, 108, 142), "B": (46, 68, 118), "L": (98, 122, 164),
        "A": (84, 108, 150),
    },
}

# ---------------------------------------------------------------------------
# 3. 躯干模板（字符网格，自动居中；不含手臂与腿，二者由代码按帧绘制）
#    down=正面(有脸)  left=侧面(脸朝左)  up=背面(只见头发)
# ---------------------------------------------------------------------------
TORSO = {
    "down": [
        "HHHHHHHHH",
        "HHHHHHHHHHH",
        "HSSSSSSSSSH",
        "HSSSSSSSSSSH",
        "HSESSSSSSESH",
        "HSSSSSSSSSSH",
        "HSSSMMSSSSSH",
        "HSSSSSSSSSSH",
        "HHSSSSSSSSHH",
        "..SSSSSSSS..",
        ".SSSSSSSSSS.",
        ".SSSSSSSSSS.",
        "..SSSSSSSS..",
        "..BBBBBBBB..",
        ".BBBBBBBBBB.",
        ".BBBBBBBBBB.",
        ".BBBBBBBBBB.",
        ".SBBBBBBBBB.",
        "..SSSSSSSS..",
    ],
    "left": [
        "HHHHHHH",
        "HHHHHHHHH",
        "SSSSSSSHH",
        "SSSSSSSHH",
        "SSESSSSHH",
        "SSSSSSSHH",
        "SSSSSSSHH",
        "SSSSSSSHH",
        "SSSSSSSHH",
        "..SSSS..",
        ".SSSSSS.",
        ".SSSSSS.",
        ".SSSSSS.",
        ".BBBBBB.",
        "BBBBBBB.",
        "BBBBBBB.",
        "BBBBBBB.",
        ".BBBBBB.",
        ".SSSSSS.",
    ],
    "up": [
        "HHHHHHHHH",
        "HHHHHHHHHHH",
        "HHHHHHHHHHH",
        "HHHHHHHHHHH",
        "HHHHHHHHHHH",
        "HHHHHHHHHHH",
        "HHHHHHHHHHH",
        "HHHHHHHHHHH",
        "HHHHHHHHHHH",
        "..SSSSSSSS..",
        ".SSSSSSSSSS.",
        ".SSSSSSSSSS.",
        "..SSSSSSSS..",
        "..BBBBBBBB..",
        ".BBBBBBBBBB.",
        ".BBBBBBBBBB.",
        ".BBBBBBBBBB.",
        ".SBBBBBBBBB.",
        "..SSSSSSSS..",
    ],
}

# ---------------------------------------------------------------------------
# 4. 腿 / 手臂 逐帧参数（x0..x1 含端点，y0..y1 含端点）
#    帧 0/2 站姿过渡；帧 1 迈左腿（前）；帧 3 迈右腿（前）
# ---------------------------------------------------------------------------
def legs_down_up(frame):
    """正面/背面腿。返回 [(腿x0,腿y0,腿x1,腿y1, 脚x0,脚y0,脚x1,脚y1), ...] 两条腿。"""
    if frame in (0, 2):
        return [
            (12, 19, 14, 28, 11, 29, 15, 31),   # 左腿（3px 宽，脚 5px）
            (16, 19, 18, 28, 16, 29, 20, 31),   # 右腿（中间留 1px 间隙 x=15）
        ]
    if frame == 1:  # 左前右后
        return [
            (12, 19, 14, 29, 11, 30, 16, 31),   # 左腿前迈踩实（脚前伸）
            (16, 19, 18, 26, 15, 27, 18, 28),   # 右腿后蹬抬起
        ]
    return [                                     # frame == 3 右前左后
        (12, 19, 14, 26, 11, 27, 14, 28),       # 左腿后蹬抬起
        (16, 19, 18, 29, 15, 30, 20, 31),       # 右腿前迈踩实（脚前伸）
    ]

def legs_left(frame):
    """侧面（脸朝左）腿：前后错开。"""
    if frame in (0, 2):
        return [
            (13, 19, 16, 28, 12, 29, 17, 31),   # 主腿（两腿视觉并拢）
        ]
    if frame == 1:  # 前腿向画面左前方迈
        return [
            (10, 19, 13, 29, 9, 30, 14, 31),    # 前腿踩实
            (16, 19, 19, 26, 15, 27, 18, 28),   # 后腿抬起
        ]
    return [                                     # frame == 3 另一腿在前
        (14, 19, 17, 29, 13, 30, 18, 31),       # 前腿踩实
        (10, 19, 13, 26, 9, 27, 12, 28),        # 后腿抬起
    ]

def arms_down_up(frame):
    """正面/背面手臂（身体两侧 3px 宽，行走时前后摆投影为上下）。"""
    if frame in (0, 2):
        return [(9, 11, 11, 18), (20, 11, 22, 18)]
    if frame == 1:  # 左臂后摆上抬，右臂前摆下探
        return [(9, 10, 11, 17), (20, 12, 22, 19)]
    return [(9, 12, 11, 19), (20, 10, 22, 17)]

def arms_left(frame):
    """侧面手臂（单只 2px 宽，贴身体前缘）。"""
    if frame in (0, 2):
        return [(11, 10, 12, 17)]
    if frame == 1:  # 前摆
        return [(9, 11, 10, 18)]
    return [(15, 11, 16, 18)]   # 后摆

# ---------------------------------------------------------------------------
# 5. 绘制
# ---------------------------------------------------------------------------
def place(img, x0, y0, x1, y1, color):
    """在 img 上填充矩形（裁剪到画布内）。"""
    x0, x1 = max(0, x0), min(FRAME - 1, x1)
    y0, y1 = max(0, y0), min(FRAME - 1, y1)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            img.putpixel((x, y), color)

def center_row(row):
    """把模板行居中铺到 32 宽画布，返回 (x_offset, chars)。"""
    n = len(row)
    x0 = (FRAME - n) // 2
    return x0, row

def draw_torso(img, direction, pal):
    for dy, row in enumerate(TORSO[direction]):
        x0, row = center_row(row)
        for dx, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x0 + dx, dy), pal[ch])

def draw_limbs(img, direction, frame, pal):
    """按方向与帧绘制手臂与腿（腿色 pal['L']）。"""
    # 手臂（手臂阴影色 A，与身体肤色区分）
    arm_fn = arms_left if direction == "left" else arms_down_up
    for x0, y0, x1, y1 in arm_fn(frame):
        place(img, x0, y0, x1, y1, pal["A"])
    # 腿
    if direction == "left":
        legs = legs_left(frame)
    else:
        legs = legs_down_up(frame)
    for lx0, ly0, lx1, ly1, fx0, fy0, fx1, fy1 in legs:
        place(img, lx0, ly0, lx1, ly1, pal["L"])
        place(img, fx0, fy0, fx1, fy1, pal["L"])

def render_frame(direction, frame, pal):
    if direction == "right":  # 右 = 左的水平镜像
        return render_frame("left", frame, pal).transpose(Image.FLIP_LEFT_RIGHT)
    img = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw_torso(img, direction, pal)
    draw_limbs(img, direction, frame, pal)
    return img

def build_sheet(pal):
    """4 方向 × 4 帧 -> 128×128 sheet（行=方向，列=帧）。"""
    sheet = Image.new("RGBA", (FRAME * 4, FRAME * 4), (0, 0, 0, 0))
    for r, direction in enumerate(ROWS):
        for c, frame in enumerate(COLS):
            img = render_frame(direction, frame, pal)
            sheet.paste(img, (c * FRAME, r * FRAME))
    return sheet

# ---------------------------------------------------------------------------
# 6. 主流程
# ---------------------------------------------------------------------------
def main():
    # 6.1 默认配色主 sheet
    sheet = build_sheet(PALETTES["default"])
    default_path = os.path.join(OUT_DIR, "villager_high_walk.png")
    sheet.save(default_path)
    print("saved:", default_path, sheet.size)

    # 6.2 5 种状态配色变体
    state_paths = {}
    for state in ["idle", "pathfinding", "moving", "harvesting", "returning"]:
        s = build_sheet(PALETTES[state])
        p = os.path.join(OUT_DIR, f"villager_high_{state}.png")
        s.save(p)
        state_paths[state] = p
        print("saved:", p, s.size)

    # 6.3 预览图（8 倍放大 + 棋盘格底，便于人工检查透明区域）
    def preview(sheet_img, scale=8):
        w, h = sheet_img.size
        big = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
        px = sheet_img.load()
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                for yy in range(scale):
                    for xx in range(scale):
                        if a == 0:
                            # 棋盘格
                            chk = (60, 60, 60) if ((x + y) % 2 == 0) else (40, 40, 40)
                            big.putpixel((x * scale + xx, y * scale + yy), (*chk, 255))
                        else:
                            big.putpixel((x * scale + xx, y * scale + yy), (r, g, b, 255))
        return big

    pv1 = preview(sheet)
    pv1.save(os.path.join(OUT_DIR, "_preview_walk_default_8x.png"))
    print("saved preview: _preview_walk_default_8x.png", pv1.size)

    # 6.4 5 状态并排预览（每状态只取 down 方向 4 帧）
    strip = Image.new("RGBA", (FRAME * 4 * 5, FRAME * 4), (0, 0, 0, 0))
    for i, state in enumerate(["idle", "pathfinding", "moving", "harvesting", "returning"]):
        pal = PALETTES[state]
        for c, frame in enumerate(COLS):
            img = render_frame("down", frame, pal)
            strip.paste(img, (i * FRAME * 4 + c * FRAME, 0))
    pv2 = preview(strip)
    pv2.save(os.path.join(OUT_DIR, "_preview_states_down_8x.png"))
    print("saved preview: _preview_states_down_8x.png", pv2.size)

    # 6.5 自检
    assert sheet.size == (128, 128)
    assert all(s.size == (128, 128) for s in [build_sheet(PALETTES[s]) for s in state_paths])
    print("SELF-CHECK OK: 16 frames/sheet, 32x32 per frame, 6 sheets total")

if __name__ == "__main__":
    main()
