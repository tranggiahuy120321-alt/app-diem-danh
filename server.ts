import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API endpoint for AI Assistant Chat
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history, contextData } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ success: false, error: "Nội dung tin nhắn không hợp lệ." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "Chưa cấu hình GEMINI_API_KEY trong môi trường server."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let systemInstruction = `Bạn là Trợ lý AI thông minh chuyên nghiệp của Trường Mầm non Hướng Dương 2 (Hotline: 0795.497.309).
Nhiệm vụ của bạn là hỗ trợ giáo viên và nhà trường tra cứu thông tin điểm danh, danh sách học sinh, thống kê số buổi đi học/vắng học, thông tin phụ huynh và giải đáp thắc mắc chuyên môn.
Phong cách trả lời: Thân thiện, lịch sự, chính xác, ngắn gọn, mạch lạc, bằng tiếng Việt.
Khi trả lời thống kê hoặc thông tin học sinh, hãy dùng định dạng rõ ràng (sử dụng gạch đầu dòng, in đậm tên học sinh, số liệu cụ thể).`;

      if (contextData) {
        systemInstruction += `\n\nDỮ LIỆU ĐIỂM DANH VÀ HỌC SINH THỰC TẾ TRÊN HỆ THỐNG:\n${JSON.stringify(contextData, null, 2)}`;
      }

      const contents: any[] = [];
      if (Array.isArray(history)) {
        for (const item of history) {
          if (item.role && item.text) {
            contents.push({
              role: item.role === 'user' ? 'user' : 'model',
              parts: [{ text: item.text }]
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
        }
      });

      const replyText = response.text || "Rất tiếc, tôi chưa thể trả lời lúc này. Vui lòng thử lại.";

      return res.json({
        success: true,
        reply: replyText
      });

    } catch (err: any) {
      console.error("Lỗi AI Chat API:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Đã xảy ra lỗi khi kết nối tới Trợ lý AI."
      });
    }
  });

  // Vite middleware for dev / static serving for prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
