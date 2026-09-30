import { API_URL } from '../config';
import { Student, AddStudentPayload, SaveAttendancePayload } from '../types';

const LOCAL_STORAGE_KEY = 'mamnon_students_data_v1';
let studentsRequest: Promise<any> | null = null;
let studentsFreshUntil = 0;
let studentsVersion = 0;
let studentsMemory: Student[] | null = null;

// Internal helper to get cached local students
export const getLocalStudents = (): Student[] => {
  try {
    if (studentsMemory !== null) return studentsMemory;
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const parsed: Student[] = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.every(s => s && typeof s.id === 'string' && typeof s.className === 'string')) {
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
  studentsMemory = students;
  studentsFreshUntil = 0;
  studentsVersion++;
  window.dispatchEvent(new Event('students-updated'));
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(students));
  } catch (e) {
    console.error('Lỗi lưu dữ liệu vào localStorage', e);
  }
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Read the body before clearing the timeout, including slow response bodies.
    const body = await response.text();
    return new Response(body, { status: response.status, statusText: response.statusText });
  } finally { clearTimeout(timer); }
}

export async function getStudentsByClass(className: string, force = false): Promise<{ success: boolean; data: Student[]; isOfflineFallback?: boolean }> {
  let result;
  if (!force && Date.now() < studentsFreshUntil) {
    result = { success: true, data: getLocalStudents() };
  } else {
    if (!studentsRequest) {
      studentsRequest = fetchAllStudents(force).finally(() => { studentsRequest = null; });
    }
    result = await studentsRequest;
  }
  return { ...result, data: result.data.filter((s: Student) => !className || className === 'Tất cả' || s.className.trim().toLowerCase() === className.trim().toLowerCase()) };
}

async function postConfirmed(payload: unknown): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetchWithTimeout(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }, 30000);
    const data = await response.json();
    const success = response.ok && data.status !== 'error' && data.success !== false && (data.status === 'success' || data.success === true);
    return { success, message: data.message || (success ? 'Đã lưu thành công.' : 'Máy chủ chưa xác nhận lưu thành công.') };
  } catch {
    return { success: false, message: 'Chưa xác nhận được kết quả lưu. Vui lòng kiểm tra báo cáo hoặc Google Sheets trước khi gửi lại để tránh trùng dữ liệu.' };
  }
}

/**
 * Lấy danh sách học sinh theo lớp từ Google Sheets API
 */
async function fetchAllStudents(force = false): Promise<{ success: boolean; data: Student[]; isOfflineFallback?: boolean }> {
  try {
    const version = studentsVersion;
    const url = `${API_URL}?action=getStudents${force ? '&refresh=1' : ''}`;
    const response = await fetchWithTimeout(url, {
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

        if (version !== studentsVersion) {
          return { success: true, data: getLocalStudents() };
        }
        saveLocalStudents(fetchedStudents);
        studentsFreshUntil = Date.now() + 60000;
        return { success: true, data: fetchedStudents };

      }
    }
  } catch (err) {
    console.warn('Không thể gọi API getStudents Google Sheets hoặc bị giới hạn CORS, sử dụng bộ nhớ cục bộ:', err);
  }

  // Fallback to local storage
  return { success: true, data: getLocalStudents(), isOfflineFallback: true };

}

/**
 * Thêm học sinh mới lên Google Sheets API
 */
export async function addStudentApi(payload: AddStudentPayload): Promise<{ success: boolean; message: string; newStudent: Student }> {
  const newStudent: Student = { id: `STU-${crypto.randomUUID()}`, fullName: payload.fullName.trim(), className: payload.className, parentName: payload.parentName.trim(), phone: payload.phone.trim(), gender: 'boy' };
  const result = await postConfirmed({ action: 'addStudent', ...newStudent });
  if (result.success) saveLocalStudents([...getLocalStudents(), newStudent]);
  return { ...result, newStudent };
}

export async function saveAttendanceApi(payload: SaveAttendancePayload): Promise<{ success: boolean; message: string }> {
  return postConfirmed({ ...payload, action: 'saveAttendance', className: payload.class,
    absentNames: payload.absentNames ?? payload.absentIds.join(', ') });
}

export async function updateStudentApi(updatedStudent: Student): Promise<{ success: boolean; message: string }> {
  const result = await postConfirmed({ action: 'updateStudent', ...updatedStudent });
  if (result.success) saveLocalStudents(getLocalStudents().map(s => s.id === updatedStudent.id ? updatedStudent : s));
  return result;
}

export async function deleteStudentApi(studentId: string): Promise<{ success: boolean; message: string }> {
  const result = await postConfirmed({ action: 'deleteStudent', id: studentId });
  if (result.success) saveLocalStudents(getLocalStudents().filter(s => s.id !== studentId));
  return result;
}

type HistoryCache = { data: any[]; nextFrom: number; source: string };
const HISTORY_KEY = `attendance_sync_v2:${API_URL}`;
let historyMemory: HistoryCache | null = null;
let historyRequest: Promise<{ success: boolean; data: any[] }> | null = null;

function readHistoryCache(): HistoryCache | null {
  if (historyMemory) return historyMemory;
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
    if (value && Array.isArray(value.data) && Number.isInteger(value.nextFrom) && value.nextFrom >= 2 && typeof value.source === 'string' && value.data.every((r: any) => Number.isInteger(r.sheetRow) && r.sheetRow >= 2)) {
      historyMemory = value;
    }
  } catch { /* Missing or corrupt cache requires a full first download. */ }
  return historyMemory;
}

