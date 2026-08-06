import React, { useState } from 'react';
import { CLASSES } from '../config';
import { addStudentApi, getStudentsByClass } from '../services/api';
import { Student, ToastMessage } from '../types';
import { UserPlus, User, GraduationCap, Phone, Heart, CheckCircle, RefreshCw } from 'lucide-react';

interface AddStudentProps {
  onStudentAdded?: (student: Student) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const AddStudent: React.FC<AddStudentProps> = ({ onStudentAdded, addToast }) => {
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState<string>('Lớp dưới');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [recentlyAdded, setRecentlyAdded] = useState<Student[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: { fullName?: string; phone?: string } = {};
    if (!fullName.trim()) {
      newErrors.fullName = 'Vui lòng nhập Họ và Tên học sinh';
    }
    if (phone.trim() && !/^[0-9+\s-]{8,15}$/.test(phone.trim())) {
      newErrors.phone = 'Số điện thoại không hợp lệ (từ 8 - 15 chữ số)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const result = await addStudentApi({
        action: 'addStudent',
        fullName: fullName.trim(),
        className,
        parentName: parentName.trim(),
        phone: phone.trim(),
      });

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Thành công!',
          message: `Đã gửi yêu cầu thêm bé ${fullName.trim()} vào lớp ${className}. Đang đồng bộ Google Sheets...`,
        });

        const newStudent = result.newStudent;
        setRecentlyAdded((prev) => [newStudent, ...prev]);

        if (onStudentAdded) {
          onStudentAdded(newStudent);
        }

        // Re-fetch from Google Sheets after 1.5s
        setTimeout(() => {
          getStudentsByClass('Tất cả');
        }, 1500);

        // Reset form
        setFullName('');
        setParentName('');
        setPhone('');
      } else {
        addToast({
          type: 'error',
          title: 'Lỗi',
          message: result.message || 'Không thể thêm học sinh. Vui lòng thử lại.',
        });
      }
    } catch (error) {
      console.error(error);
      addToast({
        type: 'error',
        title: 'Lỗi kết nối',
        message: 'Đã xảy ra lỗi khi gửi dữ liệu.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      
      {/* Banner Header */}
      <div className="bg-orange-400 rounded-3xl p-6 text-white shadow-lg shadow-orange-200/80 relative overflow-hidden">
        <div className="relative z-10 flex items-center space-x-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/30 text-3xl font-bold shadow-inner">
            👶
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Thêm Học Sinh Mới</h2>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-[32px] border-2 border-slate-100 p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Row 1: Họ tên + Lớp */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Họ và Tên Học Sinh <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5 text-orange-400" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Gia Bảo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 text-sm font-bold transition-all focus:outline-none ${
                    errors.fullName
                      ? 'border-red-300 bg-red-50/50'
                      : 'border-slate-100 bg-slate-50 focus:border-blue-400 focus:bg-white'
                  }`}
                />
              </div>
              {errors.fullName && <p className="text-xs text-red-500 font-bold mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Lớp Học <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                </div>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full pl-12 pr-8 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-sm font-black text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none appearance-none"
                >
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 font-black text-xs">
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Tên Phụ Huynh + Số Điện Thoại */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Tên Phụ Huynh
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn Minh"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-sm font-bold transition-all focus:border-blue-400 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Số Điện Thoại Phụ Huynh
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-5 h-5 text-emerald-500" />
                </div>
                <input
                  type="tel"
                  placeholder="Ví dụ: 0901234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 text-sm font-bold transition-all focus:outline-none ${
                    errors.phone
                      ? 'border-red-300 bg-red-50/50'
                      : 'border-slate-100 bg-slate-50 focus:border-blue-400 focus:bg-white'
                  }`}
                />
              </div>
              {errors.phone && <p className="text-xs text-red-500 font-bold mt-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:flex-1 py-4 px-6 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-200 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Thêm Học Sinh</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setFullName('');
                setParentName('');
                setPhone('');
                setErrors({});
              }}
              className="w-full sm:w-auto py-4 px-6 rounded-3xl border-2 border-slate-100 bg-slate-50 text-slate-600 font-black text-sm hover:bg-slate-100 transition-all cursor-pointer"
            >
              Làm Mới Form
            </button>
          </div>
        </form>
      </div>

      {/* Recently added list */}
      {recentlyAdded.length > 0 && (
        <div className="bg-emerald-50 rounded-[32px] border-2 border-emerald-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-emerald-900 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Đã thêm thành công ({recentlyAdded.length} bé)</span>
            </h3>
            <span className="text-xs text-emerald-700 font-bold uppercase">Lưu vào bộ nhớ</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentlyAdded.map((s) => (
              <div key={s.id} className="bg-white p-4 rounded-2xl border-2 border-emerald-100 shadow-2xs flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 font-black flex items-center justify-center shrink-0 text-base">
                  👦
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-800 truncate">{s.fullName}</p>
                  <p className="text-[11px] font-bold text-slate-400">{s.className} {s.phone ? `• SĐT: ${s.phone}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
