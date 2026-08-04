// Local smart rule-based analyzer for client-side fallback when API server is unreachable or returns 404

export function generateLocalSmartResponse(promptStr: string, students: any[] = [], history: any[] = []): string {
  const q = promptStr.toLowerCase().trim();

  const removeAccents = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  const normQ = removeAccents(q);

  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth() + 1;
  const todayYear = now.getFullYear();
  const todayFormattedVi = `${todayDay.toString().padStart(2, '0')}/${todayMonth.toString().padStart(2, '0')}/${todayYear}`;
  const todayFormattedViShort = `${todayDay}/${todayMonth}/${todayYear}`;
  const todayFormattedISO = `${todayYear}-${todayMonth.toString().padStart(2, '0')}-${todayDay.toString().padStart(2, '0')}`;

  const todayTarget = {
    year: todayYear,
    month: todayMonth,
    day: todayDay,
    dateVi: todayFormattedVi,
    dateViShort: todayFormattedViShort,
    dateISO: todayFormattedISO,
  };

  // Helper to extract date from user prompt string (e.g. 27/07/2026, 27/07, 27-07-2026, 04/08/2026)
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

  // Helper functions for Monday to Saturday week calculation (6 days, excluding Sunday)
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
    // 1. Try class-specific match first
    if (className) {
      const match = history.find((rec) =>
        isRecordForTargetDate(rec, {
          year: targetDay.dateObj.getFullYear(),
          month: targetDay.dateObj.getMonth() + 1,
          day: targetDay.dateObj.getDate(),
          dateVi: targetDay.dateVi,
          dateViShort: targetDay.dateViShort,
          dateISO: targetDay.dateISO,
        }, className)
      );
      if (match) return match;
    }

    // 2. Fallback to any class record for that day
    return history.find((rec) => {
      return isRecordForTargetDate(rec, {
        year: targetDay.dateObj.getFullYear(),
        month: targetDay.dateObj.getMonth() + 1,
        day: targetDay.dateObj.getDate(),
        dateVi: targetDay.dateVi,
        dateViShort: targetDay.dateViShort,
        dateISO: targetDay.dateISO,
      });
    });
  };

  // 0. Kiểm tra truy vấn Thống kê nghỉ học hôm nay / điểm danh hôm nay / danh sách vắng hôm nay
  const isTodayQuery =
    normQ.includes('thong ke nghi hoc hom nay') ||
    normQ.includes('thong ke nghi hoc') ||
    normQ.includes('nghi hoc hom nay') ||
    normQ.includes('vang hom nay') ||
    normQ.includes('vang mat hom nay') ||
    normQ.includes('ai nghi hom nay') ||
    normQ.includes('danh sach vang hom nay') ||
    normQ.includes('diem danh hom nay') ||
    (normQ.includes('thong ke') && (normQ.includes('nghi') || normQ.includes('vang'))) ||
    (normQ.includes('hom nay') && (normQ.includes('nghi') || normQ.includes('vang') || normQ.includes('diem danh')));

  if (isTodayQuery) {
    const todayRecords = history.filter((rec) => isRecordForTargetDate(rec, todayTarget));

    if (todayRecords.length > 0) {
      let detailsText = `📋 **Thống kê nghỉ học hôm nay (${todayFormattedVi}):**\n\n`;
      let totalAbsent = 0;

      todayRecords.forEach((r) => {
        const cName = r.className || r.Lop || r.lop || 'Lớp';
        const absentNames = String(r.absentNames || r.danhsachvang || r.DanhSachVang || '').trim();
        const updateTime = r.timestamp || r.NgayDiemDanh || r.date || 'Hôm nay';

        if (absentNames && absentNames.toLowerCase() !== 'không có' && absentNames.toLowerCase() !== 'none') {
          detailsText += `• **${cName}**: Vắng (**${absentNames}**) — *Cập nhật lúc ${updateTime}*\n`;
          const count = absentNames.split(',').filter(s => s.trim().length > 0).length;
          totalAbsent += count;
        } else {
          detailsText += `• **${cName}**: ✅ Đi học đầy đủ (Không có học sinh vắng)\n`;
        }
      });

      detailsText += `\n📊 **Tổng kết hôm nay:** ${totalAbsent > 0 ? `Có **${totalAbsent}** bé vắng mặt.` : 'Tất cả các lớp đi học đầy đủ!'}`;
      return detailsText;
    } else {
      return `📋 **Thống kê nghỉ học hôm nay (${todayFormattedVi}):**\n\nChưa có dữ liệu điểm danh nào được ghi nhận cho ngày hôm nay (${todayFormattedVi}).\n\n*(Bạn có thể chuyển qua tab **Điểm Danh** để thực hiện điểm danh cho các lớp!)*`;
    }
  }

  // 1. Kiểm tra truy vấn theo ngày cụ thể (ví dụ: ngày 27/07/2026, 01/08/2026, 04/08/2026)
  const targetDatePrompt = extractDateFromPrompt(q);
  if (targetDatePrompt && (q.includes('ngày') || q.includes('điểm danh') || q.includes('vắng') || q.includes('nghỉ') || q.includes('báo cáo'))) {
    const recordsForDate = history.filter((rec) => isRecordForTargetDate(rec, targetDatePrompt));

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

  // 2. Hỏi theo tuần chung (ví dụ: "điểm danh tuần này", "báo cáo tuần")
  if (q.includes('tuần') || q.includes('tất cả các ngày')) {
    const weekDays = getWeekDays(new Date());
    let reportText = `📅 **Báo cáo điểm danh tuần này (Thứ Hai đến Thứ Bảy):**\n\n`;

    weekDays.forEach((wd) => {
      const recs = history.filter((r) => isRecordForTargetDate(r, wd));

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
    const lopDuoi = students.filter(s => (s.className || s.Lop || '').toLowerCase().includes('dưới')).length;
    const lopTren = students.filter(s => (s.className || s.Lop || '').toLowerCase().includes('trên')).length;

    return `📊 **Thống kê sĩ số toàn trường:**
• **Tổng số học sinh:** ${total} bé
• **Lớp dưới:** ${lopDuoi} bé
• **Lớp trên lầu:** ${lopTren} bé

*Nhấn tab **Danh Sách Học Sinh** hoặc nhập tên bé để tra cứu chi tiết.*`;
  }

  // 4. Smart Student Extraction & Weekly Attendance Matching
  // Vietnamese query stopwords that should NEVER match as a single-word student last name
  const STOPWORDS = new Set([
    'hoc', 'thong', 'nghi', 'ke', 'hom', 'nay', 'vang', 'diem', 'danh',
    'bao', 'cao', 'si', 'so', 'tuan', 'lop', 'be', 'phu', 'huynh', 'tro',
    'ly', 'ngay', 'sach', 'chua', 'co', 'mat', 'bao', 'nhieu', 'cho', 'tat',
    'ca', 'tim', 'sdt', 'so', 'dien', 'thoai'
  ]);

  let bestStudent: any = null;
  let maxScore = 0;

  for (const s of students) {
    const fullName = String(s.fullName || s.hoTen || s.Name || s.name || '').trim();
    if (!fullName) continue;

    const normFullName = removeAccents(fullName.toLowerCase());
    const parent = String(s.parentName || s.tenPhuHuynh || '').trim();
    const normParent = removeAccents(parent.toLowerCase());
    const id = String(s.id || '').trim().toLowerCase();

    let score = 0;

    // Check full name exact/substring match
    if (normFullName.length > 0 && normQ.includes(normFullName)) {
      score = 100;
    } else if (normFullName.length > 0 && normFullName.includes(normQ) && normQ.length >= 3) {
      score = 70;
    } else {
      // Check last 2 words of full name (e.g. "Gia Lâm" from "Trần Gia Lâm")
      const words = fullName.split(/\s+/);
      if (words.length >= 2) {
        const shortName = words.slice(-2).join(' ');
        const normShort = removeAccents(shortName.toLowerCase());
        if (normQ.includes(normShort)) {
          score = 90;
        }
      }
      // Check last word if length >= 2 and NOT in stopwords list
      if (score === 0 && words.length > 0) {
        const lastWord = words[words.length - 1];
        const normLast = removeAccents(lastWord.toLowerCase());
        if (normLast.length >= 2 && !STOPWORDS.has(normLast)) {
          try {
            const escapedLast = normLast.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedLast}\\b`, 'i');
            if (regex.test(normQ)) {
              score = 50;
            }
          } catch {
            if (normQ.includes(normLast)) {
              score = 50;
            }
          }
        }
      }
    }

    if (score < 50 && normParent.length >= 3 && normQ.includes(normParent)) {
      score = 40;
    }

    if (score < 50 && id.length >= 2 && normQ.includes(id)) {
      score = 40;
    }

    if (score > maxScore) {
      maxScore = score;
      bestStudent = s;
    }
  }

  // If a specific student was matched with high confidence
  if (bestStudent && maxScore >= 40) {
    const name = bestStudent.fullName || bestStudent.hoTen || bestStudent.Name || 'Học sinh';
    const cName = bestStudent.className || bestStudent.Lop || bestStudent.lop || 'Chưa rõ lớp';
    const parent = bestStudent.parentName || bestStudent.tenPhuHuynh || 'Chưa cập nhật';
    const phone = bestStudent.phone || bestStudent.soDienThoai || 'Chưa cập nhật';

    const words = name.trim().split(/\s+/);
    const shortName = words.length >= 2 ? words.slice(-2).join(' ') : name;

    // Calculate weekly attendance (Monday to Saturday - 6 days)
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
        const absentNames = String(rec.absentNames || rec.danhsachvang || rec.DanhSachVang || '');
        const normAbsent = removeAccents(absentNames.toLowerCase());
        const normFull = removeAccents(name.toLowerCase());
        const normShort = removeAccents(shortName.toLowerCase());

        // Check if student is listed as absent
        const isAbsent = normAbsent.includes(normFull) || normAbsent.includes(normShort) || (
          words.length > 0 && normAbsent.includes(removeAccents(words[words.length - 1].toLowerCase()))
        );

        if (isAbsent) {
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

  // Standard welcome / help response
  return `🤖 **Trợ Lý Hướng Dương xin chào!**
Tôi có thể hỗ trợ bạn:
1. **Thống kê nghỉ học hôm nay:** Bấm vào nút gợi ý hoặc gõ *"Thống kê nghỉ học hôm nay"* để xem danh sách vắng ngày hôm nay.
2. **Tra cứu điểm danh một bé:** Nhập tên bé (Ví dụ: *"Bé Gia Lâm tuần này có đi học không?"*).
3. **Tra cứu sĩ số & phụ huynh:** Nhập *"Sĩ số các lớp"* hoặc *"SĐT phụ huynh bé An Vy"*.

Hãy gửi câu hỏi của bạn bên dưới!`;
}
