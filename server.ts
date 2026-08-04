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

Dữ liệu lịch sử điểm danh (Tương ứng dữ liệu từ Google Sheets bảng DiemDanh):
${attendanceContext}

NHIỆM VỤ VÀ CÁC QUY TẮC PHÂN TÍCH CHÍNH XÁC BẮT BUỘC:

1. QUY TẮC ĐỐI CHIẾU NGÀY THÁNG CỘT B TRÊN BẢNG SHEET DIEMDANH (KHÔNG ĐƯỢC BÁO BỎ SÓT DỮ LIỆU):
   - Cột B của bảng DiemDanh ('date' / 'Ngay' / 'ngayDiemDanh' / 'Date') lưu trữ ngày thực hiện điểm danh (Ví dụ: 27/07/2026, 28/07/2026, 29/07/2026, 01/08/2026).
   - Khi đối chiếu ngày điểm danh cho từng ngày trong tuần (ví dụ ngày 28/07/2026):
     + Quét trong Dữ liệu lịch sử điểm danh xem có BẤT KỲ bản ghi nào tương ứng với ngày đó hay không (khớp các định dạng như 28/07/2026, 28/7/2026, 2026-07-28, 28/07).
     + NẾU DÒNG DỮ LIỆU GHI NHẬN NGÀY NÀO THÌ PHẢI MAP CHÍNH XÁC VÀO NGÀY ĐÓ (ví dụ dòng ngày 28/07, 29/07, 01/08), TUYỆT ĐỐI KHÔNG ĐỂ TÌNH TRẠNG CÁC NGÀY TRONG TUẦN BỊ BÁO "Chưa có dữ liệu" KHI TRONG BẢNG SHEET ĐÃ CÓ BẢN GHI!

2. TRA CỨU LỊCH SỬ ĐIỂM DANH HỌC SINH CÁ NHÂN (Ví dụ: "Gia Lâm tuần cuối tháng 7", "Bé Gia Lâm từ 27/07 đến 01/08", "Gia Lâm hôm nay có đi học không?"):
   - Bước 1: Tra cứu Danh sách học sinh toàn trường để tìm đúng bé, xác định Tên đầy đủ và Lớp của bé (Ví dụ: Trần Gia Lâm - Lớp Dưới).
   - Bước 2: Xác định khoảng thời gian được hỏi (Ví dụ "tuần cuối tháng 7" nghĩa là từ Thứ Hai 27/07/2026 đến Thứ Bảy 01/08/2026).
   - Bước 3: Lọc và đánh giá trạng thái chuyên cần (Có mặt / Vắng mặt) CỦA RIÊNG BÉ ĐÓ theo từng ngày (từ Thứ Hai đến Thứ Bảy):
     + Với mỗi ngày trong tuần:
       * Tìm bản ghi điểm danh tương ứng với ngày đó trong Dữ liệu lịch sử điểm danh.
       * Nếu có bản ghi điểm danh cho ngày đó:
         - Nếu tên bé ("Gia Lâm", "Trần Gia Lâm", "Lâm") NẰM TRONG danh sách vắng ('absentNames' / 'danhsachvang'): Đánh giá bé **❌ VẮNG MẶT**.
         - Nếu tên bé KHÔNG NẰM TRONG danh sách vắng: Đánh giá bé **✅ CÓ MẶT / ĐÃ ĐI HỌC**.
       * Nếu thực sự KHÔNG CÓ bản ghi điểm danh nào cho ngày đó trong dữ liệu: Báo "Chưa có dữ liệu điểm danh".
   - Bước 4: Trình bày kết quả theo từng ngày từ Thứ 2 đến Thứ 7 và tổng kết: Số buổi đi học = [Số buổi có mặt]/6 buổi.
   - BẮT BUỘC CHỈ IN TRẠNG THÁI CHUYÊN CẦN CỦA CHÍNH BÉ ĐÓ.
   - TUYỆT ĐỐI KHÔNG LIỆT KÊ DANH SÁCH VẮNG CỦA TOÀN TRƯỜNG HAY CÁC LỚP KHÁC RA MÀN HÌNH. Báo cáo phải gọn gàng, chính xác và tập trung 100% vào học sinh được hỏi.

3. QUY TẮC KHI HỎI VỀ "THỐNG KÊ NGHỈ HỌC HÔM NAY" HOẶC TỪ KHÓA TƯƠNG TỰ ("nghỉ học hôm nay", "vắng hôm nay", "ai nghỉ hôm nay", "danh sách vắng hôm nay"):
   - Chỉ khi hỏi tổng quan toàn trường ngày hôm nay (${todayStrVi}): Liệt kê danh sách vắng của từng lớp trong ngày hôm nay.
   - Nếu câu hỏi chỉ đích danh một học sinh: Áp dụng Quy tắc 2 (chỉ trả về cá nhân học sinh đó).

4. XỬ LÝ KHOẢNG THỜI GIAN TRONG QUÁ KHỨ (VD: "tuần cuối tháng 7", "từ 27/07 đến 01/08", "ngày 27/07/2026"):
   - Lọc đúng tuần từ Thứ Hai 27/07/2026 đến Thứ Bảy 01/08/2026.
   - TUYỆT ĐỐI KHÔNG tự ý chuyển sang tuần hiện tại hay ngày hôm nay khi người dùng hỏi khoảng thời gian quá khứ.

QUY TẮC TRÌNH BÀY:
- Trả lời bằng tiếng Việt thân thiện, chuyên nghiệp, sử dụng Markdown đẹp mắt.
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
              temperature: 0.2,
            },
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API timeout (9s)')), 9000)
          );

          const response: any = await Promise.race([geminiCall, timeoutPromise]);

          const replyText = response.text || 'Xin lỗi, tôi không nhận được phản hồi từ AI.';
          return res.json({ reply: replyText });
        } catch (geminiErr: any) {
          const errMsg = geminiErr?.message || String(geminiErr);
          if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            console.warn('Gemini API hết quota/giới hạn tần suất (429) -> Tự động chuyển sang bộ phân tích cục bộ.');
          } else {
            console.warn('Lỗi gọi Gemini API -> Chuyển sang bộ phân tích cục bộ:', errMsg);
          }
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
