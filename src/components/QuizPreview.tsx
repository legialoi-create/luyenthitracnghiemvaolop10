import React from 'react';
import { motion } from 'motion/react';
import { Check, X, Save, Eye } from 'lucide-react';
import MathText from './MathText';
import { ParsedQuestion } from '../utils/wordParser';

interface QuizPreviewProps {
  questions: ParsedQuestion[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function QuizPreview({ questions, onConfirm, onCancel, loading }: QuizPreviewProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Eye size={20} className="text-blue-600" />
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Kiểm tra câu hỏi (Preview)</h2>
            </div>
            <p className="text-slate-400 font-medium text-sm">Vui lòng kiểm tra lại nội dung và công thức LaTeX trước khi lưu.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="px-6 py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition active:scale-95 text-sm uppercase tracking-widest"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={onConfirm}
              disabled={loading || questions.length === 0}
              className="px-8 py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 flex items-center gap-2 text-sm uppercase tracking-widest"
            >
              {loading ? 'ĐANG LƯU...' : <><Save size={18} /> Lưu vào Database</>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8fafc]">
          {questions.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
               <X size={48} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-bold">Không bóc tách được câu hỏi nào. Vui lòng kiểm tra lại định dạng file Word.</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none text-8xl font-black italic select-none">
                  {idx + 1}
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 uppercase">{q.category}</span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Câu hỏi {idx + 1}</span>
                  </div>
                  
                  <div className="text-xl font-semibold text-slate-800 mb-8 leading-relaxed">
                    <MathText text={q.content} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, oIdx) => (
                      <div 
                        key={oIdx} 
                        className={`p-4 rounded-xl border flex items-start gap-4 ${q.correctAnswer === oIdx ? 'bg-green-50 border-green-200 text-green-900 shadow-sm' : 'bg-slate-50 border-slate-100/50 text-slate-600'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${q.correctAnswer === oIdx ? 'bg-green-500 text-white shadow-md shadow-green-200' : 'bg-white text-slate-400 border border-slate-200'}`}>
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <div className="mt-1 font-medium"><MathText text={opt} /></div>
                        {q.correctAnswer === oIdx && <Check size={16} className="ml-auto text-green-500 shrink-0 self-center" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-white border-t border-slate-100 flex justify-center items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          Tổng cộng: {questions.length} câu hỏi được sẵn sàng
        </div>
      </motion.div>
    </div>
  );
}
