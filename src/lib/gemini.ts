import type { Analysis } from "./nutrition";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `你是一位專業的營養師。請分析使用者提供的餐點（文字描述或照片），
拆解成食材清單，估算每項食材的份量、熱量(kcal)、蛋白質(g)、脂肪(g)、碳水化合物(g)。
再給出整餐總計，以及一段 50 字以內的繁體中文「AI 營養教練簡評」。
所有文字皆使用繁體中文。只輸出 JSON。`;

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          kcal: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          carbs: { type: "number" },
        },
        required: ["name", "amount", "kcal", "protein", "fat", "carbs"],
      },
    },
    totalKcal: { type: "number" },
    protein: { type: "number" },
    fat: { type: "number" },
    carbs: { type: "number" },
    comment: { type: "string" },
  },
  required: ["title", "ingredients", "totalKcal", "protein", "fat", "carbs", "comment"],
};

export async function analyzeMeal(opts: {
  apiKey: string;
  text?: string | undefined;
  imageBase64?: string | undefined;
  mimeType?: string | undefined;
}): Promise<Analysis> {
  const parts: Array<Record<string, unknown>> = [];
  if (opts.imageBase64) {
    parts.push({
      inline_data: { mime_type: opts.mimeType || "image/jpeg", data: opts.imageBase64 },
    });
  }
  parts.push({
    text: opts.text?.trim()
      ? `請分析這份餐點：${opts.text.trim()}`
      : "請分析照片中的餐點內容。",
  });

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(opts.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });

  if (!res.ok) {
    let msg = `分析失敗（${res.status}）`;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      if (err?.error?.message) msg += `：${err.error.message}`;
    } catch {
      /* ignore */
    }
    if (res.status === 400 || res.status === 403) msg += "（請確認 API Key 是否正確）";
    throw new Error(msg);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!raw) throw new Error("AI 沒有回傳結果，請再試一次。");

  const parsed = JSON.parse(raw) as Analysis;
  const round = (n: number) => Math.round((Number(n) || 0) * 10) / 10;
  return {
    title: parsed.title || "未命名餐點",
    ingredients: (parsed.ingredients ?? []).map((i) => ({
      name: i.name,
      amount: i.amount,
      kcal: Math.round(Number(i.kcal) || 0),
      protein: round(i.protein),
      fat: round(i.fat),
      carbs: round(i.carbs),
    })),
    totalKcal: Math.round(Number(parsed.totalKcal) || 0),
    protein: round(parsed.protein),
    fat: round(parsed.fat),
    carbs: round(parsed.carbs),
    comment: parsed.comment || "",
  };
}

export function fileToBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve({ base64: dataUrl.split(",")[1] ?? "", dataUrl });
    };
    reader.onerror = () => reject(new Error("讀取照片失敗"));
    reader.readAsDataURL(file);
  });
}
