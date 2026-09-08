"""Create original, explicitly synthetic five-second robotics sample clips."""
from pathlib import Path
import math
import subprocess
import imageio_ffmpeg
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / "public" / "demo"
root.mkdir(parents=True, exist_ok=True)
for scene in ("robotics", "perception"):
    process = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-f", "rawvideo", "-vcodec", "rawvideo", "-s", "960x540", "-pix_fmt", "rgb24", "-r", "24", "-i", "-", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(root / f"{scene}.mp4")], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    for frame in range(120):
        t = frame / 24
        image = Image.new("RGB", (960, 540), "#0a1723")
        draw = ImageDraw.Draw(image)
        for y in range(280, 550, 30):
            draw.line((0, y, 960, y), fill="#1d3c47")
        for x in range(-900, 1900, 100):
            draw.line((480, 240, x, 540), fill="#1d3c47")
        if scene == "robotics":
            for x, y, w, h in [(130, 100, 150, 180), (640, 90, 190, 200)]:
                draw.rounded_rectangle((x, y, x+w, y+h), 10, fill="#142b39", outline="#416175", width=2)
                for j in range(6): draw.line((x+15, y+20+j*24, x+w-15, y+20+j*24), fill="#284554")
            a = math.sin(t * 1.256) * .5
            points = [(450, 430), (450, 300), (450 + 115*math.cos(a-1), 300 + 115*math.sin(a-1))]
            points.append((points[2][0]+110*math.cos(a), points[2][1]+110*math.sin(a)))
            draw.rounded_rectangle((380, 420, 520, 455), 8, fill="#456075")
            draw.line(points, fill="#c0d9de", width=24)
            for x, y in points: draw.ellipse((x-18, y-18, x+18, y+18), fill="#22cba7", outline="#85eddb", width=3)
            x,y=points[-1]
            draw.line((x,y,x+30,y+25), fill="#98b9c9", width=10)
            draw.rectangle((x-35,y-40,x+50,y+45), outline="#28cda6", width=2)
            draw.text((x-32,y-55), "END EFFECTOR  0.98", fill="#70eccb")
        else:
            for i in range(800):
                angle = i * 2.399
                depth = 1 + (i % 80)/12
                z = (depth-t*.3) % 7 + 1
                x = 480 + math.cos(angle)*480/z
                y = 280 + (math.sin(angle)*220+100)/z
                color = (50, 170+int(60*math.sin(i)), 180+int(40*math.cos(i)))
                draw.ellipse((x,y,x+3,y+3),fill=color)
            for i in range(5):
                x=130+i*155+math.sin(t+i)*15
                y=200+int(math.sin(i)*45)
                draw.rectangle((x,y,x+70,y+125),outline="#5d90eb",width=2)
                draw.text((x,y-15), f"OBJECT {i+1}  0.97",fill="#92b5ff")
        draw.rectangle((30,30,930,510),outline="#315664")
        draw.text((50,48), "FILEMARKET / SYNTHETIC DEMONSTRATION", fill="#81a8b9")
        draw.ellipse((50,480,57,487),fill="#28cda6")
        draw.text((68,478), f"{scene.upper()}    FRAME {frame:03d}    24 FPS",fill="#77dac4")
        draw.text((755,478), f"00:0{int(t)}:{frame%24:02d}",fill="#adc5d4")
        if frame == 24: image.save(root / f"{scene}.jpg")
        process.stdin.write(image.tobytes())
    process.stdin.close()
    if process.wait() != 0: raise RuntimeError("Video encoding failed")
print("Created two original 960x540, five-second H.264 demo clips.")
