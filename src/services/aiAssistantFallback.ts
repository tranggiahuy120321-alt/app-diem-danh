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

  // Helper to extract reference date object for week calculations from user prompt
  const extractRefDateFromPrompt = (str: string): Date | null => {
    const norm = removeAccents(str.toLowerCase());

    // 1. Look for explicit date numbers in prompt e.g. 27/07/2026 or 27/07 or 01/08
    const matches = [...str.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g)];
    if (matches.length > 0) {
      const firstMatch = matches[0];
      const day = parseInt(firstMatch[1], 10);
      const month = parseInt(firstMatch[2], 10);
      let year = firstMatch[3] ? parseInt(firstMatch[3], 10) : 2026;
      if (year < 100) year += 2000;

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, day);
      }
    }

    // 2. Look for month/period text like "cuoi thang 7", "tuan cuoi thang 7", "thang 7", "thang 07", "t7"
    if (
      norm.includes('cuoi thang 7') ||
      norm.includes('tuan cuoi thang 7') ||
      norm.includes('cuoi t7') ||
      norm.includes('thang 7') ||
      norm.includes('thang 07') ||
      norm.includes('t7')
    ) {
      return new Date(2026, 6, 27); // 27/07/2026 (July 27, 2026 - Monday of late July week)
    }

    if (
      norm.includes('cuoi thang 8') ||
      norm.includes('tuan cuoi thang 8') ||
      norm.includes('cuoi t8') ||
      norm.includes('thang 8') ||
      norm.includes('thang 08') ||
      norm.includes('t8')
    ) {
      return new Date(2026, 7, 24); // 24/08/2026
    }

    return null;
  };

  // Helper to extract all possible date objects/strings from a record object
  const extractDatesFromRecord = (rec: any) => {
    if (!rec) return [];
    const results: Array<{ day: number; month: number; year: number; dateVi: string; dateViShort: string; dateISO: string; datePart: string }> = [];

    const candidateFields = [
      rec.date,
      rec.Date,
      rec.Ngay,
      rec.ngay,
      rec.NgayDiemDanh,
      rec.ngayDiemDanh,
      rec.dateDiemDanh,
      rec['Ngày'],
      rec['Ngày điểm danh'],
      rec['Cột B'],
      rec.timestamp,
      rec.Timestamp,
      rec.created_at,
      rec.time,
      rec.Time,
    ];

    const seenKeys = new Set<string>();

    const addDate = (day: number, month: number, year: number) => {
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
    };

    for (const fieldVal of candidateFields) {
      if (!fieldVal) continue;

      if (fieldVal instanceof Date) {
        addDate(fieldVal.getDate(), fieldVal.getMonth() + 1, fieldVal.getFullYear());
        continue;
      }

      if (typeof fieldVal === 'number' && fieldVal > 1000000000000) {
        const d = new Date(fieldVal);
        if (!isNaN(d.getTime())) {
          addDate(d.getDate(), d.getMonth() + 1, d.getFullYear());
        }
        continue;
      }

      const rawStr = String(fieldVal).trim();
      if (!rawStr) continue;

      // 1. Try parsing ISO/Date strings like 2026-07-31T08:30:00.000Z or 2026-07-31 08:30:00
      if (rawStr.includes('T') || rawStr.includes('-') || rawStr.includes('/')) {
        const parsedIso = new Date(rawStr);
        if (!isNaN(parsedIso.getTime()) && parsedIso.getFullYear() >= 2000) {
          addDate(parsedIso.getDate(), parsedIso.getMonth() + 1, parsedIso.getFullYear());
        }
      }

      // 2. Extract patterns via regex: 28/07/2026, 28/7/2026, 2026-07-28, 28-07-2026, 28/07
      const matches = [...rawStr.matchAll(/(\d{1,4})[/-](\d{1,2})(?:[/-](\d{2,4}))?/g)];
      for (const match of matches) {
        let p1 = parseInt(match[1], 10);
        let p2 = parseInt(match[2], 10);
        let p3 = match[3] ? parseInt(match[3], 10) : 2026;

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

        addDate(day, month, year);
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

    const recordDates = extractDatesFromRecord(rec);
    if (recordDates.length === 0) return false;

    const dateMatches = recordDates.some((rd) => {
      return (
        (rd.year === target.year && rd.month === target.month && rd.day === target.day) ||
        (target.dateVi && (rd.dateVi === target.dateVi || rd.datePart === target.dateVi)) ||
        (target.dateViShort && (rd.dateViShort === target.dateViShort || rd.datePart === target.dateViShort)) ||
        (target.dateISO && (rd.dateISO === target.dateISO || rd.datePart === target.dateISO))
      );
    });

    if (!dateMatches) return false;

    if (className) {
      const recClass = String(rec.className || rec.Lop || rec.lop || '').trim().toLowerCase();
      const targetClass = String(className).trim().toLowerCase();
      if (recClass && targetClass && recClass !== 'tất cả' && recClass !== 'toàn trường' && targetClass !== 'tất cả') {
        const isMatch = recClass === targetClass || recClass.includes(targetClass) || targetClass.includes(recClass);
        if (!isMatch) return false;
      }
    }

    return true;
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

  const findRecordsForDay = (targetDay: { dateObj: Date; dateVi: string; dateViShort: string; dateISO: string }, className?: string) => {
    const target = {
      year: targetDay.dateObj.getFullYear(),
      month: targetDay.dateObj.getMonth() + 1,
      day: targetDay.dateObj.getDate(),
      dateVi: targetDay.dateVi,
      dateViShort: targetDay.dateViShort,
      dateISO: targetDay.dateISO,
    };

    // 1. Check all records matching date
    const dayRecords = history.filter((rec) => isRecordForTargetDate(rec, target));
    if (dayRecords.length === 0) return [];

    // 2. If a specific class is requested, require matching class records (returns [] if student's class wasn't checked in)
    if (className && className !== 'Chưa rõ lớp' && className !== 'Tất cả' && className !== 'Toàn trường') {
      const classMatches = dayRecords.filter((rec) => isRecordForTargetDate(rec, target, className));
      return classMatches;
    }

    return dayRecords;
  };

  // 0. Kiểm tra truy vấn Thống kê nghỉ học hôm nay / điểm danh hôm nay / danh sách vắng hôm nay
  const isTodayQuery =
    (normQ.includes('thong ke nghi hoc hom nay') ||
    normQ.includes('thong ke nghi hoc') ||
    normQ.includes('nghi hoc hom nay') ||
    normQ.includes('vang hom nay') ||
    normQ.includes('vang mat hom nay') ||
    normQ.includes('ai nghi hom nay') ||
    normQ.includes('danh sach vang hom nay') ||
    normQ.includes('diem danh hom nay')) &&
    !normQ.includes('be ') && !normQ.includes('hoc sinh ');

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

  // 1. Kiểm tra truy vấn theo ngày cụ thể (ví dụ: ngày 27/07/2026, 01/08/2026, 04/08/2026) khi không hỏi khoảng tuần
  const targetDatePrompt = extractDateFromPrompt(q);
  const isWeekOrRangeQuery = normQ.includes('tuan') || normQ.includes('den') || normQ.includes('tu') || normQ.includes('-') || normQ.includes('khoang');
  if (targetDatePrompt && (q.includes('ngày') || q.includes('điểm danh') || q.includes('vắng') || q.includes('nghỉ') || q.includes('báo cáo')) && !isWeekOrRangeQuery) {
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

  // 2. Tra cứu học sinh cá nhân (Ưu tiên số 1 khi người dùng nhắc tên học sinh, ví dụ: "Gia Lâm tuần cuối tháng 7", "Bé Minh Nhật", "Trần Gia Lâm")
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
    const refDate = extractRefDateFromPrompt(promptStr);
    const weekDays = getWeekDays(refDate || new Date());
    const startDateVi = weekDays[0].dateVi;
    const endDateVi = weekDays[5].dateVi;

    const weekTitle = refDate
      ? `tuần từ ${startDateVi} đến ${endDateVi}`
      : `tuần này (${startDateVi} đến ${endDateVi})`;

    let weekReportText = '';
    let absentCount = 0;
    let presentCount = 0;
    let noDataCount = 0;

    weekDays.forEach((wd) => {
      const dayRecs = findRecordsForDay(wd, cName);
      if (dayRecs.length === 0) {
        noDataCount++;
        weekReportText += `• **${wd.dayName} (${wd.dateVi}):** Chưa có dữ liệu điểm danh\n`;
      } else {
        const normFull = removeAccents(name.toLowerCase());
        const normShort = removeAccents(shortName.toLowerCase());
        const lastWord = words.length > 0 ? removeAccents(words[words.length - 1].toLowerCase()) : '';

        // Check if student is listed as absent in ANY matching record of that day
        const isAbsent = dayRecs.some((r) => {
          const absentNames = String(r.absentNames || r.danhsachvang || r.DanhSachVang || r['Danh sách vắng'] || '');
          const normAbsent = removeAccents(absentNames.toLowerCase());
          if (!normAbsent || normAbsent === 'khong co' || normAbsent === 'none' || normAbsent === '0' || normAbsent === 'khong') return false;

          return (
            normAbsent.includes(normFull) ||
            normAbsent.includes(normShort) ||
            (lastWord.length >= 2 && normAbsent.includes(lastWord))
          );
        });

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

📅 **Chi tiết điểm danh ${weekTitle}:**
${weekReportText}
📊 **Tóm tắt tuần:** Số buổi đi học: **${presentCount}/6 buổi** (${presentCount} ngày có mặt, ${absentCount} ngày vắng mặt, ${noDataCount} ngày chưa có dữ liệu điểm danh).`;
  }

  // 3. Hỏi theo tuần chung toàn trường (khi không tìm thấy học sinh cá nhân)
  if (q.includes('tuần') || q.includes('tất cả các ngày') || normQ.includes('tuan')) {
    const refDate = extractRefDateFromPrompt(promptStr);
    const weekDays = getWeekDays(refDate || new Date());
    const startDateVi = weekDays[0].dateVi;
    const endDateVi = weekDays[5].dateVi;

    const weekTitle = refDate
      ? `tuần từ ${startDateVi} đến ${endDateVi}`
      : `tuần này (${startDateVi} đến ${endDateVi})`;

    let reportText = `📅 **Báo cáo điểm danh ${weekTitle} (Thứ Hai đến Thứ Bảy):**\n\n`;

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

  // Standard welcome / help response
  return `🤖 **Trợ Lý Hướng Dương xin chào!**
Tôi có thể hỗ trợ bạn:
1. **Thống kê nghỉ học hôm nay:** Bấm vào nút gợi ý hoặc gõ *"Thống kê nghỉ học hôm nay"* để xem danh sách vắng ngày hôm nay.
2. **Tra cứu điểm danh một bé:** Nhập tên bé (Ví dụ: *"Bé Gia Lâm tuần này có đi học không?"*).
3. **Tra cứu sĩ số & phụ huynh:** Nhập *"Sĩ số các lớp"* hoặc *"SĐT phụ huynh bé An Vy"*.

Hãy gửi câu hỏi của bạn bên dưới!`;
}
