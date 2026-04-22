/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Quiz from './components/Quiz';
import AdminPanel from './components/AdminPanel';
import { Lock, GraduationCap, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loginAnonymously, auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Utility for password hashing
async function hashSecret(text: string) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  const [view, setView] = useState<'landing' | 'quiz' | 'admin' | 'admin_login'>('landing');
  const [adminCreds, setAdminCreds] = useState({ user: '', pass: '' });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  useEffect(() => {
    // Kiểm tra session cục bộ (local)
    const isAdminSession = sessionStorage.getItem('isAdmin') === 'true';
    if (isAdminSession) {
      setIsLoggedIn(true);
      setView('admin'); // Tự động vào lại Admin nếu đã đăng nhập
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      const isStillAdmin = sessionStorage.getItem('isAdmin') === 'true';
      // Giữ trạng thái đăng nhập nếu có user hoặc đã xác thực local
      if (user || isStillAdmin) {
        setIsLoggedIn(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = adminCreds.user.trim();
    const pass = adminCreds.pass.trim();

    // Hashes for: "101   101!@#" (1, 2, or 3 spaces)
    const h1 = 'd2cdf3f325473e109ce29c85e017aeb7763ae9b0a5d55cda5891ffd515e68266'; // 3 spaces
    const h2 = '6788db3d91c10705f4df8cf781ec7d1889813e339cd58ca68c4d51624b45502c'; // 2 spaces
    const h3 = '6f98725838531776992520330dc372f87ee56b0d91244e837ea8a46b5fd66835'; // 1 space
    
    const inputHash = await hashSecret(pass);

    if (user === 'legialoi' && (inputHash === h1 || inputHash === h2 || inputHash === h3)) {
      // Vì lỗi auth/admin-restricted-operation từ Firebase, chúng ta chuyển sang 
      // quản lý session cục bộ kết hợp với Relaxed Security Rules của Firestore.
      setIsLoggedIn(true);
      setView('admin');
      sessionStorage.setItem('isAdmin', 'true');
      
      // Thử đăng nhập ẩn danh ở background, nếu lỗi thì cũng không chặn user
      loginAnonymously().catch(err => console.log("Silent auth background failed:", err));
    } else {
      alert('Sai thông tin đăng nhập! Vui lòng kiểm tra lại Username/Password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-slate-900 font-sans">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div 
            key="landing"
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex flex-col items-center justify-center p-4 relative"
          >
            {/* Nút đăng nhập Admin nhỏ ở góc trái */}
            <button 
              onClick={() => setView('admin_login')}
              className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm transition-all text-[10px] font-bold group"
            >
              <Lock size={12} className="group-hover:scale-110 transition-transform" />
              ADMIN
            </button>

            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-200">Σ</div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-800">
                  LUYỆN THI <span className="text-blue-600">LÊ LỢI</span>
                </h1>
              </div>
              <p className="text-slate-500 text-lg max-w-md mx-auto font-medium">
                Hệ thống luyện thi trắc nghiệm vào lớp 10 theo cấu trúc SGD Quảng Trị
              </p>
            </div>

            <div className="w-full max-w-xl">
              <button 
                onClick={() => setView('quiz')}
                className="group relative w-full p-8 md:p-12 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 hover:border-blue-500 transition-all text-left flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-lg shadow-blue-200">
                  <GraduationCap size={40} />
                </div>
                <h3 className="text-3xl font-black mb-4 text-slate-800">Bắt đầu Luyện thi</h3>
                <p className="text-slate-500 mb-10 leading-relaxed text-lg font-medium">
                  Làm bài trắc nghiệm: 16 câu 4 điểm theo cấu trúc <br className="hidden md:block" />
                  8 câu Số, 6 câu Hình, 2 câu Thống kê.
                </p>
                <div className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 group-hover:bg-blue-700 transition-colors">
                  VÀO THI NGAY <ArrowRight size={24} />
                </div>
              </button>
            </div>
            
            <footer className="mt-20 text-slate-400 text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              &copy; 2026 LUYỆN THI LÊ LỢI. Người tạo web: Lê Gia Lợi
            </footer>
          </motion.div>
        )}

        {view === 'quiz' && (
          <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#f0f4f8]">
            <nav className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">Σ</div>
                <span className="text-lg font-bold tracking-tight text-slate-800">LUYỆN THI <span className="text-blue-600">LÊ LỢI</span></span>
              </div>
              <button onClick={() => setView('landing')} className="text-slate-400 hover:text-blue-600 font-bold text-sm flex items-center gap-2 transition-colors">
                ← THOÁT
              </button>
            </nav>
            <div className="p-4 md:p-8">
              <Quiz onBack={() => setView('landing')} />
            </div>
          </motion.div>
        )}

        {view === 'admin_login' && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen flex items-center justify-center p-4 bg-[#f0f4f8]"
          >
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-300 border border-white w-full max-w-md">
              <div className="text-center mb-10">
                 <div className="w-20 h-20 bg-slate-50 text-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Lock size={32} />
                 </div>
                 <h2 className="text-3xl font-black text-slate-800">Admin Access</h2>
                 <p className="text-slate-400 mt-2 font-medium">Xác thực quyền quản trị viên</p>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tên đăng nhập</label>
                  <input 
                    type="text" 
                    placeholder=""
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-lg font-medium"
                    value={adminCreds.user}
                    onChange={e => setAdminCreds({...adminCreds, user: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Mật khẩu</label>
                  <input 
                    type="password" 
                    placeholder=""
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-lg font-medium"
                    value={adminCreds.pass}
                    onChange={e => setAdminCreds({...adminCreds, pass: e.target.value})}
                  />
                </div>
                <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 mt-4 active:scale-95 transform">
                  ĐĂNG NHẬP
                </button>
                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => setView('landing')} 
                    className="text-slate-400 font-bold text-sm tracking-widest hover:text-slate-600 transition uppercase"
                  >
                    HỦY BỎ
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {view === 'admin' && (
          <div className="min-h-screen bg-[#f0f4f8]">
            <AdminPanel onLogout={() => { 
              setIsLoggedIn(false); 
              setView('landing'); 
              sessionStorage.removeItem('isAdmin');
              auth.signOut();
            }} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
