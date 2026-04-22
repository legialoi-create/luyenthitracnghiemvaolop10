import React, { useState, useEffect } from 'react';
import { db, Question, QuizResult } from '../lib/firebase';
import { collection, addDoc, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, ChevronLeft, Send, User } from 'lucide-react';
import MathText from './MathText';

export default function Quiz({ onBack }: { onBack?: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentStep, setCurrentStep] = useState<'info' | 'doing' | 'result'>('info');
  const [studentInfo, setStudentInfo] = useState({ name: '', class: '' });
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAndRandomize = async () => {
    const snapshot = await getDocs(collection(db, 'questions'));
    const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
    
    const algebra = all.filter(q => q.category === 'Số và Đại số').sort(() => 0.5 - Math.random()).slice(0, 8);
    const geometry = all.filter(q => q.category === 'Hình học và Đo lường').sort(() => 0.5 - Math.random()).slice(0, 6);
    const stats = all.filter(q => q.category === 'Thống kê và Xác suất').sort(() => 0.5 - Math.random()).slice(0, 2);
    
    setQuestions([...algebra, ...geometry, ...stats].sort(() => 0.5 - Math.random()));
  };

  const startQuiz = async () => {
    if (!studentInfo.name || !studentInfo.class) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    await fetchAndRandomize();
    setStartTime(new Date());
    setCurrentStep('doing');
  };

  const handleSubmit = async () => {
    if (Object.keys(userAnswers).length < questions.length) {
      if (!confirm('Bạn chưa hoàn thành tất cả câu hỏi. Nộp bài ngay?')) return;
    }

    setIsSubmitting(true);
    let count = 0;
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) {
        count++;
      }
    });

    const finalScore = count * 0.25;
    setCorrectCount(count);
    setScore(finalScore);

    try {
      await addDoc(collection(db, 'results'), {
        name: studentInfo.name,
        class: studentInfo.class,
        score: finalScore,
        correctCount: count,
        totalQuestions: questions.length,
        startTime: Timestamp.fromDate(startTime!),
        submittedAt: serverTimestamp()
      });
      setCurrentStep('result');
    } catch (err) {
      alert('Lỗi nộp bài');
    }
    setIsSubmitting(false);
  };

  if (currentStep === 'info') {
    return (
      <div className="max-w-md mx-auto mt-12 p-10 bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-white">
        <div className="text-center mb-10">
          <div className="flex justify-between items-start mb-6">
            <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-inner">
              <User size={36} />
            </div>
            <div className="w-6"></div>
          </div>
          <h2 className="text-3xl font-black text-slate-800">Thông tin học sinh</h2>
          <p className="text-slate-400 mt-2 font-medium">Nhập thông tin để bắt đầu bài thi</p>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Họ và Tên</label>
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-lg"
              placeholder="Nguyễn Văn A"
              value={studentInfo.name}
              onChange={e => setStudentInfo({...studentInfo, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Lớp / Khối</label>
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-lg"
              placeholder="9A"
              value={studentInfo.class}
              onChange={e => setStudentInfo({...studentInfo, class: e.target.value})}
            />
          </div>
          <button 
            onClick={startQuiz}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 mt-4 active:scale-95 transform"
          >
            BẮT ĐẦU LÀM BÀI
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 'doing' && questions.length === 0) {
    return <div className="text-center mt-20 p-12 bg-white rounded-3xl shadow-xl max-w-md mx-auto border border-slate-100 font-bold text-slate-400">Kho đề đang được cập nhật...</div>;
  }

  if (currentStep === 'doing') {
    const q = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;

    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 gap-6">
          <div className="flex gap-6 items-center">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Câu hỏi</div>
              <div className="text-xl font-black text-slate-800 tracking-tight">{(currentIndex + 1).toString().padStart(2, '0')} / {questions.length}</div>
            </div>
            <div className="w-px bg-slate-100 h-10"></div>
            <div className="text-center">
               <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Danh mục</div>
               <div className="text-sm font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border border-blue-100">{q.category}</div>
            </div>
          </div>

          <div className="flex-1 w-full md:px-12">
            <div className="flex justify-between items-center mb-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ hoàn thành</span>
               <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-blue-500 shadow-sm"
              ></motion.div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 border-l pl-6 border-slate-100">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Thí sinh</div>
              <div className="text-sm font-bold text-slate-800">{studentInfo.name}</div>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 text-xs shadow-inner">
              {studentInfo.name.split(' ').pop()?.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-9">
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[450px] flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                <div className="text-[12rem] font-black italic tracking-tighter">Q</div>
              </div>

              <div className="relative z-10">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-6">Câu hỏi số {currentIndex + 1}:</h3>
                <div className="text-2xl leading-relaxed font-semibold text-slate-800 mb-12">
                  <MathText text={q.content} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-auto">
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setUserAnswers({...userAnswers, [currentIndex]: i})}
                      className={`group p-6 rounded-2xl border-2 text-left transition-all flex items-start gap-5 relative overflow-hidden ${
                        userAnswers[currentIndex] === i 
                          ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-md shadow-blue-100' 
                          : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white hover:shadow-lg'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                        userAnswers[currentIndex] === i ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <div className="mt-2 text-lg font-medium tracking-tight"><MathText text={opt} /></div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-50">
                <button 
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className="px-8 py-3 rounded-xl text-slate-400 font-bold hover:bg-slate-50 disabled:opacity-20 transition-all"
                >
                  ← QUAY LẠI
                </button>
                
                {currentIndex === questions.length - 1 ? (
                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-3 px-10 py-4 bg-green-500 text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:bg-green-600 transition-all transform hover:-translate-y-1"
                  >
                    {isSubmitting ? 'ĐANG NỘP...' : 'NỘP BÀI'} <Send size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all transform hover:-translate-y-1"
                  >
                    TIẾP TỤC <ChevronRight size={20} />
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-4">
             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Danh sách câu hỏi</h4>
                <div className="grid grid-cols-4 gap-2">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-full aspect-square rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center ${
                        currentIndex === i ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 scale-105' :
                        userAnswers[i] !== undefined ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-300 border-slate-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
             </div>

             <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-slate-300 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Mẹo làm bài</h4>
                <p className="text-xs text-slate-400 italic leading-relaxed">"Đọc kỹ đề bài, chú ý các điều kiện của tham số. Đừng quên kiểm tra lại các đáp án đã chọn!"</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'result') {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-12 bg-white rounded-[3rem] shadow-2xl shadow-slate-200 border border-white text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        
        <motion.div 
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          className="w-28 h-28 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"
        >
          <CheckCircle2 size={56} />
        </motion.div>
        
        <h2 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">Kết thúc bài thi!</h2>
        <p className="text-slate-400 mb-10 font-medium">Chúc mừng <span className="text-blue-600">{studentInfo.name}</span> đã hoàn thành bài thi trắc nghiệm.</p>
        
        <div className="mb-12">
           <div className="bg-blue-600 p-10 rounded-[3rem] shadow-2xl shadow-blue-200 text-white inline-block min-w-[280px]">
              <div className="text-[12px] text-blue-100 font-black uppercase tracking-[0.3em] mb-4">Điểm số của bạn</div>
              <div className="flex items-center justify-center gap-2">
                 <span className="text-8xl font-black tracking-tighter">{score % 1 === 0 ? score : score.toFixed(2)}</span>
                 <span className="text-4xl font-bold text-blue-300">/ 4</span>
              </div>
           </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-10 inline-flex items-center gap-4">
           <div className={`w-3 h-3 rounded-full ${correctCount >= 8 ? 'bg-green-500' : 'bg-orange-500'}`}></div>
           <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">
             Số câu đúng: <span className="text-slate-900">{correctCount}</span> / {questions.length}
           </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition shadow-xl shadow-slate-200 uppercase tracking-widest"
            >
              Làm đề mới
            </button>
            <button 
              onClick={onBack}
              className="px-8 py-5 bg-white text-slate-400 border border-slate-200 rounded-2xl font-black text-sm hover:bg-slate-50 transition uppercase tracking-widest"
            >
              Quay lại trang chủ
            </button>
        </div>
      </div>
    );
  }

  return null;
}
