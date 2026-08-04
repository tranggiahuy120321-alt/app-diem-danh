import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  User,
  RefreshCw,
  HelpCircle,
  Users,
  Calendar,
  Loader2,
  Trash2,
  Phone,
  CheckCircle2,
  Search,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { Student, ToastMessage } from '../types';
import { getStudentsByClass, getAttendanceHistoryApi, getLocalStudents } from '../services/api';
import { generateLocalSmartResponse } from '../services/aiAssistantFallback';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
}

interface AIAssistantProps {
  addToast?: (toast: Omit<ToastMessage, 'id'>) => void;
  onNavigateToTab?: (tab: string) => void;
}

const SAMPLE_PROMPTS = [
  '🔍 Tra cứu bé Minh Nhật',
  '📊 Thống kê nghỉ học hôm nay',
  '🏫 Sĩ số từng lớp mầm',
  '📞 Tìm SĐT phụ huynh bé An Vy',
  '📅 Danh sách vắng gần đây',
];

const SESSION_STORAGE_KEY = 'ai_assistant_chat_history';

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: 'welcome-1',
  role: 'assistant',
  content: `👋 **Xin chào! Tôi là Trợ Lý AI Hướng Dương.**\n\nTôi sẵn sàng giúp bạn tra cứu thông tin học sinh, kiểm tra lịch sử điểm danh và thống kê chuyên cần.\n\n*Hãy thử bấm các câu hỏi gợi ý bên dưới hoặc nhập câu hỏi của bạn!*`,
  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
};

