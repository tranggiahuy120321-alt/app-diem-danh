import { API_URL, SPREADSHEET_ID, SHEET_STUDENTS, SHEET_ATTENDANCE } from '../config';
import { Student, AddStudentPayload, SaveAttendancePayload } from '../types';

const LOCAL_STORAGE_KEY = 'mamnon_cs2_students_data_v1';

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
 * Lấy danh sách học sinh theo lớp từ Google Sheets API (Cơ Sở 2: HocSinh_CS2)
 */
export async function getStudentsByClass(className: string): Promise<{ success: boolean; data: Student[]; isOfflineFallback?: boolean }> {
  try {
    const params = new URLSearchParams({
      action: 'getStudents',
      facility: '2',
      class: className,
      sheetName: SHEET_STUDENTS,
      sheet: SHEET_STUDENTS,
      tab: SHEET_STUDENTS,
      studentSheet: SHEET_STUDENTS,
      spreadsheetId: SPREADSHEET_ID,
    });
    const url = `${API_URL}?${params.toString()}`;
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
 * Thêm học sinh mới lên Google Sheets API (Cơ Sở 2: HocSinh_CS2)
 */
export async function addStudentApi(payload: AddStudentPayload): Promise<{ success: boolean; message: string; newStudent: Student }> {
  const fullName = payload.fullName ? payload.fullName.trim() : '';
  const className = payload.className ? payload.className.trim() : '';
  const parentName = payload.parentName ? payload.parentName.trim() : '';
  const phone = payload.phone ? payload.phone.trim() : '';

  const newStudent: Student = {
    id: `STU-${Date.now().toString().slice(-4)}`,
    fullName,
    className,
    parentName,
    phone,
    gender: Math.random() > 0.5 ? 'boy' : 'girl'
  };

  // Always save locally to ensure UI updates immediately
  const currentStudents = getLocalStudents();
  currentStudents.push(newStudent);
  saveLocalStudents(currentStudents);

  if (!API_URL) {
    return {
      success: true,
      message: 'Thêm học sinh thành công (lưu cục bộ)!',
      newStudent
    };
  }

  try {
    // Send POST to Google Apps Script with no-cors to avoid CORS block on redirect
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addStudent',
        facility: '2',
        sheetName: SHEET_STUDENTS,
        sheet: SHEET_STUDENTS,
        tab: SHEET_STUDENTS,
        studentSheet: SHEET_STUDENTS,
        spreadsheetId: SPREADSHEET_ID,

        // Standardized primary keys as requested
        fullName: fullName,
        className: className,
        parentName: parentName,
        phone: phone,
        MaHocSinh: newStudent.id,

        // English & Vietnamese alias keys for maximum compatibility
        id: newStudent.id,
        ID: newStudent.id,
        maHocSinh: newStudent.id,
        name: fullName,
        studentName: fullName,
        HoTen: fullName,
        hoTen: fullName,
        class: className,
        Lop: className,
        lop: className,
        TenPhuHuynh: parentName,
        tenPhuHuynh: parentName,
        SoDienThoai: phone,
        soDienThoai: phone,
        parentPhone: phone,
        sdt: phone,
        SDT: phone,
      }),
    });

    return {
      success: true,
      message: 'Đã gửi yêu cầu thành công!',
      newStudent
    };
  } catch (err: any) {
    console.warn('Không thể gửi POST tới API, dữ liệu đã lưu cục bộ:', err);
    return {
      success: false,
      message: err?.message || 'Không thể kết nối đến máy chủ Google Sheets.',
      newStudent
    };
  }
}

/**
 * Lưu kết quả điểm danh lên Google Sheets API (Cơ Sở 2: DiemDanh_CS2)
 */
export async function saveAttendanceApi(payload: SaveAttendancePayload): Promise<{ success: boolean; message: string }> {
  if (!API_URL) {
    return { success: false, message: 'Chưa cấu hình Google Sheets API URL trong file config.ts.' };
  }

  try {
    const absentNamesVal = payload.absentNames !== undefined
      ? payload.absentNames
      : (Array.isArray(payload.absentIds) ? payload.absentIds.join(', ') : payload.absentIds);

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'saveAttendance',
        facility: '2',
        sheetName: SHEET_ATTENDANCE,
        sheet: SHEET_ATTENDANCE,
        tab: SHEET_ATTENDANCE,
        attendanceSheet: SHEET_ATTENDANCE,
        spreadsheetId: SPREADSHEET_ID,

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

    return {
      success: true,
      message: 'Đã gửi yêu cầu thành công!'
    };
  } catch (err: any) {
    console.warn('Lỗi kết nối API saveAttendance:', err);
    return {
      success: false,
      message: err?.message || 'Không thể kết nối đến máy chủ Google Sheets.'
    };
  }
}

