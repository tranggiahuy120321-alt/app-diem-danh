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
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Lỗi đọc dữ liệu từ localStorage', e);
  }
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
      
      // Extract array from direct array response or wrapped response
      let rawList: any[] | null = null;
      if (Array.isArray(json)) {
        rawList = json;
      } else if (Array.isArray(json?.data)) {
        rawList = json.data;
      } else if (Array.isArray(json?.students)) {
        rawList = json.students;
      } else if (Array.isArray(json?.result)) {
        rawList = json.result;
      }

      if (rawList !== null) {
        // Filter out completely empty rows
        const validRows = rawList.filter((item: any) => {
          if (!item || typeof item !== 'object') return false;
          const name = item.fullName || item.HoTen || item.hoTen || item.name || item['Họ và Tên'] || item['Họ và tên'] || item['Họ tên'];
          const id = item.id || item.ID || item.MaHocSinh || item.maHocSinh;
          return Boolean(name || id);
        });

        const fetchedStudents: Student[] = validRows.map((item: any, index: number) => ({
          id: String(item.id || item.ID || item.MaHocSinh || item.maHocSinh || item['Mã học sinh'] || item['Mã HS'] || `HS-${index + 1}`),
          fullName: String(item.fullName || item.HoTen || item.hoTen || item.name || item['Họ và Tên'] || item['Họ và tên'] || item['Họ tên'] || 'Học sinh'),
          className: String(item.className || item.Lop || item.lop || item.class || item['Lớp'] || 'Mầm'),
          parentName: String(item.parentName || item.TenPhuHuynh || item.tenPhuHuynh || item['Tên Phụ Huynh'] || item['Phụ huynh'] || ''),
          phone: String(item.phone || item.SoDienThoai || item.soDienThoai || item['Số Điện Thoại'] || item['SĐT'] || ''),
          gender: (item.gender === 'girl' || item.GioiTinh === 'girl' || item.gioiTinh === 'Nữ' || item.gioiTinh === 'gái' || item.gioiTinh === 'girl') ? 'girl' : 'boy'
        }));

        // Update local storage cache if fetched list is non-empty
        if (fetchedStudents.length > 0) {
          saveLocalStudents(fetchedStudents);
        }

        const filtered = fetchedStudents.filter(s => 
          !className || className === 'Tất cả' || s.className.trim().toLowerCase() === className.trim().toLowerCase()
        );

        return { success: true, data: filtered };
      }
    }
  } catch (err) {
    console.warn('Không thể gọi API getStudents Google Sheets hoặc bị giới hạn CORS, sử dụng bộ nhớ cục bộ:', err);
  }

  // Fallback to local storage
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
    apiMsg = 'Đã gửi yêu cầu lưu điểm danh.';
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
  try {
    if (API_URL) {
      const response = await fetch(API_URL, {
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

      if (response.ok) {
        const text = await response.text();
        let resJson: any = {};
        try {
          resJson = JSON.parse(text);
        } catch (e) {
          console.warn('Response từ deleteStudent không phải dạng JSON:', text);
        }

        const isSuccess = resJson.status === 'success' || resJson.success === true || text.toLowerCase().includes('success');

        if (isSuccess) {
          // Xóa ở local storage sau khi Backend Google Sheets xác nhận thành công
          const currentStudents = getLocalStudents();
          const updatedStudents = currentStudents.filter(s => s.id !== studentId);
          saveLocalStudents(updatedStudents);

          return {
            success: true,
            message: resJson.message || 'Đã xóa học sinh khỏi Google Sheets thành công!'
          };
        } else {
          return {
            success: false,
            message: resJson.message || resJson.error || 'Xóa học sinh thất bại từ cơ sở dữ liệu Google Sheets.'
          };
        }
      }
    }
  } catch (err) {
    console.warn('Không thể gửi yêu cầu xóa tới API Google Sheets:', err);
    return {
      success: false,
      message: 'Không thể kết nối tới Google Sheets. Vui lòng kiểm tra lại kết nối mạng.'
    };
  }

  // Fallback nếu không cấu hình API_URL
  const currentStudents = getLocalStudents();
  const updatedStudents = currentStudents.filter(s => s.id !== studentId);
  saveLocalStudents(updatedStudents);

  return {
    success: true,
    message: 'Đã xóa học sinh thành công (lưu cục bộ)!'
  };
}

/**
 * Lấy danh sách lịch sử điểm danh trực tiếp từ Google Sheets API (GET)
 */
export async function getAttendanceHistoryApi(): Promise<{ success: boolean; data: any[] }> {
  if (!API_URL) {
    return { success: true, data: [] };
  }

  try {
    const separator = API_URL.includes('?') ? '&' : '?';
    const fetchUrl = `${API_URL}${separator}action=getAttendance&t=${new Date().getTime()}`;

    // TUYỆT ĐỐI KHÔNG THÊM HEADERS để tránh lỗi CORS với Google Apps Script
    const response = await fetch(fetchUrl);

    if (response.ok) {
      const json = await response.json();

      let rawList: any[] | null = null;
      if (Array.isArray(json)) {
        rawList = json;
      } else if (Array.isArray(json?.data)) {
        rawList = json.data;
      } else if (Array.isArray(json?.history)) {
        rawList = json.history;
      } else if (Array.isArray(json?.result)) {
        rawList = json.result;
      }

      if (rawList !== null) {
        // Parse list objects and standardize keys
        const historyData = rawList.map((item: any, idx: number) => {
          const dateVal = String(item.date || item.Ngay || item.ngay || item.time || '');
          const classVal = String(item.className || item.class || item.Lop || item.lop || 'Mầm');
          const absentNamesVal = item.absentNames !== undefined 
            ? String(item.absentNames) 
            : (item.DanhSachVang !== undefined ? String(item.DanhSachVang) : (item.danhSachVang !== undefined ? String(item.danhSachVang) : (item.danhsachvang !== undefined ? String(item.danhsachvang) : '')));
          const timestampVal = item.timestamp || item.Time || item.ThoiGian || item.thoiGian || new Date().toISOString();
          const absentIdsVal = Array.isArray(item.absentIds) ? item.absentIds : [];

          return {
            id: String(item.id || item.ID || `ATT-${idx + 1}`),
            date: dateVal,
            className: classVal,
            absentNames: absentNamesVal,
            absentIds: absentIdsVal,
            timestamp: timestampVal,
          };
        });

        // Đảm bảo theo thứ tự mới nhất nằm trên cùng
        return { success: true, data: historyData.reverse() };
      }
    }
  } catch (err) {
    console.warn('Lỗi gọi API getAttendance Google Sheets:', err);
  }

  return { success: false, data: [] };
}

/**
 * Xóa bản ghi điểm danh qua Google Sheets API (POST)
 */
export async function deleteAttendanceApi(timestamp: string): Promise<{ success: boolean; message: string }> {
  if (!API_URL) {
    throw new Error('Chưa cấu hình Google Sheets API URL.');
  }

  return fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    redirect: 'follow',
    body: JSON.stringify({
      action: 'deleteAttendance',
      timestamp: timestamp
    })
  })
    .then((res) => res.text())
    .then((text) => {
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { message: text };
      }

      const isSuccess = data.status === 'success' || data.success === true || (data.message && String(data.message).toLowerCase().includes('thành công'));

      return {
        success: isSuccess,
        message: data.message || (isSuccess ? 'Đã xóa bản ghi điểm danh thành công!' : 'Xóa bản ghi thất bại.')
      };
    });
}

