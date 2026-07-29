import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Download, 
  Phone, 
  Filter, 
  RefreshCw, 
  Loader2
} from 'lucide-react';
import { Student } from '../types';
import { CLASSES } from '../config';
import { getLocalStudents, getStudentsByClass, getAttendanceHistoryApi } from '../services/api';

interface ReportsProps {
  addToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
}

/**
 * Utility: Chuyển đổi chuỗi ngày thành định dạng Việt Nam bằng Date object và toLocaleDateString
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return '';

  const d = new Date(dateString);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('vi-VN');
  }

  return String(dateString);
};

/**
 * Utility: Chuyển đổi mốc thời gian (timestamp) thành định dạng giờ phút ngày local (ví dụ: Lúc 08:50 - 29/07/2026)
 */
export const formatTime = (dateString?: string): string => {
  if (!dateString) return '';

  const str = String(dateString).trim();
  const d = new Date(str);

  if (!isNaN(d.getTime())) {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `Lúc ${hours}:${minutes} - ${day}/${month}/${year}`;
  }

  return str;
};

const isClassMatch = (studentClass: string | undefined, targetClass: string) => {
  if (!targetClass || targetClass === 'Tất cả') return true;
  if (!studentClass) return false;
  const sc = studentClass.trim().toLowerCase();
  const tc = targetClass.trim().toLowerCase();
  return sc === tc || sc.includes(tc) || tc.includes(sc);
};

