import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/body')({
  component: BodyTrackerPage,
});

interface BodyLog {
  id: string;
  weight: number | null;
  photo_path: string;
  recorded_at: string;
  imageUrl?: string;
}

function BodyTrackerPage() {
  const [logs, setLogs] = useState<BodyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);

  const fetchLogs = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('body_logs')
        .select('*')
        .order('recorded_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // 取得具備時效保護的私人 Signed URL（非公開網址，完全杜絕外洩）
        const logsWithUrls = await Promise.all(
          data.map(async (log) => {
            const { data: signedData } = await supabase.storage
              .from('body-photos')
              .createSignedUrl(log.photo_path, 3600);
            return { ...log, imageUrl: signedData?.signedUrl || '' };
          })
        );
        setLogs(logsWithUrls);
      }
    } catch (err) {
      console.error('載入失敗:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('請先選擇體態照片！');

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('請先登入帳號');

      const userId = userData.user.id;
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      // 1. 直傳私有 Supabase Bucket，完全不經過 AI
      const { error: uploadError } = await supabase.storage
        .from('body-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. 存入個人的 body_logs 表格
      const { error: dbError } = await supabase.from('body_logs').insert([
        {
          user_id: userId,
          weight: weight ? parseFloat(weight) : null,
          photo_path: filePath,
          recorded_at: date,
        },
      ]);

      if (dbError) throw dbError;

      alert('體態紀錄成功！');
      setFile(null);
      setWeight('');
      fetchLogs();
    } catch (err: any) {
      alert(err.message || '上傳失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">體態追蹤紀錄</h2>
        <p className="text-xs text-gray-500 mt-1">
          🔒 隱私保護模式：本功能照片僅存於個人專屬加密空間，完全隔離於 AI 之外。
        </p>
      </div>

      {/* 上傳表單 */}
      <form onSubmit={handleUpload} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">記錄日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-xl p-2 text-sm bg-gray-50 focus:bg-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">體重 (kg)</label>
          <input
            type="number"
            step="0.1"
            placeholder="例如: 65.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full border rounded-xl p-2 text-sm bg-gray-50 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">體態照片</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition disabled:opacity-50"
        >
          {loading ? '儲存中...' : '保存今日體態'}
        </button>
      </form>

      {/* 歷史紀錄相簿 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">歷史紀錄</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">目前尚無體態紀錄</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {logs.map((log) => (
              <div key={log.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                {log.imageUrl && (
                  <img src={log.imageUrl} alt="體態" className="w-full h-48 object-cover" />
                )}
                <div className="p-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-800">{log.recorded_at}</p>
                  {log.weight && <p className="text-gray-500">{log.weight} kg</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
