import React, { useState, useEffect } from 'react';
import { auth, db, QuizResult } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, Medal, Filter, ChevronLeft } from 'lucide-react';

interface LeaderboardProps {
  onBack: () => void;
  hideHeader?: boolean;
}

type TimeFrame = 'weekly' | 'monthly' | 'all-time';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Details: ', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

export default function Leaderboard({ onBack, hideHeader = false }: LeaderboardProps) {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('all-time');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchResults = async (frame: TimeFrame) => {
    const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
    const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 hours in ms

    setLoading(true);
    try {
      // Check Global Cache doc first to save reads
      const cacheRef = doc(db, 'leaderboard_cache', frame);
      let cacheSnap;
      try {
        cacheSnap = await getDoc(cacheRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `leaderboard_cache/${frame}`);
        return;
      }
      
      if (cacheSnap.exists()) {
        const cacheData = cacheSnap.data();
        const age = Date.now() - cacheData.timestamp;
        if (age < CACHE_TIME) {
          setResults(cacheData.data);
          setLastUpdated(cacheData.timestamp);
          setLoading(false);
          return;
        }
      }

      let q = query(
        collection(db, 'results'),
        orderBy('score', 'desc'),
        orderBy('submittedAt', 'asc'), // Early submission is better for same score
        limit(100)
      );

      if (frame !== 'all-time') {
        const now = new Date();
        const startDate = new Date();
        if (frame === 'weekly') {
          startDate.setDate(now.getDate() - 7);
        } else if (frame === 'monthly') {
          startDate.setMonth(now.getMonth() - 1);
        }
        
        q = query(
          collection(db, 'results'),
          where('submittedAt', '>=', Timestamp.fromDate(startDate)),
          limit(100)
        );
      }

      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'results');
        return;
      }
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizResult));
      
      const processedData = data.map(r => {
        const start = r.startTime instanceof Timestamp ? r.startTime.toDate() : new Date(r.startTime);
        const end = r.submittedAt instanceof Timestamp ? r.submittedAt.toDate() : new Date(r.submittedAt);
        const duration = Math.max(0, (end.getTime() - start.getTime()) / 1000); // seconds
        return { ...r, duration };
      });

      processedData.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a as any).duration - (b as any).duration;
      });

      // Deduplicate: Each student (same name + same school) only once with their best score
      const seen = new Set<string>();
      const uniqueResults: QuizResult[] = [];

      for (const entry of processedData) {
        const key = `${normalize(entry.name)}|${normalize(entry.school)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(entry as any);
        }
        if (uniqueResults.length >= 20) break;
      }

      setResults(uniqueResults);
      
      // Update Global Cache
      const now = Date.now();
      try {
        await setDoc(doc(db, 'leaderboard_cache', frame), {
          data: uniqueResults,
          timestamp: now
        });
      } catch (err) {
        console.warn("Cache update failed (optional):", err);
      }
      setLastUpdated(now);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults(timeFrame);
  }, [timeFrame]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}p ${secs}s`;
  };

  return (
    <div className={`max-w-4xl mx-auto ${hideHeader ? 'py-0' : 'py-8'} px-4`}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-10">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
              <Trophy className="text-amber-500" size={32} />
              BẢNG XẾP HẠNG
            </h2>
            <p className="text-slate-400 font-medium mt-1 uppercase tracking-[0.2em] text-[10px]">Top 20 học sinh xuất sắc nhất</p>
          </div>
          <div className="w-10"></div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-1 px-2 bg-slate-50/50 border-bottom border-slate-100 flex gap-1.5 md:gap-2 overflow-x-auto no-scrollbar">
          {(['all-time', 'weekly', 'monthly'] as TimeFrame[]).map((frame) => (
            <button
              key={frame}
              onClick={() => setTimeFrame(frame)}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                timeFrame === frame 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'
              }`}
            >
              {frame === 'all-time' ? 'Tất cả' : frame === 'weekly' ? 'Tuần này' : 'Tháng này'}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/30">
                <th className="px-6 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hạng</th>
                <th className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thí sinh</th>
                <th className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông tin</th>
                <th className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Điểm số</th>
                <th className="px-6 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-2 h-8 bg-slate-50/50 border-b border-slate-50"></td>
                    </tr>
                  ))
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold italic">Chưa có kết quả nào trong thời gian này.</td>
                  </tr>
                ) : (
                  results.map((r: any, i) => (
                    <motion.tr 
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`group hover:bg-slate-50 border-b border-slate-50 transition-colors ${i < 3 ? 'bg-amber-50/10' : ''}`}
                    >
                      <td className="px-6 py-1.5">
                        <div className="flex items-center gap-2">
                          {i === 0 && <Trophy size={14} className="text-amber-500" />}
                          {i === 1 && <Medal size={14} className="text-slate-400" />}
                          {i === 2 && <Medal size={14} className="text-amber-700" />}
                          <span className={`font-black text-xs ${i < 3 ? 'text-slate-800' : 'text-slate-400'}`}>
                             {i + 1}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2.5">
                           <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[9px] shadow-inner shrink-0 ${
                             i === 0 ? 'bg-amber-500 text-white' : 
                             i === 1 ? 'bg-slate-400 text-white' :
                             i === 2 ? 'bg-amber-700 text-white' :
                             'bg-slate-100 text-slate-400'
                           }`}>
                             {r.name.split(' ').pop()?.slice(0, 2).toUpperCase()}
                           </div>
                           <div>
                             <div className="font-black text-slate-800 text-[11px] truncate max-w-[120px] md:max-w-none leading-tight">{r.name}</div>
                             <div className="text-[8px] font-bold text-slate-400 flex items-center gap-1">
                               <Clock size={7} /> {r.submittedAt instanceof Timestamp ? r.submittedAt.toDate().toLocaleDateString('vi-VN') : new Date(r.submittedAt).toLocaleDateString('vi-VN')}
                             </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-tight leading-tight">{r.class}</span>
                          <span className="text-[8px] font-bold text-slate-400 truncate max-w-[100px] md:max-w-none">{r.school}</span>
                        </div>
                      </td>
                      <td className="px-4 py-1.5 text-center">
                        <div className="inline-flex items-center justify-center min-w-[45px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 font-black text-[11px] shadow-sm">
                          {r.score % 1 === 0 ? r.score : r.score.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-1.5 text-right font-mono text-[9px] font-bold text-slate-400 group-hover:text-slate-800 transition-colors">
                        {formatDuration(r.duration)}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {lastUpdated && (
        <div className="mt-2 text-center max-w-lg mx-auto">
           <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest italic">
             Dữ liệu cập nhật lúc: {new Date(lastUpdated).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
           </p>
        </div>
      )}
      
      {!hideHeader && (
        <div className="mt-8 text-center p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 shadow-sm">
          <h4 className="text-lg font-black mb-2 text-blue-900">Thử thách ngay hôm nay!</h4>
          <p className="text-sm text-blue-600/70 font-medium mb-6">Luyện tập thường xuyên để cải thiện tốc độ và điểm số của bạn trên bảng tổng sắp.</p>
          <button 
             onClick={onBack}
             className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95"
          >
            LÀM BÀI THI NGAY
          </button>
        </div>
      )}
    </div>
  );
}
