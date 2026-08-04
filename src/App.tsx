import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DailyAttendance } from './components/DailyAttendance';
import { AddStudent } from './components/AddStudent';
import { StudentList } from './components/StudentList';
import { Reports } from './components/Reports';
import { AIAssistant } from './components/AIAssistant';
import { ToastContainer } from './components/ToastContainer';
import { Logo } from './components/Logo';
import { ToastMessage, Student } from './types';
import { getLocalStudents, getStudentsByClass } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('attendance');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [studentSignal, setStudentSignal] = useState<number>(0);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);

  // Load total student count
  useEffect(() => {
    let isMounted = true;
    const fetchTotal = async () => {
      try {
        const res = await getStudentsByClass('Tất cả');
        if (isMounted && res.success && Array.isArray(res.data)) {
          setTotalStudentsCount(res.data.length);
          return;
        }
      } catch (e) {
        // Fallback to local storage count
      }
      if (isMounted) {
        const list = getLocalStudents();
        setTotalStudentsCount(list.length);
      }
    };
    fetchTotal();
    return () => { isMounted = false; };
  }, [studentSignal]);

  // Toast Helper
  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStudentAdded = (newStudent: Student) => {
    setStudentSignal((prev) => prev + 1);
  };

  const handleStudentDeleted = () => {
    setStudentSignal((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-sky-50 text-slate-800 flex flex-col font-sans antialiased">
      
      {/* Header & Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalStudentsCount={totalStudentsCount}
      />

      {/* Main Content View */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'attendance' ? (
          <DailyAttendance
            studentsListSignal={studentSignal}
            addToast={addToast}
          />
        ) : activeTab === 'students' ? (
          <StudentList
            studentsListSignal={studentSignal}
            onStudentDeleted={handleStudentDeleted}
            onNavigateToAddStudent={() => setActiveTab('addStudent')}
            addToast={addToast}
          />
        ) : activeTab === 'addStudent' ? (
          <AddStudent
            onStudentAdded={handleStudentAdded}
            addToast={addToast}
          />
        ) : activeTab === 'reports' ? (
          <Reports addToast={addToast} />
        ) : (
          <AIAssistant addToast={addToast} onNavigateToTab={(tab) => setActiveTab(tab as NavTab)} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-4 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-center sm:justify-between gap-2">
          <div className="flex items-center space-x-2 font-bold text-slate-600">
            <div className="w-5 h-5 flex items-center justify-center">
              <Logo className="w-full h-full" />
            </div>
            <span>Mầm non Hướng Dương — 0795.497.309</span>
          </div>
        </div>
      </footer>

      {/* Visual Footer Decor Stripe */}
      <div className="h-3 w-full flex overflow-hidden">
        <div className="h-full w-1/4 bg-red-400"></div>
        <div className="h-full w-1/4 bg-yellow-400"></div>
        <div className="h-full w-1/4 bg-blue-400"></div>
        <div className="h-full w-1/4 bg-emerald-400"></div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}

