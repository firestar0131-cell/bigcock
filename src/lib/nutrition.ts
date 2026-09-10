export type Ingredient = {
  name: string;
  amount: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type Analysis = {
  title: string;
  ingredients: Ingredient[];
  totalKcal: number;
  protein: number;
  fat: number;
  carbs: number;
  comment: string;
};

export type MealEntry = Analysis & {
  id: string;
  createdAt: number;
  image?: string | undefined;
};

const KEY_MEALS = "burnlog.meals";
const KEY_APIKEY = "burnlog.geminiKey";
const KEY_GOAL = "burnlog.goal";

const isBrowser = () => typeof window !== "undefined";

export function loadMeals(): MealEntry[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_MEALS) ?? "[]") as MealEntry[];
  } catch {
    return [];
  }
}

export function saveMeals(meals: MealEntry[]) {
  if (isBrowser()) localStorage.setItem(KEY_MEALS, JSON.stringify(meals));
}

export function loadApiKey(): string {
  if (!isBrowser()) return "";
  return localStorage.getItem(KEY_APIKEY) ?? "";
}

export function saveApiKey(key: string) {
  if (isBrowser()) localStorage.setItem(KEY_APIKEY, key.trim());
}

export function loadGoal(): number {
  if (!isBrowser()) return 2000;
  const v = Number(localStorage.getItem(KEY_GOAL));
  return Number.isFinite(v) && v > 0 ? v : 2000;
}

export function saveGoal(goal: number) {
  if (isBrowser()) localStorage.setItem(KEY_GOAL, String(goal));
}

export function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export function sumMacros(meals: MealEntry[]) {
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.totalKcal || 0),
      protein: acc.protein + (m.protein || 0),
      fat: acc.fat + (m.fat || 0),
      carbs: acc.carbs + (m.carbs || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export function formatTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function mealLabel(ts: number) {
  const h = new Date(ts).getHours();
  if (h < 10) return "早餐";
  if (h < 15) return "午餐";
  if (h < 20) return "晚餐";
  return "宵夜";
}
