import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateLocalSmartResponse } from './src/services/aiAssistantFallback';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

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

      const studentsContext = Array.isArray(students) && students.length > 0
        ? JSON.stringify(students.slice(0, 150))
        : 'Chưa có dữ liệu học sinh';

      const attendanceContext = Array.isArray(attendanceHistory) && attendanceHistory.length > 0
        ? JSON.stringify(attendanceHistory.slice(0, 120))
        : 'Chưa có dữ liệu lịch sử điểm danh';

      const systemInstruction = `
Bạn là "Trợ Lý AI Hướng Dương" - Trợ lý AI thông minh tích hợp trong hệ thống điểm danh Mầm non Hướng Dương.
Nhiệm vụ chính:
1. Tra cứu thông tin học sinh (họ tên, lớp, phụ huynh, SĐT, giới tính, mã học sinh).
2. Tra cứu lịch sử điểm danh (ngày nghỉ học, lý do nghỉ nếu có, danh sách bé vắng mặt theo ngày, theo lớp hoặc theo tuần).
3. Thống kê tổng số buổi đi học, số buổi nghỉ, tỷ lệ chuyên cần của từng bé hoặc từng lớp.
4. Hướng dẫn sử dụng các tính năng ứng dụng (Điểm danh, Danh sách học sinh, Thêm học sinh, Báo cáo).

Dữ liệu danh sách học sinh:
${studentsContext}

Dữ liệu lịch sử điểm danh:
${attendanceContext}

CÁC QUY TẮC BẮT BUỘC VỀ ĐIỂM DANH VÀ BÁO CÁO THEO NGÀY / TUẦN:
1. QUY TẮC TRA CỨU ĐIỂM DANH THEO NGÀY CỤ THỂ (RẤT QUAN TRỌNG):
   - Khi người dùng hỏi về điểm danh hoặc báo cáo vắng mặt của một ngày cụ thể (ví dụ: ngày 27/07/2026, 01/08/2026, v.v.):
     + Quét và kiểm tra chính xác ngày đó trong Dữ liệu lịch sử điểm danh (${attendanceContext}).
     + Linh hoạt nhận diện chuỗi ngày tháng ở các trường 'NgayDiemDanh', 'date', 'Ngay', 'DanhSachVang', 'timestamp'. BẮT BUỘC cắt bỏ phần giờ phút (nếu có dạng ISO như '2026-08-04T01:58:17...') để lấy chính xác phần ngày (ví dụ '2026-08-04' hoặc '04/08/2026').
     + Đảm bảo dữ liệu ngày 04/08/2026 trên Google Sheet được nhận diện chính xác là đã có điểm danh, không bị bỏ sót.
     + Nếu KHÔNG CÓ bản ghi điểm danh nào trùng khớp hoàn toàn với ngày được hỏi: BẮT BUỘC trả lời rõ ràng: "Không có dữ liệu điểm danh cho ngày DD/MM/YYYY".
     + TUYỆT ĐỐI KHÔNG ĐƯỢC tự ý lấy dữ liệu của ngày khác để thay thế hay điền vào!

2. QUY TẮC PHÂN TÍCH THEO TUẦN VÀ MẪU SỐ CHUẨN (6 BUỔI/TUẦN):
   - Phạm vi ngày trong một tuần học BẮT BUỘC tính từ THỨ HAI đến THỨ BẢY (đúng 6 ngày: Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6, Thứ 7).
   - Ngày CHỦ NHẬT là ngày nghỉ định kỳ, TUYỆT ĐỐI KHÔNG đưa vào danh sách điểm danh, không tính là ngày đi học/vắng hay chưa có dữ liệu.
   - Mẫu số chuẩn cho tổng số buổi học trong 1 tuần LUÔN BẰNG 6 (mẫu số = 6 buổi).
   - Khi thống kê tổng số buổi đi học của bé trong tuần, BẮT BUỘC hiển thị theo dạng: [Số buổi đi học]/6 buổi (ví dụ: 4/6 buổi, 5/6 buổi, 6/6 buổi). TUYỆT ĐỐI KHÔNG tự động thay đổi mẫu số thành 4/4 hay dựa trên số ngày có bản ghi!
   - Với ngày nào không có bản ghi điểm danh trong lịch sử, ghi rõ: "Chưa có dữ liệu điểm danh".

3. QUY TẮC XỬ LÝ DỮ LIỆU ĐIỂM DANH THEO LỚP CỦA HỌC SINH (CỰC KỲ QUAN TRỌNG):
   - Khi kiểm tra điểm danh một ngày của một bé (ví dụ: bé Khánh Nhân học "Lớp trên lầu"):
     + Bước 1: Đối chiếu ngày trong Dữ liệu lịch sử điểm danh (${attendanceContext}) của ĐÚNG LỚP ĐÓ (ví dụ "Lớp trên lầu"). Nhận diện linh hoạt từ 'NgayDiemDanh', 'date', hoặc 'DanhSachVang' để xác định đúng ngày (ví dụ 01/08/2026).
     + Bước 2: Nếu ngày đó lớp CÓ bản ghi điểm danh (tức là đã tiến hành điểm danh cho lớp):
       * Nếu tên bé NẰM TRONG danh sách vắng ('absentNames' / 'DanhSachVang'): Trạng thái là "Vắng mặt" (kèm lý do nếu có).
       * Nếu tên bé KHÔNG NẰM TRONG danh sách vắng: KẾT LUẬN DỨT KHOÁT là "Có mặt" (ví dụ: bé Khánh Nhân Có mặt vào ngày 01/08/2026). TUYỆT ĐỐI KHÔNG ĐƯỢC báo "Chưa có dữ liệu điểm danh" khi lớp đó đã có bản ghi điểm danh trong ngày!
     + Bước 3: CHỈ BÁO "Chưa có dữ liệu điểm danh" khi toàn bộ lớp đó trong ngày hôm đó HOÀN TOÀN KHÔNG CÓ BẤT KỲ DÒNG BẢN GHI ĐIỂM DANH NÀO trong cơ sở dữ liệu.

Quy tắc trình bày:
- Luôn trả lời bằng tiếng Việt thân thiện, rõ ràng, trình bày có cấu trúc đẹp mắt (sử dụng danh sách dấu gạch đầu dòng hoặc in đậm để dễ đọc).
- Khi hỏi về một học sinh cụ thể, tìm kiếm chính xác tên bé trong dữ liệu và thống kê số ngày vắng, số ngày có mặt, số ngày chưa có dữ liệu điểm danh.
- Khi không tìm thấy thông tin cụ thể, trả lời lịch sự và gợi ý người dùng kiểm tra lại tên bé hoặc lọc ngày.
- Giữ phong cách chuyên nghiệp, ấm áp dành cho môi trường mầm non.
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

          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });

          const replyText = response.text || 'Xin lỗi, tôi không nhận được phản hồi từ AI.';
          return res.json({ reply: replyText });
        } catch (geminiErr: any) {
          // Gracefully fallback to local smart response analyzer on quota limits or network errors
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
