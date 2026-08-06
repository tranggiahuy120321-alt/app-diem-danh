import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, RefreshCw, Trash2, User, CheckCircle2, Database, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { ToastMessage, Student, AttendanceRecord } from '../types';
import { getStudentsByClass, getAttendanceHistoryApi } from '../services/api';

interface AIAssistantProps {
  addToast?: (toast: Omit<ToastMessage, 'id'>) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isError?: boolean;
}

const SUGGESTED_PROMPTS = [
  '📊 Thống kê điểm danh hôm nay',
  '🏫 Sĩ số từng lớp hiện tại',
  '👧 Tra cứu học sinh có tỷ lệ vắng cao',
  '📋 Danh sách học sinh lớp Dưới',
  '📋 Danh sách học sinh lớp Trên lầu',
  '💡 Hướng dẫn điểm danh cho giáo viên mới'
];

const SESSION_STORAGE_KEY = 'ai_assistant_chat_messages_v1';

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'ai',
  text: 'Xin chào cô/thầy! Tôi là **Trợ lý AI mầm non Hướng Dương 2** 🌻.\n\nTôi có thể giúp cô/thầy tra cứu danh sách học sinh, thông tin phụ huynh, lịch sử điểm danh, thống kê sĩ số và tỷ lệ bé đi học. Cô/thầy muốn tra cứu thông tin gì hôm nay ạ?',
  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
};

