import { createClient } from '@supabase/supabase-js';

// 直接設定專屬 Supabase 伺服器資訊，確保 SSR 與前端皆能穩定連線
const SUPABASE_URL = 'https://lbufgwwtnugnesdszzrd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BgCeHpgKd-udkCTPl9v7Iw_0w8Gtimw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
