export function MacroPie({
  protein,
  fat,
  carbs,
  size = 56,
}: {
  protein: number;
  fat: number;
  carbs: number;
  size?: number;
}) {
  const p = Math.max(protein, 0) * 4;
  const f = Math.max(fat, 0) * 9;
  const c = Math.max(carbs, 0) * 4;
  const total = p + f + c || 1;
  const a = (p / total) * 100;
  const b = a + (f / total) * 100;

  return (
    <div
      className="shrink-0 rounded-full outline-1 -outline-offset-1 outline-black/5"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--color-halo) 0 ${a}%, var(--color-halo2) ${a}% ${b}%, var(--color-halo3) ${b}% 100%)`,
      }}
      role="img"
      aria-label={`蛋白質 ${protein} 公克、脂肪 ${fat} 公克、碳水 ${carbs} 公克的比例圖`}
    />
  );
}
