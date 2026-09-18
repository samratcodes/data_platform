/**
 * Decides how a company logo should sit inside a round badge.
 * - Roughly square logos cover the whole circle.
 * - Wide or tall logos are contained on a background that matches their own edges,
 *   so a wordmark on a colored card still reads as one solid badge.
 * - Light logos on transparent backgrounds get a dark backdrop so they never vanish on white.
 */
export type LogoFit = { cover: boolean; background: string };

export const defaultLogoFit: LogoFit = { cover: true, background: "#ffffff" };
const darkBackdrop = "#16302a";

export function analyzeLogo(image: HTMLImageElement): LogoFit {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return defaultLogoFit;
  const ratio = width / height;
  const cover = ratio >= .8 && ratio <= 1.25;
  let background = "#ffffff";
  try {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { cover, background };
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    const pixel = (x: number, y: number) => { const index = (y * size + x) * 4; return [data[index], data[index + 1], data[index + 2], data[index + 3]]; };
    const corners = [pixel(1, 1), pixel(size - 2, 1), pixel(1, size - 2), pixel(size - 2, size - 2)];
    const average = (channel: number) => corners.reduce((sum, value) => sum + value[channel], 0) / corners.length;
    if (average(3) > 220) {
      background = `rgb(${Math.round(average(0))} ${Math.round(average(1))} ${Math.round(average(2))})`;
    } else {
      // Transparent logo: measure how light its visible pixels are.
      let lightness = 0;
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] < 128) continue;
        lightness += (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
        count += 1;
      }
      if (count && lightness / count > .82) background = darkBackdrop;
    }
  } catch {
    // A tainted canvas only loses the color match; the fit decision still applies.
  }
  return { cover, background };
}
