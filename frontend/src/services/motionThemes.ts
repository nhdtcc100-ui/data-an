// ==============================================================================
// motionThemes.ts - محرك أنماط واجهات المستخدم العشرة (UI Design Styles)
// والثيمات الحركية المتقدمة للرسوم البيانية (ECharts) وجداول البيانات (Data Tables)
// ==============================================================================

import * as echarts from 'echarts';

export type MotionThemeId =
  // ── 10 الأنماط الأساسية لتصميم واجهات المستخدم (UI Design Styles) ──
  | 'skeuomorphism'      // 01. السكيومورفزم (محاكاة العناصر الحقيقية والمواد ثلاثية الأبعاد)
  | 'neumorphism'        // 02. النيومورفزم (بروز ناعم من الخلفية بظلال خفيفة مزدوجة)
  | 'glassmorphism'      // 03. الجلاس مورفزم (طبقات زجاجية شفافة وضبابية كرستالية)
  | 'claymorphism'       // 04. الكلاي مورفزم (صلصال مجسم وأشكال كبسولية منتفخة)
  | 'minimalism'         // 05. المينيماليزم البارز (تصميم بسيط ونظيف بأقل عناصر ممكنة)
  | 'maximalism'         // 06. الماكسيماليزم (ألوان قوية صاخبة وتفاصيل غنية مشبعة)
  | 'brutalism'          // 07. البروتاليزم (أسلوب جريء وخشن بحدود وظلال هندسية حادة)
  | 'liquid-glass'       // 08. الزجاج السائل (واجهات زجاجية سائلة ولامعة تفاعلية)
  | 'bento-grid'         // 09. البينتو جرايد (تقسيم بطاقات ومربعات Bento Box منظمة)
  | 'spatial-ui'         // 10. السباتيشل ثلاثي الأبعاد (واجهات الواقع المعزز والافتراضي VisionOS)
  // ── ثيمات التنقل الحركي المكملة ──
  | 'cyber-neon'         // نيون سيبراني داكن
  | 'glass-capsule'      // الكبسولة الزجاجية
  | 'liquid-floating'    // العائم السائل
  | 'minimal-luxury'     // الفخامة الذهبية
  | 'matrix-holo'        // الهولوغرام الرقمي
  | 'orbit-cosmic'       // المداري الكوني
  | 'segmented-dynamic'  // الديناميكي المقسم
  | 'magnetic-dock'      // المغناطيسي التقني
  | 'morphing-blob'      // الكتلة السائلة
  | 'layered-card';      // البطاقات ذات الطبقات

export type ThemeCategory = 'all' | 'ui-styles' | '3d' | 'glass' | 'clean' | 'bold';

export interface MotionThemeConfig {
  id: MotionThemeId;
  nameAr: string;
  nameEn: string;
  category: ThemeCategory;
  categoryAr: string;
  tagline: string;
  icon: string;
  previewColors: string[];
  chartColors: string[];
  animation: {
    duration: number;
    easing: string;
    delayStep: number;
  };
  cardWrapperClass: string;
  badgeStyle: {
    bg: string;
    border: string;
    text: string;
    glow: string;
  };
  tableTheme: {
    headerBg: string;
    headerTextColor: string;
    headerBorderColor: string;
    rowHoverBg: string;
    selectedRowBg: string;
    selectedBorder: string;
    numHighlightColor: string;
  };
}

