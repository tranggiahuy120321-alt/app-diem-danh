import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateLocalSmartResponse } from './src/services/aiAssistantFallback';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize Gemini AI
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API Route for AI Assistant Chat
  app.post('/api/ai-assistant', async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, history, students = [], attendanceHistory = [] } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Vui lòng cung cấp câu hỏi.' });
      }

      const now = new Date();
      const todayStrVi = now.toLocaleDateString('vi-VN');
      const dayOfWeekVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][now.getDay()];
      const todayISO = now.toISOString().split('T')[0];

      const studentsContext = Array.isArray(students) && students.length > 0
        ? JSON.stringify(students.slice(0, 150))
        : 'Chưa có dữ liệu học sinh';

      const attendanceContext = Array.isArray(attendanceHistory) && attendanceHistory.length > 0
        ? JSON.stringify(attendanceHistory.slice(0, 120))
        : 'Chưa có dữ liệu lịch sử điểm danh';

      const systemInstruction = `
Bạn là "Trợ Lý AI Hướng Dương" - Trợ lý AI thông minh chính thức của hệ thống điểm danh Mầm non Hướng Dương.
THỜI GIAN HIỆN TẠI HÔM NAY: ${dayOfWeekVi}, ngày ${todayStrVi} (định dạng ISO: ${todayISO}).

Dữ liệu danh sách học sinh toàn trường:
${studentsContext}

Dữ liệu lịch sử điểm danh:
${attendanceContext}

NHIỆM VỤ VÀ CÁC QUY TẮC PHÂN TÍCH THÔNG MINH BẮT BUỘC:

1. TRA CỨU ĐIỂM DANH MỘT HỌC SINH CỤ THỂ (Ví dụ: "Gia Lâm hôm nay có đi học không?", "Bé Minh Nhật tuần này thế nào"):
   - Tìm kiếm chính xác học sinh dựa vào tên (hoặc tên ngắn như "Gia Lâm", "Lâm", "Minh Nhật", v.v.) trong Dữ liệu danh sách học sinh.
   - Xác định Lớp của bé (ví dụ: Lớp dưới, Lớp trên lầu).
   - Kiểm tra Lịch sử điểm danh dành cho LỚP CỦA BÉ vào ngày cần tra cứu (ví dụ ngày hôm nay ${todayStrVi} / ${todayISO}):
     + Nếu ngày đó LỚP CỦA BÉ CÓ BẢN GHI ĐIỂM DANH:
       * Nếu tên bé NẰM TRONG danh sách vắng ('absentNames' / 'danhsachvang' / 'DanhSachVang'): Báo rõ ràng bé **VẮNG MẶT** (kèm lý do vắng nếu có).
       * Nếu tên bé KHÔNG NẰM TRONG danh sách vắng: Kết luận dứt khoát bé **CÓ MẶT / ĐÃ ĐI HỌC** đầy đủ!
     + Nếu ngày đó lớp của bé KHÔNG CÓ BẢN GHI ĐIỂM DANH NÀO: Báo "Chưa có dữ liệu điểm danh cho lớp [Tên lớp] ngày ${todayStrVi}".
   - Khi hỏi về ĐIỂM DANH TRONG TUẦN:
     + Thống kê 6 ngày từ THỨ HAI đến THỨ BẢY trong tuần. (Chủ Nhật là ngày nghỉ không tính).
     + Liệt kê từng ngày từ Thứ 2 đến Thứ 7: Có mặt ✅ / Vắng mặt ❌ / Chưa có dữ liệu 📋.
     + Tổng kết số buổi đi học theo dạng: [Số buổi đi học]/6 buổi (ví dụ: 5/6 buổi, 6/6 buổi).

2. TRA CỨU TỔNG QUAN VÀ BÁO CÁO NGÀY:
   - Tra cứu đúng ngày được hỏi trong Lịch sử điểm danh.
   - Liệt kê danh sách bé vắng mặt theo từng lớp.

3. TRA CỨU SĨ SỐ LỚP VÀ PHỤ HUYNH:
   - Cung cấp sĩ số, tên phụ huynh, SĐT liên hệ từ dữ liệu học sinh khi người dùng hỏi.

QUY TẮC TRÌNH BÀY:
- Trả lời bằng tiếng Việt thân thiện, chuyên nghiệp, sử dụng định dạng Markdown đẹp mắt (danh sách gạch đầu dòng, in đậm từ quan trọng, emoji phù hợp).
- Câu trả lời trực tiếp, chính xác tuyệt đối dựa vào dữ liệu học sinh và lịch sử điểm danh đã cung cấp.
`;

      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY') {
        try {
          const contents: any[] = [];
          
          if (Array.isArray(history)) {
            for (const msg of history) {
              if (msg.role === 'user' || msg.role === 'model') {
                contents.push({
                  role: msg.role,
                  parts: [{ text: String(msg.content || msg.text || '') }]
                });
              }
            }
          }

          contents.push({
            role: 'user',
            parts: [{ text: String(prompt) }]
          });

          const geminiCall = ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API timeout (4.5s)')), 4500)
          );

          const response: any = await Promise.race([geminiCall, timeoutPromise]);

          const replyText = response.text || 'Xin lỗi, tôi không nhận được phản hồi từ AI.';
          return res.json({ reply: replyText });
        } catch (geminiErr: any) {
          console.warn('Lỗi gọi Gemini API (chuyển sang phân tích dữ liệu cục bộ):', geminiErr?.message || geminiErr);
          const replyText = generateLocalSmartResponse(prompt, students, attendanceHistory);
          return res.json({ reply: replyText });
        }
      } else {
        const replyText = generateLocalSmartResponse(prompt, students, attendanceHistory);
        return res.json({ reply: replyText });
      }
    } catch (err: any) {
      console.error('Error in /api/ai-assistant:', err);
      const { prompt = '', students = [], attendanceHistory = [] } = req.body || {};
      const fallbackText = generateLocalSmartResponse(prompt, students, attendanceHistory);
      return res.json({ reply: fallbackText });
    }
  });

  // Vite middleware in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

startServer();