export const AIAssistant: React.FC<AIAssistantProps> = ({ addToast }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc sessionStorage cho Trợ lý AI:', e);
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Lưu tin nhắn vào sessionStorage mỗi khi thay đổi
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Lỗi lưu sessionStorage cho Trợ lý AI:', e);
    }
  }, [messages]);

  // System context data state
  const [studentsData, setStudentsData] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Fetch contextual system data (students & attendance records)
  useEffect(() => {
    let isMounted = true;

    const loadContextData = async () => {
      try {
        const [studentsRes, attendanceRes] = await Promise.allSettled([
          getStudentsByClass('Tất cả'),
          getAttendanceHistoryApi()
        ]);

        if (!isMounted) return;

        let studentsList: Student[] = [];
        let attendanceList: AttendanceRecord[] = [];

        if (studentsRes.status === 'fulfilled' && studentsRes.value.success && Array.isArray(studentsRes.value.data)) {
          studentsList = studentsRes.value.data;
        }

        if (attendanceRes.status === 'fulfilled' && attendanceRes.value.success && Array.isArray(attendanceRes.value.data)) {
          attendanceList = attendanceRes.value.data;
        }

        setStudentsData(studentsList);
        setAttendanceData(attendanceList);
        setIsDataLoaded(true);
      } catch (err: any) {
        if (isMounted) {
          console.warn('Lỗi tải dữ liệu cho AI Assistant:', err);
          setDataError('Không thể lấy đủ dữ liệu nền, nhưng Trợ lý AI vẫn có thể trả lời các câu hỏi chung.');
          setIsDataLoaded(true);
        }
      }
    };

    loadContextData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || isLoading) return;

    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      // Build system context payload
      const todayIso = new Date().toISOString().split('T')[0];
      const LopDướiCount = studentsData.filter(s => s.className?.toLowerCase().includes('dưới')).length;
      const LopTrenCount = studentsData.filter(s => s.className?.toLowerCase().includes('trên')).length;

      const contextData = {
        ngayHomNay: todayIso,
        tongSoHocSinh: studentsData.length,
        siSoLopDuo: LopDướiCount,
        siSoLopTrenLau: LopTrenCount,
        danhSachHocSinh: studentsData.map(s => ({
          maHocSinh: s.id,
          hoTen: s.fullName,
          lop: s.className,
          phuHuynh: s.parentName || 'Chưa cập nhật',
          soDienThoai: s.phone || 'Chưa cập nhật'
        })),
        lichSuDiemDanhToanBo: attendanceData.slice(0, 100).map(a => ({
          ngay: a.date,
          lop: a.className,
          maHocSinhVang: a.studentId,
          tenHocSinhVang: a.studentName,
          lyDoVang: a.reason || 'Không rõ'
        }))
      };

      // Construct history array
      const historyPayload = messages
        .filter(m => !m.isError && m.id !== 'welcome')
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text
        }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: queryText,
          history: historyPayload,
          contextData: contextData
        }),
      });

      const data = await response.json();

      if (data.success && data.reply) {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'Không nhận được câu trả lời từ server.');
      }
    } catch (err: any) {
      console.error('AI Chat Error:', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `⚠️ **Không thể kết nối với Trợ lý AI**: ${err?.message || 'Có lỗi kết nối xảy ra.'}\n\nVui lòng thử lại hoặc kiểm tra kết nối mạng của bạn.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages((prev) => [...prev, errorMsg]);
      if (addToast) {
        addToast({
          type: 'error',
          title: 'Lỗi Trợ lý AI',
          message: 'Không thể xử lý tin nhắn lúc này.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChatHistory = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn('Lỗi xóa sessionStorage:', e);
    }
    setMessages([DEFAULT_WELCOME_MESSAGE]);
  };

  // Utility to format text response with simple markdown bold, bullet points
  const formatText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      // Bold tags regex **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <div key={lineIdx} className="flex items-start space-x-2 my-1 pl-2">
            <span className="text-blue-500 font-bold">•</span>
            <span>{formattedLine.slice(0)}</span>
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={lineIdx} className="h-2" />;
      }

      return <p key={lineIdx} className="my-0.5 leading-relaxed">{formattedLine}</p>;
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span>Trợ Lý AI Điểm Danh</span>
                <span className="text-xs font-black px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  Gemini 3.6
                </span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
              Hỏi đáp thông minh về danh sách học sinh, lịch sử vắng học, sĩ số lớp và báo cáo điểm danh
            </p>
          </div>
        </div>

        {/* Data Status Indicator */}
        <div className="flex items-center space-x-2 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
          <div className="text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center space-x-1.5 shadow-2xs">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {!isDataLoaded
                ? 'Đang tải dữ liệu trường...'
                : `Đã kết nối: ${studentsData.length} bé (${attendanceData.length} lịch sử)`}
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
          </div>

          {messages.length > 1 && (
            <button
              onClick={clearChatHistory}
              title="Xóa đoạn chat"
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-full border border-slate-200 transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 flex flex-col h-[580px] sm:h-[620px] overflow-hidden">
        
        {/* Messages Stream Container */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 max-w-[92%] sm:max-w-[85%] ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-slate-800'
                    : msg.isError
                    ? 'bg-red-500'
                    : 'bg-gradient-to-tr from-blue-600 to-indigo-500'
                }`}
              >
                {msg.sender === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1">
                <div
                  className={`p-4 rounded-3xl text-sm sm:text-base leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white font-medium rounded-tr-xs shadow-sm'
                      : msg.isError
                      ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-xs'
                  }`}
                >
                  {formatText(msg.text)}
                </div>

                <div
                  className={`text-[10px] font-bold text-slate-400 px-2 flex items-center space-x-1 ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Loading animation bubble */}
          {isLoading && (
            <div className="flex items-start space-x-2.5 mr-auto max-w-[85%]">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-xs animate-pulse">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="p-4 rounded-3xl rounded-tl-xs bg-white border border-slate-200/80 text-slate-600 shadow-xs flex items-center space-x-3 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="font-semibold text-slate-600 animate-pulse">
                  Trợ lý AI đang tra cứu dữ liệu & tổng hợp câu trả lời...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompt Quick Chips */}
        <div className="p-3 bg-slate-100/80 border-t border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center space-x-2">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-2 shrink-0">
            Gợi ý câu hỏi:
          </span>
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-full border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shrink-0 disabled:opacity-50 shadow-2xs"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Nhập câu hỏi tra cứu (Ví dụ: Thống kê sĩ số hôm nay, lịch sử bé Nguyễn Văn A...)"
            className="flex-1 px-4 py-3 bg-slate-100/90 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400 disabled:opacity-50"
          />

          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Gửi</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
