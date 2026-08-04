import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

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

  // Local rule-based analyzer when API key is missing or offline
  function generateLocalSmartResponse(promptStr: string, students: any[], history: any[]): string {
    const q = promptStr.toLowerCase().trim();

    // Helper to extract date from user prompt string (e.g. 27/07/2026, 27/07, 27-07-2026)
    const extractDateFromPrompt = (str: string) => {
      const match = str.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
      if (!match) return null;
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const dayFormatted = day.toString().padStart(2, '0');
        const monthFormatted = month.toString().padStart(2, '0');
        return {
          day,
          month,
          year,
          dateVi: `${dayFormatted}/${monthFormatted}/${year}`,
          dateViShort: `${day}/${month}/${year}`,
          dateISO: `${year}-${monthFormatted}-${dayFormatted}`,
        };
      }
      return null;
    };

    // Helper to extract all possible date objects/strings from a record object
    const extractDatesFromRecord = (rec: any) => {
      if (!rec) return [];
      const results: Array<{ day: number; month: number; year: number; dateVi: string; dateViShort: string; dateISO: string; datePart: string }> = [];

      const candidateFields = [
        rec.NgayDiemDanh,
        rec.ngayDiemDanh,
        rec.dateDiemDanh,
        rec.date,
        rec.Date,
        rec.ngay,
        rec.Ngay,
        rec.DanhSachVang,
        rec.danhsachvang,
        rec.absentNames,
        rec.timestamp,
        rec.Timestamp,
        rec.created_at,
        rec.time,
        rec.Time,
      ];

      const seenKeys = new Set<string>();

      for (const fieldVal of candidateFields) {
        if (!fieldVal) continue;
        const rawStr = String(fieldVal).trim();
        if (!rawStr) continue;

        // Cut off time component if present (e.g. 2026-08-04T01:58:17... -> 2026-08-04, 04/08/2026 01:58:17 -> 04/08/2026)
        const cleanStr = rawStr.split(/[\sT,]+/)[0];
        const strNormalized = rawStr.replace(/T/g, ' ');

        const targets = [cleanStr, strNormalized];

        for (const targetStr of targets) {
          const matches = targetStr.matchAll(/\b(\d{1,4})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g);
          for (const match of matches) {
            let p1 = parseInt(match[1], 10);
            let p2 = parseInt(match[2], 10);
            let p3 = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();

            let day = 0, month = 0, year = 0;

            if (p1 > 1000) {
              year = p1;
              month = p2;
              day = p3;
            } else {
              day = p1;
              month = p2;
              year = p3 < 100 ? p3 + 2000 : p3;
            }

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
              const dayFormattedVi = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
              const dayFormattedViShort = `${day}/${month}/${year}`;
              const dayFormattedISO = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              const key = `${year}-${month}-${day}`;

              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                results.push({
                  day,
                  month,
                  year,
                  dateVi: dayFormattedVi,
                  dateViShort: dayFormattedViShort,
                  dateISO: dayFormattedISO,
                  datePart: dayFormattedVi,
                });
              }
            }
          }
        }
      }

      return results;
    };

    const getRecordAttendanceDate = (rec: any) => {
      const dates = extractDatesFromRecord(rec);
      return dates.length > 0 ? dates[0] : null;
    };

    const isRecordForTargetDate = (
      rec: any,
      target: { year: number; month: number; day: number; dateVi?: string; dateViShort?: string; dateISO?: string },
      className?: string
    ) => {
      if (!rec) return false;

      if (className) {
        const recClass = String(rec.className || rec.Lop || rec.lop || '').trim().toLowerCase();
        const targetClass = String(className).trim().toLowerCase();
        if (recClass && targetClass && recClass !== 'tất cả') {
          const isMatch = recClass === targetClass || recClass.includes(targetClass) || targetClass.includes(recClass);
          if (!isMatch) return false;
        }
      }

      const recordDates = extractDatesFromRecord(rec);
      if (recordDates.length === 0) return false;

      return recordDates.some((rd) => {
        return (
          (rd.year === target.year && rd.month === target.month && rd.day === target.day) ||
          (target.dateVi && (rd.dateVi === target.dateVi || rd.datePart === target.dateVi)) ||
          (target.dateViShort && (rd.dateViShort === target.dateViShort || rd.datePart === target.dateViShort)) ||
          (target.dateISO && (rd.dateISO === target.dateISO || rd.datePart === target.dateISO))
        );
      });
    };

    // Helper functions for Monday to Saturday week calculation & record lookup
    const getWeekDays = (refDate: Date) => {
      const dayOfWeek = refDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + diffToMonday);

      const days = [];
      const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      for (let i = 0; i < 6; i++) {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const dayFormattedVi = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        const dayFormattedViShort = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        const dayFormattedISO = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        days.push({
          dayName: dayNames[i],
          dateObj: d,
          dateVi: dayFormattedVi,
          dateViShort: dayFormattedViShort,
          dateISO: dayFormattedISO,
        });
      }
      return days;
    };

    const findRecordForDay = (targetDay: { dateObj: Date; dateVi: string; dateViShort: string; dateISO: string }, className?: string) => {
      return history.find((rec) => {
        return isRecordForTargetDate(rec, {
          year: targetDay.dateObj.getFullYear(),
          month: targetDay.dateObj.getMonth() + 1,
          day: targetDay.dateObj.getDate(),
          dateVi: targetDay.dateVi,
          dateViShort: targetDay.dateViShort,
          dateISO: targetDay.dateISO,
        }, className);
      });
    };

    // 0. Kiểm tra truy vấn theo ngày cụ thể (ví dụ: ngày 27/07/2026, 27/07, vắng ngày 27/7)
    const targetDatePrompt = extractDateFromPrompt(q);
    if (targetDatePrompt && (q.includes('ngày') || q.includes('điểm danh') || q.includes('vắng') || q.includes('nghỉ') || q.includes('báo cáo') || q.includes('hôm'))) {
      const recordsForDate = history.filter((rec) => {
        return isRecordForTargetDate(rec, {
          year: targetDatePrompt.year,
          month: targetDatePrompt.month,
          day: targetDatePrompt.day,
          dateVi: targetDatePrompt.dateVi,
          dateViShort: targetDatePrompt.dateViShort,
          dateISO: targetDatePrompt.dateISO,
        });
      });

      if (recordsForDate.length === 0) {
        return `📋 **Không có dữ liệu điểm danh cho ngày ${targetDatePrompt.dateVi}.**\n\n*(Chưa có bản ghi điểm danh nào được tạo cho ngày này trong hệ thống)*`;
      } else {
        let detailsText = `📋 **Lịch sử điểm danh ngày ${targetDatePrompt.dateVi}:**\n`;
        recordsForDate.forEach((r) => {
          detailsText += `• **${r.className || r.Lop || 'Lớp'}**: Vắng (${r.absentNames || r.danhsachvang || 'Không có'}) - Cập nhật lúc ${r.timestamp || r.NgayDiemDanh || r.date}\n`;
        });
        return detailsText;
      }
    }

    // 1. Tìm thông tin học sinh & báo cáo điểm danh theo tuần của học sinh
    const foundStudents = students.filter(s => {
      const name = (s.fullName || s.hoTen || '').toLowerCase();
      const parent = (s.parentName || s.tenPhuHuynh || '').toLowerCase();
      const id = (s.id || '').toLowerCase();
      return name.includes(q) || parent.includes(q) || (q.length >= 2 && id.includes(q));
    });

    if (foundStudents.length > 0 && (q.includes('bé') || q.includes('em') || q.includes('cháu') || q.includes('học sinh') || q.includes('phụ huynh') || q.includes('sđt') || q.includes('đi học') || q.includes('vắng') || q.includes('nghỉ') || q.includes('tuần') || foundStudents.length === 1)) {
      const target = foundStudents[0];
      const name = target.fullName || target.hoTen || 'Học sinh';
      const cName = target.className || target.Lop || 'Chưa rõ lớp';
      const parent = target.parentName || target.tenPhuHuynh || 'Chưa cập nhật';
      const phone = target.phone || target.soDienThoai || 'Chưa cập nhật';

      // Tính toán điểm danh theo tuần (Thứ Hai đến Thứ Bảy)
      const weekDays = getWeekDays(new Date());
      let weekReportText = '';
      let absentCount = 0;
      let presentCount = 0;
      let noDataCount = 0;

      weekDays.forEach((wd) => {
        const rec = findRecordForDay(wd, cName);
        if (!rec) {
          noDataCount++;
          weekReportText += `• **${wd.dayName} (${wd.dateVi}):** Chưa có dữ liệu điểm danh\n`;
        } else {
          const absentNames = String(rec.absentNames || rec.danhsachvang || '').toLowerCase();
          if (absentNames.includes(name.toLowerCase())) {
            absentCount++;
            weekReportText += `• **${wd.dayName} (${wd.dateVi}):** ❌ Vắng mặt\n`;
          } else {
            presentCount++;
            weekReportText += `• **${wd.dayName} (${wd.dateVi}):** ✅ Có mặt\n`;
          }
        }
      });

      return `🔍 **Thông tin học sinh: ${name}**
• **Lớp:** ${cName}
• **Phụ huynh:** ${parent}
• **SĐT liên hệ:** ${phone}

📅 **Chi tiết điểm danh tuần này (Thứ Hai đến Thứ Bảy):**
${weekReportText}
📊 **Tóm tắt tuần:** Số buổi đi học: **${presentCount}/6 buổi** (${presentCount} ngày có mặt, ${absentCount} ngày vắng mặt, ${noDataCount} ngày chưa có dữ liệu điểm danh).`;
    }

    // 2. Hỏi theo tuần (vd: "điểm danh tuần này", "báo cáo tuần")
    if (q.includes('tuần') || q.includes('tất cả các ngày')) {
      const weekDays = getWeekDays(new Date());
      let reportText = `📅 **Báo cáo điểm danh tuần này (Thứ Hai đến Thứ Bảy):**\n\n`;

      weekDays.forEach((wd) => {
        const recs = history.filter((r) => {
          return isRecordForTargetDate(r, {
            year: wd.dateObj.getFullYear(),
            month: wd.dateObj.getMonth() + 1,
            day: wd.dateObj.getDate(),
            dateVi: wd.dateVi,
            dateViShort: wd.dateViShort,
            dateISO: wd.dateISO,
          });
        });

        if (recs.length === 0) {
          reportText += `• **${wd.dayName} (${wd.dateVi}):** Chưa có dữ liệu điểm danh\n`;
        } else {
          const details = recs.map((r) => `${r.className || r.Lop || 'Lớp'}: Vắng (${r.absentNames || r.danhsachvang || 'Không có'})`).join('; ');
          reportText += `• **${wd.dayName} (${wd.dateVi}):** ${details}\n`;
        }
      });

      return reportText;
    }

    // 3. Hỏi về tổng sĩ số / danh sách
    if (q.includes('sĩ số') || q.includes('bao nhiêu học sinh') || q.includes('tổng số bé') || q.includes('danh sách')) {
      const total = students.length;
      const lopDuoi = students.filter(s => (s.className || '').toLowerCase().includes('dưới')).length;
      const lopTren = students.filter(s => (s.className || '').toLowerCase().includes('trên')).length;

      return `📊 **Thống kê sĩ số toàn trường:**
• **Tổng số học sinh:** ${total} bé
• **Lớp dưới:** ${lopDuoi} bé
• **Lớp trên lầu:** ${lopTren} bé

*Nhấn tab **Danh Sách Học Sinh** hoặc nhập tên bé để tra cứu chi tiết.*`;
    }

    // 4. Hỏi về điểm danh / nghỉ học hôm nay
    if (q.includes('điểm danh') || q.includes('vắng') || q.includes('nghỉ học') || q.includes('hôm nay')) {
      const todayStr = new Date().toLocaleDateString('vi-VN');
      const todayRecords = history.filter(r => r.date === todayStr || (r.date && todayStr.includes(r.date)));

      if (todayRecords.length > 0) {
        let text = `📋 **Lịch sử điểm danh hôm nay (${todayStr}):**\n`;
        todayRecords.forEach(r => {
          text += `• **${r.className || 'Lớp'}**: Vắng (${r.absentNames || 'Không có'}) - Cập nhật lúc ${r.timestamp || r.date}\n`;
        });
        return text;
      } else {
        return `📋 Ngày **${todayStr}**: **Chưa có dữ liệu điểm danh**. Hãy chuyển qua tab **Điểm Danh** để thực hiện điểm danh cho các lớp!`;
      }
    }

    // Standard welcome / help response
    return `🤖 **Trợ Lý Hướng Dương xin chào!**
Tôi có thể hỗ trợ bạn:
1. **Tra cứu điểm danh theo tuần (Thứ Hai - Thứ Bảy):** Nhập tên bé (Ví dụ: *"Tra cứu bé Minh Nhật"*) hoặc *"Điểm danh tuần này"*.
2. **Xử lý chính xác dữ liệu:** Liệt kê đầy đủ 6 ngày từ Thứ Hai đến Thứ Bảy, ngày nào không có bản ghi sẽ hiển thị *"Chưa có dữ liệu điểm danh"*.
3. **Tra cứu sĩ số & phụ huynh:** Nhập *"Sĩ số các lớp"* hoặc *"SĐT phụ huynh bé An Vy"*.

Hãy gửi câu hỏi của bạn bên dưới!`;
  }

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
