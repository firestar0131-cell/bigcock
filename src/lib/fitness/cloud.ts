import { supabase } from "@/integrations/supabase/client";
import { emptyFitness } from "./model";
import { fitnessSchema } from "./storage";
import type { FitnessRepository, CloudFitness } from "./sync";
export async function requireFitnessUser(expectedUser: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== expectedUser)
    throw new Error("登入已失效或帳號已切換，請重新登入。");
  return supabase;
}
function readRow(row: { payload: unknown; revision: number }): CloudFitness {
  return { data: fitnessSchema.parse(row.payload), revision: row.revision };
}
export function fitnessRepository(userId: string): FitnessRepository {
  return {
    async load() {
      await requireFitnessUser(userId);
      let result = await supabase
        .from("fitness_accounts")
        .select("payload,revision")
        .eq("user_id", userId)
        .maybeSingle();
      if (result.error)
        throw new Error("無法讀取雲端 Fitness。請確認網路及資料庫 migration 已完成。");
      if (!result.data) {
        const seeded = await supabase
          .from("fitness_accounts")
          .upsert(
            { user_id: userId, payload: emptyFitness(), revision: 0 },
            { onConflict: "user_id", ignoreDuplicates: true },
          );
        if (seeded.error) throw new Error("無法建立帳號的 Fitness 資料，尚未開放寫入。");
        result = await supabase
          .from("fitness_accounts")
          .select("payload,revision")
          .eq("user_id", userId)
          .single();
      }
      if (result.error || !result.data) throw new Error("讀取 Fitness 失敗，請重試。");
      return readRow(result.data);
    },
    async save(data, revision) {
      await requireFitnessUser(userId);
      fitnessSchema.parse(data);
      const result = await supabase.rpc("save_fitness", {
        expected_user: userId,
        expected_revision: revision,
        next_payload: data,
      });
      if (result.error) {
        if (result.error.code === "PT409")
          throw new Error("另一個裝置已更新資料，這次變更沒有覆蓋雲端紀錄。");
        throw new Error("Supabase 未確認儲存成功，請檢查網路或登入狀態。");
      }
      return readRow(result.data);
    },
  };
}

