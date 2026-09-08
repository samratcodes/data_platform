export function samplePoints() {
  return Array.from({ length: 360 }, (_, index) => {
    const angle = index * Math.PI / 30;
    return { x: Math.cos(angle) * (2 + index % 7 / 6), y: index / 120 - 1.5, z: Math.sin(angle) * (2 + index % 7 / 6) };
  });
}