export const Reports: React.FC<ReportsProps> = ({ addToast }) => {
  const [reportSubTab, setReportSubTab] = useState<'history' | 'students'>('history');
  const [selectedClass, setSelectedClass] = useState<string>('Tất cả');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timePeriod, setTimePeriod] = useState<'this_week' | '7_days' | 'this_month' | 'last_month' | '30_days' | 'all'>('this_month');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load history from Google Sheets API & students list
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [historyRes, studentListRes] = await Promise.all([
        getAttendanceHistoryApi(),
        getStudentsByClass('Tất cả')
      ]);

      if (historyRes.success && Array.isArray(historyRes.data)) {
        setHistoryList(historyRes.data);
      } else {
        setHistoryList([]);
      }

      if (studentListRes.success && Array.isArray(studentListRes.data)) {
        setStudents(studentListRes.data);
      } else {
        setStudents(getLocalStudents());
      }
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu báo cáo:', e);
      addToast({ type: 'error', title: 'Lỗi kết nối', message: 'Không thể tải lịch sử điểm danh từ server.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to parse array of absent student names from a history record
  const getAbsentNamesFromRecord = (rec: any): string[] => {
    if (rec.absentNames && typeof rec.absentNames === 'string') {
      return rec.absentNames
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && s !== '-' && s.toLowerCase() !== 'không' && s.toLowerCase() !== 'không có');
    }
    if (Array.isArray(rec.absentIds) && rec.absentIds.length > 0) {
      return rec.absentIds.map((id: string) => {
        const found = students.find((s) => s.id === id);
        return found ? found.fullName : id;
      });
    }
    return [];
  };

  // Filter history records for date & class log
  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      const matchClass = isClassMatch(item.className, selectedClass);
      let matchDate = true;
      if (selectedDate) {
        const itemFormatted = formatDate(item.date);
        const selectedFormatted = formatDate(selectedDate);
        matchDate = itemFormatted === selectedFormatted || item.date === selectedDate;
      }
      return matchClass && matchDate;
    });
  }, [historyList, selectedClass, selectedDate]);

  // Filter history by time period
  const filteredHistoryByTime = useMemo(() => {
    const now = new Date();

    return historyList.filter((record) => {
      if (!record.date) return true;
      let recDate = new Date(record.date);
      
      if (isNaN(recDate.getTime())) {
        const cleanStr = String(record.date).trim();
        const parts = cleanStr.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            recDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
          } else {
            // DD/MM/YYYY
            recDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0, 0);
          }
        }
      }

      if (isNaN(recDate.getTime())) return true;

      if (timePeriod === 'this_week') {
        const dayOfWeek = now.getDay();
        const distanceToMon = (dayOfWeek + 6) % 7;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMon, 0, 0, 0);
        return recDate >= monday;
      }

      if (timePeriod === 'this_month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        return recDate >= firstDay;
      }

      if (timePeriod === 'last_month') {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return recDate >= firstDayLastMonth && recDate <= lastDayLastMonth;
      }

      if (timePeriod === '7_days') {
        const d7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
        return recDate >= d7;
      }

      if (timePeriod === '30_days') {
        const d30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0);
        return recDate >= d30;
      }

      return true; // 'all'
    });
  }, [historyList, timePeriod]);

  // Student list mapping with attendance stats
  const studentStats = useMemo(() => {
    const map = new Map<string, { student: Student; presentCount: number; absentCount: number; totalSessions: number }>();

    // Initialize map
    students.forEach((s) => {
      map.set(s.id, { student: s, presentCount: 0, absentCount: 0, totalSessions: 0 });
    });

    // Compute stats from filteredHistoryByTime
    filteredHistoryByTime.forEach((record) => {
      const absentNamesList = getAbsentNamesFromRecord(record).map(n => n.toLowerCase().trim());
      const classStudents = students.filter((s) => isClassMatch(s.className, record.className));

      classStudents.forEach((s) => {
        const item = map.get(s.id);
        if (item) {
          item.totalSessions += 1;
          const isAbsent = absentNamesList.some(name => name === s.fullName.toLowerCase().trim());
          if (isAbsent) {
            item.absentCount += 1;
          } else {
            item.presentCount += 1;
          }
        }
      });
    });

    const list = Array.from(map.values());

    return list.filter(({ student }) => {
      const matchClass = isClassMatch(student.className, selectedClass);
      const matchSearch = !searchTerm || student.fullName.toLowerCase().includes(searchTerm.toLowerCase().trim()) || (student.phone && student.phone.includes(searchTerm.trim()));
      return matchClass && matchSearch;
    });
  }, [students, filteredHistoryByTime, selectedClass, searchTerm]);

  // Overall Statistics Metrics
  const totalStudents = students.length;
  const totalSessionsRecorded = historyList.length;

  const overallPresenceRate = useMemo(() => {
    if (historyList.length === 0 || students.length === 0) return 100;
    let totalPresent = 0;
    let totalPossible = 0;

    historyList.forEach((rec) => {
      const classCount = students.filter((s) => isClassMatch(s.className, rec.className)).length || 10;
      const absentCount = getAbsentNamesFromRecord(rec).length;
      totalPresent += Math.max(0, classCount - absentCount);
      totalPossible += classCount;
    });

    if (totalPossible === 0) return 100;
    return Math.round((totalPresent / totalPossible) * 100);
  }, [historyList, students]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      addToast({ type: 'info', title: 'Chưa có dữ liệu', message: 'Không có dữ liệu điểm danh để xuất báo cáo.' });
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel display
    csvContent += "Ngày điểm danh,Lớp,Tổng sĩ số,Số bé vắng,Số bé có mặt,Tỷ lệ hiện diện (%),Danh sách vắng\n";

    filteredHistory.forEach((rec) => {
      const classStudents = students.filter((s) => isClassMatch(s.className, rec.className));
      const totalInClass = classStudents.length || 10;
      const absentNamesList = getAbsentNamesFromRecord(rec);
      const absentCount = absentNamesList.length;
      const presentCount = Math.max(0, totalInClass - absentCount);
      const rate = totalInClass > 0 ? Math.round((presentCount / totalInClass) * 100) : 100;

      csvContent += `"${formatDate(rec.date)}","${rec.className}",${totalInClass},${absentCount},${presentCount},"${rate}%","${absentNamesList.join('; ')}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_Diem_Danh_${selectedClass.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({ type: 'success', title: 'Xuất CSV thành công', message: 'Tệp báo cáo đã được tải xuống máy của bạn.' });
  };

  return (
    <div className="max-w-5xl mx-auto py-2 space-y-6">

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-xs flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 font-black flex items-center justify-center shrink-0 text-xl">
            👶
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tổng Sĩ Số</p>
            <p className="text-xl font-black text-slate-800">{totalStudents} <span className="text-xs text-slate-400">bé</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-xs flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 text-xl">
            📝
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Số Lượt Điểm Danh</p>
            <p className="text-xl font-black text-slate-800">{totalSessionsRecorded} <span className="text-xs text-slate-400">lần</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-xs flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-black flex items-center justify-center shrink-0 text-xl">
            🌟
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tỷ Lệ Chuyên Cần</p>
            <p className="text-xl font-black text-emerald-600">{overallPresenceRate}%</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-xs flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-700 font-black flex items-center justify-center shrink-0 text-xl">
            🏫
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Số Lớp Học</p>
            <p className="text-xl font-black text-slate-800">{CLASSES.length} <span className="text-xs text-slate-400">lớp</span></p>
          </div>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="bg-white rounded-[32px] border-2 border-slate-100 p-5 sm:p-7 shadow-sm space-y-6">
        
        {/* Controls & Sub-tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          
          {/* Sub Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => setReportSubTab('history')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                reportSubTab === 'history'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-blue-500'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Lịch Sử Theo Ngày</span>
            </button>

            <button
              onClick={() => setReportSubTab('students')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                reportSubTab === 'students'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-blue-500'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Thống Kê Theo Bé</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class Selector Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-700 focus:outline-none appearance-none cursor-pointer pr-3"
              >
                <option value="Tất cả">Tất cả lớp</option>
                {CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker (For history view) */}
            {reportSubTab === 'history' && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-700 focus:outline-none cursor-pointer"
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="text-[10px] font-bold text-red-500 hover:underline ml-1 cursor-pointer"
                  >
                    Xóa ngày
                  </button>
                )}
              </div>
            )}

            {/* Search & Time Filter (For student view) */}
            {reportSubTab === 'students' && (
              <>
                <div className="flex items-center space-x-1.5 bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value as any)}
                    className="bg-transparent text-xs font-black text-slate-700 focus:outline-none appearance-none cursor-pointer pr-3"
                  >
                    <option value="this_week">Tuần này</option>
                    <option value="this_month">Tháng này</option>
                    <option value="last_month">Tháng trước</option>
                    <option value="7_days">7 ngày qua</option>
                    <option value="30_days">30 ngày qua</option>
                    <option value="all">Tất cả thời gian</option>
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm tên bé..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-400 focus:outline-none w-36 sm:w-44"
                  />
                </div>
              </>
            )}

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              title="Xuất file CSV báo cáo"
              className="px-3 py-1.5 rounded-2xl bg-emerald-50 border-2 border-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs font-black transition-all cursor-pointer flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>

            {/* Refresh Data button */}
            <button
              onClick={loadData}
              disabled={isLoading}
              title="Tải lại dữ liệu từ Google Sheets"
              className="p-2 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

        </div>

        {/* SUB VIEW 1: HISTORY LOG TABLE */}
        {reportSubTab === 'history' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="py-12 text-center space-y-3 bg-slate-50/60 rounded-3xl border-2 border-dashed border-slate-200 p-6">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-sm font-black text-slate-600">Đang tải lịch sử điểm danh từ Google Sheets...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-slate-50/60 rounded-3xl border-2 border-dashed border-slate-200 p-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 font-black flex items-center justify-center mx-auto text-2xl">
                  📋
                </div>
                <p className="text-sm font-black text-slate-700">Chưa có lịch sử điểm danh nào phù hợp</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Hãy vào tab <strong>"Điểm Danh"</strong> và bấm nút <strong>"Lưu Điểm Danh"</strong> để ghi nhận báo cáo mới.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 px-1">
                  <span>Hiển thị {filteredHistory.length} bản ghi điểm danh (đồng bộ từ Google Sheets)</span>
                  <span className="text-emerald-600 font-bold">Mới nhất nằm ở trên</span>
                </div>

                {filteredHistory.map((rec, index) => {
                  const classStudents = students.filter((s) => isClassMatch(s.className, rec.className));
                  const totalInClass = classStudents.length || 10;

                  const absentNamesList = getAbsentNamesFromRecord(rec);
                  const absentCount = absentNamesList.length;
                  const presentCount = Math.max(0, totalInClass - absentCount);
                  const attendancePercentage = totalInClass > 0 ? Math.round((presentCount / totalInClass) * 100) : 100;

                  const formattedDate = formatDate(rec.date);
                  const formattedTime = formatTime(rec.timestamp || rec.date);

                  return (
                    <div
                      key={rec.id ? `rec-${rec.id}` : `rec-idx-${index}`}
                      className="bg-slate-50/70 hover:bg-slate-50 rounded-2xl border-2 border-slate-100 p-4 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center space-x-3">
                          <span className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {rec.className?.includes('Lớp dưới') ? '1F' : '2F'}
                          </span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-black text-slate-800">{rec.className || 'Lớp học'}</h4>
                              <span className="text-xs font-bold text-slate-500">• Ngày {formattedDate}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-semibold">
                              {formattedTime ? formattedTime : `Bản ghi điểm danh ngày ${formattedDate}`}
                            </p>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black flex items-center space-x-1 ${
                              attendancePercentage >= 90
                                ? 'bg-emerald-100 text-emerald-800'
                                : attendancePercentage >= 75
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            <span>Đi học: {presentCount}/{totalInClass} ({attendancePercentage}%)</span>
                          </span>
                        </div>
                      </div>

                      {/* Detail absent list */}
                      <div className="text-xs">
                        {absentCount === 0 ? (
                          <div className="flex items-center space-x-1.5 text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl inline-flex">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Tất cả học sinh có mặt đầy đủ! 🌟</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="font-black text-slate-600 flex items-center space-x-1">
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                              <span>Bé nghỉ học ({absentCount} bé):</span>
                            </p>
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              {absentNamesList.map((name: string, i: number) => {
                                const foundStudent = students.find(
                                  (s) => s.fullName.trim().toLowerCase() === name.trim().toLowerCase()
                                );
                                return (
                                  <div
                                    key={`absent-${i}-${name}`}
                                    className="bg-white px-2.5 py-1 rounded-xl border border-red-200 text-red-800 font-bold flex items-center space-x-1.5 shadow-2xs text-[11px]"
                                  >
                                    <span>{name}</span>
                                    {foundStudent?.phone && (
                                      <a
                                        href={`tel:${foundStudent.phone}`}
                                        className="text-blue-600 hover:underline flex items-center ml-1 font-black"
                                        title={`Gọi phụ huynh: ${foundStudent.phone}`}
                                      >
                                        <Phone className="w-3 h-3 mr-0.5" />
                                        <span>Gọi PH</span>
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB VIEW 2: STUDENT ATTENDANCE STATS */}
        {reportSubTab === 'students' && (
          <div className="space-y-4">
            {/* Period Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border-2 border-slate-100">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1 shrink-0">Kỳ báo cáo:</span>
                {[
                  { id: 'this_week', label: 'Tuần này' },
                  { id: 'this_month', label: 'Tháng này' },
                  { id: 'last_month', label: 'Tháng trước' },
                  { id: '30_days', label: '30 ngày qua' },
                  { id: 'all', label: 'Tất cả' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTimePeriod(item.id as any)}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer shrink-0 ${
                      timePeriod === item.id
                        ? 'bg-amber-400 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-black">
                <span className="text-slate-500">Danh sách {studentStats.length} bé ({selectedClass})</span>
                <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0">
                  {filteredHistoryByTime.length} lượt điểm danh
                </span>
              </div>
            </div>

            {studentStats.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-50 rounded-3xl border-2 border-slate-100 p-6">
                <p className="text-sm font-black text-slate-700">Không tìm thấy học sinh nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {studentStats.map(({ student, presentCount, absentCount, totalSessions }) => {
                  const rate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;
                  const isExcellent = rate >= 90;

                  return (
                    <div
                      key={student.id || `stu-${student.fullName}`}
                      className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-2xl font-black flex items-center justify-center shrink-0 text-base ${
                            student.gender === 'girl' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {student.gender === 'girl' ? '👧' : '👦'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-800 truncate">{student.fullName}</h4>
                            <p className="text-[11px] font-bold text-slate-400">{student.className}</p>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isExcellent ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isExcellent ? 'Xuất Sắc 🌟' : 'Cần Chú Ý ⚠️'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-600">
                          <span>Chuyên cần: {rate}%</span>
                          <span className="text-slate-400">{presentCount} có mặt / {absentCount} vắng</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Parent Phone line */}
                      {student.phone && (
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-semibold truncate">PH: {student.parentName || 'Phụ huynh'}</span>
                          <a
                            href={`tel:${student.phone}`}
                            className="text-blue-600 font-black hover:underline flex items-center shrink-0"
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            <span>{student.phone}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