export const AIAssistant: React.FC<AIAssistantProps> = ({ addToast }) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Không thể đọc tin nhắn từ sessionStorage:', e);
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Không thể lưu tin nhắn vào sessionStorage:', e);
    }
  }, [messages]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load context data (students and history) on component mount
  const loadContextData = async () => {
    setIsDataLoaded(false);
    try {
      // Fetch students
      const studRes = await getStudentsByClass('Tất cả');
      let loadedStudents: Student[] = [];
      if (studRes.success && Array.isArray(studRes.data)) {
        loadedStudents = studRes.data;
      } else {
        loadedStudents = getLocalStudents();
      }
      setStudents(loadedStudents);

      // Fetch attendance history
      const histRes = await getAttendanceHistoryApi();
      if (histRes.success && Array.isArray(histRes.data)) {
        setAttendanceHistory(histRes.data);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu cho AI Assistant:', e);
      setStudents(getLocalStudents());
    } finally {
      setIsDataLoaded(true);
    }
  };

  useEffect(() => {
    loadContextData();
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend || inputPrompt).trim();
    if (!promptText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Prepare chat history for AI
      const historyPayload = messages
        .filter((m) => !m.isError)
        .slice(-6)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          content: m.content,
        }));

      // Ensure students and attendanceHistory are populated with latest/fallback data if empty
      let payloadStudents = students;
      let payloadHistory = attendanceHistory;

      if (!payloadStudents || payloadStudents.length === 0) {
        try {
          const studRes = await getStudentsByClass('Tất cả');
          if (studRes.success && Array.isArray(studRes.data) && studRes.data.length > 0) {
            payloadStudents = studRes.data;
            setStudents(payloadStudents);
          } else {
            payloadStudents = getLocalStudents();
            setStudents(payloadStudents);
          }
        } catch {
          payloadStudents = getLocalStudents();
          setStudents(payloadStudents);
        }
      }

      if (!payloadHistory || payloadHistory.length === 0) {
        try {
          const histRes = await getAttendanceHistoryApi();
          if (histRes.success && Array.isArray(histRes.data) && histRes.data.length > 0) {
            payloadHistory = histRes.data;
            setAttendanceHistory(payloadHistory);
          }
        } catch {
          // ignore error
        }
      }

      let assistantReply = '';

      try {
        // Construct precise, cross-platform endpoint URL for mobile and desktop web environments
        let apiUrl = '/api/ai-assistant';
        if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
          apiUrl = `${window.location.origin.replace(/\/$/, '')}/api/ai-assistant`;
        }

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptText,
            history: historyPayload,
            students: payloadStudents || [],
            attendanceHistory: payloadHistory || [],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.reply) {
            assistantReply = data.reply;
          }
        } else {
          console.warn(`Server AI trả về mã HTTP ${res.status}`);
        }
      } catch (networkErr) {
        console.warn('Không thể kết nối trực tiếp API AI server, áp dụng bộ phân tích dự phòng:', networkErr);
      }

      // Fallback to client-side smart analyzer if API server is offline or returned error
      if (!assistantReply) {
        assistantReply = generateLocalSmartResponse(promptText, payloadStudents || [], payloadHistory || []);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantReply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Lỗi khi xử lý tin nhắn AI Assistant:', err);
      // Final resilient fallback
      const fallbackReply = generateLocalSmartResponse(promptText, students || [], attendanceHistory || []);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Bạn có muốn xóa lịch sử trò chuyện với Trợ lý AI?')) {
      setMessages([
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `🧹 **Đã làm sạch cuộc trò chuyện!**\n\nBạn có thể hỏi lại thông tin bất cứ lúc nào.`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Simple rich text formatting for bold, lists, headers
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Bold text formatting **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const lineContent = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-extrabold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (line.startsWith('• ') || line.startsWith('- ')) {
        return (
          <div key={index} className="flex items-start my-1 text-slate-700">
            <span className="text-amber-500 font-bold mr-2 text-sm">•</span>
            <div>{lineContent.slice(1)}</div>
          </div>
        );
      }

      if (line.startsWith('🔍') || line.startsWith('📊') || line.startsWith('📋') || line.startsWith('🤖') || line.startsWith('⚠️')) {
        return (
          <div key={index} className="font-bold my-1 text-slate-800">
            {lineContent}
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={index} className="h-2" />;
      }

      return (
        <p key={index} className="my-0.5 text-slate-700 leading-relaxed">
          {lineContent}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[520px] max-w-4xl mx-auto bg-white rounded-3xl shadow-lg border-2 border-slate-200/80 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 p-4 sm:px-6 flex items-center justify-between border-b-2 border-amber-300 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-white rounded-2xl shadow-sm border-2 border-amber-200 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-900 text-lg sm:text-xl tracking-tight flex items-center gap-2">
              <span>Trợ Lý AI Hướng Dương</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-white/90 text-amber-800 shadow-2xs">
                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-600 animate-spin" /> Thông Minh
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={loadContextData}
            title="Làm mới dữ liệu tra cứu"
            className="p-2 bg-white/80 hover:bg-white text-slate-700 rounded-xl transition-all border border-amber-200/60 cursor-pointer shadow-2xs flex items-center gap-1 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${!isDataLoaded ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm Mới Data</span>
          </button>

          <button
            onClick={handleClearHistory}
            title="Xóa lịch sử trò chuyện"
            className="p-2 bg-white/80 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-xl transition-all border border-amber-200/60 cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="bg-amber-50/60 border-b border-amber-100/80 p-2.5 px-4 overflow-x-auto flex items-center space-x-2 scrollbar-none">
        <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider shrink-0 flex items-center mr-1">
          <HelpCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
          Gợi ý:
        </span>
        {SAMPLE_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="px-3 py-1.5 bg-white hover:bg-amber-100 text-slate-700 text-xs font-bold rounded-full border border-amber-200/80 whitespace-nowrap transition-all shadow-2xs cursor-pointer disabled:opacity-50 hover:border-amber-300"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs border ${
                  isUser
                    ? 'bg-blue-600 text-white border-blue-700'
                    : msg.isError
                    ? 'bg-red-100 text-red-600 border-red-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-2xs ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs font-medium'
                    : msg.isError
                    ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-xs'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                }`}
              >
                <div className="text-sm font-sans leading-normal">
                  {isUser ? msg.content : renderFormattedContent(msg.content)}
                </div>
                <div
                  className={`text-[10px] mt-2 font-semibold flex items-center justify-end ${
                    isUser ? 'text-blue-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 shadow-2xs">
              <Bot className="w-5 h-5 text-amber-800 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-xs p-4 shadow-2xs flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span className="text-xs font-bold text-slate-500">Trợ Lý AI đang suy nghĩ & phân tích dữ liệu...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Footer */}
      <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Nhập câu hỏi cho Trợ lý AI (vd: Bé Minh Nhật vắng ngày nào?)..."
              disabled={isLoading}
              className="w-full pl-4 pr-10 py-3 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-sm font-medium rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all placeholder:text-slate-400"
            />
            {inputPrompt && (
              <button
                type="button"
                onClick={() => setInputPrompt('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 font-extrabold rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-40 cursor-pointer flex items-center justify-center shrink-0 gap-1.5 border border-amber-400"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Gửi</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
