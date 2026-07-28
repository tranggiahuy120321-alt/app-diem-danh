import React, { useState, useEffect } from 'react';
import { Student, ToastMessage } from '../types';
import { CLASSES } from '../config';
import { getLocalStudents, getStudentsByClass, deleteStudentApi, updateStudentApi } from '../services/api';
import { Search, Trash2, Users, Phone, User, AlertTriangle, X, GraduationCap, Plus, RefreshCw, Pencil, Check } from 'lucide-react';

interface StudentListProps {
  studentsListSignal?: number;
  onStudentDeleted?: () => void;
  onNavigateToAddStudent?: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const StudentList: React.FC<StudentListProps> = ({
  studentsListSignal,
  onStudentDeleted,
  onNavigateToAddStudent,
  addToast,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('Tất cả');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Edit state
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Load students from API and local storage
  const loadStudents = async () => {
    const localList = getLocalStudents();
    if (localList.length > 0) {
      setStudents(localList);
    }

    try {
      const res = await getStudentsByClass('Tất cả');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setStudents(res.data);
      }
    } catch (err) {
      console.warn('StudentList API fetch warning:', err);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [studentsListSignal]);

  const handleOpenEdit = (student: Student) => {
    setStudentToEdit(student);
    setEditFormData({ ...student });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToEdit || !editFormData.fullName?.trim() || !editFormData.className) return;

    setIsSavingEdit(true);
    try {
      const updated: Student = {
        id: studentToEdit.id,
        fullName: editFormData.fullName.trim(),
        className: editFormData.className,
        parentName: editFormData.parentName?.trim() || '',
        phone: editFormData.phone?.trim() || '',
        gender: editFormData.gender === 'girl' ? 'girl' : 'boy',
      };

      const res = await updateStudentApi(updated);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Cập nhật thành công',
          message: `Đã cập nhật thông tin học sinh ${updated.fullName}.`,
        });
        loadStudents();
        if (onStudentDeleted) {
          onStudentDeleted();
        }
        setStudentToEdit(null);
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Lỗi',
        message: 'Không thể cập nhật thông tin. Vui lòng thử lại.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Class matching helper
  const isClassMatch = (studentClass: string | undefined, targetClass: string) => {
    if (targetClass === 'Tất cả') return true;
    if (!studentClass) return false;
    const sc = studentClass.trim().toLowerCase();
    const tc = targetClass.trim().toLowerCase();
    return sc === tc || sc.includes(tc) || tc.includes(sc);
  };

  // Filter students by class and search query
  const filteredStudents = students.filter((student) => {
    const matchesClass = isClassMatch(student.className, selectedClass);

    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      student.fullName.toLowerCase().includes(query) ||
      (student.parentName && student.parentName.toLowerCase().includes(query)) ||
      (student.phone && student.phone.includes(query)) ||
      student.id.toLowerCase().includes(query);

    return matchesClass && matchesQuery;
  });

  // Dynamic list of unique classes
  const availableClasses = Array.from(
    new Set([...CLASSES, ...students.map((s) => s.className).filter(Boolean)])
  );

  // Handle delete student
  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;

    setIsDeleting(true);
    try {
      const res = await deleteStudentApi(studentToDelete.id);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Thành công',
          message: `Đã xóa học sinh ${studentToDelete.fullName} khỏi danh sách.`,
        });
        loadStudents();
        if (onStudentDeleted) {
          onStudentDeleted();
        }
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Lỗi',
        message: 'Không thể xóa học sinh. Vui lòng thử lại.',
      });
    } finally {
      setIsDeleting(false);
      setStudentToDelete(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-2 space-y-6">
      
      {/* Search & Filter Header Bar */}
      <div className="bg-white rounded-3xl p-5 border-2 border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          
          {/* Class Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 overflow-x-auto">
            <button
              onClick={() => setSelectedClass('Tất cả')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedClass === 'Tất cả'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({students.length})
            </button>
            {availableClasses.map((cls) => {
              const count = students.filter((s) => isClassMatch(s.className, cls)).length;
              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    selectedClass === cls
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cls} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo tên bé, phụ huynh, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-xs font-bold bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Student List Grid */}
      {filteredStudents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const isBoy = student.gender === 'boy';
            return (
              <div
                key={student.id}
                className="bg-white rounded-3xl p-5 border-2 border-slate-100 shadow-xs hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3.5">
                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg border ${
                        isBoy
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-rose-50 text-rose-500 border-rose-200'
                      }`}
                    >
                      {isBoy ? '👦' : '👧'}
                    </div>

                    <div>
                      <h3 className="font-black text-slate-800 text-base leading-snug group-hover:text-blue-600 transition-colors">
                        {student.fullName}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                          <GraduationCap className="w-3 h-3 mr-1 text-slate-500" />
                          {student.className}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(student)}
                      title="Chỉnh sửa thông tin học sinh"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setStudentToDelete(student)}
                      title="Xóa học sinh này"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Parent & Contact Info */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/80 space-y-1.5 text-xs font-semibold text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Phụ huynh:
                    </span>
                    <span className="font-bold text-slate-800">
                      {student.parentName || 'Chưa cập nhật'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> SĐT liên hệ:
                    </span>
                    {student.phone ? (
                      <a
                        href={`tel:${student.phone}`}
                        className="font-bold text-blue-600 hover:underline"
                      >
                        {student.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400 font-medium">Chưa có</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl p-10 border-2 border-slate-100 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="font-black text-slate-700 text-base">
            Không tìm thấy học sinh nào
          </h3>
          <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto">
            {searchQuery
              ? `Không có học sinh nào phù hợp với từ khóa "${searchQuery}".`
              : 'Danh sách học sinh trong lớp này hiện đang trống.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                Xóa tìm kiếm
              </button>
            )}
            {onNavigateToAddStudent && (
              <button
                onClick={onNavigateToAddStudent}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 font-black text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm học sinh mới</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                onClick={() => setStudentToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-800">
                Xác nhận xóa học sinh?
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Bạn có chắc chắn muốn xóa bé{' '}
                <strong className="text-slate-800 font-black">{studentToDelete.fullName}</strong> ({studentToDelete.className}) khỏi danh sách?
              </p>
              <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-700">
                ⚠️ Hành động này sẽ loại bỏ học sinh khỏi danh sách lớp và bảng điểm danh.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100 rounded-2xl transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {studentToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200 my-8">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Chỉnh sửa thông tin học sinh
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    Mã học sinh: {studentToEdit.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStudentToEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              {/* Họ và tên bé */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  placeholder="Nhập họ và tên bé..."
                  className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
                />
              </div>

              {/* Lớp học */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Lớp học <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={editFormData.className || CLASSES[0]}
                  onChange={(e) => setEditFormData({ ...editFormData, className: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all cursor-pointer"
                >
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phụ huynh */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Tên Phụ huynh
                </label>
                <input
                  type="text"
                  value={editFormData.parentName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, parentName: e.target.value })}
                  placeholder="Nhập tên phụ huynh..."
                  className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
                />
              </div>

              {/* SĐT */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Số điện thoại liên hệ
                </label>
                <input
                  type="tel"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="Ví dụ: 0901234567"
                  className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
                />
              </div>

              {/* Giới tính */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Giới tính
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, gender: 'boy' })}
                    className={`py-2.5 px-4 rounded-2xl font-black text-xs border-2 flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      editFormData.gender !== 'girl'
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base">👦</span>
                    <span>Bé trai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, gender: 'girl' })}
                    className={`py-2.5 px-4 rounded-2xl font-black text-xs border-2 flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      editFormData.gender === 'girl'
                        ? 'bg-rose-50 border-rose-400 text-rose-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base">👧</span>
                    <span>Bé gái</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setStudentToEdit(null)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100 rounded-2xl transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-md shadow-blue-200 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
