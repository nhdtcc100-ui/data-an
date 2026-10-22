# دليل المنصة التحليلية الشامل (Analytics Platform - Frontend Documentation)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Apache ECharts](https://img.shields.io/badge/Apache_ECharts-5.5-e43961.svg)](https://echarts.apache.org/)

---

## 📌 نبذة عن الواجهة الأمامية

واجهة تحليلات بيانات تفاعلية سحابية مبنية على **React 19** و **TypeScript** و **Tailwind CSS v4** و **Apache ECharts**، تحاكي تجربة **Power BI** في بناء اللوحات وسحب الحقول وتطبيق التصفية المتقاطعة، مع سلاسة التضمين والمشاركة العامة المشابهة لـ **Looker Studio**.

---

## 🛠️ مكونات الواجهة الرئيسية

* **`DashboardCanvas.tsx`**: شبكة مرنة من 12 عموداً تسمح بالسحب وتغيير الحجم (`react-grid-layout`).
* **`EChartWrapper.tsx`**: مغلّف عالي الأداء لـ Apache ECharts مع دعم التكبير، التمرير، وإطلاق أحداث التصفية المتقاطعة (Cross-filtering).
* **`VisualizationsPanel.tsx`**: لوحة اختيار نوع المخطط (أعمدة، خطوط، مساحات، دوائر، مؤشرات أداء KPI، جداول محورية، وفلاتر).
* **`DataPanel.tsx`**: لوحة استعراض الأعمدة ومطابقة أنواع الحقول وسحبها إلى المحاور والمقاييس.
* **`SlicerWidget.tsx`**: فلاتر تفاعلية ترسل تأثيراتها لحظياً لكافة الرسوم البيانية في اللوحة.
* **`ShareModal.tsx`**: نافذة توليد روابط المشاركة العامة، حماية كلمة السر، ونسخ كود التضمين `<iframe>`.
* **`PublicReportViewer.tsx`**: وضع المشاهدة العامة الخفيف والمستقل للقراءة فقط.
* **`WorkspaceList.tsx`**: إدارة وتصفح مساحات العمل واللوحات المحفوظة.

---

## 🚀 التشغيل السريع للواجهة الأمامية

```bash
# تثبيت الاعتماديات
npm install

# تشغيل خادم التطوير
npm run dev

# بناء النسخة الإنتاجية
npm run build
```

> **الرابط المحلي المباشر:** `http://localhost:5173`