/**
 * Cập nhật thông tin học sinh (Cơ Sở 2: HocSinh_CS2)
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

  if (!API_URL) {
    return {
      success: true,
      message: 'Cập nhật thông tin học sinh thành công (lưu cục bộ)!'
    };
  }

  try {
    const payloadData = {
      action: 'updateStudent',
      facility: '2',
      sheetName: SHEET_STUDENTS,
      sheet: SHEET_STUDENTS,
      tab: SHEET_STUDENTS,
      studentSheet: SHEET_STUDENTS,
      spreadsheetId: SPREADSHEET_ID,

      // ID / Primary key fields
      MaHocSinh: updatedStudent.id,
      maHocSinh: updatedStudent.id,
      id: updatedStudent.id,
      ID: updatedStudent.id,
      studentId: updatedStudent.id,

      // Full name
      HoTen: updatedStudent.fullName,
      hoTen: updatedStudent.fullName,
      fullName: updatedStudent.fullName,
      name: updatedStudent.fullName,
      studentName: updatedStudent.fullName,

      // Class
      Lop: updatedStudent.className,
      lop: updatedStudent.className,
      className: updatedStudent.className,
      class: updatedStudent.className,

      // Parent Name
      TenPhuHuynh: updatedStudent.parentName,
      tenPhuHuynh: updatedStudent.parentName,
      parentName: updatedStudent.parentName,

      // Phone
      SoDienThoai: updatedStudent.phone,
      soDienThoai: updatedStudent.phone,
      phone: updatedStudent.phone,
      parentPhone: updatedStudent.phone,
      sdt: updatedStudent.phone,
      SDT: updatedStudent.phone,

      // Gender
      gender: updatedStudent.gender || 'boy',
      GioiTinh: updatedStudent.gender === 'girl' ? 'Nữ' : 'Nam',

      // Complete student object
      student: updatedStudent,
    };

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow',
        body: JSON.stringify(payloadData),
      });
    } catch (fetchErr) {
      console.warn('Fetch POST with redirect failed, retrying with fallback:', fetchErr);
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payloadData),
      });
    }

    return {
      success: true,
      message: 'Đã cập nhật thông tin học sinh lên Google Sheets thành công!'
    };
  } catch (err: any) {
    console.warn('Lỗi kết nối khi cập nhật thông tin học sinh:', err);
    return {
      success: true, // Updated locally
      message: 'Đã cập nhật dữ liệu cục bộ.'
    };
  }
}

/**
 * Xóa học sinh khỏi danh sách (Cơ Sở 2: HocSinh_CS2)
 */
export async function deleteStudentApi(studentId: string): Promise<{ success: boolean; message: string }> {
  // Always update local storage first
  const currentStudents = getLocalStudents();
  const updatedStudents = currentStudents.filter(s => s.id !== studentId);
  saveLocalStudents(updatedStudents);

  if (!API_URL) {
    return {
      success: true,
      message: 'Đã xóa học sinh thành công (lưu cục bộ)!'
    };
  }

  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'deleteStudent',
        facility: '2',
        sheetName: SHEET_STUDENTS,
        sheet: SHEET_STUDENTS,
        tab: SHEET_STUDENTS,
        studentSheet: SHEET_STUDENTS,
        spreadsheetId: SPREADSHEET_ID,

        id: studentId,
        ID: studentId,
        MaHocSinh: studentId,
      }),
    });

    return {
      success: true,
      message: 'Đã gửi yêu cầu thành công!'
    };
  } catch (err: any) {
    console.warn('Không thể gửi yêu cầu xóa tới API Google Sheets:', err);
    return {
      success: false,
      message: err?.message || 'Không thể kết nối tới Google Sheets. Vui lòng kiểm tra lại kết nối mạng.'
    };
  }
}

/**
 * Lấy danh sách lịch sử điểm danh trực tiếp từ Google Sheets API (Cơ Sở 2: DiemDanh_CS2)
 */
