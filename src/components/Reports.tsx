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
  Loader2,
  Trash2,
  X
} from 'lucide-react';
import { Student } from '../types';
import { CLASSES } from '../config';
import { getLocalStudents, getStudentsByClass, getAttendanceHistoryApi, deleteAttendanceApi } from '../services/api';

interface ReportsProps {
  addToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
}

/**
 * Utility: Chuẩn hóa mọi kiểu dữ liệu ngày (thô ISO, YYYY-MM-DD, DD/MM/YYYY, Date object...)
 * Trả về object chứa isoDate ('YYYY-MM-DD'), displayDate ('DD/MM/YYYY'), và Date object.
 * Đảm bảo quy đổi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7) không bị lệch lùi ngày.
 */
export const parseDateInfo = (val?: any): { isoDate: string; displayDate: string; dateObj: Date } | null => {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Bỏ qua các hàng tiêu đề của Google Sheets nếu lọt vào
  const lower = str.toLowerCase();
  if (
    lower === 'ngày' ||
    lower === 'ngay' ||
    lower === 'date' ||
    lower === 'stt' ||
    lower === 'thời gian' ||
    lower === 'timestamp' ||
    lower === 'lớp' ||
    lower === 'lop' ||
    lower === 'ngaydiemdanh'
  ) {
    return null;
  }

  let year: number = 0;
  let month: number = 0; // 1-indexed
  let day: number = 0;
  let hours: number = 0;
  let minutes: number = 0;
  let seconds: number = 0;
  let hasTime = false;

  // 1. Nếu chuỗi là ISO String hoặc chứa thông tin múi giờ UTC/offset (e.g. 2026-07-30T17:00:00.000Z)
  const isIsoWithZone = str.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(str) || (str.includes('T') && str.includes('Z'));

  if (isIsoWithZone) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      try {
        const formatter = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        const parts = formatter.formatToParts(d);
        const pMap: Record<string, string> = {};
        parts.forEach((p) => {
          pMap[p.type] = p.value;
        });

        year = parseInt(pMap.year, 10);
        month = parseInt(pMap.month, 10);
        day = parseInt(pMap.day, 10);
        hours = parseInt(pMap.hour, 10);
        minutes = parseInt(pMap.minute, 10);
        seconds = parseInt(pMap.second, 10);
        hasTime = true;
      } catch (e) {
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
        hours = d.getHours();
        minutes = d.getMinutes();
        seconds = d.getSeconds();
        hasTime = true;
      }
    }
  }

  // 2. Định dạng DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD.MM.YYYY (ví dụ: 31/07/2026 hoặc 31.07.2026 08:30:00)
  if (!year) {
    const ddMMyyyyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ddMMyyyyMatch) {
      day = parseInt(ddMMyyyyMatch[1], 10);
      month = parseInt(ddMMyyyyMatch[2], 10);
      year = parseInt(ddMMyyyyMatch[3], 10);
      if (year < 100) year += 2000;
      if (ddMMyyyyMatch[4] !== undefined) {
        hours = parseInt(ddMMyyyyMatch[4], 10);
        hasTime = true;
      }
      if (ddMMyyyyMatch[5] !== undefined) minutes = parseInt(ddMMyyyyMatch[5], 10);
      if (ddMMyyyyMatch[6] !== undefined) seconds = parseInt(ddMMyyyyMatch[6], 10);
    }
  }

  // 3. Chuỗi thuần YYYY-MM-DD hoặc YYYY/MM/DD (ví dụ: 2026-07-31 từ date input)
  if (!year) {
    const yyyyMMddMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (yyyyMMddMatch) {
      year = parseInt(yyyyMMddMatch[1], 10);
      month = parseInt(yyyyMMddMatch[2], 10);
      day = parseInt(yyyyMMddMatch[3], 10);
      if (yyyyMMddMatch[4] !== undefined) {
        hours = parseInt(yyyyMMddMatch[4], 10);
        hasTime = true;
      }
      if (yyyyMMddMatch[5] !== undefined) minutes = parseInt(yyyyMMddMatch[5], 10);
      if (yyyyMMddMatch[6] !== undefined) seconds = parseInt(yyyyMMddMatch[6], 10);
    }
  }

  // 4. Fallback dùng new Date(str) đối với định dạng chuẩn JS khác (e.g. Wed Jul 31 2026...)
  if (!year) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
      hours = d.getHours();
      minutes = d.getMinutes();
      seconds = d.getSeconds();
      hasTime = true;
    } else {
      return {
        isoDate: str,
        displayDate: str,
        dateObj: new Date(),
      };
    }
  }

  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return {
      isoDate: str,
      displayDate: str,
      dateObj: new Date(),
    };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDate = `${year}-${pad(month)}-${pad(day)}`; // YYYY-MM-DD
  const displayDate = `${pad(day)}/${pad(month)}/${year}`; // DD/MM/YYYY
  const dateObj = new Date(year, month - 1, day, hasTime ? hours : 12, minutes, seconds);

  return { isoDate, displayDate, dateObj };
};