export const MOTION_THEMES: MotionThemeConfig[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. السكيومورفزم (Skeuomorphism) - محاكاة العناصر والأشكال الحقيقية
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'skeuomorphism',
    nameAr: 'السكيومورفزم',
    nameEn: 'Skeuomorphism',
    category: '3d',
    categoryAr: 'محاكاة واقعية',
    tagline: 'محاكاة المواد والأزرار الحقيقية ببروز مجسم، ملمس كلاسيكي، تدرجات معدنية وظلال واقعية ملموسة',
    icon: '📻',
    previewColors: ['#d97706', '#94a3b8', '#0284c7', '#10b981'],
    chartColors: ['#d97706', '#94a3b8', '#0284c7', '#10b981', '#b45309', '#475569', '#3b82f6'],
    animation: {
      duration: 2100,
      easing: 'bounceOut',
      delayStep: 75
    },
    cardWrapperClass: 'theme-skeuomorphism rounded-2xl border-2 transition-all duration-300',
    badgeStyle: {
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      glow: 'shadow-[0_2px_8px_rgba(217,119,6,0.4)]'
    },
    tableTheme: {
      headerBg: 'linear-gradient(180deg, rgba(51,65,85,0.7), rgba(15,23,42,0.85))',
      headerTextColor: '#e2e8f0',
      headerBorderColor: 'rgba(71,85,105,0.6)',
      rowHoverBg: 'rgba(217,119,6,0.08)',
      selectedRowBg: 'linear-gradient(90deg, rgba(217,119,6,0.22), rgba(15,23,42,0.6))',
      selectedBorder: '#d97706',
      numHighlightColor: '#fbbf24'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. النيومورفزم (Neumorphism) - عناصر ناعمة بارزة بظلال خفيفة
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'neumorphism',
    nameAr: 'النيومورفزم',
    nameEn: 'Neumorphism',
    category: '3d',
    categoryAr: 'بروز ناعم',
    tagline: 'عناصر ناعمة بارزة ومنبثقة من الخلفية بظلال مزدوجة خفيفة وانسيابية (Soft UI)',
    icon: '🔘',
    previewColors: ['#60a5fa', '#818cf8', '#34d399', '#f472b6'],
    chartColors: ['#60a5fa', '#818cf8', '#34d399', '#f472b6', '#a78bfa', '#38bdf8', '#fbbf24'],
    animation: {
      duration: 1900,
      easing: 'cubicOut',
      delayStep: 60
    },
    cardWrapperClass: 'theme-neumorphism rounded-3xl transition-all duration-300',
    badgeStyle: {
      bg: 'bg-blue-500/15',
      border: 'border-blue-400/30',
      text: 'text-blue-200',
      glow: 'shadow-[0_0_10px_rgba(96,165,250,0.3)]'
    },
    tableTheme: {
      headerBg: 'rgba(15, 23, 42, 0.9)',
      headerTextColor: '#93c5fd',
      headerBorderColor: 'rgba(30, 41, 59, 0.8)',
      rowHoverBg: 'rgba(96, 165, 250, 0.06)',
      selectedRowBg: 'rgba(96, 165, 250, 0.16)',
      selectedBorder: '#60a5fa',
      numHighlightColor: '#bfdbfe'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. الجلاس مورفزم (Glassmorphism) - طبقات زجاجية شفافة وضبابية
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'glassmorphism',
    nameAr: 'الجلاس مورفزم',
    nameEn: 'Glassmorphism',
    category: 'glass',
    categoryAr: 'زجاج شفاف',
    tagline: 'طبقات زجاجية شفافة بلورية مع تأثيرات الضبابية (Blurring) وانعكاسات كرستالية فخمة',
    icon: '💎',
    previewColors: ['#38bdf8', '#818cf8', '#c084fc', '#34d399'],
    chartColors: ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#f472b6', '#38bdf8', '#a78bfa'],
    animation: {
      duration: 2000,
      easing: 'quarticOut',
      delayStep: 70
    },
    cardWrapperClass: 'theme-glassmorphism rounded-2xl transition-all duration-300',
    badgeStyle: {
      bg: 'bg-sky-500/15',
      border: 'border-white/20',
      text: 'text-sky-200',
      glow: 'shadow-[0_0_12px_rgba(56,189,248,0.35)]'
    },
    tableTheme: {
      headerBg: 'rgba(255, 255, 255, 0.08)',
      headerTextColor: '#e2e8f0',
      headerBorderColor: 'rgba(255, 255, 255, 0.15)',
      rowHoverBg: 'rgba(255, 255, 255, 0.06)',
      selectedRowBg: 'linear-gradient(90deg, rgba(56,189,248,0.22), rgba(129,140,248,0.14))',
      selectedBorder: '#38bdf8',
      numHighlightColor: '#7dd3fc'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. الكلاي مورفزم (Claymorphism) - صلصال مجسم ثلاثي الأبعاد
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'claymorphism',
    nameAr: 'الكلاي مورفزم',
    nameEn: 'Claymorphism',
    category: '3d',
    categoryAr: 'صلصال مجسم',
    tagline: 'عناصر تبدو كأنها مصنوعة من الصلصال المجسم ثلاثي الأبعاد بأشكال منتفخة وظلال ناعمة مرحة',
    icon: '🧸',
    previewColors: ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981'],
    chartColors: ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'],
    animation: {
      duration: 2200,
      easing: 'elasticOut',
      delayStep: 85
    },
    cardWrapperClass: 'theme-claymorphism rounded-[28px] transition-all duration-300',
    badgeStyle: {
      bg: 'bg-purple-500/25',
      border: 'border-purple-400/40',
      text: 'text-purple-200',
      glow: 'shadow-[0_4px_12px_rgba(168,85,247,0.4)]'
    },
    tableTheme: {
      headerBg: 'rgba(139, 92, 246, 0.16)',
      headerTextColor: '#d8b4fe',
      headerBorderColor: 'rgba(139, 92, 246, 0.3)',
      rowHoverBg: 'rgba(236, 72, 153, 0.08)',
      selectedRowBg: 'linear-gradient(90deg, rgba(236,72,153,0.22), rgba(139,92,246,0.18))',
      selectedBorder: '#ec4899',
      numHighlightColor: '#f472b6'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. المينيماليزم البارز (Minimalism) - تصميم بسيط ونظيف بأقل عناصر
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'minimalism',
    nameAr: 'المينيماليزم البارز',
    nameEn: 'Minimalism',
    category: 'clean',
    categoryAr: 'بساطة ونقاء',
    tagline: 'التصميم البسيط والنظيف الذي يحتوي على أقل عناصر ممكنة مع وضوح بصري مريح (مثل أسلوب جوجل)',
    icon: '⚪',
    previewColors: ['#38bdf8', '#94a3b8', '#e2e8f0', '#0ea5e9'],
    chartColors: ['#38bdf8', '#94a3b8', '#e2e8f0', '#0ea5e9', '#64748b', '#cbd5e1'],
    animation: {
      duration: 1600,
      easing: 'cubicOut',
      delayStep: 40
    },
    cardWrapperClass: 'theme-minimalism rounded-xl transition-all duration-200',
    badgeStyle: {
      bg: 'bg-slate-800/80',
      border: 'border-slate-700',
      text: 'text-slate-200',
      glow: 'shadow-none'
    },
    tableTheme: {
      headerBg: 'rgba(15, 23, 42, 0.6)',
      headerTextColor: '#cbd5e1',
      headerBorderColor: 'rgba(51, 65, 85, 0.4)',
      rowHoverBg: 'rgba(255, 255, 255, 0.03)',
      selectedRowBg: 'rgba(56, 189, 248, 0.12)',
      selectedBorder: '#38bdf8',
      numHighlightColor: '#93c5fd'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. الماكسيماليزم (Maximalism) - ألوان قوية وتفاصيل غنية صارخة
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'maximalism',
    nameAr: 'الماكسيماليزم',
    nameEn: 'Maximalism',
    category: 'bold',
    categoryAr: 'ألوان صارخة',
    tagline: 'عكس البساطة تماماً؛ غني بالألوان القوية، التفاصيل الكثيرة، والأشكال الصارخة ذات التباين العالي',
    icon: '🎨',
    previewColors: ['#ff0055', '#00e5ff', '#ffe600', '#7928ca'],
    chartColors: ['#ff0055', '#00e5ff', '#ffe600', '#7928ca', '#00ff66', '#ff00aa', '#ffaa00'],
    animation: {
      duration: 1900,
      easing: 'bounceOut',
      delayStep: 60
    },
    cardWrapperClass: 'theme-maximalism rounded-2xl transition-all duration-300',
    badgeStyle: {
      bg: 'bg-fuchsia-500/20',
      border: 'border-fuchsia-400',
      text: 'text-fuchsia-300',
      glow: 'shadow-[0_0_15px_rgba(236,72,153,0.6)]'
    },
    tableTheme: {
      headerBg: 'rgba(236, 72, 153, 0.15)',
      headerTextColor: '#ff007f',
      headerBorderColor: 'rgba(236, 72, 153, 0.4)',
      rowHoverBg: 'rgba(0, 229, 255, 0.08)',
      selectedRowBg: 'linear-gradient(90deg, rgba(255,0,85,0.25), rgba(0,229,255,0.18))',
      selectedBorder: '#ff0055',
      numHighlightColor: '#00e5ff'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7. البروتاليزم (Brutalism) - ستايل جريء وخشن بحدود صلبة
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'brutalism',
    nameAr: 'البروتاليزم',
    nameEn: 'Brutalism',
    category: 'bold',
    categoryAr: 'جريء وخشن',
    tagline: 'ستايل جريء، خشن، وغير مهتم بالزخرفة؛ يعتمد على حدود صلبة سميكة، ظلال حادة وعشوائية تقنية منظمة',
    icon: '⚡',
    previewColors: ['#facc15', '#38bdf8', '#f43f5e', '#4ade80'],
    chartColors: ['#facc15', '#38bdf8', '#f43f5e', '#4ade80', '#a855f7', '#fb923c', '#e11d48'],
    animation: {
      duration: 1700,
      easing: 'quarticIn',
      delayStep: 50
    },
    cardWrapperClass: 'theme-brutalism transition-all duration-200',
    badgeStyle: {
      bg: 'bg-yellow-400 text-black',
      border: 'border-2 border-black dark:border-white',
      text: 'text-black font-black',
      glow: 'shadow-[2px_2px_0px_#000]'
    },
    tableTheme: {
      headerBg: 'rgba(250, 204, 21, 0.2)',
      headerTextColor: '#facc15',
      headerBorderColor: '#38bdf8',
      rowHoverBg: 'rgba(56, 189, 248, 0.1)',
      selectedRowBg: 'rgba(250, 204, 21, 0.25)',
      selectedBorder: '#facc15',
      numHighlightColor: '#facc15'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8. الزجاج السائل (Liquid Glass) - واجهات زجاجية سائلة ولامعة
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'liquid-glass',
    nameAr: 'الزجاج السائل',
    nameEn: 'Liquid Glass',
    category: 'glass',
    categoryAr: 'زجاج سائل',
    tagline: 'واجهات زجاجية سائلة ولامعة تتفاعل مع المستخدم بحركات انسيابية متدفقة (أسلوب أبل ومايكروسوفت الشائع)',
    icon: '🌊',
    previewColors: ['#06b6d4', '#3b82f6', '#6366f1', '#10b981'],
    chartColors: ['#06b6d4', '#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9'],
    animation: {
      duration: 2200,
      easing: 'cubicInOut',
      delayStep: 80
    },
    cardWrapperClass: 'theme-liquid-glass rounded-2xl transition-all duration-300',
    badgeStyle: {
      bg: 'bg-cyan-500/20',
      border: 'border-cyan-400/40',
      text: 'text-cyan-200',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.45)]'
    },
    tableTheme: {
      headerBg: 'rgba(6, 182, 212, 0.12)',
      headerTextColor: '#38bdf8',
      headerBorderColor: 'rgba(6, 182, 212, 0.28)',
      rowHoverBg: 'rgba(6, 182, 212, 0.08)',
      selectedRowBg: 'linear-gradient(90deg, rgba(6,182,212,0.28), rgba(59,130,246,0.18))',
      selectedBorder: '#06b6d4',
      numHighlightColor: '#22d3ee'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9. البينتو جرايد (Bento Grid) - تقسيم بطاقات ومربعات Bento منظمة
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'bento-grid',
    nameAr: 'البينتو جرايد',
    nameEn: 'Bento Grid',
    category: 'clean',
    categoryAr: 'صناديق منظمة',
    tagline: 'تقسيم المحتوى إلى بطاقات أو مربعات (Bento Cards) متناسقة وسهلة التصفح بصرياً (تستخدمها أبل بكثرة)',
    icon: '🍱',
    previewColors: ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b'],
    chartColors: ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#14b8a6'],
    animation: {
      duration: 1900,
      easing: 'cubicOut',
      delayStep: 60
    },
    cardWrapperClass: 'theme-bento-grid rounded-3xl transition-all duration-300',
    badgeStyle: {
      bg: 'bg-sky-500/15',
      border: 'border-slate-600/70',
      text: 'text-sky-300',
      glow: 'shadow-[0_2px_8px_rgba(2,132,199,0.3)]'
    },
    tableTheme: {
      headerBg: 'rgba(30, 41, 59, 0.7)',
      headerTextColor: '#e2e8f0',
      headerBorderColor: 'rgba(71, 85, 105, 0.5)',
      rowHoverBg: 'rgba(51, 65, 85, 0.4)',
      selectedRowBg: 'rgba(2, 132, 199, 0.2)',
      selectedBorder: '#0284c7',
      numHighlightColor: '#38bdf8'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 10. السباتيشل ثلاثي الأبعاد (Spatial UI) - واجهات الواقع المعزز والافتراضي
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'spatial-ui',
    nameAr: 'السباتيشل ثلاثي الأبعاد',
    nameEn: 'Spatial UI',
    category: '3d',
    categoryAr: 'واقع معزز',
    tagline: 'واجهات مصممة خصيصاً للواقع المعزز (AR) والواقع الافتراضي (VR) لتناسب المساحات ثلاثية الأبعاد العائمة',
    icon: '🥽',
    previewColors: ['#818cf8', '#c084fc', '#38bdf8', '#34d399'],
    chartColors: ['#818cf8', '#c084fc', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#60a5fa'],
    animation: {
      duration: 2400,
      easing: 'exponentialOut',
      delayStep: 90
    },
    cardWrapperClass: 'theme-spatial-ui rounded-3xl transition-all duration-300',
    badgeStyle: {
      bg: 'bg-indigo-500/20',
      border: 'border-purple-400/40',
      text: 'text-indigo-200',
      glow: 'shadow-[0_0_20px_rgba(129,140,248,0.5)]'
    },
    tableTheme: {
      headerBg: 'rgba(129, 140, 248, 0.14)',
      headerTextColor: '#c7d2fe',
      headerBorderColor: 'rgba(167, 139, 250, 0.3)',
      rowHoverBg: 'rgba(192, 132, 252, 0.08)',
      selectedRowBg: 'linear-gradient(90deg, rgba(129,140,248,0.25), rgba(192,132,252,0.18))',
      selectedBorder: '#818cf8',
      numHighlightColor: '#a5b4fc'
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // أنماط مكملة (التوافق مع المشاريع السابقة)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'cyber-neon',
    nameAr: 'نيون سيبراني داكن',
    nameEn: 'Cyber Neon',
    category: 'bold',
    categoryAr: 'نيون داكن',
    tagline: 'ألوان نيون كهربائية متوهجة مع تأثير توهج ليزري على حواف الجداول والرسوم',
    icon: '⚡',
    previewColors: ['#00f3ff', '#ff007f', '#ffe600', '#39ff14'],
    chartColors: ['#00f3ff', '#ff007f', '#ffe600', '#39ff14', '#b026ff', '#00e5ff'],
    animation: {
      duration: 1900,
      easing: 'cubicOut',
      delayStep: 60
    },
    cardWrapperClass: 'theme-cyber-neon bg-slate-950 border border-cyan-400/50 rounded-xl shadow-[0_0_20px_rgba(0,243,255,0.18)] transition-all duration-300',
    badgeStyle: {
      bg: 'bg-cyan-500/20',
      border: 'border-cyan-400',
      text: 'text-cyan-300',
      glow: 'shadow-[0_0_15px_rgba(0,243,255,0.6)]'
    },
    tableTheme: {
      headerBg: 'rgba(0, 243, 255, 0.1)',
      headerTextColor: '#00f3ff',
      headerBorderColor: 'rgba(0, 243, 255, 0.35)',
      rowHoverBg: 'rgba(0, 243, 255, 0.07)',
      selectedRowBg: 'linear-gradient(90deg, rgba(0,243,255,0.28), rgba(255,0,127,0.15))',
      selectedBorder: '#00f3ff',
      numHighlightColor: '#00f3ff'
    }
  },

  {
    id: 'glass-capsule',
    nameAr: 'الكبسولة الزجاجية',
    nameEn: 'Glass Capsule',
    category: 'glass',
    categoryAr: 'زجاجي ناصع',
    tagline: 'تصميم زجاجي بلوري شفاف مع ضبابية وانعكاسات كرستالية فخمة',
    icon: '💎',
    previewColors: ['#38bdf8', '#818cf8', '#c084fc', '#34d399'],
    chartColors: ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#f472b6', '#38bdf8'],
    animation: {
      duration: 2000,
      easing: 'quarticOut',
      delayStep: 70
    },
    cardWrapperClass: 'theme-glass-capsule backdrop-blur-2xl bg-slate-900/60 border border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300',
    badgeStyle: {
      bg: 'bg-indigo-500/15',
      border: 'border-indigo-400/30',
      text: 'text-indigo-200',
      glow: 'shadow-[0_0_12px_rgba(129,140,248,0.35)]'
    },
    tableTheme: {
      headerBg: 'rgba(255, 255, 255, 0.06)',
      headerTextColor: '#e2e8f0',
      headerBorderColor: 'rgba(255, 255, 255, 0.12)',
      rowHoverBg: 'rgba(255, 255, 255, 0.05)',
      selectedRowBg: 'linear-gradient(90deg, rgba(129,140,248,0.22), rgba(192,132,252,0.12))',
      selectedBorder: '#818cf8',
      numHighlightColor: '#a5b4fc'
    }
  },

  {
    id: 'minimal-luxury',
    nameAr: 'الفخامة الذهبية',
    nameEn: 'Minimal Luxury',
    category: 'clean',
    categoryAr: 'ملكي فاخر',
    tagline: 'خلفيات ملكية داكنة مع تدرجات ذهبية دافئة وبريق هادئ للأرقام والحدود',
    icon: '👑',
    previewColors: ['#d4af37', '#f59e0b', '#fbbf24', '#b45309'],
    chartColors: ['#d4af37', '#f59e0b', '#fbbf24', '#b45309', '#fde68a', '#92400e'],
    animation: {
      duration: 2000,
      easing: 'quarticOut',
      delayStep: 70
    },
    cardWrapperClass: 'theme-minimal-luxury bg-stone-950 border border-amber-500/30 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-300',
    badgeStyle: {
      bg: 'bg-amber-500/15',
      border: 'border-amber-400/30',
      text: 'text-amber-300',
      glow: 'shadow-[0_0_12px_rgba(212,175,55,0.4)]'
    },
    tableTheme: {
      headerBg: 'rgba(212, 175, 55, 0.12)',
      headerTextColor: '#fde68a',
      headerBorderColor: 'rgba(212, 175, 55, 0.3)',
      rowHoverBg: 'rgba(212, 175, 55, 0.06)',
      selectedRowBg: 'linear-gradient(90deg, rgba(212,175,55,0.22), rgba(180,83,9,0.12))',
      selectedBorder: '#d4af37',
      numHighlightColor: '#fef08a'
    }
  },

  {
    id: 'liquid-floating',
    nameAr: 'العائم السائل',
    nameEn: 'Liquid Floating',
    category: 'glass',
    categoryAr: 'حركي سائل',
    tagline: 'منحنيات سائلة عائمة مع تدرجات لونية انسيابية وظلال ناعمة',
    icon: '🌊',
    previewColors: ['#06b6d4', '#3b82f6', '#6366f1', '#10b981'],
    chartColors: ['#06b6d4', '#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ec4899'],
    animation: {
      duration: 2200,
      easing: 'cubicInOut',
      delayStep: 80
    },
    cardWrapperClass: 'theme-liquid-floating backdrop-blur-md bg-slate-900/85 border border-cyan-500/30 rounded-2xl shadow-[0_12px_32px_rgba(6,182,212,0.12)] transition-all duration-300',
    badgeStyle: {
      bg: 'bg-cyan-500/15',
      border: 'border-cyan-500/30',
      text: 'text-cyan-300',
      glow: 'shadow-[0_0_12px_rgba(6,182,212,0.4)]'
    },
    tableTheme: {
      headerBg: 'rgba(6, 182, 212, 0.12)',
      headerTextColor: '#38bdf8',
      headerBorderColor: 'rgba(6, 182, 212, 0.25)',
      rowHoverBg: 'rgba(6, 182, 212, 0.08)',
      selectedRowBg: 'linear-gradient(90deg, rgba(6,182,212,0.25), rgba(59,130,246,0.15))',
      selectedBorder: '#06b6d4',
      numHighlightColor: '#22d3ee'
    }
  },

  {
    id: 'orbit-cosmic',
    nameAr: 'المداري الكوني',
    nameEn: 'Orbit Cosmic',
    category: '3d',
    categoryAr: 'كوني مداري',
    tagline: 'مسارات دائرية كوكبية مع إشعاع سديمي وحركة دورانية فلكية',
    icon: '🪐',
    previewColors: ['#8b5cf6', '#6366f1', '#ec4899', '#06b6d4'],
    chartColors: ['#8b5cf6', '#6366f1', '#ec4899', '#06b6d4', '#fbbf24', '#14b8a6'],
    animation: {
      duration: 2400,
      easing: 'circularOut',
      delayStep: 90
    },
    cardWrapperClass: 'theme-orbit-cosmic bg-slate-950 border border-purple-500/30 rounded-2xl shadow-[0_0_25px_rgba(139,92,246,0.15)] transition-all duration-300',
    badgeStyle: {
      bg: 'bg-purple-500/20',
      border: 'border-purple-400/40',
      text: 'text-purple-200',
      glow: 'shadow-[0_0_14px_rgba(139,92,246,0.4)]'
    },
    tableTheme: {
      headerBg: 'rgba(139, 92, 246, 0.14)',
      headerTextColor: '#c4b5fd',
      headerBorderColor: 'rgba(139, 92, 246, 0.3)',
      rowHoverBg: 'rgba(139, 92, 246, 0.08)',
      selectedRowBg: 'rgba(139, 92, 246, 0.22)',
      selectedBorder: '#8b5cf6',
      numHighlightColor: '#a78bfa'
    }
  }
];

export function getMotionTheme(id?: MotionThemeId | string): MotionThemeConfig {
  if (!id) return MOTION_THEMES[2]; // Default to Glassmorphism
  const found = MOTION_THEMES.find((t) => t.id === id);
  if (found) return found;

  // Fallbacks for legacy theme IDs
  if (id === 'matrix-holo') return MOTION_THEMES.find((t) => t.id === 'cyber-neon') || MOTION_THEMES[2];
  if (id === 'magnetic-dock') return MOTION_THEMES.find((t) => t.id === 'neumorphism') || MOTION_THEMES[1];
  if (id === 'segmented-dynamic') return MOTION_THEMES.find((t) => t.id === 'bento-grid') || MOTION_THEMES[8];
  if (id === 'morphing-blob') return MOTION_THEMES.find((t) => t.id === 'claymorphism') || MOTION_THEMES[3];
  if (id === 'layered-card') return MOTION_THEMES.find((t) => t.id === 'spatial-ui') || MOTION_THEMES[9];

  return MOTION_THEMES[2]; // default Glassmorphism
}

/**
 * دالة تعزيز وتحسين خيارات ECharts بالثيم الحركي المختار:
 * تدمج الرسوم المتحركة، التدرجات الضوئية، ظلال النيون، وألوان السلسلة
 */
export function applyMotionThemeToECharts(
  options: echarts.EChartsOption,
  themeId: MotionThemeId | string
): echarts.EChartsOption {
  if (!options) return options;
  const theme = getMotionTheme(themeId);
  const colors = theme.chartColors;

  const enriched: any = {
    ...options,
    color: colors,
    animation: true,
    animationDuration: theme.animation.duration,
    animationEasing: theme.animation.easing,
    animationDelay: (idx: number) => idx * theme.animation.delayStep,
    animationDurationUpdate: 1000,
    animationEasingUpdate: 'cubicOut'
  };

  // Enhance Tooltip
  if (enriched.tooltip) {
    const isNeon = theme.id === 'cyber-neon' || theme.id === 'maximalism';
    const isLuxury = theme.id === 'minimal-luxury' || theme.id === 'skeuomorphism';
    const isBrutal = theme.id === 'brutalism';
    enriched.tooltip = {
      ...enriched.tooltip,
      backgroundColor: isBrutal ? '#000000' : isNeon ? 'rgba(5, 10, 20, 0.94)' : isLuxury ? 'rgba(10, 10, 10, 0.95)' : 'rgba(15, 23, 42, 0.9)',
      borderColor: theme.tableTheme.selectedBorder,
      borderWidth: isBrutal ? 2.5 : 1.5,
      textStyle: {
        color: '#ffffff',
        fontFamily: 'Tajawal, sans-serif'
      },
      extraCssText: isBrutal
        ? 'box-shadow: 4px 4px 0px #38bdf8; border-radius: 4px;'
        : `backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 16px ${theme.badgeStyle.glow}; border-radius: 14px;`
    };
  }

  // Enhance Series with theme-specific glow, gradients and shapes
  if (Array.isArray(enriched.series)) {
    enriched.series = enriched.series.map((s: any, sIdx: number) => {
      const primaryColor = colors[sIdx % colors.length];

      // Lines & Areas
      if (s.type === 'line' || s.type === 'area') {
        const hasGlow =
          theme.id === 'cyber-neon' ||
          theme.id === 'maximalism' ||
          theme.id === 'liquid-glass' ||
          theme.id === 'spatial-ui' ||
          theme.id === 'glassmorphism' ||
          theme.id === 'orbit-cosmic';

        return {
          ...s,
          lineStyle: {
            width: theme.id === 'brutalism' ? 4 : 3.2,
            color: primaryColor,
            shadowColor: hasGlow ? primaryColor : 'transparent',
            shadowBlur: hasGlow ? 15 : 0,
            ...(s.lineStyle || {})
          },
          itemStyle: {
            color: primaryColor,
            borderColor: theme.id === 'brutalism' ? '#000' : '#fff',
            borderWidth: theme.id === 'brutalism' ? 2 : 1.5,
            shadowColor: hasGlow ? primaryColor : 'transparent',
            shadowBlur: hasGlow ? 8 : 0,
            ...(s.itemStyle || {})
          },
          areaStyle: s.areaStyle
            ? {
                color:
                  theme.id === 'brutalism'
                    ? hexToRgba(primaryColor, 0.35)
                    : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: hexToRgba(primaryColor, 0.5) },
                        { offset: 1, color: hexToRgba(primaryColor, 0.02) }
                      ])
              }
            : undefined
        };
      }

      // Bar Chart: theme border radius and gradients
      if (s.type === 'bar') {
        let radius: any = [6, 6, 0, 0];
        if (theme.id === 'claymorphism') radius = [16, 16, 8, 8];
        else if (theme.id === 'brutalism') radius = [0, 0, 0, 0];
        else if (theme.id === 'bento-grid' || theme.id === 'spatial-ui') radius = [10, 10, 4, 4];
        else if (theme.id === 'liquid-glass' || theme.id === 'liquid-floating') radius = [10, 10, 0, 0];

        return {
          ...s,
          itemStyle: {
            borderRadius: radius,
            borderColor: theme.id === 'brutalism' ? '#000000' : undefined,
            borderWidth: theme.id === 'brutalism' ? 2 : 0,
            color:
              theme.id === 'brutalism'
                ? primaryColor
                : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: primaryColor },
                    { offset: 1, color: hexToRgba(primaryColor, 0.65) }
                  ]),
            shadowColor:
              theme.id === 'cyber-neon' || theme.id === 'maximalism'
                ? primaryColor
                : theme.id === 'brutalism'
                ? '#000'
                : 'transparent',
            shadowBlur:
              theme.id === 'cyber-neon' || theme.id === 'maximalism'
                ? 14
                : 0,
            ...(s.itemStyle || {})
          }
        };
      }

      // Pie & Donut
      if (s.type === 'pie') {
        return {
          ...s,
          itemStyle: {
            borderRadius: theme.id === 'claymorphism' ? 12 : theme.id === 'brutalism' ? 0 : 6,
            borderColor: theme.id === 'brutalism' ? '#000000' : '#0f172a',
            borderWidth: theme.id === 'brutalism' ? 3 : 2,
            ...(s.itemStyle || {})
          }
        };
      }

      return s;
    });
  }

  return enriched;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(56, 189, 248, ${alpha})`;
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
