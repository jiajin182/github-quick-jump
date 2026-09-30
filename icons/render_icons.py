"""由 icon.svg 生成 Chrome 扩展所需的各尺寸 PNG 图标。

Chrome 的扩展图标不支持 SVG，必须是位图。这里用无头 Chrome 渲染 SVG
（浏览器对 SVG 的渲染是权威的），再用 Pillow 降采样到目标尺寸。
"""

import os
import shutil
import subprocess
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER_SIZE = 512
SIZES = (16, 32, 48, 128)

CHROME_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
)


def find_browser():
    for path in CHROME_CANDIDATES:
        if os.path.isfile(path):
            return path
    found = shutil.which("chrome") or shutil.which("msedge")
    if found:
        return found
    raise RuntimeError("未找到 Chrome 或 Edge，无法渲染 SVG")


def render_master():
    with open(os.path.join(HERE, "icon.svg"), "r", encoding="utf-8") as f:
        svg = f.read()

    html = (
        "<!doctype html><html><head><meta charset=\"utf-8\"><style>"
        "html,body{margin:0;padding:0;background:transparent;overflow:hidden}"
        "svg{display:block}</style></head><body>%s</body></html>" % svg
    )

    workdir = tempfile.mkdtemp(prefix="ghqj-icons-")
    html_path = os.path.join(workdir, "render.html")
    png_path = os.path.join(workdir, "master.png")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    subprocess.run(
        [
            find_browser(),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--window-size=%d,%d" % (MASTER_SIZE, MASTER_SIZE),
            "--default-background-color=00000000",
            "--user-data-dir=" + os.path.join(workdir, "profile"),
            "--screenshot=" + png_path,
            "file:///" + html_path.replace("\\", "/"),
        ],
        check=False,
        capture_output=True,
    )

    if not os.path.isfile(png_path):
        raise RuntimeError("浏览器未生成截图")

    image = Image.open(png_path).convert("RGBA")
    shutil.rmtree(workdir, ignore_errors=True)
    return image


def main():
    master = render_master()
    if master.size != (MASTER_SIZE, MASTER_SIZE):
        raise RuntimeError("渲染尺寸异常: %s" % (master.size,))

    for size in SIZES:
        out = os.path.join(HERE, "icon%d.png" % size)
        master.resize((size, size), Image.LANCZOS).save(out)
        print("wrote %s (%dx%d)" % (out, size, size))


if __name__ == "__main__":
    main()