/**
 * Lấy chuỗi ngày ISO hôm nay (YYYY-MM-DD) theo giờ local
 */
export const getTodayIsoDate = (): string => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Kiểm tra xem bản ghi điểm danh có phải thuộc ngày hôm nay không
 */
export const isTodayRecord = (rec: any): boolean => {
  if (!rec) return false;
  const parsed = parseDateInfo(rec.date || rec.timestamp);
  if (!parsed) return false;
  return parsed.isoDate === getTodayIsoDate();
};

/**
 * Utility: Chuyển đổi chuỗi ngày thành định dạng DD/MM/YYYY
 */
export const formatDate = (dateString?: string): string => {
  const parsed = parseDateInfo(dateString);
  if (parsed) {
    return parsed.displayDate;
  }
  return '';
};

/**
 * Utility: Chuyển đổi mốc thời gian (timestamp) thành định dạng giờ phút ngày local
 */
export const formatTime = (dateString?: string): string => {
  if (!dateString) return '';
  const parsed = parseDateInfo(dateString);
  if (!parsed) return '';

  const { dateObj, displayDate } = parsed;
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');

  // Nếu không có giờ phút cụ thể (mặc định 12:00) thì chỉ hiển thị ngày
  if (hours === '12' && minutes === '00' && dateObj.getSeconds() === 0) {
    return `Bản ghi ngày ${displayDate}`;
  }
  return `Lúc ${hours}:${minutes} - ${displayDate}`;
};

/**
 * Utility: Lấy thứ trong tuần dạng Tiếng Việt (Thứ Hai, Thứ Ba, ..., Chủ Nhật)
 */
export const getVietnameseDayOfWeek = (dateObj: Date): string => {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const day = dateObj.getDay();
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[day];
};

/**
 * Utility: Format ngày dạng DD/MM/YYYY
 */
