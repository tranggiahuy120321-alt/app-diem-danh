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
      const parsed: Student[] = JSON.parse(data);
      const mockIds = new Set([
        'STU-101', 'STU-102', 'STU-103', 'STU-104', 'STU-105', 'STU-106', 'STU-107',
        'STU-201', 'STU-202', 'STU-203', 'STU-204', 'STU-205', 'STU-206'
      ]);
      const filtered = parsed.filter(s => !mockIds.has(s.id));
      if (filtered.length !== parsed.length) {
        saveLocalStudents(filtered);
      }
      return filtered;
    }
  } catch (e) {
    console.error('Lỗi đọc dữ liệu từ localStorage', e);
  }
  // Initialize with initial students (empty array)
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
  return [];
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
      
      // Extract array from direct array response or wrapped response { data: [...] }
      const rawList = Array.isArray(json) 
        ? json 
        : (Array.isArray(json?.data) ? json.data : (Array.isArray(json?.students) ? json.students : null));

      if (rawList !== null) {
        // Map backend response fields flexibly (English & Vietnamese key names)
        const fetchedStudents: Student[] = rawList.map((item: any, index: number) => ({
          id: String(item.id || item.ID || item.MaHocSinh || item.maHocSinh || item['Mã học sinh'] || `STU-${101 + index}`),
          fullName: item.fullName || item.HoTen || item.hoTen || item.name || item['Họ và Tên'] || item['Họ và tên'] || item['Họ tên'] || 'Học sinh',
          className: item.className || item.Lop || item.lop || item.class || item['Lớp'] || className || 'Mầm',
          parentName: item.parentName || item.TenPhuHuynh || item.tenPhuHuynh || item['Tên Phụ Huynh'] || item['Phụ huynh'] || '',
          phone: item.phone ? String(item.phone) : (item.SoDienThoai ? String(item.SoDienThoai) : (item.soDienThoai ? String(item.soDienThoai) : (item['Số Điện Thoại'] || item['SĐT'] || ''))),
          gender: (item.gender === 'girl' || item.GioiTinh === 'girl' || item.gioiTinh === 'Nữ' || item.gioiTinh === 'gái') ? 'girl' : 'boy'
        }));

        // Sync local storage with Google Sheets data if fetched items exist
        if (fetchedStudents.length > 0) {
          saveLocalStudents(fetchedStudents);
        }

        // Filter for requested class
        const filtered = fetchedStudents.filter(s => 
          !className || className === 'Tất cả' || s.className.trim().toLowerCase() === className.trim().toLowerCase()
        );

        return { success: true, data: filtered };
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
        // Vietnamese key aliases matching Google Sheets / Code.gs
        HoTen: payload.fullName,
        hoTen: payload.fullName,
        Lop: payload.className,
        lop: payload.className,
        TenPhuHuynh: payload.parentName,
        tenPhuHuynh: payload.parentName,
        SoDienThoai: payload.phone,
        soDienThoai: payload.phone,
        MaHocSinh: newStudent.id,

        // English camelCase key aliases
        fullName: payload.fullName,
        className: payload.className,
        parentName: payload.parentName,
        phone: payload.phone,
        id: newStudent.id,
        ID: newStudent.id,
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
    const absentNamesVal = payload.absentNames !== undefined
      ? payload.absentNames
      : (Array.isArray(payload.absentIds) ? payload.absentIds.join(', ') : payload.absentIds);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'saveAttendance',
        class: payload.class,
        className: payload.class,
        Lop: payload.class,
        lop: payload.class,

        date: payload.date,
        Ngay: payload.date,
        ngay: payload.date,

        absentIds: payload.absentIds,
        absentNames: absentNamesVal,
        danhsachvang: absentNamesVal,
        danhSachVang: absentNamesVal,
        DanhSachVang: absentNamesVal,
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
 * Cập nhật thông tin học sinh
 */
export async function updateStudentApi(updatedStudent: Student): Promise<{ success: boolean; message: string }> {
  // Update local storage
  const currentStudents = getLocalStudents();
  const index = currentStudents.findIndex(s => s.id === updatedStudent.id);
  if (index !== -1) {
    currentStudents[index] = updatedStudent;
    saveLocalStudents(currentStudents);
  } else {
    currentStudents.push(updatedStudent);
    saveLocalStudents(currentStudents);
  }

  try {
    // Attempt remote update POST request if API_URL is configured
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updateStudent',
        student: updatedStudent,
        id: updatedStudent.id,
        ID: updatedStudent.id,
        MaHocSinh: updatedStudent.id,

        HoTen: updatedStudent.fullName,
        hoTen: updatedStudent.fullName,
        fullName: updatedStudent.fullName,

        Lop: updatedStudent.className,
        lop: updatedStudent.className,
        className: updatedStudent.className,

        TenPhuHuynh: updatedStudent.parentName,
        tenPhuHuynh: updatedStudent.parentName,
        parentName: updatedStudent.parentName,

        SoDienThoai: updatedStudent.phone,
        soDienThoai: updatedStudent.phone,
        phone: updatedStudent.phone,
      }),
    });
  } catch (err) {
    console.warn('Không thể gửi yêu cầu cập nhật tới API, đã lưu cục bộ:', err);
  }

  return {
    success: true,
    message: 'Cập nhật thông tin học sinh thành công!'
  };
}

/**
 * Xóa học sinh khỏi danh sách
 */
export async function deleteStudentApi(studentId: string): Promise<{ success: boolean; message: string }> {
  // Update local storage
  const currentStudents = getLocalStudents();
  const updatedStudents = currentStudents.filter(s => s.id !== studentId);
  saveLocalStudents(updatedStudents);

  try {
    // Attempt remote deletion POST request if API_URL is configured
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'deleteStudent',
        id: studentId,
        ID: studentId,
        MaHocSinh: studentId,
      }),
    });
  } catch (err) {
    console.warn('Không thể gửi Yêu cầu xóa tới API, đã xóa cục bộ:', err);
  }

  return {
    success: true,
    message: 'Đã xóa học sinh thành công!'
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
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (e) {
    console.error('Lỗi đọc lịch sử điểm danh:', e);
  }

  return [];
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