export function getLocalAttendanceHistory(): any[] {
  return readHistoryCache()?.data || [];
}

export function getAttendanceHistoryApi(): Promise<{ success: boolean; data: any[] }> {
  if (!historyRequest) historyRequest = fetchAttendanceHistory().finally(() => { historyRequest = null; });
  return historyRequest;
}

/**
 * Lấy danh sách lịch sử điểm danh trực tiếp từ Google Sheets API (GET)
 */
async function fetchAttendanceHistory(): Promise<{ success: boolean; data: any[] }> {
  if (!API_URL) {
    return { success: true, data: [] };
  }

  try {
    const separator = API_URL.includes('?') ? '&' : '?';
    const cached = readHistoryCache();
    const fetchUrl = `${API_URL}${separator}action=getAttendance&sync=1&fromRow=${cached?.nextFrom || 2}&source=${encodeURIComponent(cached?.source || '')}&t=${Date.now()}`;

    // TUYỆT ĐỐI KHÔNG THÊM HEADERS để tránh lỗi CORS với Google Apps Script
    const response = await fetchWithTimeout(fetchUrl);

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
          const dateVal = String(
            item.date ||
            item.Date ||
            item.Ngay ||
            item.ngay ||
            item.NgayDiemDanh ||
            item.ngayDiemDanh ||
            item['Ngày'] ||
            item['Ngày điểm danh'] ||
            item['Ngay'] ||
            item['Cột B'] ||
            item['colB'] ||
            item.time ||
            item.Time ||
            item.timestamp ||
            ''
          );
          const classVal = String(
            item.className ||
            item.class ||
            item.Lop ||
            item.lop ||
            item['Lớp'] ||
            'Mầm'
          );
          const absentNamesVal = item.absentNames !== undefined 
            ? String(item.absentNames) 
            : (item.DanhSachVang !== undefined ? String(item.DanhSachVang) : (item.danhSachVang !== undefined ? String(item.danhSachVang) : (item.danhsachvang !== undefined ? String(item.danhsachvang) : (item['Danh sách vắng'] !== undefined ? String(item['Danh sách vắng']) : ''))));
          const timestampVal = item.timestamp || item.Time || item.ThoiGian || item.thoiGian || new Date().toISOString();
          const absentIdsVal = Array.isArray(item.absentIds) ? item.absentIds : [];

          return {
            sheetRow: item.sheetRow,
            id: String(item.id || item.ID || `ATT-${item.sheetRow || idx + 1}`),
            date: dateVal,
            className: classVal,
            absentNames: absentNamesVal,
            absentIds: absentIdsVal,
            timestamp: timestampVal,
          };
        });

        if (json.syncVersion === 2 && Number.isInteger(json.replaceFrom) && json.replaceFrom >= 2 && Number.isInteger(json.nextFrom) && json.nextFrom >= 2 && typeof json.source === 'string' && historyData.every(r => Number.isInteger(r.sheetRow) && r.sheetRow >= json.replaceFrom)) {
          const prefix = cached && cached.source === json.source ? cached.data.filter(r => r.sheetRow < json.replaceFrom) : [];
          const data = [...prefix, ...historyData].sort((a, b) => b.sheetRow - a.sheetRow);
          historyMemory = { data, nextFrom: json.nextFrom, source: json.source };
          try { localStorage.setItem(HISTORY_KEY, JSON.stringify(historyMemory)); } catch { /* Keep a working memory cache if storage is full. */ }
          return { success: true, data };
        }
        // Older deployments remain readable but are not used as incremental caches.
        return { success: true, data: historyData.reverse() };
      }
    }
  } catch (err) {
    console.warn('Lỗi gọi API getAttendance Google Sheets:', err);
  }

  return { success: false, data: getLocalAttendanceHistory() };
}

/**
 * Xóa bản ghi điểm danh qua Google Sheets API (POST)
 */
export async function deleteAttendanceApi(target: any): Promise<{ success: boolean; message: string }> {
  return postConfirmed({ action: 'deleteAttendance', timestamp: typeof target === 'object' ? target.timestamp : String(target) });
}

/**
 * Lấy URL tuyệt đối chuẩn cho endpoint AI Assistant trên cả desktop và thiết bị di động
 */
export function getAIAssistantApiUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http')) {
      return `${origin.replace(/\/$/, '')}/api/ai-assistant`;
    }
  }
  return '/api/ai-assistant';
}

/**
 * Gửi yêu cầu phân tích AI tới backend server với AbortController timeout 12 giây và xử lý lỗi đồng bộ
 */
export async function sendAIAssistantApi(payload: {
  prompt: string;
  history?: any[];
  students?: Student[];
  attendanceHistory?: any[];
}): Promise<{ success: boolean; reply: string }> {
  const apiUrl = getAIAssistantApiUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) {
        return { success: true, reply: data.reply };
      }
    }
    console.warn(`AI Assistant API trả về mã HTTP ${res.status}`);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('AI Assistant API quá thời gian chờ (timeout 12s), chuyển sang bộ phân tích cục bộ.');
    } else {
      console.warn('Không thể kết nối AI Assistant API server:', err);
    }
  }

  return { success: false, reply: '' };
}