export const formatViDate = (d: Date): string => {
  if (!d || isNaN(d.getTime())) return '';
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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
  const [timePeriod, setTimePeriod] = useState<'this_week' | '7_days' | 'this_month' | 'last_month' | '30_days' | 'custom' | 'all'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingTimestamp, setDeletingTimestamp] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);

  // Handle delete attendance record confirmation action
  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return;

    if (!isTodayRecord(recordToDelete)) {
      addToast({
        type: 'error',
        title: 'Chặn thao tác',
        message: 'Chỉ được phép xóa bản ghi điểm danh thuộc ngày hôm nay để bảo vệ dữ liệu lịch sử.',
      });
      setRecordToDelete(null);
      return;
    }

    const rec = recordToDelete;
    setRecordToDelete(null);

    const targetTs = rec.timestamp || rec.date || '';
    setDeletingTimestamp(targetTs || rec.id);

    try {
      const result = await deleteAttendanceApi(targetTs, rec);
      if (result.success) {
        // Immediately remove item from local history UI state
        setHistoryList((prev) =>
          prev.filter((item) => {
            if (rec.id && item.id && rec.id === item.id) return false;
            if (targetTs && (item.timestamp === targetTs || item.date === targetTs) && item.className === rec.className) return false;
            return item !== rec;
          })
        );

        addToast({
          type: 'success',
          title: 'Đã xóa bản ghi',
          message: 'Đã gửi yêu cầu xóa bản ghi điểm danh thành công!',
        });

        // Sync with Google Sheets after delay
        setTimeout(() => {
          loadData();
        }, 1500);
      } else {
        addToast({ type: 'error', title: 'Xóa thất bại', message: result.message || 'Không thể xóa bản ghi điểm danh.' });
      }
    } catch (error: any) {
      console.error('Lỗi khi xóa bản ghi:', error);
      addToast({ type: 'error', title: 'Lỗi hệ thống', message: error?.message || 'Không thể kết nối đến Google Sheets.' });
    } finally {
      setDeletingTimestamp(null);
    }
  };

  // Load history from Google Sheets API & students list
  const loadData = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [historyRes, studentListRes] = await Promise.all([
        getAttendanceHistoryApi(),
        getStudentsByClass('Tất cả')
      ]);

      if (historyRes.success && Array.isArray(historyRes.data)) {
        setHistoryList(historyRes.data);
      } else {
        setHistoryList([]);
        const errorMsg = historyRes.message || 'Không thể tải lịch sử điểm danh từ Google Sheets.';
        setFetchError(errorMsg);
        addToast({ type: 'error', title: 'Lỗi tải lịch sử', message: errorMsg });
      }

      if (studentListRes.success && Array.isArray(studentListRes.data)) {
        setStudents(studentListRes.data);
      } else {
        setStudents(getLocalStudents());
      }
    } catch (e: any) {
      console.error('Lỗi khi tải dữ liệu báo cáo:', e);
      const errorMsg = e?.message || 'Không thể kết nối đến Google Sheets server.';
      setFetchError(errorMsg);
      addToast({ type: 'error', title: 'Lỗi kết nối', message: errorMsg });
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
      // Ignore row ONLY if it's strictly a header row (both className and date are header labels)
      const classLower = String(item.className || '').trim().toLowerCase();
      const dateLower = String(item.date || '').trim().toLowerCase();
      const isHeaderClass = classLower === 'lớp' || classLower === 'lop' || classLower === 'classname' || classLower === 'class';
      const isHeaderDate = dateLower === 'ngày' || dateLower === 'ngay' || dateLower === 'date' || dateLower === 'timestamp';
      if (isHeaderClass && isHeaderDate) {
        return false;
      }

      const matchClass = isClassMatch(item.className, selectedClass);
      let matchDate = true;
      if (selectedDate) {
        const parsedItemDate = parseDateInfo(item.date || item.timestamp);
        const parsedSelected = parseDateInfo(selectedDate);
        if (parsedItemDate && parsedSelected) {
          matchDate = parsedItemDate.isoDate === parsedSelected.isoDate;
        } else if (selectedDate) {
          matchDate = String(item.date || '').includes(selectedDate) || String(item.timestamp || '').includes(selectedDate);
        }
      }
      return matchClass && matchDate;
    });
  }, [historyList, selectedClass, selectedDate]);

  // Filter history by time period
  const filteredHistoryByTime = useMemo(() => {
    if (timePeriod === 'all') return historyList;

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    return historyList.filter((record) => {
      const parsed = parseDateInfo(record.date || record.timestamp);
      if (!parsed) return true;

      const recDate = parsed.dateObj;

      if (timePeriod === 'this_week') {
        const curr = new Date();
        const firstDayOfWeek = new Date(curr.setDate(curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1)));
        firstDayOfWeek.setHours(0, 0, 0, 0);
        return recDate >= firstDayOfWeek;
      }

      if (timePeriod === 'custom') {
        if (customStartDate) {
          const startParsed = parseDateInfo(customStartDate);
          if (startParsed) {
            startParsed.dateObj.setHours(0, 0, 0, 0);
            if (recDate < startParsed.dateObj) return false;
          }
        }
        if (customEndDate) {
          const endParsed = parseDateInfo(customEndDate);
          if (endParsed) {
            endParsed.dateObj.setHours(23, 59, 59, 999);
            if (recDate > endParsed.dateObj) return false;
          }
        }
        return true;
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
  }, [historyList, timePeriod, customStartDate, customEndDate]);

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

  // Computed stats for the 3 top summary cards (Sĩ số, Đi học, Vắng mặt)
  const currentOverviewData = useMemo(() => {
    // 1. Total students in selected class (or whole school)
    const classStudentsList = students.filter((s) => isClassMatch(s.className, selectedClass));
    const targetTotalStudents = classStudentsList.length || (selectedClass === 'Tất cả' ? students.length : 0);

    // 2. Determine target records to calculate stats directly from filteredHistory
    let recordsForOverview = filteredHistory;
    let displayDateObj = new Date();

    if (selectedDate) {
      recordsForOverview = filteredHistory;
      const parsed = parseDateInfo(selectedDate);
      if (parsed) {
        displayDateObj = parsed.dateObj;
      }
    } else if (filteredHistory.length > 0) {
      // Pick records corresponding to the latest date in filteredHistory
      const firstRecord = filteredHistory[0];
      const parsedFirst = parseDateInfo(firstRecord.date || firstRecord.timestamp);
      if (parsedFirst) {
        displayDateObj = parsedFirst.dateObj;
        const targetIso = parsedFirst.isoDate;
        recordsForOverview = filteredHistory.filter((h) => {
          const p = parseDateInfo(h.date || h.timestamp);
          return p && p.isoDate === targetIso;
        });
      }
    }

    // 3. Collect unique absent student names across recordsForOverview
    const uniqueAbsentNames = new Set<string>();
    recordsForOverview.forEach((rec) => {
      const absents = getAbsentNamesFromRecord(rec);
      absents.forEach((name) => {
        if (name && name !== '-' && name.toLowerCase() !== 'không' && name.toLowerCase() !== 'không có') {
          uniqueAbsentNames.add(name.toLowerCase().trim());
        }
      });
    });

    const totalAbsent = uniqueAbsentNames.size;
    const presentCount = Math.max(0, targetTotalStudents - totalAbsent);
    const presenceRate = targetTotalStudents > 0 ? Math.round((presentCount / targetTotalStudents) * 100) : 100;

    const dayOfWeekStr = getVietnameseDayOfWeek(displayDateObj);
    const formattedDate = formatViDate(displayDateObj);

    return {
      total: targetTotalStudents,
      present: presentCount,
      absent: totalAbsent,
      presenceRate: presenceRate,
      dateLabel: selectedDate || filteredHistory.length > 0 ? `Ngày ${formattedDate} (${dayOfWeekStr})` : 'Tất cả lịch sử',
      classLabel: selectedClass === 'Tất cả' ? 'Toàn trường' : selectedClass
    };
  }, [students, filteredHistory, selectedClass, selectedDate]);

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

      csvContent += `"${formatDate(rec.date || rec.timestamp)}","${rec.className}",${totalInClass},${absentCount},${presentCount},"${rate}%","${absentNamesList.join('; ')}"\n`;
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
    <div className="max-w-6xl mx-auto py-2 space-y-6">

      {/* 3 Summary Stat Cards matching screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: SĨ SỐ */}
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100/90 shadow-xs flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center shrink-0 text-3xl">
            👶
          </div>
          <div>
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-wider">SĨ SỐ</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mt-1">
              {currentOverviewData.total} <span className="text-sm font-bold text-slate-500 ml-0.5">bé</span>
            </p>
            <p className="text-xs font-black text-slate-500 mt-1">{currentOverviewData.classLabel}</p>
          </div>
        </div>

        {/* Card 2: ĐI HỌC */}
        <div className="bg-emerald-50/70 p-5 rounded-3xl border-2 border-emerald-300/80 shadow-xs flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-[12px] font-black text-emerald-800 uppercase tracking-wider">ĐI HỌC</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-950 leading-none mt-1">
              {currentOverviewData.present} <span className="text-sm font-bold text-emerald-800 ml-0.5">bé</span>
            </p>
            <p className="text-xs font-black text-emerald-700 mt-1">{currentOverviewData.presenceRate}% có mặt</p>
          </div>
        </div>

        {/* Card 3: VẮNG MẶT */}
        <div className="bg-rose-50/70 p-5 rounded-3xl border-2 border-rose-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <XCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-[12px] font-black text-red-800 uppercase tracking-wider">VẮNG MẶT</p>
            <p className="text-2xl sm:text-3xl font-black text-red-950 leading-none mt-1">
              {currentOverviewData.absent} <span className="text-sm font-bold text-red-800 ml-0.5">bé</span>
            </p>
            <p className="text-xs font-black text-red-700 mt-1">{currentOverviewData.dateLabel}</p>
          </div>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="bg-white rounded-[32px] border-2 border-slate-100 p-5 sm:p-7 shadow-xs space-y-6">
        
        {/* Controls & Sub-tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          
          {/* Sub Tab Switcher */}
          <div className="flex items-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/60 shrink-0">
            <button
              onClick={() => setReportSubTab('history')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
                reportSubTab === 'history'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Lịch Sử Theo Ngày</span>
            </button>

            <button
              onClick={() => setReportSubTab('students')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
                reportSubTab === 'students'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Thống Kê Theo Bé</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class Selector Filter */}
            <div className="flex items-center space-x-2 bg-slate-50 border-2 border-slate-200/80 rounded-2xl px-3.5 py-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer pr-1"
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
              <div className="flex items-center space-x-2 bg-slate-50 border-2 border-slate-200/80 rounded-2xl px-3.5 py-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="flex items-center space-x-1.5 text-xs font-black text-slate-600 hover:text-red-600 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200/80 rounded-2xl px-3.5 py-2 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Xóa lọc</span>
              </button>
            )}

            {/* Search & Time Filter (For student view) */}
            {reportSubTab === 'students' && (
              <>
                <div className="flex items-center space-x-2 bg-slate-50 border-2 border-slate-200/80 rounded-2xl px-3.5 py-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value as any)}
                    className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="this_week">Tuần này</option>
                    <option value="this_month">Tháng này</option>
                    <option value="last_month">Tháng trước</option>
                    <option value="7_days">7 ngày qua</option>
                    <option value="30_days">30 ngày qua</option>
                    <option value="custom">Tùy chọn (Từ ngày - Đến ngày)</option>
                    <option value="all">Tất cả thời gian</option>
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Tìm tên bé..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3.5 py-2 bg-slate-50 border-2 border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-400 focus:outline-none w-36 sm:w-44"
                  />
                </div>
              </>
            )}

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              title="Xuất file CSV báo cáo"
              className="px-3.5 py-2 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>

            {/* Refresh Data button */}
            <button
              onClick={loadData}
              disabled={isLoading}
              title="Tải lại dữ liệu từ Google Sheets"
              className="w-10 h-10 bg-slate-50 border-2 border-slate-200/80 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 transition-all cursor-pointer disabled:opacity-50"
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
                <p className="text-sm font-black text-slate-600">Đang tải dữ liệu...</p>
              </div>
            ) : fetchError ? (
              <div className="py-10 text-center space-y-3 bg-red-50/80 rounded-3xl border-2 border-red-200 p-6">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 font-black flex items-center justify-center mx-auto text-xl">
                  ⚠️
                </div>
                <p className="text-sm font-black text-red-800">Lỗi khi kết nối Google Sheets</p>
                <p className="text-xs text-red-600 font-medium max-w-md mx-auto">{fetchError}</p>
                <button
                  onClick={loadData}
                  className="mt-2 px-4 py-2 bg-red-600 text-white font-black text-xs rounded-xl shadow-xs hover:bg-red-700 transition-all cursor-pointer inline-flex items-center space-x-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử tải lại</span>
                </button>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-slate-50/60 rounded-3xl border-2 border-dashed border-slate-200 p-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 font-black flex items-center justify-center mx-auto text-2xl">
                  📋
                </div>
                <p className="text-base font-black text-slate-700">Không có dữ liệu</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Chưa có lịch sử điểm danh nào trên Google Sheets. Hãy vào tab <strong>"Điểm Danh"</strong> và bấm <strong>"Lưu Điểm Danh"</strong> để thêm bản ghi mới.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 px-1">
                  <span>Hiển thị {filteredHistory.length} bản ghi điểm danh</span>
                  <span className="text-emerald-600 font-bold">Mới nhất nằm ở trên</span>
                </div>

                {filteredHistory.map((rec, index) => {
                  const classStudents = students.filter((s) => isClassMatch(s.className, rec.className));
                  const totalInClass = classStudents.length || 10;

                  const absentNamesList = getAbsentNamesFromRecord(rec);
                  const absentCount = absentNamesList.length;
                  const presentCount = Math.max(0, totalInClass - absentCount);
                  const attendancePercentage = totalInClass > 0 ? Math.round((presentCount / totalInClass) * 100) : 100;

                  const formattedDate = formatDate(rec.date || rec.timestamp);
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

                        {/* Badges & Delete action */}
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

                          {isTodayRecord(rec) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecordToDelete(rec);
                              }}
                              disabled={deletingTimestamp === (rec.timestamp || rec.date || '')}
                              title="Xóa bản ghi điểm danh hôm nay"
                              className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all cursor-pointer border border-red-200 shrink-0 flex items-center justify-center disabled:opacity-50"
                            >
                              {deletingTimestamp === (rec.timestamp || rec.date || '') ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
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
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border-2 border-slate-100">
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1 shrink-0">Kỳ báo cáo:</span>
                  {[
                    { id: 'this_week', label: 'Tuần này' },
                    { id: 'this_month', label: 'Tháng này' },
                    { id: 'last_month', label: 'Tháng trước' },
                    { id: '30_days', label: '30 ngày qua' },
                    { id: 'custom', label: 'Tùy chọn' },
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

              {/* Custom Date Inputs when 'Tùy chọn' is selected */}
              {timePeriod === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border-2 border-slate-100 text-xs font-bold text-slate-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 font-extrabold shrink-0">Từ ngày:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white border-2 border-slate-200 rounded-xl px-2.5 py-1 text-xs font-black text-slate-700 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 font-extrabold shrink-0">Đến ngày:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white border-2 border-slate-200 rounded-xl px-2.5 py-1 text-xs font-black text-slate-700 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  {(customStartDate || customEndDate) && (
                    <button
                      onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                      className="text-xs font-extrabold text-red-500 hover:underline cursor-pointer ml-auto"
                    >
                      Xóa ngày chọn
                    </button>
                  )}
                </div>
              )}
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

      {/* Modal xác nhận xóa bản ghi điểm danh (không dùng window.confirm) */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 font-black flex items-center justify-center mx-auto text-xl shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-800">Xác nhận xóa điểm danh</h3>
              <p className="text-xs text-slate-500 font-medium">
                Bạn có chắc chắn muốn xóa bản ghi điểm danh ngày{' '}
                <strong className="text-slate-700">{formatDate(recordToDelete.date || recordToDelete.timestamp)}</strong>{' '}
                của lớp <strong className="text-slate-700">{recordToDelete.className || 'học'}</strong>?
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecord}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white font-black text-xs rounded-xl shadow-xs hover:bg-red-700 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
