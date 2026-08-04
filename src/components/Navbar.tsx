import React from 'react';
import { ClipboardCheck, Users, UserPlus, BarChart3, Sparkles, Bot } from 'lucide-react';
import { Logo } from './Logo';

export type NavTab = 'attendance' | 'students' | 'addStudent' | 'reports' | 'aiAssistant';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  totalStudentsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, totalStudentsCount }) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b-4 border-yellow-400 p-3 sm:px-8 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        
        {/* Logo & Branding */}
        <div className="flex items-center space-x-3">
          <div className="w-14 h-14 p-0.5 bg-white rounded-2xl shadow-md border-2 border-amber-200 flex items-center justify-center shrink-0 hover:scale-105 transition-transform">
            <Logo className="w-full h-full" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-black text-lg sm:text-2xl text-slate-800 tracking-tight leading-tight flex items-center gap-1.5">
                <span>Mầm non Hướng Dương</span>
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-600" /> V1.0
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
              Hệ Thống Điểm Danh Mầm Non • Hotline: 0795.497.309
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden sm:flex items-center p-1.5 bg-slate-100 rounded-full border border-slate-200/80">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center px-3.5 lg:px-4 py-2 text-sm font-black rounded-full transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-blue-500'
            }`}
          >
            <ClipboardCheck className={`w-4 h-4 mr-1.5 ${activeTab === 'attendance' ? 'text-blue-600' : 'text-slate-400'}`} />
            Điểm Danh
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center px-3.5 lg:px-4 py-2 text-sm font-black rounded-full transition-all cursor-pointer ${
              activeTab === 'students'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-blue-500'
            }`}
          >
            <Users className={`w-4 h-4 mr-1.5 ${activeTab === 'students' ? 'text-blue-600' : 'text-slate-400'}`} />
            Danh Sách Học Sinh
          </button>

          <button
            onClick={() => setActiveTab('addStudent')}
            className={`flex items-center px-3.5 lg:px-4 py-2 text-sm font-black rounded-full transition-all cursor-pointer ${
              activeTab === 'addStudent'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-blue-500'
            }`}
          >
            <UserPlus className={`w-4 h-4 mr-1.5 ${activeTab === 'addStudent' ? 'text-blue-600' : 'text-slate-400'}`} />
            Thêm Học Sinh
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center px-3.5 lg:px-4 py-2 text-sm font-black rounded-full transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-blue-500'
            }`}
          >
            <BarChart3 className={`w-4 h-4 mr-1.5 ${activeTab === 'reports' ? 'text-blue-600' : 'text-slate-400'}`} />
            Báo Cáo
          </button>

          <button
            onClick={() => setActiveTab('aiAssistant')}
            className={`flex items-center px-3.5 lg:px-4 py-2 text-sm font-black rounded-full transition-all cursor-pointer ${
              activeTab === 'aiAssistant'
                ? 'bg-amber-400 text-slate-900 shadow-sm border border-amber-300'
                : 'text-amber-800 hover:text-amber-900 bg-amber-100/60'
            }`}
          >
            <Bot className={`w-4 h-4 mr-1.5 ${activeTab === 'aiAssistant' ? 'text-slate-900' : 'text-amber-600'}`} />
            Trợ Lý AI
          </button>
        </nav>

        {/* Top Info pill */}
        <div className="flex items-center">
          {typeof totalStudentsCount === 'number' && (
            <button
              onClick={() => setActiveTab('students')}
              title="Nhấn để xem danh sách học sinh"
              className="text-xs font-black px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 rounded-full border-2 border-emerald-200/80 flex items-center shadow-xs transition-all cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 animate-pulse shrink-0"></span>
              <span>Sĩ số: <strong className="font-black text-emerald-900">{totalStudentsCount}</strong> bé</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Tabs */}
      <div className="flex sm:hidden mt-3 p-1 bg-slate-100 rounded-full border border-slate-200 justify-around overflow-x-auto gap-0.5">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-2 px-2 text-[11px] font-black rounded-full flex items-center justify-center space-x-1 transition-all whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Điểm Danh</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-2 px-2 text-[11px] font-black rounded-full flex items-center justify-center space-x-1 transition-all whitespace-nowrap ${
            activeTab === 'students'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Danh Sách</span>
        </button>

        <button
          onClick={() => setActiveTab('addStudent')}
          className={`flex-1 py-2 px-2 text-[11px] font-black rounded-full flex items-center justify-center space-x-1 transition-all whitespace-nowrap ${
            activeTab === 'addStudent'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Thêm Mới</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-2 px-2 text-[11px] font-black rounded-full flex items-center justify-center space-x-1 transition-all whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Báo Cáo</span>
        </button>

        <button
          onClick={() => setActiveTab('aiAssistant')}
          className={`flex-1 py-2 px-2 text-[11px] font-black rounded-full flex items-center justify-center space-x-1 transition-all whitespace-nowrap ${
            activeTab === 'aiAssistant'
              ? 'bg-amber-400 text-slate-900 shadow-sm'
              : 'text-amber-800 bg-amber-100/80'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Trợ Lý AI</span>
        </button>
      </div>

    </header>
  );
};

