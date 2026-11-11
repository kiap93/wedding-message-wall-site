/**
 * Core UI Dictionaries & Wedding Phrases for EventFrame.io
 * Supports: English (en), Simplified Chinese (zh-CN), Traditional Chinese (zh-TW), Bahasa Melayu (ms)
 */

export interface TranslationResource {
  [key: string]: string;
}

export const UI_DICTIONARIES: Record<string, TranslationResource> = {
  en: {
    // Navigation
    'nav.story': 'Our Story',
    'nav.schedule': 'Schedule',
    'nav.venue': 'Venue',
    'nav.gallery': 'Gallery',
    'nav.invitation': 'Invitation',
    'nav.wall': 'Guest Wall',
    'nav.rsvp': 'RSVP',
    'nav.wishes': 'Wishes',

    // Hero Section
    'hero.badge': 'The Wedding Celebration',
    'hero.default_subheadline': 'Together with their families, invite you to celebrate their wedding day',
    'hero.view_invitation': 'View Wedding Invitation',

    // Countdown Section
    'countdown.badge': 'The Moment Awaits',
    'countdown.headline': 'Counting Down to Our Special Day',
    'countdown.days': 'Days',
    'countdown.hours': 'Hours',
    'countdown.minutes': 'Mins',
    'countdown.seconds': 'Secs',
    'countdown.today': 'Today is the Wedding Day!',

    // Story Section
    'story.badge': 'How It All Began',
    'story.headline': 'Our Love Story',
    'story.subheadline': 'A few meaningful milestones that brought us to this unforgettable day.',

    // Schedule Section
    'schedule.badge': 'Order of Events',
    'schedule.headline': 'Wedding Day Itinerary',
    'schedule.subheadline': 'Join us for every magical moment of our special celebration.',

    // Venue Section
    'venue.badge': 'Location & Details',
    'venue.headline': 'Venue & Reception Details',
    'venue.subheadline': 'Everything you need to know about the celebration setting and getting here.',
    'venue.get_directions': 'Open in Google Maps',
    'venue.attire': 'Dress Code',
    'venue.attire_desc': 'Formal / Black-Tie Optional',
    'venue.parking': 'Parking Information',
    'venue.parking_desc': 'Complimentary valet parking available at the main venue entrance.',

    // Gallery Section
    'gallery.badge': 'Moments Captured',
    'gallery.headline': 'Memories & Photos',
    'gallery.subheadline': 'A glimpse into our favorite chapters together leading up to today.',

    // Invitation Section
    'invitation.badge': 'Formal Invitation',
    'invitation.headline': 'Wedding Stationery',
    'invitation.subheadline': 'View the personalized stationery suite designed for our special day.',
    'invitation.view_btn': 'Open Digital Invitation',

    // RSVP Section
    'rsvp.badge': 'Attendance Confirmation',
    'rsvp.headline': 'RSVP to Celebrate With Us',
    'rsvp.subheadline': 'Kindly confirm your attendance by {{deadline}} so we can prepare for your celebration.',
    'rsvp.question': 'Will you be joining us?',
    'rsvp.accept': 'Joyfully Accepts',
    'rsvp.decline': 'Regretfully Declines',
    'rsvp.fullname': 'Full Name',
    'rsvp.fullname_placeholder': 'e.g. Eleanor Vance',
    'rsvp.email': 'Email Address',
    'rsvp.email_placeholder': 'e.g. eleanor@example.com',
    'rsvp.phone': 'Phone Number',
    'rsvp.phone_placeholder': 'e.g. +1 555-123-4567',
    'rsvp.guest_count': 'Number of Guests',
    'rsvp.meal_pref': 'Meal Preference',
    'rsvp.meal_standard': 'Standard / Chef Selection',
    'rsvp.meal_vegetarian': 'Vegetarian',
    'rsvp.meal_vegan': 'Vegan',
    'rsvp.meal_gluten_free': 'Gluten Free',
    'rsvp.meal_halal': 'Halal',
    'rsvp.dietary': 'Dietary Requirements / Allergies',
    'rsvp.dietary_placeholder': 'Please specify allergies, food intolerances or seating preferences...',
    'rsvp.submit': 'Submit RSVP',
    'rsvp.submitting': 'Sending your confirmation...',
    'rsvp.success_title': 'Thank You for Confirming!',
    'rsvp.success_message': 'Your RSVP response has been successfully recorded. We cannot wait to celebrate together!',
    'rsvp.closed': 'RSVP for this event is now closed. Please reach out to the couple directly.',

    // Wishes & Message Wall
    'wall.badge': 'Guestbook & Blessings',
    'wall.headline': 'Send Your Warmest Wishes',
    'wall.subheadline': 'Your love and blessings will appear live on our reception message wall!',
    'wall.your_name': 'Your Name',
    'wall.your_message': 'Your Blessing or Message',
    'wall.message_placeholder': 'Write your heartfelt congratulations, memories, or blessings for the couple...',
    'wall.send_wish': 'Post Your Blessing',
    'wall.sending': 'Sending...',
    'wall.sent_success': 'Your blessing was posted to the Wedding Wall!',
    'wall.translate_btn': 'Translate to View',
    'wall.original_btn': 'View Original',
    'wall.empty': 'Be the first guest to leave a blessing for the couple!',

    // Footer
    'footer.with_love': 'With love and gratitude,',
    'footer.blessing': 'Forever begins now. Thank you for being part of our journey.',
    'footer.copyright': 'All rights reserved.',

    // Language Selector & General UI
    'lang.selector_title': 'Language',
    'lang.switch': 'Switch Language',
    'common.loading': 'Loading wedding celebration...',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.preview_mode': 'Preview Mode',
    'common.draft_notice': 'This language version is currently in draft.'
  },

  'zh-CN': {
    // Navigation
    'nav.story': '爱情故事',
    'nav.schedule': '婚礼流程',
    'nav.venue': '宴会地点',
    'nav.gallery': '甜蜜画廊',
    'nav.invitation': '精美请柬',
    'nav.wall': '宾客祝福',
    'nav.rsvp': '出席回函',
    'nav.wishes': '留言祝福',

    // Hero Section
    'hero.badge': '百年好合 · 婚礼盛典',
    'hero.default_subheadline': '谨定于良辰吉日，诚邀亲朋挚友共赴婚宴，见证幸福时刻',
    'hero.view_invitation': '查阅电子请柬',

    // Countdown Section
    'countdown.badge': '幸福倒计时',
    'countdown.headline': '距离大婚吉日还有',
    'countdown.days': '天',
    'countdown.hours': '时',
    'countdown.minutes': '分',
    'countdown.seconds': '秒',
    'countdown.today': '今日大婚，良辰吉日！',

    // Story Section
    'story.badge': '从相遇至携手',
    'story.headline': '我们的故事',
    'story.subheadline': '记叙相知、相许的点滴珍贵历程。',

    // Schedule Section
    'schedule.badge': '婚礼吉时',
    'schedule.headline': '婚礼当日流程',
    'schedule.subheadline': '真诚期待与您共度每个美好温情的瞬间。',

    // Venue Section
    'venue.badge': '宴席指南',
    'venue.headline': '婚礼宴会地点',
    'venue.subheadline': '婚宴场地交通、着装及签到指引。',
    'venue.get_directions': '在地图中打开导航',
    'venue.attire': '着装要求',
    'venue.attire_desc': '大方得体 / 礼服或正装出席',
    'venue.parking': '停车指引',
    'venue.parking_desc': '酒店正门提供专属宾客免费代客泊车及停车位。',

    // Gallery Section
    'gallery.badge': '定格甜蜜',
    'gallery.headline': '幸福瞬间',
    'gallery.subheadline': '捕捉幸福洋溢的每个美好笑容与留念。',

    // Invitation Section
    'invitation.badge': '正式请柬',
    'invitation.headline': '婚礼专属请柬',
    'invitation.subheadline': '查阅为诸位尊贵宾客精心设计的电子喜帖。',
    'invitation.view_btn': '开启电子请柬',

    // RSVP Section
    'rsvp.badge': '出席确认',
    'rsvp.headline': '出席回函 · 恭候光临',
    'rsvp.subheadline': '烦请于 {{deadline}} 前回复回函，以便我们备席恭迎您的莅临。',
    'rsvp.question': '您是否能够莅临出席？',
    'rsvp.accept': '欣然赴约',
    'rsvp.decline': '遗憾缺席',
    'rsvp.fullname': '尊姓大名',
    'rsvp.fullname_placeholder': '例如：李先生 / 张女士',
    'rsvp.email': '电子邮箱',
    'rsvp.email_placeholder': '例如：yourname@example.com',
    'rsvp.phone': '联络电话',
    'rsvp.phone_placeholder': '例如：+86 138-0000-0000',
    'rsvp.guest_count': '出席人数',
    'rsvp.meal_pref': '餐饮偏好',
    'rsvp.meal_standard': '标准宴席 / 主厨精选',
    'rsvp.meal_vegetarian': '素食精选',
    'rsvp.meal_vegan': '纯素餐点',
    'rsvp.meal_gluten_free': '无麸质餐点',
    'rsvp.meal_halal': '清真餐点',
    'rsvp.dietary': '特殊饮食或忌口',
    'rsvp.dietary_placeholder': '请注明食品过敏源、忌口或特殊座位需求...',
    'rsvp.submit': '确认提交回函',
    'rsvp.submitting': '提交回函中...',
    'rsvp.success_title': '感谢您的回复！',
    'rsvp.success_message': '我们已成功记录您的出席回函，衷心期盼与您在婚宴上相聚欢庆！',
    'rsvp.closed': '本婚礼回函已截止。如有变动，请直接联络新人。',

    // Wishes & Message Wall
    'wall.badge': '新人芳名录 · 祝福墙',
    'wall.headline': '致送美好祝福',
    'wall.subheadline': '您的温暖祝福将即时同步投射至婚宴现场大屏幕！',
    'wall.your_name': '您的姓名 / 称呼',
    'wall.your_message': '祝福留言',
    'wall.message_placeholder': '写下您对新人的真挚祝愿、美好回忆与新婚寄语...',
    'wall.send_wish': '发布新婚祝福',
    'wall.sending': '发送中...',
    'wall.sent_success': '祝福已发布至现场婚礼祝福墙！',
    'wall.translate_btn': '翻译查看',
    'wall.original_btn': '查看原文',
    'wall.empty': '成为第一位为新人送上新婚祝福的尊贵宾客吧！',

    // Footer
    'footer.with_love': '致以最真挚的谢意与敬意，',
    'footer.blessing': '执子之手，与子偕老。感恩一路有您相伴与祝福。',
    'footer.copyright': '版权所有。',

    // Language Selector & General UI
    'lang.selector_title': '选择语言',
    'lang.switch': '切换语言',
    'common.loading': '正在载入婚礼网页...',
    'common.back': '返回',
    'common.close': '关闭',
    'common.preview_mode': '预览模式',
    'common.draft_notice': '此语言版本尚在草稿阶段。'
  },

  'zh-TW': {
    // Navigation
    'nav.story': '愛情故事',
    'nav.schedule': '婚禮流程',
    'nav.venue': '宴會地點',
    'nav.gallery': '甜蜜藝廊',
    'nav.invitation': '精緻喜帖',
    'nav.wall': '賓客祝福',
    'nav.rsvp': '出席回函',
    'nav.wishes': '留言祝福',

    // Hero Section
    'hero.badge': '百年好合 · 婚禮盛典',
    'hero.default_subheadline': '謹定於良辰吉日，誠摯邀請親朋好友共赴喜宴，見證永恆幸福',
    'hero.view_invitation': '查閱電子喜帖',

    // Countdown Section
    'countdown.badge': '幸福倒數',
    'countdown.headline': '距離大婚吉日還有',
    'countdown.days': '天',
    'countdown.hours': '時',
    'countdown.minutes': '分',
    'countdown.seconds': '秒',
    'countdown.today': '今日大喜之日，百年好合！',

    // Story Section
    'story.badge': '從相遇到相許',
    'story.headline': '我們的故事',
    'story.subheadline': '記敘一路走來相知、相守的動人里程碑。',

    // Schedule Section
    'schedule.badge': '婚禮吉時',
    'schedule.headline': '婚禮當日流程',
    'schedule.subheadline': '真摯期待與您一同參與每一個溫馨感動的時刻。',

    // Venue Section
    'venue.badge': '宴席指南',
    'venue.headline': '婚禮宴席地點',
    'venue.subheadline': '婚宴會場交通、著裝規範與停車指引。',
    'venue.get_directions': '於 Google 地圖中開啟導航',
    'venue.attire': '著裝規範',
    'venue.attire_desc': '端莊得體 / 正裝或典雅禮服',
    'venue.parking': '停車資訊',
    'venue.parking_desc': '宴會場地提供專屬貴賓停車場與免費代客泊車服務。',

    // Gallery Section
    'gallery.badge': '定格永恆',
    'gallery.headline': '珍貴回憶',
    'gallery.subheadline': '記錄相愛相伴的幸福甜蜜瞬間。',

    // Invitation Section
    'invitation.badge': '正式喜帖',
    'invitation.headline': '婚禮專屬喜帖',
    'invitation.subheadline': '查閱為諸位尊榮貴賓專屬設計的電子請帖。',
    'invitation.view_btn': '開啟電子喜帖',

    // RSVP Section
    'rsvp.badge': '出席回覆',
    'rsvp.headline': '出席回函 · 敬備喜宴',
    'rsvp.subheadline': '敬請於 {{deadline}} 前完成回函確認，以便我們為您準備座席與佳餚。',
    'rsvp.question': '您是否能夠撥冗蒞臨？',
    'rsvp.accept': '欣然赴約',
    'rsvp.decline': '遺憾缺席',
    'rsvp.fullname': '大名尊姓',
    'rsvp.fullname_placeholder': '例如：王大明 / 林美華',
    'rsvp.email': '電子郵件',
    'rsvp.email_placeholder': '例如：yourname@example.com',
    'rsvp.phone': '聯絡電話',
    'rsvp.phone_placeholder': '例如：+886 912-345-678',
    'rsvp.guest_count': '出席人數',
    'rsvp.meal_pref': '餐飲喜好',
    'rsvp.meal_standard': '標準宴席 / 主廚推薦',
    'rsvp.meal_vegetarian': '精選素食',
    'rsvp.meal_vegan': '純植物全素',
    'rsvp.meal_gluten_free': '無麩質餐點',
    'rsvp.meal_halal': '清真餐點',
    'rsvp.dietary': '特殊飲食或過敏備註',
    'rsvp.dietary_placeholder': '請告知食品過敏原、忌口或特殊座席安排需求...',
    'rsvp.submit': '送出回函',
    'rsvp.submitting': '回函提交中...',
    'rsvp.success_title': '感謝您的回覆！',
    'rsvp.success_message': '我們已收到您的出席回函，滿心歡喜期待在大婚之日與您相聚！',
    'rsvp.closed': '本婚宴回函已截止，如有任何變更，請直接聯繫新人。',

    // Wishes & Message Wall
    'wall.badge': '百年佳偶 · 祝福牆',
    'wall.headline': '送上溫馨祝福',
    'wall.subheadline': '您的溫暖心意將即時呈現於婚禮現場大螢幕上！',
    'wall.your_name': '您的姓名 / 稱謂',
    'wall.your_message': '祝福訊息',
    'wall.message_placeholder': '寫下您對新人的真摯祝福、溫馨回憶與美好期許...',
    'wall.send_wish': '送出新婚祝福',
    'wall.sending': '傳送中...',
    'wall.sent_success': '祝福已成功傳送至現場大螢幕！',
    'wall.translate_btn': '翻譯查看',
    'wall.original_btn': '查看原文',
    'wall.empty': '成為第一位為新人送上溫暖祝福的貴賓吧！',

    // Footer
    'footer.with_love': '致上最深切的感激與愛意，',
    'footer.blessing': '執子之手，與子偕老。感謝您見證我們的人生新篇章。',
    'footer.copyright': '版權所有。',

    // Language Selector & General UI
    'lang.selector_title': '語言選擇',
    'lang.switch': '切換語言',
    'common.loading': '正在載入婚禮網頁...',
    'common.back': '返回',
    'common.close': '關閉',
    'common.preview_mode': '預覽模式',
    'common.draft_notice': '此語言版本目前處於草稿階段。'
  },

  'ms': {
    // Navigation
    'nav.story': 'Kisah Kami',
    'nav.schedule': 'Atur Cara',
    'nav.venue': 'Lokasi Majlis',
    'nav.gallery': 'Galeri Foto',
    'nav.invitation': 'Kad Jemputan',
    'nav.wall': 'Buku Ucapan',
    'nav.rsvp': 'Pengesahan Kehadiran',
    'nav.wishes': 'Ucapan Doa',

    // Hero Section
    'hero.badge': 'Walimatulurus · Raikan Cinta',
    'hero.default_subheadline': 'Dengan penuh kesyukuran, kami sekeluarga menjemput anda meraikan hari bahagia kami',
    'hero.view_invitation': 'Lihat Kad Jemputan Digital',

    // Countdown Section
    'countdown.badge': 'Detik Yang Dinanti',
    'countdown.headline': 'Menghitung Hari Bahagia',
    'countdown.days': 'Hari',
    'countdown.hours': 'Jam',
    'countdown.minutes': 'Minit',
    'countdown.seconds': 'Saat',
    'countdown.today': 'Hari Ini Adalah Hari Bahagia!',

    // Story Section
    'story.badge': 'Permulaan Cinta',
    'story.headline': 'Kisah Kasih Kami',
    'story.subheadline': 'Detik-detik bermakna yang menyatukan hati kami menuju hari bahagia.',

    // Schedule Section
    'schedule.badge': 'Atur Cara Majlis',
    'schedule.headline': 'Jadual Hari Perkahwinan',
    'schedule.subheadline': 'Bersama-sama kami menyaksikan setiap detik indah sepanjang majlis berlangsung.',

    // Venue Section
    'venue.badge': 'Lokasi & Panduan',
    'venue.headline': 'Maklumat Lokasi & Dewan',
    'venue.subheadline': 'Semua maklumat penting mengenai lokasi dewan, etika pakaian dan panduan arah.',
    'venue.get_directions': 'Buka Navigasi Google Maps',
    'venue.attire': 'Etika Pakaian',
    'venue.attire_desc': 'Pakaian Tradisional / Formal Sopan',
    'venue.parking': 'Kemudahan Tempat Letak Kereta',
    'venue.parking_desc': 'Kemudahan parkir percuma disediakan berhampiran pintu masuk dewan.',

    // Gallery Section
    'gallery.badge': 'Potret Kenangan',
    'gallery.headline': 'Galeri Kenangan Terindah',
    'gallery.subheadline': 'Koleksi foto mengabadikan detik indah perjalanan kasih kami berdua.',

    // Invitation Section
    'invitation.badge': 'Kad Jemputan Rasmi',
    'invitation.headline': 'Jemputan Raja Sehari',
    'invitation.subheadline': 'Khas buat tetamu kehormat yang diraikan sekalian.',
    'invitation.view_btn': 'Buka Kad Jemputan',

    // RSVP Section
    'rsvp.badge': 'Pengesahan Kehadiran',
    'rsvp.headline': 'RSVP · Pengesahan Kehadiran Anda',
    'rsvp.subheadline': 'Sila sahkan kehadiran anda sebelum {{deadline}} bagi memudahkan urusan jamuan majlis.',
    'rsvp.question': 'Adakah anda berpeluang hadir meraikan bersama?',
    'rsvp.accept': 'Hadir dengan Sukacita',
    'rsvp.decline': 'Tidak Dapat Hadir',
    'rsvp.fullname': 'Nama Penuh',
    'rsvp.fullname_placeholder': 'cth. Ahmad bin Farhan',
    'rsvp.email': 'Alamat Emel',
    'rsvp.email_placeholder': 'cth. ahmad@example.com',
    'rsvp.phone': 'Nombor Telefon',
    'rsvp.phone_placeholder': 'cth. +60 12-345 6789',
    'rsvp.guest_count': 'Bilangan Tetamu',
    'rsvp.meal_pref': 'Pilihan Makanan',
    'rsvp.meal_standard': 'Hidangan Utama Majlis',
    'rsvp.meal_vegetarian': 'Vegetarian',
    'rsvp.meal_vegan': 'Vegan',
    'rsvp.meal_gluten_free': 'Bebas Gluten',
    'rsvp.meal_halal': 'Halal',
    'rsvp.dietary': 'Alahan / Keperluan Diet Khas',
    'rsvp.dietary_placeholder': 'Sila nyatakan alahan makanan atau sebarang keperluan tempat duduk...',
    'rsvp.submit': 'Hantar Pengesahan Kehadiran',
    'rsvp.submitting': 'Menghantar maklumat...',
    'rsvp.success_title': 'Terima Kasih Atas Pengesahan Anda!',
    'rsvp.success_message': 'Maklumat kehadiran anda telah direkodkan. Kami amat menantikan kehadiran anda di majlis nanti!',
    'rsvp.closed': 'Pengesahan kehadiran telah ditutup. Sila hubungi tuan rumah secara terus.',

    // Wishes & Message Wall
    'wall.badge': 'Buku Ucapan & Doa',
    'wall.headline': 'Kirimkan Doa & Ucapan Buat Pengantin',
    'wall.subheadline': 'Ucapan tulus ikhlas anda akan dipaparkan secara langsung di layar dewan majlis!',
    'wall.your_name': 'Nama Anda',
    'wall.your_message': 'Ucapan atau Doa Restu',
    'wall.message_placeholder': 'Tuliskan ucapan tahniah, doa bahagia, atau kenangan manis bersama pasangan...',
    'wall.send_wish': 'Kirimkan Ucapan',
    'wall.sending': 'Menghantar ucapan...',
    'wall.sent_success': 'Ucapan anda telah berjaya dimuatkan ke Layar Tetamu!',
    'wall.translate_btn': 'Terjemah ke Bahasa Ini',
    'wall.original_btn': 'Lihat Teks Asal',
    'wall.empty': 'Jadilah tetamu pertama yang menitipkan doa buat pasangan mempelai!',

    // Footer
    'footer.with_love': 'Dengan ingatan tulus ikhlas dan kasih sayang,',
    'footer.blessing': 'Semoga ikatan ini berkekalan hingga ke syurga. Terima kasih atas doa dan kehadiran anda.',
    'footer.copyright': 'Hak cipta terpelihara.',

    // Language Selector & General UI
    'lang.selector_title': 'Pilih Bahasa',
    'lang.switch': 'Tukar Bahasa',
    'common.loading': 'Memuatkan laman perkahwinan...',
    'common.back': 'Kembali',
    'common.close': 'Tutup',
    'common.preview_mode': 'Mod Pratonton',
    'common.draft_notice': 'Versi bahasa ini masih dalam peringkat draf.'
  }
};

export const weddingDictionaries = UI_DICTIONARIES;
