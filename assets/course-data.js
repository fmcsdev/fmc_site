// assets/course-data.js
// Single source of truth for FMC courses (used by courses.html and can be reused elsewhere)

window.FMC_COURSES = [
  // ===== Languages =====
  {
    id: "chinese",
    label: "中国語コース（Chinese Course）",
    category: "語学 / Languages",
    image: "assets/courses/chinese.jpg",
    subtitle: "発音・会話・旅行・仕事まで対応",
    desc: "発音の基礎から日常会話、旅行会話、仕事で使う表現まで。目的に合わせてカリキュラムを作ります。",
    bullets: ["発音・声調", "日常会話", "旅行会話", "HSK対策（必要に応じて）"],
    recommended: "中国語をゼロから始めたい方／旅行や仕事で使いたい方"
  },
  {
    id: "english",
    label: "英語（English Course）",
    category: "語学 / Languages",
    image: "assets/courses/english.jpg",
    subtitle: "会話／旅行／ビジネス／試験対策",
    desc: "会話力を上げたい、旅行で困らない英語がほしい、試験対策をしたい…全部OK。",
    bullets: ["スピーキング強化", "発音・リスニング", "ビジネス英語", "TOEIC/英検対策（必要に応じて）"],
    recommended: "英語を実用的に伸ばしたい方／試験対策したい方"
  },
  {
    id: "japanese",
    label: "日本語コース（Japanese Course）",
    category: "語学 / Languages",
    image: "assets/courses/japanese.jpg",
    subtitle: "会話＋JLPT/EJUも対応",
    desc: "生活・仕事で使える日本語から、JLPT/EJU対策まで。レベルに合わせて丁寧に指導します。",
    bullets: ["日常会話", "敬語・職場日本語", "JLPT対策", "EJU対策（必要に応じて）"],
    recommended: "日本で生活・就職したい方／JLPTを目指す方"
  },
  {
    id: "french",
    label: "フランス語コース（French Course）",
    category: "語学 / Languages",
    image: "assets/courses/french.jpg",
    subtitle: "基礎文法＋会話で自然に話せる",
    desc: "挨拶から会話まで。発音と基本文法を押さえて、使えるフランス語を身につけます。",
    bullets: ["発音（リエゾンなど）", "基本文法", "日常会話", "旅行会話"],
    recommended: "フランス語を趣味・旅行で始めたい方"
  },
  {
    id: "spanish",
    label: "スペイン語講座（Spanish Course）",
    category: "語学 / Languages",
    image: "assets/courses/spanish.jpg",
    subtitle: "会話中心でも、文法中心でもOK",
    desc: "スペイン語はテンポよく伸びる言語。会話で使える表現をどんどん増やします。",
    bullets: ["基本文法（最短で）", "会話ロールプレイ", "旅行で使う表現", "発音・リズム"],
    recommended: "会話を早く話せるようになりたい方／旅行や趣味で学びたい方"
  },
  {
    id: "danish",
    label: "デンマーク語コース（Danish Course）",
    category: "語学 / Languages",
    image: "assets/courses/danish.jpg",
    subtitle: "発音・聞き取りが難しい言語もサポート",
    desc: "難しく感じやすい発音や聞き取りを、ポイントを絞って練習します。",
    bullets: ["発音のコツ", "基本フレーズ", "会話練習", "リスニング強化"],
    recommended: "北欧言語に挑戦したい方／発音から整えたい方"
  },
  {
    id: "mongolian",
    label: "モンゴル語（Mongolian Course）",
    category: "語学 / Languages",
    image: "assets/courses/mongolian.jpg",
    subtitle: "基礎から会話まで",
    desc: "文字・発音・基本文型から丁寧に。目標に合わせて進めます。",
    bullets: ["発音・基本文型", "日常会話", "語彙強化", "目的別学習"],
    recommended: "珍しい言語を楽しく学びたい方"
  },
  {
    id: "arabic",
    label: "アラビア語コース（اللغة العربية）",
    category: "語学 / Languages",
    image: "assets/courses/arabic.jpg",
    subtitle: "文字・発音からOK",
    desc: "文字から始めるアラビア語。発音・読み書き・会話をバランスよく。",
    bullets: ["アラビア文字", "発音", "基本会話", "文化背景も学ぶ"],
    recommended: "文字から学びたい方／中東文化にも興味がある方"
  },

  // ===== Culture & Other =====
  {
    id: "ukulele",
    label: "ウクレレコース（Ukulele Course）",
    category: "文化・その他 / Culture & Other",
    image: "assets/courses/ukulele.jpg",
    subtitle: "初心者歓迎（基礎〜曲）",
    desc: "コードの押さえ方から、簡単な曲が弾けるまで。",
    bullets: ["基本コード", "リズム練習", "簡単な曲", "弾き語り入門（希望者）"],
    recommended: "楽器を気軽に始めたい方"
  },
  {
    id: "painting",
    label: "絵画コース（Painting Course）",
    category: "文化・その他 / Culture & Other",
    image: "assets/courses/painting.jpg",
    subtitle: "基礎〜作品づくり",
    desc: "デッサンや色の使い方など基礎からスタート。",
    bullets: ["基礎テクニック", "構図", "色彩", "作品制作"],
    recommended: "趣味で絵を始めたい方／表現したい方"
  },
  {
    id: "calligraphy",
    label: "習字・書道（Calligraphy）",
    category: "文化・その他 / Culture & Other",
    image: "assets/courses/calligraphy.jpg",
    subtitle: "基礎〜創作",
    desc: "文字を美しく書くコツから、作品づくりまで。",
    bullets: ["筆の扱い", "楷書の基礎", "バランス練習", "作品制作"],
    recommended: "日本文化を体験したい方／集中する趣味がほしい方"
  },
  {
    id: "programming",
    label: "プログラミングクラス（Programming Class）",
    category: "文化・その他 / Culture & Other",
    image: "assets/courses/programming.jpg",
    subtitle: "初心者向け〜実用",
    desc: "目的に合わせて学習。Web基礎、アプリ、簡単な自動化など。",
    bullets: ["基礎（HTML/CSS/JSなど）", "小さな制作", "実用スキル", "学び方のサポート"],
    recommended: "これから始めたい初心者／作りたいものがある方"
  },

  // ===== Events =====
  {
    id: "exchange",
    label: "交流会（Language Exchange Meetings）",
    category: "イベント / Events",
    image: "assets/courses/exchange.jpg",
    subtitle: "多言語で話せる交流イベント",
    desc: "言語交換で楽しく会話。初心者でも安心して参加できます。",
    bullets: ["会話練習", "友達づくり", "テーマトーク", "イベント（ハイキング等）もあり"],
    recommended: "楽しく会話したい方／友達を作りたい方"
  }
];
