import React, { useState, useEffect, useMemo } from 'react';
import { CLASSES } from '../config';
import { getStudentsByClass, saveAttendanceApi } from '../services/api';
import { Student, ToastMessage } from '../types';
import {
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  Save,
  Search,
  Phone,
  RefreshCw,
  Users,
  Sparkles,
  AlertTriangle,
  UserCheck,
  UserX,
  FileSpreadsheet
} from 'lucide-react';

interface DailyAttendanceProps {
  studentsListSignal?: number; // Reload signal if a student was added
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const DailyAttendance: React.FC<DailyAttendanceProps> = ({
  studentsListSignal,
  addToast,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('Lớp dưới');
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [students, setStudents] = useState<Student[]>([]);
  // Mapping student ID -> isAbsent (true = Vắng mặt / Red, false = Đi học / Green)
  const [absentMap, setAbsentMap] = useState<Record<string, boolean>>({});
  // Optional reasons for absence
  const [reasonsMap, setReasonsMap] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'present' | 'absent'>('all');

  // Load students when class changes or when reload signal changes
  useEffect(() => {
    fetchStudents(selectedClass);
  }, [selectedClass, studentsListSignal]);

  const fetchStudents = async (className: string) => {
    setIsLoading(true);
    try {
      const res = await getStudentsByClass(className);
      if (res.success) {
        setStudents(res.data);
        // Reset absent map (default all present = false for isAbsent)
        const initialMap: Record<string, boolean> = {};
        res.data.forEach((s) => {
          initialMap[s.id] = false;
        });
        setAbsentMap(initialMap);
      }
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Lỗi tải danh sách',
        message: 'Không thể tải danh sách học sinh. Vui lòng thử lại.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle single student status
  const toggleStatus = (studentId: string) => {
    setAbsentMap((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Batch actions
  const setAllPresent = () => {
    const updated: Record<string, boolean> = {};
    students.forEach((s) => {
      updated[s.id] = false;
    });
    setAbsentMap(updated);
    addToast({
      type: 'info',
      title: 'Đã chọn',
      message: 'Đặt tất cả học sinh là Đi học (Xanh)',
    });
  };

  const setAllAbsent = () => {
    const updated: Record<string, boolean> = {};
    students.forEach((s) => {
      updated[s.id] = true;
    });
    setAbsentMap(updated);
    addToast({
      type: 'info',
      title: 'Đã chọn',
      message: 'Đặt tất cả học sinh là Vắng mặt (Đỏ)',
    });
  };

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.includes(searchQuery));

      if (!matchesSearch) return false;

      const isAbsent = absentMap[s.id];
      if (filterMode === 'present') return !isAbsent;
      if (filterMode === 'absent') return isAbsent;
      return true;
    });
  }, [students, searchQuery, filterMode, absentMap]);

  // Statistics calculation
  const totalCount = students.length;
  const absentCount = Object.values(absentMap).filter(Boolean).length;
  const presentCount = totalCount - absentCount;

  // Handle Save Attendance
  const handleSaveAttendance = async () => {
    if (students.length === 0) {
      addToast({
        type: 'error',
        title: 'Cảnh báo',
        message: 'Lớp hiện tại không có học sinh để điểm danh.',
      });
      return;
    }

    setIsSaving(true);

    // Get array of absent student IDs
    const absentIds = students
      .filter((s) => absentMap[s.id] === true)
      .map((s) => s.id);

    try {
      const res = await saveAttendanceApi({
        action: 'saveAttendance',
        class: selectedClass,
        date: attendanceDate,
        absentIds,
      });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Lưu thành công!',
          message: res.message,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Lỗi',
          message: res.message || 'Không thể lưu điểm danh.',
        });
      }
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Lỗi kết nối',
        message: 'Không thể kết nối tới máy chủ.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28">
      
      {/* Top Bar: Class selection pills + Date + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Class Selection & Date (Left 8 cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-[32px] border-2 border-slate-100 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1 text-orange-500" />
                Chọn Lớp Học
              </label>
              {/* Class Selector Pills */}
              <div className="flex flex-wrap gap-2">
                {['Tất cả', ...CLASSES].map((cls) => {
                  const isSelected = selectedClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedClass(cls)}
                      className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-orange-50 border-2 border-orange-400 text-orange-700 shadow-sm'
                          : 'bg-white border-2 border-slate-100 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Picker */}
            <div className="sm:w-48 shrink-0">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-blue-500" />
                Ngày Điểm Danh
              </label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-xs font-black text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm bé theo tên hoặc SĐT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-2xl border-2 border-slate-100 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-300 focus:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Toggle All */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={setAllPresent}
                className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs hover:bg-emerald-200 transition-all flex items-center space-x-1 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Tất cả đi học</span>
              </button>

              <button
                onClick={setAllAbsent}
                className="px-3 py-2 rounded-xl bg-red-100 text-red-800 font-black text-xs hover:bg-red-200 transition-all flex items-center space-x-1 cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Tất cả vắng</span>
              </button>

              <button
                onClick={() => fetchStudents(selectedClass)}
                disabled={isLoading}
                title="Tải lại"
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
              </button>
            </div>
          </div>

        </div>

        {/* Quick Stats Box (Right 4 cols) */}
        <div className="lg:col-span-4 bg-white p-6 rounded-[32px] border-2 border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Thống Kê {selectedClass}</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-100">
                <div className="text-xl font-black text-slate-800">{totalCount}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase">Sĩ Số</div>
              </div>

              <div
                onClick={() => setFilterMode(filterMode === 'present' ? 'all' : 'present')}
                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                  filterMode === 'present'
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <div className="text-xl font-black">{presentCount}</div>
                <div className="text-[10px] font-black uppercase opacity-90">Đi Học</div>
              </div>

              <div
                onClick={() => setFilterMode(filterMode === 'absent' ? 'all' : 'absent')}
                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                  filterMode === 'absent'
                    ? 'bg-red-500 text-white border-red-600 shadow-md'
                    : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                }`}
              >
                <div className="text-xl font-black">{absentCount}</div>
                <div className="text-[10px] font-black uppercase opacity-90">Vắng Mặt</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveAttendance}
            disabled={isSaving || students.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-blue-200 uppercase tracking-wider transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu Điểm Danh ({absentCount} Vắng)</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Filter Mode Badge */}
      {filterMode !== 'all' && (
        <div className="flex items-center justify-between bg-amber-50 px-5 py-2.5 rounded-2xl border-2 border-amber-200 text-xs text-amber-900 font-bold">
          <span>Đang lọc: <strong>{filterMode === 'present' ? 'Chỉ hiển thị bé Đi học' : 'Chỉ hiển thị bé Vắng mặt'}</strong></span>
          <button onClick={() => setFilterMode('all')} className="underline font-black hover:text-amber-950">
            Xem tất cả
          </button>
        </div>
      )}

      {/* Student Cards Grid */}
      <div className="bg-white rounded-[40px] border-2 border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800">
            Danh Sách {selectedClass} <span className="text-slate-400 font-medium ml-2 text-xs">({filteredStudents.length} học sinh)</span>
          </h2>

          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 text-xs font-black text-emerald-700">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div> Đi học
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 text-xs font-black text-red-700">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div> Vắng mặt
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm font-black text-slate-600">Đang tải danh sách học sinh {selectedClass}...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-black text-slate-700">Chưa có học sinh trong danh sách này</h3>
            <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
              Chuyển sang tab <strong>"Thêm học sinh"</strong> để nhập dữ liệu bé mới.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStudents.map((student, index) => {
              const isAbsent = absentMap[student.id] ?? false;
              const isGirl = student.gender === 'girl' || (index % 2 !== 0);

              return (
                <div
                  key={student.id}
                  className={`border-2 p-5 rounded-3xl flex flex-col items-center text-center transition-all duration-200 ${
                    isAbsent
                      ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
                      : 'bg-white border-slate-100 hover:border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Emoji Avatar */}
                  <div
                    className={`w-16 h-16 rounded-full mb-3 flex items-center justify-center text-2xl shadow-inner font-black ${
                      isAbsent
                        ? 'bg-red-100 border-2 border-red-200'
                        : isGirl
                        ? 'bg-pink-100 text-pink-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isGirl ? '👧' : '👦'}
                  </div>

                  {/* Student Info */}
                  <h4 className={`font-black text-base leading-tight ${isAbsent ? 'text-red-900' : 'text-slate-800'}`}>
                    {student.fullName}
                  </h4>

                  <p className={`text-[10px] font-extrabold mb-3 uppercase tracking-wider ${isAbsent ? 'text-red-400' : 'text-slate-400'}`}>
                    ID: #{student.id}
                  </p>

                  {student.phone && (
                    <a
                      href={`tel:${student.phone}`}
                      className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center mb-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3 h-3 mr-1 text-emerald-500" />
                      {student.phone}
                    </a>
                  )}

                  {/* Absent Reason Input */}
                  {isAbsent && (
                    <div className="w-full mb-3">
                      <input
                        type="text"
                        placeholder="Lý do vắng mặt..."
                        value={reasonsMap[student.id] || ''}
                        onChange={(e) =>
                          setReasonsMap((prev) => ({ ...prev, [student.id]: e.target.value }))
                        }
                        className="w-full text-xs bg-white border border-red-200 rounded-xl px-2.5 py-1.5 text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                    </div>
                  )}

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => toggleStatus(student.id)}
                    className={`w-full py-2.5 rounded-2xl font-black text-xs uppercase transition-all shadow-md cursor-pointer ${
                      isAbsent
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100'
                    }`}
                  >
                    {isAbsent ? 'VẮNG MẶT' : 'ĐI HỌC'}
                  </button>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Save Bar for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-slate-100 py-3 px-4 shadow-xl">
        <button
          onClick={handleSaveAttendance}
          disabled={isSaving || students.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-3xl font-black text-base shadow-xl shadow-blue-200 uppercase tracking-wider flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>LƯU ĐIỂM DANH ({absentCount} VẮNG)</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
