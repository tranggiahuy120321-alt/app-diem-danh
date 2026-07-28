export type ClassName = 'Lớp dưới' | 'Lớp trên lầu';

export interface Student {
  id: string;
  fullName: string;
  className: ClassName | string;
  parentName?: string;
  phone?: string;
  avatarBg?: string;
  gender?: 'boy' | 'girl';
}

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  className: string;
  date: string;
  isAbsent: boolean;
  reason?: string;
}

export interface SaveAttendancePayload {
  action: 'saveAttendance';
  class: string;
  date: string;
  absentIds: string[];
  absentNames?: string;
}

export interface AddStudentPayload {
  action: 'addStudent';
  fullName: string;
  className: string;
  parentName: string;
  phone: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}
