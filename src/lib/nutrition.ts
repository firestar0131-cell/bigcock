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

export type Profile = {
  gender: "male" | "female";
  age: number;
  height: number;
  weight: number;
  activity: "sedentary" | "light" | "moderate" | "active" | "athlete";
  goalType: "cut" | "maintain" | "bulk";
  targetWeight: number;
  note: string;
};

export type Targets = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  advice: string;
  updatedAt: number;
};

export const ACTIVITY_LABELS: Record<Profile["activity"], string> = {
  sedentary: "久坐（幾乎不運動）",
  light: "輕度（每週 1-2 次）",
  moderate: "中度（每週 3-4 次）",
  active: "高度（每週 5-6 次）",
  athlete: "運動員（每天訓練）",
};

export const GOAL_LABELS: Record<Profile["goalType"], string> = {
  cut: "減脂",
  maintain: "維持體態",
  bulk: "增肌",
};

export const DEFAULT_PROFILE: Profile = {
  gender: "male",
  age: 28,
  height: 170,
  weight: 65,
  activity: "moderate",
  goalType: "cut",
  targetWeight: 60,
  note: "",
};

const KEY_MEALS = "burnlog.meals";
const KEY_APIKEY = "burnlog.geminiKey";
const KEY_GOAL = "burnlog.goal";
const KEY_PROFILE = "burnlog.profile";
const KEY_TARGETS = "burnlog.targets";

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

export function loadProfile(): Profile {
  if (!isBrowser()) return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(KEY_PROFILE);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: Profile) {
  if (isBrowser()) localStorage.setItem(KEY_PROFILE, JSON.stringify(p));
}

export function loadTargets(): Targets | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(KEY_TARGETS);
    return raw ? (JSON.parse(raw) as Targets) : null;
  } catch {
    return null;
  }
}

export function saveTargets(t: Targets) {
  if (isBrowser()) localStorage.setItem(KEY_TARGETS, JSON.stringify(t));
}