export async function getAttendanceHistoryApi(): Promise<{ success: boolean; data: any[]; message?: string }> {
  if (!API_URL) {
    return { success: false, data: [], message: 'Chưa cấu hình Google Sheets API URL trong file config.ts.' };
  }

  try {
    const separator = API_URL.includes('?') ? '&' : '?';
    const params = new URLSearchParams({
      action: 'getAttendance',
      facility: '2',
      sheetName: SHEET_ATTENDANCE,
      sheet: SHEET_ATTENDANCE,
      tab: SHEET_ATTENDANCE,
      attendanceSheet: SHEET_ATTENDANCE,
      spreadsheetId: SPREADSHEET_ID,
      t: String(new Date().getTime()),
    });
    const fetchUrl = `${API_URL}${separator}${params.toString()}`;

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
      } else if (Array.isArray(json?.attendance)) {
        rawList = json.attendance;
      } else if (Array.isArray(json?.rows)) {
        rawList = json.rows;
      } else if (Array.isArray(json?.records)) {
        rawList = json.records;
      } else if (Array.isArray(json?.list)) {
        rawList = json.list;
      } else if (Array.isArray(json?.values)) {
        rawList = json.values;
      }

      if (rawList !== null) {
        const historyData = rawList
          .map((item: any, idx: number) => {
            if (!item) return null;

            let timestampVal = '';
            let dateVal = '';
            let classVal = '';
            let absentNamesVal = '';
            let idVal = '';

            if (Array.isArray(item)) {
              // Ánh xạ đúng chuẩn cấu trúc cột Database:
              // item[0]: Cột A (NgayDiemDanh / Timestamp)
              // item[1]: Cột B (Lop / Ngày điểm danh)
              // item[2]: Cột C (DanhSachVang / Tên lớp)
              // item[3]: Cột D (GhiChu / Danh sách vắng)
              timestampVal = String(item[0] || '').trim();
              dateVal = String(item[1] || '').trim() || timestampVal;
              classVal = String(item[2] || '').trim();
              absentNamesVal = String(item[3] || '').trim();
              idVal = `ATT-${idx + 1}`;
            } else if (typeof item === 'object') {
              timestampVal = String(item.timestamp || item.Timestamp || item.NgayDiemDanh || '').trim();
              dateVal = String(item.date || item.Date || item.Ngay || item.Lop || '').trim() || timestampVal;
              classVal = String(item.className || item.class || item.DanhSachVang || '').trim();
              absentNamesVal = String(item.absentNames || item.GhiChu || item.danhSachVang || '').trim();
              idVal = String(item.id || `ATT-${idx + 1}`);
            }

            // Bỏ qua dòng tiêu đề
            const lowerClass = classVal.toLowerCase();
            const lowerDate = dateVal.toLowerCase();
            if (
              lowerClass === 'lớp' || lowerClass === 'lop' || lowerClass === 'classname' ||
              lowerDate === 'ngày' || lowerDate === 'ngay' || lowerDate === 'date' || lowerDate === 'ngaydiemdanh'
            ) {
              return null;
            }

            if (!timestampVal && !dateVal && !classVal) {
              return null;
            }

            return {
              id: idVal,
              timestamp: timestampVal || dateVal,
              date: dateVal || timestampVal,
              className: classVal || 'Mầm',
              absentNames: absentNamesVal,
              absentIds: []
            };
          })
          .filter((x): x is any => x !== null);

        // Hiển thị đầy đủ toàn bộ bản ghi theo đúng thứ tự mới nhất lên trên
        return { success: true, data: historyData.reverse() };
      } else {
        return { success: true, data: [] };
      }
    } else {
      return { success: false, data: [], message: `Mã lỗi HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (err: any) {
    console.warn('Lỗi gọi API getAttendance Google Sheets:', err);
    return { success: false, data: [], message: err?.message || 'Không thể kết nối tới Google Sheets API.' };
  }
}

/**
 * Xóa bản ghi điểm danh qua Google Sheets API (Cơ Sở 2: DiemDanh_CS2)
 */
export async function deleteAttendanceApi(timestamp: string, recordData?: any): Promise<{ success: boolean; message: string }> {
  if (!API_URL) {
    return { success: false, message: 'Chưa cấu hình Google Sheets API URL.' };
  }

  const ts = timestamp || recordData?.timestamp || recordData?.date || '';
  const dateVal = recordData?.date || recordData?.Ngay || ts;
  const classVal = recordData?.className || recordData?.class || recordData?.Lop || '';

  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'deleteAttendance',
        facility: '2',
        sheetName: SHEET_ATTENDANCE,
        sheet: SHEET_ATTENDANCE,
        tab: SHEET_ATTENDANCE,
        attendanceSheet: SHEET_ATTENDANCE,
        spreadsheetId: SPREADSHEET_ID,

        // Direct timestamp & aliases for backend matching
        timestamp: ts,
        Timestamp: ts,
        NgayDiemDanh: ts,
        ngayDiemDanh: ts,

        date: dateVal,
        Date: dateVal,
        Ngay: dateVal,
        ngay: dateVal,

        class: classVal,
        className: classVal,
        Lop: classVal,
        lop: classVal,

        id: recordData?.id || '',
        ID: recordData?.id || '',
        absentNames: recordData?.absentNames || '',
      })
    });

    return {
      success: true,
      message: 'Đã gửi yêu cầu xóa điểm danh thành công!'
    };
  } catch (err: any) {
    console.warn('Lỗi khi gửi POST deleteAttendance:', err);
    return {
      success: false,
      message: err?.message || 'Không thể kết nối đến máy chủ Google Sheets.'
    };
  }
}


