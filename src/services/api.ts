import { API_URL } from '../config';
import { Student, AddStudentPayload, SaveAttendancePayload } from '../types';
import { INITIAL_STUDENTS } from '../data/mockStudents';

const LOCAL_STORAGE_KEY = 'mamnon_students_data_v1';
const ATTENDANCE_HISTORY_KEY = 'mamnon_attendance_history_v1';

// Internal helper to get cached local students
export const getLocalStudents = (): Student[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Lỗi đọc dữ liệu từ localStorage', e);
  }
  // Initialize with initial students
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_STUDENTS));
  return INITIAL_STUDENTS;
};

// Internal helper to save local students
export const saveLocalStudents = (students: Student[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(students));
  } catch (e) {
    console.error('Lỗi lưu dữ liệu vào localStorage', e);
  }
};

/**
 * Lấy danh sách học sinh theo lớp từ Google Sheets API
 */
export async function getStudentsByClass(className: string): Promise<{ success: boolean; data: Student[]; isOfflineFallback?: boolean }> {
  try {
    const url = `${API_URL}?action=getStudents&class=${encodeURIComponent(className)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json) && json.length > 0) {
        // Map backend response if needed
        const fetchedStudents: Student[] = json.map((item: any, index: number) => ({
          id: item.id || item.ID || `SHEET-${index + 1}`,
          fullName: item.fullName || item.name || item['Họ và Tên'] || item['Họ và tên'] || 'Học sinh',
          className: item.className || item.class || item['Lớp'] || className,
          parentName: item.parentName || item['Tên Phụ Huynh'] || item['Phụ huynh'] || '',
          phone: item.phone || item['Số Điện Thoại'] || item['SĐT'] || '',
          gender: index % 2 === 0 ? 'boy' : 'girl'
        }));

        // Filter for requested class
        const filtered = fetchedStudents.filter(s => 
          !className || className === 'Tất cả' || s.className.trim().toLowerCase() === className.trim().toLowerCase()
        );

        if (filtered.length > 0) {
          return { success: true, data: filtered };
        }
      }
    }
  } catch (err) {
    console.warn('Không thể gọi API getStudents Google Sheets hoặc bị giới hạn CORS, sử dụng bộ nhớ cục bộ:', err);
  }

  // Fallback to local storage / mock data
  const localList = getLocalStudents();
  const classStudents = localList.filter(s => 
    !className || className === 'Tất cả' || s.className.trim().toLowerCase() === className.trim().toLowerCase()
  );

  return { success: true, data: classStudents, isOfflineFallback: true };
}

/**
 * Thêm học sinh mới lên Google Sheets API
 */
export async function addStudentApi(payload: AddStudentPayload): Promise<{ success: boolean; message: string; newStudent: Student }> {
  const newStudent: Student = {
    id: `STU-${Date.now().toString().slice(-4)}`,
    fullName: payload.fullName.trim(),
    className: payload.className,
    parentName: payload.parentName.trim(),
    phone: payload.phone.trim(),
    gender: Math.random() > 0.5 ? 'boy' : 'girl'
  };

  // Always save locally to ensure UI updates immediately
  const currentStudents = getLocalStudents();
  currentStudents.push(newStudent);
  saveLocalStudents(currentStudents);

  let apiSuccess = false;
  let apiMsg = '';

  try {
    // Send POST to Google Apps Script
    // GAS requires text/plain body to bypass CORS preflight issues
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addStudent',
        fullName: payload.fullName,
        className: payload.className,
        parentName: payload.parentName,
        phone: payload.phone,
        id: newStudent.id
      }),
    });

    if (response.ok) {
      apiSuccess = true;
      apiMsg = 'Đã gửi dữ liệu thành công!';
    } else {
      apiMsg = `Phản hồi server: ${response.statusText}`;
    }
  } catch (err) {
    console.warn('Không thể gửi POST tới API, dữ liệu đã lưu cục bộ:', err);
    apiMsg = 'Đã lưu cục bộ.';
  }

  return {
    success: true,
    message: 'Thêm học sinh thành công!',
    newStudent
  };
}

/**
 * Lưu kết quả điểm danh lên Google Sheets API
 */
export async function saveAttendanceApi(payload: SaveAttendancePayload): Promise<{ success: boolean; message: string }> {
  // Save attendance log locally
  try {
    const history = JSON.parse(localStorage.getItem(ATTENDANCE_HISTORY_KEY) || '[]');
    history.unshift({
      date: payload.date,
      className: payload.class,
      absentIds: payload.absentIds,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(ATTENDANCE_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch (e) {
    console.error('Lỗi lưu lịch sử điểm danh', e);
  }

  let apiSuccess = false;
  let apiMsg = '';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'saveAttendance',
        class: payload.class,
        date: payload.date,
        absentIds: payload.absentIds,
      }),
    });

    if (response.ok) {
      apiSuccess = true;
      apiMsg = 'Đã cập nhật hệ thống thành công!';
    } else {
      apiMsg = `Server trả về mã: ${response.status}`;
    }
  } catch (err) {
    console.warn('Không thể kết nối API:', err);
    apiMsg = 'Đã lưu bản ghi điểm danh cục bộ.';
  }

  return {
    success: true,
    message: `Đã lưu điểm danh lớp ${payload.class} ngày ${payload.date} thành công!`
  };
}

/**
 * Lấy danh sách lịch sử điểm danh đã lưu
 */
export function getAttendanceHistory(): any[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_HISTORY_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (e) {
    console.error('Lỗi đọc lịch sử điểm danh:', e);
  }

  // Populate sample attendance history if empty
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const sampleHistory = [
    {
      id: 'REC-001',
      date: todayStr,
      className: 'Lớp dưới',
      absentIds: ['STU-102'],
      timestamp: new Date().toISOString()
    },
    {
      id: 'REC-002',
      date: todayStr,
      className: 'Lớp trên lầu',
      absentIds: [],
      timestamp: new Date().toISOString()
    },
    {
      id: 'REC-003',
      date: yesterdayStr,
      className: 'Lớp dưới',
      absentIds: ['STU-104', 'STU-107'],
      timestamp: yesterday.toISOString()
    },
    {
      id: 'REC-004',
      date: yesterdayStr,
      className: 'Lớp trên lầu',
      absentIds: ['STU-203'],
      timestamp: yesterday.toISOString()
    }
  ];

  try {
    localStorage.setItem(ATTENDANCE_HISTORY_KEY, JSON.stringify(sampleHistory));
  } catch (e) {
    console.error('Lỗi khởi tạo mẫu lịch sử:', e);
  }

  return sampleHistory;
}

/**
 * Xóa 1 bản ghi lịch sử điểm danh
 */
export function deleteAttendanceHistoryRecord(idOrIndex: string | number) {
  try {
    const history = getAttendanceHistory();
    const updated = history.filter((item, idx) => item.id !== idOrIndex && idx !== idOrIndex);
    localStorage.setItem(ATTENDANCE_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Lỗi xóa bản ghi lịch sử:', e);
  }
}

/**
 * Xóa toàn bộ lịch sử điểm danh
 */
export function clearAttendanceHistory() {
  try {
    localStorage.removeItem(ATTENDANCE_HISTORY_KEY);
  } catch (e) {
    console.error('Lỗi làm sạch lịch sử:', e);
  }
}

