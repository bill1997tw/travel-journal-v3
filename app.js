/**
 * 悠遊小本本 (Voyage Book) - Core Logic & Router
 */

// --- 預設行前清單範本 ---
const DEFAULT_PACKING_TEMPLATE = [
  { id: 1, category: "重要證件 📄", name: "護照正本與簽證（效期大於6個月）", checked: true },
  { id: 2, category: "重要證件 📄", name: "台幣/日幣/外幣現金、雙幣信用卡 💵", checked: true },
  { id: 3, category: "重要證件 📄", name: "機票確認單與飯店住宿憑證 ✈️", checked: false },
  { id: 4, category: "電子配件 🔌", name: "手機充電線、行動電源與轉接頭", checked: false },
  { id: 5, category: "衣物盥洗 👕", name: "換洗衣物、盥洗包與保養防曬乳", checked: false },
  { id: 6, category: "日常藥品 💊", name: "個人常用感冒藥、止痛藥與暈車藥", checked: false },
  { id: 7, category: "生活用品 🎒", name: "隨身折疊雨傘/輕便雨衣 ☔", checked: false }
];

// --- 預設旅程資料 ---
const DEFAULT_TRIPS = [
  {
    id: "demo-alishan",
    title: "阿里山二天一夜大團圓之旅",
    location: "台灣，嘉義",
    date: "2024-10-26",
    dateRange: "10/26 - 10/27",
    duration: 2,
    companion: "翔翔、郁魚等 5 人",
    travelers: "5人同行",
    luggage: "無行李重限制",
    rental: "自駕/搭乘林鐵火車",
    continent: "Asia",
    rating: 5,
    image: "assets/kyoto_street.png",
    itinerary: {
      title: "阿里山二天一夜大團圓之旅",
      dates: "10/26 ~ 10/27 (2天1夜)",
      subInfo: "旅伴: 5人同行 | 交通: 自駕 & 阿里山林業鐵路",
      pills: [
        { label: "日出觀光 🌅", type: "sight" },
        { label: "森林火車 🚆", type: "train" },
        { label: "森林散策 🌲", type: "sight" }
      ],
      stats: [
        { label: "住宿飯店", value: "文山賓館" },
        { label: "此行人數", value: "5 人" },
        { label: "出發日期", value: "2024/10/26" }
      ],
      days: [
        {
          dayNum: 1,
          date: "10/26 (六)",
          theme: "漫步草原與茶園 ➔ 部落歌舞 ➔ 入住文山賓館",
          desc: "交通: 自駕開車 | 住宿: 文山賓館五人房",
          items: [
            { id: "s-ali-1", time: "08:00 - 11:30", title: "旺萊山愛情大草原", content: "漫步於綠油油的草原，與各種浪漫裝置藝術合照，體驗阿里山腳下的遼闊。", type: "sight", highlight: false },
            { id: "s-ali-2", time: "11:30 - 13:00", title: "午餐：街角永富苦茶油雞", content: "品嚐阿里山必吃、香氣逼人的經典苦茶油雞，搭配現炒高山高麗菜。", type: "food", highlight: true },
            { id: "s-ali-3", time: "13:30 - 15:30", title: "二延平步道茶園雲海", content: "漫步於茶園步道中，呼吸新鮮空氣，欣賞茶園景緻與遠處翻騰的雲海奇觀。", type: "sight", highlight: false },
            { id: "s-ali-4", time: "16:00 - 17:30", title: "優遊吧斯鄒族文化部落", content: "觀賞鄒族傳統歌舞表演、品嚐阿里山高山茶，感受原住民部落的熱情魅力。", type: "sight", highlight: false },
            { id: "s-ali-5", time: "18:00 - 19:30", title: "晚餐：山賓餐廳石頭火鍋", content: "在微涼的傍晚朝聖山賓餐廳，享用湯頭極鮮的石頭火鍋與平價美味山產。", type: "food", highlight: true },
            { id: "s-ali-6", time: "20:00", title: "入住文山賓館休息", content: "辦理入住五人房，整理行李並提早休息，為明天凌晨的日出小火車養精蓄銳。", type: "hotel", highlight: false }
          ]
        },
        {
          dayNum: 2,
          date: "10/27 (日)",
          theme: "祝山小火車 ➔ 經典小笠原日出 ➔ 姊妹潭散策",
          desc: "交通: 阿里山林鐵小火車 + 徒步步道",
          items: [
            { id: "s-ali-7", time: "04:00 - 05:00", title: "阿里山站搭乘祝山線小火車", content: "前往阿里山車站，搭乘特別版祝山線日出觀光小火車直奔祝山站。", type: "train", highlight: false },
            { id: "s-ali-8", time: "05:30 - 07:00", title: "小笠原山展望台看日出", content: "漫步前往小笠原山觀景台，迎著晨曦欣賞耀眼的金色太陽躍出玉山群峰與壯觀雲海。", type: "sight", highlight: true },
            { id: "s-ali-9", time: "07:30 - 09:00", title: "早餐：茶田35號精緻早餐", content: "在充滿檜木香與藝術感的茶田35號中，享受有機高山茶與手作精緻早餐。", type: "food", highlight: true },
            { id: "s-ali-10", time: "09:30 - 12:00", title: "姊妹潭與森林巨木群步道", content: "散步經過充滿神祕感的姊妹潭，穿梭於參天巨木群林道間，呼吸高濃度芬多精。", type: "sight", highlight: false }
          ]
        }
      ]
    },
    alternativeSpots: {
      sights: [
        { id: "alt-ali-s1", name: "特富野古道", subtype: "古道健行/針葉林", rating: "⭐️ 4.7 (1,200 則評論)", mapsUrl: "https://maps.app.goo.gl/tWp4DkG6wW6f7v8k8", address: "嘉義縣阿里山鄉自忠", hours: "24小時開放", price: "免門票", notes: "舊鐵道木棧道與高聳柳杉林交織，坡度平緩，難度低且極具幽靜感。" },
        { id: "alt-ali-s2", name: "達娜伊谷自然生態公園", subtype: "自然景觀/鄒族文化", rating: "⭐️ 4.4 (3,100 則評論)", mapsUrl: "https://maps.app.goo.gl/t9k4D6J6wW6f7v8z9", address: "嘉義縣阿里山鄉山美村3鄰51號", hours: "08:00 - 17:00", price: "門票 NT$150/人", notes: "欣賞高山鯝魚（苦花魚）生態，可過大吊橋遠眺溪谷，並觀賞部落表演。" }
      ],
      restaurants: [
        { id: "alt-ali-r1", name: "游芭絲鄒宴專門店", subtype: "鄒族原木烤肉", rating: "⭐️ 4.4 (2,600 則評論)", mapsUrl: "https://maps.app.goo.gl/qJp4z6wGkGZskfJ8", address: "嘉義縣阿里山鄉山美村1鄰18號", hours: "11:00 - 15:00, 16:30 - 19:30 (週四公休)", price: "人均 NT$350 - $600", notes: "必吃原木烤肉、烤大香腸與山產品嚐，露天座位能一覽懸崖大崩山絕景。" },
        { id: "alt-ali-r2", name: "Hana部落廚房", subtype: "手工麵包/窯烤披薩", rating: "⭐️ 4.5 (1,800 則評論)", mapsUrl: "https://maps.app.goo.gl/t8k4D6J6wW6f7v8y1", address: "嘉義縣阿里山鄉第二鄰 (來吉部落)", hours: "11:00 - 17:00 (週一二公休)", price: "人均 NT$200 - $400", notes: "由南非姑娘與鄒族勇士開辦的深山廚房，手工窯烤麵包極為搶手，披薩多汁美味。" }
      ]
    },
    packingList: [
      { id: 101, category: "穿搭配件 👕", name: "保暖防風外套 (高山清晨氣溫低)", checked: true },
      { id: 102, category: "穿搭配件 👕", name: "登山鞋/好走的慢跑鞋", checked: true },
      { id: 103, category: "穿搭配件 👕", name: "換洗衣物與睡衣 👕", checked: false },
      { id: 104, category: "盥洗保養 🧴", name: "隱形眼鏡與保養液", checked: false },
      { id: 105, category: "盥洗保養 🧴", name: "防曬乳與個人護膚保養品 🧴", checked: false },
      { id: 106, category: "盥洗保養 🧴", name: "牙刷與牙膏組 (環保旅宿備品)", checked: false },
      { id: 107, category: "電子用品 🔌", name: "行動電源、手機充電線 🔌", checked: true },
      { id: 108, category: "日常藥品 💊", name: "暈車藥 (山路彎曲，出發前必吃)", checked: false },
      { id: 109, category: "日常藥品 💊", name: "個人感冒藥與腸胃藥", checked: false },
      { id: 110, category: "生活雜物 🎒", name: "隨身折疊傘/雨衣", checked: false },
      { id: 111, category: "生活雜物 🎒", name: "保溫瓶 (高山喝熱水方便)", checked: false }
    ],
    todoList: [
      { id: 201, name: "訂購文山賓館五人房", date: "9月完成", checked: true },
      { id: 202, name: "購買祝山線觀光火車票", date: "10/11完成", checked: true },
      { id: 203, name: "確認自駕車子油箱加滿", date: "10/25完成", checked: true },
      { id: 204, name: "查詢二延平步道即時天氣", date: "出發前", checked: false }
    ],
    wishlist: [
      { id: 301, name: "購買阿里山高山茶茶葉伴手禮", price: 1200, checked: false },
      { id: 302, name: "享用奮起湖便當與甜甜圈", price: 180, checked: false },
      { id: 303, name: "買小米麻糬與山葵鹽", price: 300, checked: false }
    ],
    ledger: [
      { id: "exp-ali-1", name: "阿里山國家森林遊樂區全票", day: 2, category: "景點", cost: 200, splitCount: 1, notes: "KLOOK訂票(第二行程必要門票)" },
      { id: "exp-ali-2", name: "火車票：祝山線 (往返票)", day: 2, category: "交通", cost: 150, splitCount: 1, notes: "去程一定要一張，回程體力可以走觀日步道" },
      { id: "exp-ali-3", name: "文山賓館五人房", day: 1, category: "住宿", cost: 5400, splitCount: 5, notes: "文山賓館住宿房費(翔翔代墊)" },
      { id: "exp-ali-4", name: "街角永富苦茶油雞", day: 1, category: "餐飲", cost: 200, splitCount: 1, notes: "第一天午餐合菜人均" },
      { id: "exp-ali-5", name: "山賓餐廳", day: 1, category: "餐飲", cost: 200, splitCount: 1, notes: "第一天晚餐合菜人均" },
      { id: "exp-ali-6", name: "茶田35號 小笠原二館", day: 2, category: "餐飲", cost: 200, splitCount: 1, notes: "第二天日出精緻早餐" }
    ],
    advances: [
      { id: "adv-ali-1", payer: "翔翔", date: "9月28日", item: "文山賓館五人房住宿", amount: 5400, splitCount: 5, notes: "文山賓館住宿房費" },
      { id: "adv-ali-2", payer: "郁魚", date: "10月11日", item: "祝山火車票(5人往返)", amount: 750, splitCount: 5, notes: "代購小火車票" }
    ],
    repayInfo: [
      { id: "rp-ali-1", name: "翔翔", method: "現金支付", account: "現場清帳付款" },
      { id: "rp-ali-2", name: "郁魚", method: "Line Pay", account: "Line 一卡通帳號：241859012" },
      { id: "rp-ali-3", name: "翔翔", method: "銀行轉帳", account: "玉山銀行(808) 帳號 0182-940-123456" },
      { id: "rp-ali-4", name: "郁魚", method: "現場請客", account: "下次再說！我請客！老闆大氣 🤝" }
    ],
    diary: {
      content: "阿里山的大團圓精緻之旅！這兩天我們運氣極佳，不但爬了茶園圍繞的二延平步道，還在優遊吧斯看了精彩歌舞。晚上在山賓餐廳吃溫暖的石頭火鍋，第二天更是一口氣解鎖了金色的小笠原日出與壯觀雲海！茶田35號的有機茶香與巨木林間的芬多精，洗滌了平日的疲憊。大家一起分攤預算，結帳時帳目清晰，是一次完美的團體出遊！",
      rating: 5,
      weather: "晴天",
      companion: "翔翔、郁魚、部魚共5人",
      image: "assets/kyoto_street.png",
      cost: 6350
    }
  },
  {
    id: "demo-nagoya",
    title: "名古屋・伊勢六天五夜重機美食極致之旅",
    location: "日本，名古屋",
    date: "2026-07-15",
    dateRange: "07/15 - 07/20",
    duration: 6,
    companion: "2位男性 (朋友同行)",
    travelers: "2位男性",
    luggage: "來回各 20KG 托運行李",
    rental: "Rental 819 伊勢店 (CB400 SF)",
    continent: "Asia",
    rating: 5,
    image: "assets/swiss_alps.png",
    itinerary: {
      title: "名古屋・伊勢六天五夜重機美食極致之旅",
      dates: "07/15 ~ 07/20 (6天5夜)",
      subInfo: "旅伴: 2位男性 | 租借: Rental 819 伊勢店",
      days: [
        {
          dayNum: 1,
          date: "07/15 (三)",
          theme: "降落中部機場 ➡️ 鐵道快速前往伊勢 ➡️ 帥氣牽車與神宮參拜",
          desc: "交通: 機場名鐵 + JR快速三重號 ➡️ 重機開騎 | 住宿: 伊勢站前高級溫泉飯店",
          items: [
            { id: "s-nag-1", time: "06:00 - 07:30", title: "降落中部國際機場", content: "辦理入境並提領托運行李。", type: "flight", highlight: false },
            { id: "s-nag-2", time: "07:43 - 09:18", title: "搭名鐵轉快速三重號", content: "從機場搭乘名鐵電車至名古屋站，無縫轉乘快速三重號直達伊勢市站。", type: "train", highlight: false },
            { id: "s-nag-3", time: "10:00 - 10:30", title: "Rental 819 伊勢店辦理牽車", content: "步行至 Rental 819 伊勢店辦理手續，帥氣租借重機 (CB400 Super Four)。", type: "bike", highlight: true },
            { id: "s-nag-4", time: "10:45 - 13:30", title: "伊勢神宮內宮與江戶老街", content: "騎重機前往伊勢神宮，漫步充滿江戶風情的托福橫丁老街。", type: "sight", highlight: false },
            { id: "s-nag-5", time: "12:00", title: "午餐：手打伊勢烏龍麵與赤福冰", content: "享用軟彈的烏龍麵與經典刨冰消暑。", type: "food", highlight: true }
          ]
        },
        {
          dayNum: 2,
          date: "07/16 (四)",
          theme: "馳騁海海相連珍珠路 ➡️ 拜訪海女小屋現烤海鮮 ➡️ 俯瞰英虞灣",
          desc: "交通: 重機山海觀光景觀線 | 住宿: 松阪市區飯店",
          items: [
            { id: "s-nag-6", time: "09:00 - 11:30", title: "挑戰重機天堂『珍珠路』", content: "暢騎珍珠路景觀公路，彎道流暢、山海交錯，至鳥羽展望台喝杯熱咖啡。", type: "bike", highlight: false },
            { id: "s-nag-7", time: "12:00 - 14:00", title: "午餐：海女小屋烤龍蝦大餐", content: "現役海女阿嬤親手炭火現烤爆汁伊勢龍蝦、大扇貝與鮑魚，鮮甜難忘。", type: "food", highlight: true }
          ]
        }
      ]
    },
    alternativeSpots: {
      sights: [
        { id: "alt-nag-s1", name: "志摩西班牙村 (Shima Spain Village)", subtype: "主題樂園/地中海景點", rating: "⭐️ 4.2 (3,500 則評論)", mapsUrl: "https://maps.app.goo.gl/tWp4DkG6wW6f7v8k8", address: "三重縣志摩市", hours: "09:30 - 17:00", price: "門票約 5,400 日圓", notes: "平日人少免排隊的異國地中海城堡，拍照極美，有精采歌舞表演。" },
        { id: "alt-nag-s2", name: "鳥羽水族館 (Toba Aquarium)", subtype: "室內景點/水族館", rating: "⭐️ 4.6 (5,200 則評論)", mapsUrl: "https://maps.app.goo.gl/t9k4D6J6wW6f7v8z9", address: "三重縣鳥羽市3-3-6", hours: "09:00 - 17:00", price: "門票約 2,800 日圓", notes: "全日本飼育物種數量第一，擁有美人魚原型儒艮與超人氣海獺餵食秀。" }
      ],
      restaurants: [
        { id: "alt-nag-r1", name: "和田金 (松阪牛百老名店)", subtype: "高級松阪牛壽喜燒", rating: "⭐️ 4.6 (1,100 則評論)", mapsUrl: "https://maps.app.goo.gl/qJp4z6wGkGZskfJ8", address: "三重縣松阪市中町1878", hours: "11:30 - 20:00", price: "人均 15,000 日圓起", notes: "松阪牛的至高殿堂，由女將桌邊服務，在大鐵鍋上現場以牛油、砂糖醬油烤炙入口即化的松阪牛。" }
      ]
    },
    packingList: [...DEFAULT_PACKING_TEMPLATE],
    todoList: [
      { id: 251, name: "預約 Rental 819 重機並勾選 ETC 租借", date: "出發前兩週", checked: true },
      { id: 252, name: "確認國際駕照及台灣駕照譯本", date: "出發前", checked: true }
    ],
    wishlist: [
      { id: 351, name: "買伊勢茶、赤福麻糬特產", price: 500, checked: false }
    ],
    ledger: [
      { id: "exp-nag-1", name: "伊勢市站前高級溫泉飯店", day: 1, category: "住宿", cost: 6800, splitCount: 2, notes: "伊勢溫泉大床房" },
      { id: "exp-nag-2", name: "Rental 819 重機租借 (CB400)", day: 1, category: "交通", cost: 12000, splitCount: 2, notes: "CB400 Super Four 租車與保險" },
      { id: "exp-nag-3", name: "手羽先與名古屋美食聚餐", day: 1, category: "餐飲", cost: 5000, splitCount: 2, notes: "榮商圈居酒屋美食" }
    ],
    advances: [
      { id: "adv-nag-1", payer: "我", date: "7月15日", item: "溫泉飯店房費", amount: 6800, splitCount: 2, notes: "我先刷卡付費" },
      { id: "adv-nag-2", payer: "朋友", date: "7月15日", item: "重機租借費用", amount: 12000, splitCount: 2, notes: "旅伴付現金" }
    ],
    repayInfo: [
      { id: "rp-nag-1", name: "我", method: "Line Pay", account: "一卡通帳號：987654321" },
      { id: "rp-nag-2", name: "朋友", method: "現金支付", account: "現場日幣結算" }
    ],
    diary: {
      content: "名古屋與伊勢重機狂飆之旅！騎著 CB400 在伊勢灣的海岸線公路奔馳，海風吹拂非常舒適。海女小屋現烤新鮮龍蝦、和田金松阪牛壽喜燒，簡直是美食天花板！",
      rating: 5,
      weather: "晴天",
      companion: "朋友同行 (共 2 人)",
      image: "assets/swiss_alps.png",
      cost: 23800
    }
  }
];

// 分類代表顏色
const CATEGORY_COLORS = {
  "住宿": "#4f46e5", // Indigo
  "交通": "#06b6d4", // Cyan
  "餐飲": "#10b981", // Emerald
  "景點": "#f59e0b", // Amber
  "購物": "#ec4899", // Pink
  "其他": "#6b7280", // Gray
  "雜支": "#8b5cf6"  // Violet
};

// --- 全局狀態 ---
let trips = [];
let quickNotes = [];
let currentCarouselIndex = 0;

let activeTripId = null; // 當前進入的 Workspace 旅程 ID
let activeWorkspaceTab = "itinerary"; // 當前 Workspace 子分頁 (itinerary, checklists, budget, diary)
let activeItineraryDay = 1; // 當前行程選定天數
let activeAlternativeTab = "sights"; // 備案庫當前子籤 (sights, restaurants)

// --- 初始化應用 ---
async function bootApp() {
  if (window.voyageCloud?.hydrateBeforeAppStart) {
    await window.voyageCloud.hydrateBeforeAppStart();
  }
  initData();
  setupEventListeners();
  setupTheme();
  renderAll();
  document.dispatchEvent(new CustomEvent("voyage:app-ready"));
}

document.addEventListener("DOMContentLoaded", () => {
  bootApp();
});

// --- 資料初始化 ---
function initData() {
  // 載入客製化標題 Logo 名稱
  const savedLogoText = localStorage.getItem("voyage_logo_text");
  if (savedLogoText) {
    const logoEl = document.getElementById("logo-text");
    if (logoEl) logoEl.innerText = savedLogoText;
  }

  // 初始化使用者名稱
  if (!localStorage.getItem("voyage_user_name")) {
    localStorage.setItem("voyage_user_name", "旅人");
  }

  const localTrips = localStorage.getItem("voyage_trips");
  if (localTrips) {
    trips = JSON.parse(localTrips);
    // 防呆：確保所有屬性都存在
    trips.forEach(t => {
      if (!t.itinerary) t.itinerary = null;
      if (!t.alternativeSpots) t.alternativeSpots = { sights: [], restaurants: [] };
      if (!t.packingList) t.packingList = [...DEFAULT_PACKING_TEMPLATE];
      if (!t.todoList) t.todoList = [];
      if (!t.wishlist) t.wishlist = [];
      if (!t.ledger) t.ledger = [];
      if (!t.advances) t.advances = [];
      if (!t.repayInfo) t.repayInfo = [];
      if (!t.diary) {
        t.diary = { content: "", rating: 5, weather: "晴天", companion: "", image: "", cost: 0 };
      }
    });
  } else {
    trips = [...DEFAULT_TRIPS];
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
  }

  const localNotes = localStorage.getItem("voyage_quick_notes");
  if (localNotes) {
    quickNotes = JSON.parse(localNotes);
  } else {
    quickNotes = [
      { id: 1, text: "下次旅行想去北海道看雪 ❄️" },
      { id: 2, text: "規劃日本富士山登山大攻略 🗻" }
    ];
    localStorage.setItem("voyage_quick_notes", JSON.stringify(quickNotes));
  }
}

// --- 事件監聽與綁定 ---
function setupEventListeners() {
  // 導覽列切換
  document.querySelectorAll("nav .nav-link, #logo-btn").forEach(elem => {
    elem.addEventListener("click", () => {
      let targetView = "";
      if (elem.id === "logo-btn") {
        targetView = "dashboard";
      } else {
        targetView = elem.getAttribute("data-view");
      }
      switchView(targetView);
    });
  });

  // 主題切換
  document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);

  // 客製化標題 Logo 與招呼語編輯
  document.getElementById("edit-logo-btn").addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止氣泡傳播，避免點擊觸發導覽切換
    startLogoEdit();
  });
  document.getElementById("edit-greeting-btn").addEventListener("click", () => {
    startGreetingEdit();
  });

  // 新增旅程按鈕
  document.getElementById("global-add-trip-btn").addEventListener("click", () => openTripEditorModal());
  document.getElementById("trips-add-btn").addEventListener("click", () => openTripEditorModal());
  document.getElementById("trip-modal-close").addEventListener("click", closeTripEditorModal);
  document.getElementById("trip-modal-cancel").addEventListener("click", closeTripEditorModal);

  // 旅程封面照片上傳
  const tUploadZone = document.getElementById("t-upload-zone");
  const tFileInput = document.getElementById("t-image-file");
  tUploadZone.addEventListener("click", () => tFileInput.click());
  tFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file, "t-image-base64", "t-upload-preview", "t-upload-text");
  });

  // 旅程 Form 提交
  document.getElementById("trip-form").addEventListener("submit", handleTripSubmit);

  // 我的旅程搜尋
  document.getElementById("search-trips-bar").addEventListener("input", renderTripsList);

  // 靈感速記
  document.getElementById("quick-note-save-btn").addEventListener("click", saveQuickNote);
  document.getElementById("quick-note-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveQuickNote();
    }
  });

  // 輪播控制
  document.getElementById("carousel-prev").addEventListener("click", () => slideCarousel(-1));
  document.getElementById("carousel-next").addEventListener("click", () => slideCarousel(1));

  // Workspace 返回按鈕
  document.getElementById("workspace-back-btn").addEventListener("click", () => {
    switchView("trips");
  });

  // Workspace 子分頁切換
  document.querySelectorAll("[data-ws-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-ws-tab");
      switchWorkspaceTab(tabId);
    });
  });

  // Workspace 行程與備案相關事件
  document.getElementById("ws-edit-trip-btn").addEventListener("click", () => openTripEditorModal(activeTripId));
  document.getElementById("ws-add-schedule-btn").addEventListener("click", () => openScheduleModal());
  document.getElementById("sche-modal-close").addEventListener("click", closeScheduleModal);
  document.getElementById("sche-modal-cancel").addEventListener("click", closeScheduleModal);
  document.getElementById("sche-form").addEventListener("submit", handleScheduleSubmit);
  document.getElementById("s-maps-url").addEventListener("blur", setupScheduleAutofill);
  document.getElementById("s-maps-url").addEventListener("input", () => {
    const url = document.getElementById("s-maps-url").value.trim();
    if (url.startsWith("http") && (url.includes("maps") || url.includes("goo.gl"))) {
      setupScheduleAutofill();
    }
  });
  document.getElementById("ws-clear-itinerary-btn").addEventListener("click", handleClearItinerary);
  document.getElementById("ws-edit-day-summary-btn").addEventListener("click", openDaySummaryModal);
  document.getElementById("day-summary-modal-close").addEventListener("click", closeDaySummaryModal);
  document.getElementById("ds-modal-cancel").addEventListener("click", closeDaySummaryModal);
  document.getElementById("day-summary-form").addEventListener("submit", handleDaySummarySubmit);

  // 備案子分頁切換 (景點 vs 餐廳)
  document.querySelectorAll("[data-alt-tab]").forEach(tabBtn => {
    tabBtn.addEventListener("click", () => {
      const targetAltTab = tabBtn.getAttribute("data-alt-tab");
      switchAltTab(targetAltTab);
    });
  });

  // 新增備案按鈕
  document.getElementById("ws-add-alt-sight-btn").addEventListener("click", () => openAlternativeModal("sights"));
  document.getElementById("ws-add-alt-restaurant-btn").addEventListener("click", () => openAlternativeModal("restaurants"));
  document.getElementById("alt-modal-close").addEventListener("click", closeAlternativeModal);
  document.getElementById("alt-modal-cancel").addEventListener("click", closeAlternativeModal);
  document.getElementById("alt-form").addEventListener("submit", handleAlternativeSubmit);
  document.getElementById("a-mapsurl").addEventListener("blur", setupAlternativeAutofill);
  document.getElementById("a-mapsurl").addEventListener("input", () => {
    const url = document.getElementById("a-mapsurl").value.trim();
    if (url.startsWith("http") && (url.includes("maps") || url.includes("goo.gl"))) {
      setupAlternativeAutofill();
    }
  });

  // 備案「加入日程」表單提交
  document.getElementById("add-to-sche-close").addEventListener("click", () => document.getElementById("add-to-schedule-modal").classList.remove("active"));
  document.getElementById("ats-modal-cancel").addEventListener("click", () => document.getElementById("add-to-schedule-modal").classList.remove("active"));
  document.getElementById("add-to-sche-form").addEventListener("submit", handleAddToScheduleSubmit);

  // 智慧行程匯入 (importer)
  document.getElementById("iti-import-btn").addEventListener("click", () => {
    document.getElementById("importer-json-textarea").value = "";
    document.getElementById("itinerary-importer-modal").classList.add("active");
  });
  document.getElementById("importer-modal-close").addEventListener("click", () => document.getElementById("itinerary-importer-modal").classList.remove("active"));
  document.getElementById("importer-modal-cancel").addEventListener("click", () => document.getElementById("itinerary-importer-modal").classList.remove("active"));
  document.getElementById("importer-modal-submit").addEventListener("click", handleItineraryImport);

  // 行前清單 checklist 增刪與代辦
  document.getElementById("todo-add-btn").addEventListener("click", handleTodoAdd);
  document.getElementById("wish-add-btn").addEventListener("click", handleWishAdd);

  // 費用與記帳
  document.getElementById("ws-add-expense-btn").addEventListener("click", () => openExpenseModal());
  document.getElementById("expense-modal-close").addEventListener("click", closeExpenseModal);
  document.getElementById("expense-modal-cancel").addEventListener("click", closeExpenseModal);
  document.getElementById("expense-form").addEventListener("submit", handleExpenseSubmit);

  // 同行代墊
  document.getElementById("ws-add-advance-btn").addEventListener("click", () => openAdvanceModal());
  document.getElementById("adv-modal-close").addEventListener("click", closeAdvanceModal);
  document.getElementById("adv-modal-cancel").addEventListener("click", closeAdvanceModal);
  document.getElementById("adv-form").addEventListener("submit", handleAdvanceSubmit);

  // 收款還款
  document.getElementById("ws-add-repay-btn").addEventListener("click", () => openRepayModal());
  document.getElementById("repay-modal-close").addEventListener("click", closeRepayModal);
  document.getElementById("repay-modal-cancel").addEventListener("click", closeRepayModal);
  document.getElementById("repay-form").addEventListener("submit", handleRepaySubmit);

  // 故事日記
  document.getElementById("ws-diary-import-cost-btn").addEventListener("click", handleDiaryImportCost);
  document.getElementById("ws-diary-save-btn").addEventListener("click", handleDiarySave);

  // 日記照片上傳
  const dPlaceholder = document.getElementById("ws-diary-upload-placeholder");
  const dFileInput = document.getElementById("ws-diary-image-file");
  dPlaceholder.addEventListener("click", () => dFileInput.click());
  document.getElementById("ws-diary-preview-img").addEventListener("click", () => dFileInput.click());
  dFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file, "ws-diary-image-base64", "ws-diary-preview-img", "ws-diary-upload-placeholder");
  });

  // 日記評分星級
  document.querySelectorAll("#ws-diary-rating-stars .ws-star").forEach(star => {
    star.addEventListener("click", () => {
      const rating = parseInt(star.getAttribute("data-ws-rating"));
      setDiaryRating(rating);
    });
  });

  // 票券與備忘錄相關事件
  const wsAddVoucherBtn = document.getElementById("ws-add-voucher-btn");
  if (wsAddVoucherBtn) {
    wsAddVoucherBtn.addEventListener("click", () => openVoucherModal());
  }
  document.getElementById("voucher-modal-close").addEventListener("click", closeVoucherModal);
  document.getElementById("voucher-modal-cancel").addEventListener("click", closeVoucherModal);
  document.getElementById("voucher-modal-submit").addEventListener("click", () => {}); // default type submit
  document.getElementById("voucher-form").addEventListener("submit", handleVoucherSubmit);

  // 憑證上傳區點擊觸發檔案選擇
  const vUploadZone = document.getElementById("v-upload-zone");
  const vFileInput = document.getElementById("v-file-input");
  if (vUploadZone && vFileInput) {
    vUploadZone.addEventListener("click", () => vFileInput.click());
    
    // 處理檔案拖曳與選擇
    vUploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      vUploadZone.classList.add("dragover");
    });
    vUploadZone.addEventListener("dragleave", () => {
      vUploadZone.classList.remove("dragover");
    });
    vUploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      vUploadZone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) handleVoucherFileUpload(file);
    });
    vFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleVoucherFileUpload(file);
    });
  }

  // Lightbox 關閉
  const lightboxClose = document.getElementById("lightbox-close");
  if (lightboxClose) {
    lightboxClose.addEventListener("click", () => {
      document.getElementById("lightbox-modal").classList.remove("active");
    });
  }
  const lightboxModal = document.getElementById("lightbox-modal");
  if (lightboxModal) {
    lightboxModal.addEventListener("click", (e) => {
      if (e.target.id === "lightbox-modal") {
        lightboxModal.classList.remove("active");
      }
    });
  }
}

// --- SPA 視圖控制 ---
function switchView(viewName) {
  document.querySelectorAll("nav .nav-link").forEach(link => {
    if (link.getAttribute("data-view") === viewName) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  document.querySelectorAll(".view-section").forEach(sec => {
    sec.classList.remove("active");
  });

  const targetSec = document.getElementById(`view-${viewName}`);
  if (targetSec) {
    targetSec.classList.add("active");
  }

  activeTripId = null; // 退出 workspace

  if (viewName === "trips") {
    renderTripsList();
  } else if (viewName === "dashboard") {
    renderDashboard();
  } else if (viewName === "budget") {
    renderBudgetCharts();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- 主題切換 (日夜模式) ---
function setupTheme() {
  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  updateThemeIcons(currentTheme);
}

function toggleTheme() {
  const activeTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = activeTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcons(newTheme);
  showToast(`已切換為 ${newTheme === 'dark' ? '星空模式' : '日光模式'}`, "info");
}

function updateThemeIcons(theme) {
  const sunIcon = document.querySelector(".sun-icon");
  const moonIcon = document.querySelector(".moon-icon");
  if (theme === "dark") {
    sunIcon.style.display = "block";
    moonIcon.style.display = "none";
  } else {
    sunIcon.style.display = "none";
    moonIcon.style.display = "block";
  }
}

// --- 全域渲染 ---
function renderAll() {
  renderDashboard();
  renderTripsList();
  renderBudgetCharts();
}

// --- 1. 儀表板視圖渲染 ---
function renderDashboard() {
  const userName = localStorage.getItem("voyage_user_name") || "旅人";
  const hour = new Date().getHours();
  let greet = `哈囉，${userName}！`;
  if (hour >= 5 && hour < 11) greet = `早安，${userName}！🌅`;
  else if (hour >= 11 && hour < 14) greet = `午安，${userName}！☀️`;
  else if (hour >= 14 && hour < 18) greet = `下午好，${userName}！☕`;
  else greet = `晚安，${userName}！✨`;
  
  document.getElementById("greeting-title").innerText = greet;

  const totalTrips = trips.length;
  const uniqueCountries = new Set(trips.map(j => j.location.split(/[，,]/)[0].trim())).size;
  
  let totalSpent = 0;
  trips.forEach(t => {
    // 累計各行程明細與代墊
    const totalExp = (t.ledger || []).reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0);
    const totalAdv = (t.advances || []).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
    totalSpent += Math.max(totalExp, totalAdv, parseInt(t.diary?.cost || 0));
  });

  const totalDays = trips.reduce((sum, j) => sum + parseInt(j.duration || 0), 0);

  document.getElementById("stats-trips").innerText = totalTrips;
  document.getElementById("stats-countries").innerText = uniqueCountries;
  document.getElementById("stats-total-spent").innerText = `$${totalSpent.toLocaleString("zh-TW")}`;
  document.getElementById("stats-days").innerText = totalDays;

  const track = document.getElementById("dashboard-carousel-track");
  track.innerHTML = "";

  const sorted = [...trips].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (sorted.length === 0) {
    track.innerHTML = `
      <div style="flex:0 0 100%; display:flex; flex-direction:column; align-items:center; justify-content:center; height:260px; color:var(--text-secondary);">
        <p>目前還沒有任何規劃的旅程喔！</p>
        <button class="btn btn-primary" onclick="openTripEditorModal()" style="margin-top:1rem;">立即新增第一趟旅程</button>
      </div>
    `;
    document.getElementById("carousel-prev").style.display = "none";
    document.getElementById("carousel-next").style.display = "none";
    return;
  } else {
    document.getElementById("carousel-prev").style.display = "flex";
    document.getElementById("carousel-next").style.display = "flex";
  }

  sorted.slice(0, 5).forEach(trip => {
    const card = document.createElement("div");
    card.className = "carousel-card";
    
    const imgUrl = trip.image || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=600";
    
    // 計算總開支
    const totalExp = (trip.ledger || []).reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0);
    const totalAdv = (trip.advances || []).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
    const tripCostSum = Math.max(totalExp, totalAdv, parseInt(trip.diary?.cost || 0));

    card.innerHTML = `
      <img class="carousel-card-img" src="${imgUrl}" alt="${trip.title}">
      <div class="carousel-card-body">
        <div class="carousel-card-meta">
          <span>📍 ${trip.location}</span>
          <span>📅 ${trip.dateRange || trip.date}</span>
        </div>
        <div class="carousel-card-title">${escapeHTML(trip.title)}</div>
        <div class="carousel-card-desc">${escapeHTML(trip.diary?.content || '暫無手記日記內容，點擊進入企劃室撰寫。')}</div>
        <div style="margin-top:auto; display:flex; justify-content:space-between; align-items:center; padding-top:0.5rem;">
          <span style="font-weight:700; color:var(--accent-color); font-size:0.92rem;">預估開銷: NT$ ${tripCostSum.toLocaleString()}</span>
          <button class="btn btn-secondary" onclick="enterWorkspace('${trip.id}')" style="padding:0.35rem 0.75rem; font-size:0.8rem; border-radius:8px;">開啟本子</button>
        </div>
      </div>
    `;
    track.appendChild(card);
  });

  currentCarouselIndex = 0;
  updateCarouselPosition();
  renderQuickNotes();
}

function slideCarousel(direction) {
  const track = document.getElementById("dashboard-carousel-track");
  const cardCount = track.children.length;
  if (cardCount <= 1) return;

  const isMobile = window.innerWidth <= 1024;
  const maxIndex = isMobile ? cardCount - 1 : Math.max(0, cardCount - 2);

  currentCarouselIndex += direction;
  if (currentCarouselIndex < 0) currentCarouselIndex = maxIndex;
  if (currentCarouselIndex > maxIndex) currentCarouselIndex = 0;

  updateCarouselPosition();
}

function updateCarouselPosition() {
  const track = document.getElementById("dashboard-carousel-track");
  if (!track || track.children.length === 0) return;
  const cardWidth = track.children[0].offsetWidth;
  const gap = 24;
  
  const moveX = currentCarouselIndex * (cardWidth + gap);
  track.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
  track.style.transform = `translateX(-${moveX}px)`;
}

function saveQuickNote() {
  const input = document.getElementById("quick-note-text");
  const text = input.value.trim();
  if (!text) return;

  const note = { id: Date.now(), text: text };
  quickNotes.unshift(note);
  localStorage.setItem("voyage_quick_notes", JSON.stringify(quickNotes));
  input.value = "";
  renderQuickNotes();
  showToast("靈感速記已保存！", "success");
}

function renderQuickNotes() {
  const container = document.getElementById("quick-notes-list");
  container.innerHTML = "";

  if (quickNotes.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:1rem 0;">無速記內容</p>`;
    return;
  }

  quickNotes.forEach(note => {
    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.padding = "0.5rem 0.75rem";
    item.style.borderRadius = "8px";
    item.style.backgroundColor = "var(--badge-bg)";
    item.style.border = "1px solid var(--border-color)";
    item.style.fontSize = "0.85rem";
    
    item.innerHTML = `
      <span style="flex:1; margin-right:0.5rem; word-break:break-all;">${escapeHTML(note.text)}</span>
      <button onclick="deleteQuickNote(${note.id})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-weight:bold;" title="刪除">✕</button>
    `;
    container.appendChild(item);
  });
}

window.deleteQuickNote = function(id) {
  quickNotes = quickNotes.filter(n => n.id !== id);
  localStorage.setItem("voyage_quick_notes", JSON.stringify(quickNotes));
  renderQuickNotes();
  showToast("速記已刪除", "info");
};


// --- 2. 我的旅程列表渲染 ---
function renderTripsList() {
  const query = document.getElementById("search-trips-bar").value.toLowerCase();
  const container = document.getElementById("trips-list");
  container.innerHTML = "";

  const filtered = trips.filter(trip => {
    return trip.title.toLowerCase().includes(query) ||
           trip.location.toLowerCase().includes(query) ||
           trip.travelers.toLowerCase().includes(query);
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 0; color:var(--text-secondary); grid-column:1/-1;">
        <p>目前還沒有任何符合搜尋的旅程企劃。</p>
      </div>
    `;
    return;
  }

  filtered.forEach(trip => {
    const card = document.createElement("div");
    card.className = "trip-card glass";
    
    // 綁定點擊卡片進入企劃室
    card.addEventListener("click", (e) => {
      if (e.target.closest(".trip-card-delete-btn")) return; // 避免觸發刪除
      enterWorkspace(trip.id);
    });

    const imgUrl = trip.image || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=600";
    
    // 計算總開銷
    const totalExp = (trip.ledger || []).reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0);
    const totalAdv = (trip.advances || []).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
    const tripCostSum = Math.max(totalExp, totalAdv, parseInt(trip.diary?.cost || 0));

    card.innerHTML = `
      <div class="trip-card-img-wrap">
        <img src="${imgUrl}" alt="${trip.title}">
        <span class="trip-card-category">${CONTINENT_NAME(trip.continent)}</span>
        <button class="trip-card-delete-btn" title="刪除此旅程">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
      <div class="trip-card-body">
        <h3>${escapeHTML(trip.title)}</h3>
        <div class="trip-card-details">
          <div>📍 <span>${escapeHTML(trip.location)}</span></div>
          <div>📅 <span>${trip.dateRange || trip.date} (${trip.duration}天)</span></div>
          <div>👤 <span>旅伴: ${escapeHTML(trip.companion || '獨自冒險')}</span></div>
          <div>💰 <span>預算: NT$ ${tripCostSum.toLocaleString()}</span></div>
        </div>
        <div style="margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.8rem; font-weight:700; color:var(--accent-color);">📋 行程/行李/分帳小本本</span>
          <span style="font-size:0.75rem; color:var(--text-secondary);">點擊開啟 ➔</span>
        </div>
      </div>
    `;

    // 刪除按鈕事件
    card.querySelector(".trip-card-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTrip(trip.id);
    });

    container.appendChild(card);
  });
}

function deleteTrip(id) {
  if (confirm("您確定要刪除這個行程的全部資料嗎？此動作將連同日程、帳目、備案與行李清單一併刪除，無法復原喔！")) {
    trips = trips.filter(t => t.id !== id);
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    renderTripsList();
    renderDashboard();
    showToast("旅程已永久刪除", "info");
  }
}

function CONTINENT_NAME(code) {
  const names = { Asia: "亞洲", Europe: "歐洲", NorthAmerica: "北美", SouthAmerica: "南美", Africa: "非洲", Oceania: "大洋洲" };
  return names[code] || code;
}


// --- 3. 進入 旅程企劃室 (Trip Workspace) ---
window.enterWorkspace = function(tripId) {
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return;

  activeTripId = tripId;
  activeWorkspaceTab = "itinerary";
  activeItineraryDay = 1;
  activeAlternativeTab = "sights";

  // 切換 SPA 視圖到 workspace
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
  document.getElementById("view-workspace").classList.add("active");

  // 渲染 Workspace 頂部 Cover 資訊
  const coverBg = document.getElementById("ws-cover-bg");
  if (trip.image) {
    coverBg.style.backgroundImage = `url('${trip.image}')`;
  } else {
    coverBg.style.backgroundImage = `url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=600')`;
  }

  document.getElementById("ws-trip-title").innerText = trip.title;
  document.getElementById("ws-trip-meta").innerText = `📅 日期: ${trip.dateRange || trip.date} (${trip.duration}天) | 👤 旅伴: ${trip.companion || '無'} | 🏢 住宿: ${trip.itinerary?.stats?.[0]?.value || '未定'}`;

  // 渲染限額等 Badge
  const badgeContainer = document.getElementById("ws-trip-stats-badges");
  badgeContainer.innerHTML = "";
  if (trip.luggage) {
    badgeContainer.innerHTML += `<span class="ws-badge">✈️ ${escapeHTML(trip.luggage)}</span>`;
  }
  if (trip.rental) {
    badgeContainer.innerHTML += `<span class="ws-badge">🏍️ ${escapeHTML(trip.rental)}</span>`;
  }

  // 設定 sidebar 選單按鈕狀態
  switchWorkspaceTab("itinerary");
};

// 切換 Workspace 主要分頁
function switchWorkspaceTab(tabId) {
  activeWorkspaceTab = tabId;

  // 側邊欄按鈕高亮
  document.querySelectorAll("[data-ws-tab]").forEach(btn => {
    if (btn.getAttribute("data-ws-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 切換工作面板
  document.querySelectorAll(".ws-tab-panel").forEach(panel => {
    panel.classList.remove("active");
  });
  document.getElementById(`ws-panel-${tabId}`).classList.add("active");

  // 觸發各自渲染
  if (tabId === "itinerary") {
    renderWorkspaceItinerary();
  } else if (tabId === "checklists") {
    renderWorkspaceChecklists();
  } else if (tabId === "budget") {
    renderWorkspaceBudget();
  } else if (tabId === "diary") {
    renderWorkspaceDiary();
  } else if (tabId === "vouchers") {
    renderWorkspaceVouchers();
  }
}


// ==================== WORKSPACE A: 詳細行程與備案 ====================
function renderWorkspaceItinerary() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const iti = trip.itinerary;

  // 1. 渲染天數 Selector 頁籤
  const daySelector = document.getElementById("ws-days-selector");
  daySelector.innerHTML = "";
  
  const daysCount = parseInt(trip.duration) || 1;
  for (let i = 1; i <= daysCount; i++) {
    const btn = document.createElement("button");
    btn.className = `day-selector-btn ${activeItineraryDay === i ? 'active' : ''}`;
    btn.innerText = `DAY ${i}`;
    btn.onclick = () => {
      activeItineraryDay = i;
      renderWorkspaceItinerary();
    };
    daySelector.appendChild(btn);
  }

  const timelineContainer = document.getElementById("ws-schedule-timeline");
  timelineContainer.innerHTML = "";

  if (!iti || !iti.days || iti.days.length === 0) {
    // 尚未規劃行程或已被清空
    document.getElementById("ws-day-theme").innerText = "尚未匯入或規劃詳細行程";
    document.getElementById("ws-day-desc").innerText = "點擊右上方「新增日程項目」或「智慧匯入」直接載入助理行程規劃！";
    if (document.getElementById("ws-edit-day-summary-btn")) {
      document.getElementById("ws-edit-day-summary-btn").style.display = "none";
    }
    timelineContainer.innerHTML = `
      <div style="text-align:center; padding:3rem 0; color:var(--text-secondary);">
        <p>這趟旅程目前還沒有任何日程規劃喔。</p>
        <p style="font-size:0.85rem; margin-top:0.5rem; opacity:0.8;">建議貼上 Gemini 生成的行程 JSON 來快速填充！</p>
      </div>
    `;
    renderAlternativeSpots();
    return;
  }

  // 取得當前選定天數的資料
  let dayData = iti.days.find(d => d.dayNum === activeItineraryDay);
  if (!dayData) {
    // 防呆：如果 activeDay 溢出，重設為 Day 1
    activeItineraryDay = 1;
    dayData = iti.days[0];
  }

  if (dayData) {
    document.getElementById("ws-day-theme").innerText = `DAY ${dayData.dayNum}: ${escapeHTML(dayData.theme || '自由行日程')}`;
    document.getElementById("ws-day-desc").innerText = escapeHTML(dayData.desc || '無特定交通或住宿說明。');
    if (document.getElementById("ws-edit-day-summary-btn")) {
      document.getElementById("ws-edit-day-summary-btn").style.display = "block";
    }

    const scheduleItems = dayData.items || [];
    if (scheduleItems.length === 0) {
      timelineContainer.innerHTML = `
        <div style="text-align:center; padding:2rem 0; color:var(--text-secondary); border: 1px dashed var(--border-color); border-radius:12px;">
          <p>今日尚無行程安排，點擊「新增日程項目」手動增加。</p>
        </div>
      `;
    } else {
      const typeIcons = { "flight": "✈️", "train": "🚆", "bike": "🏍️", "food": "🍜", "hotel": "🏨", "sight": "📷", "other": "📍" };
      
      scheduleItems.forEach(item => {
        const icon = typeIcons[item.type] || "📍";
        const isHigh = item.highlight ? "highlight" : "";
        const itemEl = document.createElement("div");
        itemEl.className = `ws-time-item ${isHigh}`;
        itemEl.setAttribute("draggable", "true");
        itemEl.setAttribute("data-id", item.id);
        
        // 綁定拖曳事件
        itemEl.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", item.id);
          itemEl.classList.add("dragging");
        });
        
        itemEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          const draggingEl = document.querySelector(".ws-time-item.dragging");
          if (!draggingEl || draggingEl === itemEl) return;
          
          const rect = itemEl.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          if (e.clientY < midpoint) {
            itemEl.classList.add("drag-over-before");
            itemEl.classList.remove("drag-over-after");
          } else {
            itemEl.classList.add("drag-over-after");
            itemEl.classList.remove("drag-over-before");
          }
        });
        
        itemEl.addEventListener("dragleave", () => {
          itemEl.classList.remove("drag-over-before", "drag-over-after");
        });
        
        itemEl.addEventListener("dragend", () => {
          itemEl.classList.remove("dragging", "drag-over-before", "drag-over-after");
        });
        
        itemEl.addEventListener("drop", (e) => {
          e.preventDefault();
          itemEl.classList.remove("drag-over-before", "drag-over-after");
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId === item.id) return;
          
          const rect = itemEl.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          const placeBefore = e.clientY < midpoint;
          
          reorderScheduleItems(draggedId, item.id, placeBefore);
        });

        // 判斷備註中是否含有 Google 地圖網址
        let noteHtml = escapeHTML(item.content);
        const mapUrlMatch = item.content ? item.content.match(/https:\/\/maps\.[^\s]+/g) : null;
        if (mapUrlMatch) {
          noteHtml = noteHtml.replace(mapUrlMatch[0], `<a href="${mapUrlMatch[0]}" target="_blank" class="expense-map-link">🗺️ 查看 Google 地圖</a>`);
        }

        let metaHtml = '';
        if (item.rating || item.hours) {
          metaHtml += `
            <div class="ws-time-card-meta-row" draggable="false">
              ${item.rating ? `<span draggable="false">${escapeHTML(item.rating)}</span>` : ''}
              ${item.hours ? `<span style="color: var(--text-secondary); font-weight: normal; display: inline-flex; align-items: center; gap: 0.25rem;" draggable="false">🕒 ${escapeHTML(item.hours)}</span>` : ''}
            </div>
          `;
        }
        if (item.address) {
          metaHtml += `
            <div class="ws-time-card-address" data-address="${escapeHTML(item.address)}" onclick="copyAddress(event, this.getAttribute('data-address'))" title="點擊複製地址" draggable="false">
              <span draggable="false">📍 ${escapeHTML(item.address)}</span>
              <span class="ws-copy-badge" draggable="false">[複製]</span>
            </div>
          `;
        }
        if (item.mapsUrl) {
          metaHtml += `
            <a href="${escapeHTML(item.mapsUrl)}" target="_blank" class="ws-time-card-map-btn" draggable="false">
              🗺️ 導航地圖
            </a>
          `;
        }

        itemEl.innerHTML = `
          <div class="ws-time-label">${escapeHTML(item.time)}</div>
          <div class="ws-time-dot"></div>
          <div class="ws-time-card" draggable="false">
            <div class="ws-time-card-header" draggable="false">
              <span class="ws-time-card-title" draggable="false">${icon} ${escapeHTML(item.title)}</span>
              <div class="card-actions" draggable="false">
                <button class="btn-icon" onclick="openScheduleModal('${item.id}')" style="width:1.8rem; height:1.8rem; padding:0;" title="編輯" draggable="false">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" draggable="false"><path d="M12 20h9" draggable="false"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" draggable="false"></path></svg>
                </button>
                <button class="btn-icon" onclick="deleteScheduleItem('${item.id}')" style="width:1.8rem; height:1.8rem; padding:0; color:var(--danger); border-color:rgba(169, 74, 66, 0.15)" title="刪除" draggable="false">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" draggable="false"><polyline points="3 6 5 6 21 6" draggable="false"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" draggable="false"></path></svg>
                </button>
              </div>
            </div>
            <div class="ws-time-card-content" draggable="false">${noteHtml}</div>
            ${metaHtml}
          </div>
        `;
        timelineContainer.appendChild(itemEl);
      });
    }
  }

  // 2. 渲染備案庫
  renderAlternativeSpots();
}

// 拖曳排序實作
function reorderScheduleItems(draggedId, targetId, placeBefore) {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip || !trip.itinerary) return;

  const dayData = trip.itinerary.days.find(d => d.dayNum === activeItineraryDay);
  if (!dayData) return;

  const draggedIndex = dayData.items.findIndex(i => i.id === draggedId);
  const targetIndex = dayData.items.findIndex(i => i.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  // 取出被拖曳的項目
  const [draggedItem] = dayData.items.splice(draggedIndex, 1);

  // 重新計算插入的位置
  let insertIndex = dayData.items.findIndex(i => i.id === targetId);
  if (!placeBefore) {
    insertIndex += 1;
  }

  // 插入到新位置
  dayData.items.splice(insertIndex, 0, draggedItem);

  // 儲存至 LocalStorage 並刷新
  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  renderWorkspaceItinerary();
  showToast("行程順序已調整！", "success");
}


// 渲染備案景點與餐廳
function renderAlternativeSpots() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const alt = trip.alternativeSpots || { sights: [], restaurants: [] };
  
  // 渲染景點備案
  const sightsContainer = document.getElementById("ws-alt-sights-list");
  sightsContainer.innerHTML = "";
  if (alt.sights.length === 0) {
    sightsContainer.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-secondary); font-size:0.85rem;">暫無備案景點，點擊上方按鈕新增。</p>`;
  } else {
    alt.sights.forEach(spot => {
      const card = document.createElement("div");
      card.className = "alt-card sight-border";
      card.innerHTML = `
        <div class="alt-card-header">
          <span class="alt-card-name">📍 ${escapeHTML(spot.name)}</span>
          <span class="alt-card-badge">${escapeHTML(spot.subtype)}</span>
        </div>
        <div class="alt-card-meta">
          <div>⭐ 評分：<span class="star-badge">${escapeHTML(spot.rating)}</span></div>
          ${spot.address ? `<div>🏠 地址：<span>${escapeHTML(spot.address)}</span></div>` : ''}
          ${spot.hours ? `<div>🕒 營業：<span>${escapeHTML(spot.hours)}</span></div>` : ''}
          ${spot.price ? `<div>🎫 價格：<span>${escapeHTML(spot.price)}</span></div>` : ''}
        </div>
        <p class="alt-card-notes">${escapeHTML(spot.notes || '暫無備註')}</p>
        <div class="alt-card-actions">
          <a href="${spot.mapsUrl}" target="_blank" class="expense-map-link" style="font-size:0.8rem;">🗺️ 查看 Google 地圖</a>
          <div style="display:flex; gap:0.25rem;">
            <button class="btn btn-secondary" onclick="openAddToScheduleModal('${escapeHTML(spot.name)}', '${escapeHTML(spot.notes)}', 'sight')" style="font-size:0.75rem; padding:0.3rem 0.6rem;">➕ 加到行程</button>
            <button class="btn-icon" onclick="deleteAlternative('${spot.id}', 'sights')" style="width:1.8rem; height:1.8rem; padding:0; color:var(--danger); border-color:transparent;" title="刪除">✕</button>
          </div>
        </div>
      `;
      sightsContainer.appendChild(card);
    });
  }

  // 渲染餐廳備案
  const restaurantsContainer = document.getElementById("ws-alt-restaurants-list");
  restaurantsContainer.innerHTML = "";
  if (alt.restaurants.length === 0) {
    restaurantsContainer.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-secondary); font-size:0.85rem;">暫無備案餐廳，點擊上方按鈕新增。</p>`;
  } else {
    alt.restaurants.forEach(spot => {
      const card = document.createElement("div");
      card.className = "alt-card restaurant-border";
      card.innerHTML = `
        <div class="alt-card-header">
          <span class="alt-card-name">🍜 ${escapeHTML(spot.name)}</span>
          <span class="alt-card-badge">${escapeHTML(spot.subtype)}</span>
        </div>
        <div class="alt-card-meta">
          <div>⭐ 評分：<span class="star-badge">${escapeHTML(spot.rating)}</span></div>
          ${spot.address ? `<div>🏠 地址：<span>${escapeHTML(spot.address)}</span></div>` : ''}
          ${spot.hours ? `<div>🕒 營業：<span>${escapeHTML(spot.hours)}</span></div>` : ''}
          ${spot.price ? `<div>💰 價額：<span>${escapeHTML(spot.price)}</span></div>` : ''}
        </div>
        <p class="alt-card-notes">${escapeHTML(spot.notes || '暫無備註')}</p>
        <div class="alt-card-actions">
          <a href="${spot.mapsUrl}" target="_blank" class="expense-map-link" style="font-size:0.8rem;">🗺️ 查看 Google 地圖</a>
          <div style="display:flex; gap:0.25rem;">
            <button class="btn btn-secondary" onclick="openAddToScheduleModal('${escapeHTML(spot.name)}', '${escapeHTML(spot.notes)}', 'food')" style="font-size:0.75rem; padding:0.3rem 0.6rem;">➕ 加到行程</button>
            <button class="btn-icon" onclick="deleteAlternative('${spot.id}', 'restaurants')" style="width:1.8rem; height:1.8rem; padding:0; color:var(--danger); border-color:transparent;" title="刪除">✕</button>
          </div>
        </div>
      `;
      restaurantsContainer.appendChild(card);
    });
  }
}

// 備案庫切換 Sight / Restaurant
function switchAltTab(altTabName) {
  activeAlternativeTab = altTabName;
  document.querySelectorAll("[data-alt-tab]").forEach(btn => {
    if (btn.getAttribute("data-alt-tab") === altTabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  document.querySelectorAll(".alt-content-panel").forEach(panel => {
    panel.classList.remove("active");
  });
  document.getElementById(`alt-panel-${altTabName}`).classList.add("active");
}

// 行程日程 CRUD Modals
function openScheduleModal(itemId = null) {
  const modal = document.getElementById("schedule-modal");
  const form = document.getElementById("sche-form");
  const title = document.getElementById("sche-modal-title");
  
  form.reset();
  document.getElementById("sche-id").value = "";
  document.getElementById("sche-day-num").value = activeItineraryDay;

  if (itemId) {
    title.innerText = "修改日程行程項目";
    const trip = trips.find(t => t.id === activeTripId);
    let foundItem = null;
    if (trip && trip.itinerary) {
      trip.itinerary.days.forEach(d => {
        const item = d.items.find(i => i.id === itemId);
        if (item) foundItem = item;
      });
    }

    if (foundItem) {
      document.getElementById("sche-id").value = foundItem.id;
      document.getElementById("s-time").value = foundItem.time;
      document.getElementById("s-title").value = foundItem.title;
      document.getElementById("s-type").value = foundItem.type;
      document.getElementById("s-content").value = foundItem.content;
      document.getElementById("s-highlight").checked = !!foundItem.highlight;
      document.getElementById("s-maps-url").value = foundItem.mapsUrl || "";
      document.getElementById("s-address").value = foundItem.address || "";
      document.getElementById("s-rating").value = foundItem.rating || "";
      document.getElementById("s-hours").value = foundItem.hours || "";
    }
  } else {
    title.innerText = `新增 DAY ${activeItineraryDay} 行程項目`;
    document.getElementById("s-maps-url").value = "";
    document.getElementById("s-address").value = "";
    document.getElementById("s-rating").value = "";
    document.getElementById("s-hours").value = "";
  }

  modal.classList.add("active");
}

function closeScheduleModal() {
  document.getElementById("schedule-modal").classList.remove("active");
}

function handleScheduleSubmit(e) {
  e.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const id = document.getElementById("sche-id").value;
  const dayNum = parseInt(document.getElementById("sche-day-num").value) || activeItineraryDay;
  const time = document.getElementById("s-time").value.trim();
  const title = document.getElementById("s-title").value.trim();
  const type = document.getElementById("s-type").value;
  const content = document.getElementById("s-content").value.trim();
  const highlight = document.getElementById("s-highlight").checked;
  const mapsUrl = document.getElementById("s-maps-url").value.trim();
  const address = document.getElementById("s-address").value.trim();
  const rating = document.getElementById("s-rating").value.trim();
  const hours = document.getElementById("s-hours").value.trim();

  if (!trip.itinerary) {
    // 初始化空行程
    trip.itinerary = {
      title: trip.title,
      dates: trip.dateRange || trip.date,
      subInfo: `旅伴: ${trip.companion}`,
      days: []
    };
  }

  // 確保天數資料夾存在
  let dayData = trip.itinerary.days.find(d => d.dayNum === dayNum);
  if (!dayData) {
    dayData = { dayNum: dayNum, date: `Day ${dayNum}`, theme: "自由行程", desc: "", items: [] };
    trip.itinerary.days.push(dayData);
  }

  if (id) {
    // 編輯
    const idx = dayData.items.findIndex(item => item.id === id);
    if (idx !== -1) {
      dayData.items[idx] = { id, time, title, type, content, highlight, mapsUrl, address, rating, hours };
    }
    showToast("行程項目已成功修改！", "success");
  } else {
    // 新增
    const newItem = {
      id: "sche-" + Date.now(),
      time, title, type, content, highlight, mapsUrl, address, rating, hours
    };
    dayData.items.push(newItem);
    showToast("已成功新增行程日程！", "success");
  }

  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  closeScheduleModal();
  renderWorkspaceItinerary();
}

window.deleteScheduleItem = function(itemId) {
  if (confirm("確認要刪除這筆詳細日程項目嗎？")) {
    const trip = trips.find(t => t.id === activeTripId);
    if (trip && trip.itinerary) {
      trip.itinerary.days.forEach(d => {
        d.items = d.items.filter(item => item.id !== itemId);
      });
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceItinerary();
      showToast("已刪除該日程", "info");
    }
  }
};

function handleClearItinerary() {
  if (confirm("您確定要完全清空這趟旅程的詳細行程表嗎？（此動作不會刪除備案庫）")) {
    const trip = trips.find(t => t.id === activeTripId);
    if (trip) {
      trip.itinerary = null;
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceItinerary();
      showToast("詳細行程已清空", "info");
    }
  }
}

// 備案庫 CRUD
function openAlternativeModal(typeGroup) {
  const modal = document.getElementById("alternative-modal");
  const form = document.getElementById("alt-form");
  const title = document.getElementById("alt-modal-title");
  
  form.reset();
  document.getElementById("alt-id").value = "";
  document.getElementById("alt-type-group").value = typeGroup;

  title.innerText = typeGroup === "sights" ? "新增景點備案庫卡片" : "新增餐廳推薦備案卡片";
  modal.classList.add("active");
}

function closeAlternativeModal() {
  document.getElementById("alternative-modal").classList.remove("active");
}

function handleAlternativeSubmit(e) {
  e.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const typeGroup = document.getElementById("alt-type-group").value; // sights 或 restaurants
  const name = document.getElementById("a-name").value.trim();
  const subtype = document.getElementById("a-subtype").value.trim();
  const rating = document.getElementById("a-rating").value.trim();
  const mapsUrl = document.getElementById("a-mapsurl").value.trim();
  const address = document.getElementById("a-address").value.trim();
  const hours = document.getElementById("a-hours").value.trim();
  const price = document.getElementById("a-price").value.trim();
  const notes = document.getElementById("a-notes").value.trim();

  if (!trip.alternativeSpots) {
    trip.alternativeSpots = { sights: [], restaurants: [] };
  }

  const newItem = {
    id: "alt-" + Date.now(),
    name, subtype, rating, mapsUrl, address, hours, price, notes
  };

  trip.alternativeSpots[typeGroup].push(newItem);
  localStorage.setItem("voyage_trips", JSON.stringify(trips));

  closeAlternativeModal();
  renderAlternativeSpots();
  showToast(`已成功將 ${name} 加入備案庫！`, "success");
}

window.deleteAlternative = function(id, typeGroup) {
  if (confirm("確認要刪除這筆備案推薦卡片嗎？")) {
    const trip = trips.find(t => t.id === activeTripId);
    if (trip && trip.alternativeSpots && trip.alternativeSpots[typeGroup]) {
      trip.alternativeSpots[typeGroup] = trip.alternativeSpots[typeGroup].filter(item => item.id !== id);
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderAlternativeSpots();
      showToast("備案已移除", "info");
    }
  }
};

// 備案「加到行程」一鍵加入邏輯
window.openAddToScheduleModal = function(name, notes, type) {
  const modal = document.getElementById("add-to-schedule-modal");
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  document.getElementById("add-to-sche-name").value = name;
  document.getElementById("add-to-sche-notes").value = notes;
  document.getElementById("add-to-sche-type").value = type;

  // 載入天數選擇下拉選單
  const select = document.getElementById("ats-day");
  select.innerHTML = "";
  const daysCount = parseInt(trip.duration) || 1;
  for (let i = 1; i <= daysCount; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.innerText = `DAY ${i}`;
    select.appendChild(opt);
  }

  document.getElementById("ats-time").value = "12:00"; // 預設時間

  modal.classList.add("active");
};

function handleAddToScheduleSubmit(e) {
  e.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const name = document.getElementById("add-to-sche-name").value;
  const notes = document.getElementById("add-to-sche-notes").value;
  const type = document.getElementById("add-to-sche-type").value;
  
  const dayNum = parseInt(document.getElementById("ats-day").value) || 1;
  const time = document.getElementById("ats-time").value.trim();

  if (!trip.itinerary) {
    trip.itinerary = { title: trip.title, dates: trip.dateRange || trip.date, subInfo: "", days: [] };
  }

  let dayData = trip.itinerary.days.find(d => d.dayNum === dayNum);
  if (!dayData) {
    dayData = { dayNum: dayNum, date: `Day ${dayNum}`, theme: "自選行程", desc: "", items: [] };
    trip.itinerary.days.push(dayData);
  }

  // 從備案庫中查找匹配的景點/餐廳以取得地圖連結、地址與評分
  const alt = trip.alternativeSpots || { sights: [], restaurants: [] };
  const allSpots = [...alt.sights, ...alt.restaurants];
  const matchedSpot = allSpots.find(s => s.name === name);
  const mapsUrl = matchedSpot ? (matchedSpot.mapsUrl || "") : "";
  const address = matchedSpot ? (matchedSpot.address || "") : "";
  const rating = matchedSpot ? (matchedSpot.rating || "") : "";
  const hours = matchedSpot ? (matchedSpot.hours || "") : "";

  const newItem = {
    id: "sche-" + Date.now(),
    time: time,
    title: name,
    type: type,
    content: notes || "由備案推薦加到今日詳細行程規劃。",
    highlight: false,
    mapsUrl: mapsUrl,
    address: address,
    rating: rating,
    hours: hours
  };

  dayData.items.push(newItem);
  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  document.getElementById("add-to-schedule-modal").classList.remove("active");
  
  // 切換到對應天數並重新渲染
  activeItineraryDay = dayNum;
  renderWorkspaceItinerary();
  showToast(`已成功將「${name}」排入 Day ${dayNum} 行程中！`, "success");
}

// 智慧匯入行程邏輯
function handleItineraryImport() {
  const jsonText = document.getElementById("importer-json-textarea").value.trim();
  if (!jsonText) {
    showToast("請填寫 JSON 資料！", "error");
    return;
  }

  try {
    const data = JSON.parse(jsonText);
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;

    // A. 智慧適配器：繁體中文大語言模型輸出格式 (如使用者所貼格式)
    if (data["行程名稱"] || data["每日詳細行程"] || data["沿途推薦景點備案庫_供自由挑選加點"]) {
      const converted = {
        title: (data["行程名稱"] || "我的旅行計畫").replace(/\[cite:\s*\d+\]/g, ""),
        dates: (data["旅遊日期"] || "").replace(/\[cite:\s*\d+\]/g, ""),
        subInfo: `旅伴: ${(data["人數成員"] || "朋友").replace(/\[cite:\s*\d+\]/g, "")} | 住宿: ${data["每日詳細行程"] && data["每日詳細行程"][0] ? (data["每日詳細行程"][0]["今日住宿"] || "未定").replace(/\[cite:\s*\d+\]/g, "") : "未定"}`,
        stats: [
          { label: "旅伴人員", value: (data["人數成員"] || "朋友").replace(/\[cite:\s*\d+\]/g, "") },
          { label: "行李戰略", value: data["行李戰略說明"] ? data["行李戰略說明"].replace(/\[cite:\s*\d+\]/g, "").substring(0, 30) + "..." : "無" }
        ],
        days: (data["每日詳細行程"] || []).map(day => {
          let dayNum = 1;
          const dayStr = String(day["天數"] || day.day || "1");
          const matchNum = dayStr.match(/\d+/);
          if (matchNum) {
            dayNum = parseInt(matchNum[0]);
          }

          return {
            dayNum: dayNum,
            date: (day["日期"] || dayStr).replace(/\[cite:\s*\d+\]/g, ""),
            theme: (day["行程亮點"] || "").replace(/\[cite:\s*\d+\]/g, ""),
            desc: `住宿: ${(day["今日住宿"] || "未定").replace(/\[cite:\s*\d+\]/g, "")} | 交通: ${(day["今日交通方式"] || "自駕").replace(/\[cite:\s*\d+\]/g, "")}`,
            items: (day["當日時間軸"] || []).map(item => {
              const title = (item["項目"] || item.title || "").replace(/\[cite:\s*\d+\]/g, "");
              const content = (item["詳細說明"] || item.content || "").replace(/\[cite:\s*\d+\]/g, "");
              let mapsUrl = (item["GOOGLE地圖搜尋連結"] || item.google_maps || item.mapsUrl || "").replace(/\[cite:\s*\d+\]/g, "");
              let address = (item["地點"] || "").replace(/\[cite:\s*\d+\]/g, "");
              let type = "sight";

              // 關鍵字推算類別
              const textForType = `${title} ${content}`.toLowerCase();
              if (textForType.includes("機場") || textForType.includes("航班") || textForType.includes("降落") || textForType.includes("登機") || textForType.includes("ngo")) type = "flight";
              else if (textForType.includes("火車") || textForType.includes("名鐵") || textForType.includes("電車") || textForType.includes("鐵路") || textForType.includes("特急") || textForType.includes("近鐵")) type = "train";
              else if (textForType.includes("重機") || textForType.includes("自駕") || textForType.includes("租車") || textForType.includes("車行") || textForType.includes("騎行") || textForType.includes("騎車") || textForType.includes("騎士") || textForType.includes("rental")) type = "bike";
              else if (textForType.includes("午餐") || textForType.includes("晚餐") || textForType.includes("美食") || textForType.includes("料理") || textForType.includes("拉麵") || textForType.includes("吃") || textForType.includes("餐") || textForType.includes("料亭") || textForType.includes("壽喜燒")) type = "food";
              else if (textForType.includes("飯店") || textForType.includes("旅館") || textForType.includes("住宿") || textForType.includes("酒店") || textForType.includes("入住") || textForType.includes("民宿")) type = "hotel";

              // 智慧自動填充地址、評分與營業時間
              const alt = trip.alternativeSpots || { sights: [], restaurants: [] };
              const allSpots = [...alt.sights, ...alt.restaurants];
              const resolved = autoFillImportedItem({ mapsUrl }, title, type, trip.location, allSpots);

              return {
                id: "sche-" + Math.random(),
                time: item["時間"] || item.time || "09:00",
                title: title,
                content: content,
                type: type,
                highlight: textForType.includes("重要") || textForType.includes("極致") || textForType.includes("大餐") || textForType.includes("朝聖") || textForType.includes("天花板") || textForType.includes("狂飆"),
                mapsUrl: mapsUrl || resolved.mapsUrl,
                address: address || resolved.address,
                rating: resolved.rating,
                hours: resolved.hours
              };
            })
          };
        })
      };

      trip.itinerary = converted;

      // 智慧匯入備案庫
      const altSpotsPool = data["沿途推薦景點備案庫_供自由挑選加點"] || data.alternative_spots || [];
      if (altSpotsPool.length > 0) {
        if (!trip.alternativeSpots) trip.alternativeSpots = { sights: [], restaurants: [] };
        altSpotsPool.forEach(spot => {
          const name = (spot["景點名稱"] || spot.name || "").replace(/\[cite:\s*\d+\]/g, "");
          const desc = (spot["特點說明"] || spot.notes || "").replace(/\[cite:\s*\d+\]/g, "");
          const area = (spot["區域位置"] || "").replace(/\[cite:\s*\d+\]/g, "");
          const indexStr = spot["推薦指數"] || "★★★★☆";
          const ratingVal = `⭐️ ${(indexStr.split("★").length - 1).toFixed(1)} (推薦)`;
          
          const isRest = name.includes("餐廳") || name.includes("食") || name.includes("和牛") || name.includes("大餐") || name.includes("酒") || desc.includes("吃") || desc.includes("料理");
          const grp = isRest ? "restaurants" : "sights";

          // 利用真實資料庫補齊地址與營業時間
          const resolved = autoFillImportedItem({ name }, name, isRest ? "food" : "sight", trip.location, []);

          trip.alternativeSpots[grp].push({
            id: "alt-" + Math.random(),
            name: name,
            subtype: area || (isRest ? "美食餐廳" : "推薦景點"),
            rating: resolved.rating || ratingVal,
            mapsUrl: (spot["GOOGLE地圖搜尋連結"] || spot.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`).replace(/\[cite:\s*\d+\]/g, ""),
            address: resolved.address || "",
            hours: resolved.hours || "依現場為準",
            price: isRest ? "人均消費另計" : "門票/費用另計",
            notes: desc
          });
        });
      }

      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      document.getElementById("itinerary-importer-modal").classList.remove("active");
      activeItineraryDay = 1;
      renderWorkspaceItinerary();
      showToast("智慧識別中文 AI 行程與備案匯入成功！", "success");
      return;
    }

    // B. 原有智慧適配器：判斷是否為 trip_overview / itinerary 雙層結構
    if (data.trip_overview && data.itinerary) {
      const converted = {
        title: data.trip_overview.title.replace(/\[cite:\s*\d+\]/g, ""),
        dates: data.trip_overview.date_range.replace(/\[cite:\s*\d+\]/g, ""),
        subInfo: `旅伴: ${data.trip_overview.travelers.replace(/\[cite:\s*\d+\]/g, "")} | 租借/交通: ${data.trip_overview.moto_rental_shop ? data.trip_overview.moto_rental_shop.replace(/\[cite:\s*\d+\]/g, "") : '自駕'}`,
        stats: [
          { label: "此行同伴", value: data.trip_overview.travelers.replace(/\[cite:\s*\d+\]/g, "") },
          { label: "行李限制", value: data.trip_overview.luggage_allowance ? data.trip_overview.luggage_allowance.replace(/\[cite:\s*\d+\]/g, "") : '無限制' }
        ],
        days: data.itinerary.map(day => {
          return {
            dayNum: parseInt(day.day) || 1,
            date: day.date.replace(/\[cite:\s*\d+\]/g, ""),
            theme: day.theme.replace(/\[cite:\s*\d+\]/g, ""),
            desc: `住宿: ${day.accommodation ? day.accommodation.replace(/\[cite:\s*\d+\]/g, "") : '未定'} | 交通: ${day.transportation ? day.transportation.replace(/\[cite:\s*\d+\]/g, "") : '自駕'}`,
            items: (day.daily_schedule || []).map(item => {
              const actText = item.activity.replace(/\[cite:\s*\d+\]/g, "");
              let title = actText;
              let content = actText;
              let type = "sight";

              // 關鍵字推算 icon
              if (actText.includes("機場") || actText.includes("降落") || actText.includes("入境") || actText.includes("托運")) type = "flight";
              else if (actText.includes("火車") || actText.includes("名鐵") || actText.includes("電車") || actText.includes("特急") || actText.includes("林鐵") || actText.includes("搭乘")) type = "train";
              else if (actText.includes("重機") || actText.includes("自駕") || actText.includes("租車") || actText.includes("騎士") || actText.includes("騎車") || actText.includes("開車")) type = "bike";
              else if (actText.includes("烏龍麵") || actText.includes("午餐") || actText.includes("晚餐") || actText.includes("美食") || actText.includes("餐廳") || actText.includes("吃") || actText.includes("飯")) type = "food";
              else if (actText.includes("飯店") || actText.includes("旅館") || actText.includes("入住") || actText.includes("住宿") || actText.includes("賓館") || actText.includes("民宿")) type = "hotel";

              // 拆分標題與本文 (如果有冒號或箭頭)
              const splits = ["：", "➔", "➡️", "=>"];
              for (let s of splits) {
                if (actText.includes(s)) {
                  const parts = actText.split(s);
                  title = parts[0].trim();
                  content = parts.slice(1).join(s).trim();
                  break;
                }
              }

              if (title === content && actText.length > 22) {
                title = actText.substring(0, 16) + "...";
              }

              const highlight = actText.includes("重要") || actText.includes("日出") || actText.includes("極致") || actText.includes("朝聖") || actText.includes("百老名店");

              // 智慧自動填充與對應備案/Mock 資料
              const alt = trip.alternativeSpots || { sights: [], restaurants: [] };
              const allSpots = [...alt.sights, ...alt.restaurants];
              const resolved = autoFillImportedItem(item, title, type, trip.location, allSpots);

              return {
                id: "sche-" + Math.random(),
                time: item.time,
                title: title,
                content: content,
                type: type,
                highlight: highlight,
                mapsUrl: resolved.mapsUrl,
                address: resolved.address,
                rating: resolved.rating,
                hours: resolved.hours
              };
            })
          };
        })
      };

      trip.itinerary = converted;
      
      // 自動同步備案
      if (data.alternative_spots_pool) {
        if (!trip.alternativeSpots) trip.alternativeSpots = { sights: [], restaurants: [] };
        if (data.alternative_spots_pool.spots) {
          data.alternative_spots_pool.spots.forEach(spot => {
            const isRest = spot.type.includes("餐廳") || spot.type.includes("美食") || spot.type.includes("吃");
            const grp = isRest ? "restaurants" : "sights";
            trip.alternativeSpots[grp].push({
              id: "alt-" + Math.random(),
              name: spot.name,
              subtype: spot.type,
              rating: "⭐️ 4.5",
              mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name)}`,
              address: "",
              hours: "依現場為準",
              price: "門票/費用另計",
              notes: spot.features
            });
          });
        }
      }

      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      document.getElementById("itinerary-importer-modal").classList.remove("active");
      activeItineraryDay = 1;
      renderWorkspaceItinerary();
      showToast("智慧適配 Itinerary 匯入成功！", "success");
      return;
    }

    // C. 原有標準格式
    if (!data.title || !data.days) {
      throw new Error("格式無效");
    }

    // 遍歷原有格式的天數和項目，進行補齊或智慧填充地圖、地址、評分與營業時間
    const alt = trip.alternativeSpots || { sights: [], restaurants: [] };
    const allSpots = [...alt.sights, ...alt.restaurants];
    data.days.forEach(day => {
      if (day.items) {
        day.items.forEach(item => {
          const resolved = autoFillImportedItem(item, item.title, item.type, trip.location, allSpots);
          if (!item.mapsUrl) item.mapsUrl = resolved.mapsUrl;
          if (!item.address) item.address = resolved.address;
          if (!item.rating) item.rating = resolved.rating;
          if (!item.hours) item.hours = resolved.hours;
        });
      }
    });

    trip.itinerary = data;
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    document.getElementById("itinerary-importer-modal").classList.remove("active");
    activeItineraryDay = 1;
    renderWorkspaceItinerary();
    showToast("日程規劃一鍵匯入成功！", "success");
  } catch (err) {
    showToast("JSON 格式解析錯誤，請確認格式正確！", "error");
    console.error(err);
  }
}


// ==================== WORKSPACE B: 行李與待辦清單 ====================
function renderWorkspaceChecklists() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  // 1. 行前行李清單
  const luggageList = trip.packingList || [];
  const totalLug = luggageList.length;
  const checkedLug = luggageList.filter(item => item.checked).length;
  const lugPct = totalLug > 0 ? (checkedLug / totalLug) * 100 : 0;

  document.getElementById("luggage-progress-txt").innerText = `${checkedLug} / ${totalLug} (${Math.round(lugPct)}%)`;
  document.getElementById("luggage-progress-bar").style.width = `${lugPct}%`;

  // 按類別分組
  const groups = {};
  luggageList.forEach(item => {
    const cat = item.category || "日常雜物 🎒";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  const luggageGrid = document.getElementById("ws-luggage-grid");
  luggageGrid.innerHTML = "";

  Object.entries(groups).forEach(([category, items]) => {
    const card = document.createElement("div");
    let catClass = "cat-daily";
    if (category.includes("證件")) catClass = "cat-docs";
    else if (category.includes("電子") || category.includes("配件")) catClass = "cat-elec";
    else if (category.includes("衣物") || category.includes("盥洗")) catClass = "cat-clothes";
    else if (category.includes("藥品") || category.includes("日常藥品")) catClass = "cat-meds";
    card.className = `packing-category-card ${catClass}`;

    let itemsHtml = "";
    items.forEach(item => {
      const isCh = item.checked ? "checked" : "";
      itemsHtml += `
        <div class="packing-item-row ${isCh}" onclick="toggleLuggageItem(${item.id})">
          <div class="packing-item-left">
            <input type="checkbox" class="packing-checkbox" ${item.checked ? 'checked' : ''} onclick="event.stopPropagation(); toggleLuggageItem(${item.id})">
            <span class="packing-item-text">${escapeHTML(item.name)}</span>
          </div>
          <button class="packing-delete-btn" onclick="event.stopPropagation(); deleteLuggageItem(${item.id})">✕</button>
        </div>
      `;
    });

    const categorySafeId = category.replace(/[^\w\u4e00-\u9fa5]/g, "");

    card.innerHTML = `
      <div class="packing-category-title">
        <span>${category}</span>
        <span style="font-size:0.75rem; font-weight:normal; opacity:0.8;">(${items.filter(i=>i.checked).length}/${items.length})</span>
      </div>
      <div class="packing-items-list">
        ${itemsHtml}
      </div>
      <div class="packing-quick-add">
        <input type="text" class="packing-quick-input" id="lug-input-${categorySafeId}" placeholder="新增品項...">
        <button class="btn btn-secondary" style="padding:0.35rem 0.75rem; border-radius:8px; font-size:0.75rem;" onclick="addLuggageItem('${escapeHTML(category)}')">新增</button>
      </div>
    `;

    // 綁定輸入框 Enter 事件
    card.querySelector("input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        addLuggageItem(category);
      }
    });

    luggageGrid.appendChild(card);
  });

  // 如果清單為空，給個提示
  if (totalLug === 0) {
    luggageGrid.innerHTML = `<p style="padding:2rem; text-align:center; color:var(--text-secondary); grid-column:1/-1;">您的行李箱空空如也，請在下方或手動新增物品！</p>`;
  }

  // 2. 待辦清單
  const todoList = trip.todoList || [];
  const todoContainer = document.getElementById("ws-todo-list");
  todoContainer.innerHTML = "";
  document.getElementById("todo-progress-txt").innerText = `${todoList.filter(t=>t.checked).length} / ${todoList.length}`;

  todoList.forEach(item => {
    const isCh = item.checked ? "checked" : "";
    const row = document.createElement("div");
    row.className = `checklist-simple-row ${isCh}`;
    row.onclick = () => toggleTodoItem(item.id);
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
        <input type="checkbox" class="packing-checkbox" ${item.checked ? 'checked' : ''} onclick="event.stopPropagation(); toggleTodoItem(item.id)">
        <span class="todo-text" style="font-size:0.9rem;">${escapeHTML(item.name)}</span>
        ${item.date ? `<span style="font-size:0.75rem; opacity:0.6; background:var(--badge-bg); padding:1px 5px; border-radius:4px;">${escapeHTML(item.date)}</span>` : ''}
      </div>
      <button class="packing-delete-btn" onclick="event.stopPropagation(); deleteTodoItem(${item.id})">✕</button>
    `;
    todoContainer.appendChild(row);
  });

  if (todoList.length === 0) {
    todoContainer.innerHTML = `<p style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.8rem;">暫無待辦事項。</p>`;
  }

  // 3. 願望清單
  const wishList = trip.wishlist || [];
  const wishContainer = document.getElementById("ws-wish-list");
  wishContainer.innerHTML = "";
  document.getElementById("wish-progress-txt").innerText = `${wishList.filter(t=>t.checked).length} / ${wishList.length}`;

  wishList.forEach(item => {
    const isCh = item.checked ? "checked" : "";
    const row = document.createElement("div");
    row.className = `checklist-simple-row ${isCh}`;
    row.onclick = () => toggleWishItem(item.id);
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
        <input type="checkbox" class="packing-checkbox" ${item.checked ? 'checked' : ''} onclick="event.stopPropagation(); toggleWishItem(item.id)">
        <span class="todo-text" style="font-size:0.9rem;">${escapeHTML(item.name)}</span>
        <span style="font-size:0.75rem; color:var(--accent-color); font-weight:700;">(NT$ ${parseInt(item.price).toLocaleString()})</span>
      </div>
      <button class="packing-delete-btn" onclick="event.stopPropagation(); deleteWishItem(${item.id})">✕</button>
    `;
    wishContainer.appendChild(row);
  });

  if (wishList.length === 0) {
    wishContainer.innerHTML = `<p style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.8rem;">暫無願望清單。</p>`;
  }
}

// 行李項目互動
window.toggleLuggageItem = function(id) {
  const trip = trips.find(t => t.id === activeTripId);
  if (trip && trip.packingList) {
    const item = trip.packingList.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceChecklists();
    }
  }
};

window.deleteLuggageItem = function(id) {
  const trip = trips.find(t => t.id === activeTripId);
  if (trip && trip.packingList) {
    trip.packingList = trip.packingList.filter(i => i.id !== id);
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    renderWorkspaceChecklists();
  }
};

window.addLuggageItem = function(category) {
  const categorySafeId = category.replace(/[^\w\u4e00-\u9fa5]/g, "");
  const input = document.getElementById(`lug-input-${categorySafeId}`);
  const name = input.value.trim();
  if (!name) return;

  const trip = trips.find(t => t.id === activeTripId);
  if (trip) {
    if (!trip.packingList) trip.packingList = [];
    const newItem = {
      id: Date.now(),
      category: category,
      name: name,
      checked: false
    };
    trip.packingList.push(newItem);
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    input.value = "";
    renderWorkspaceChecklists();
    showToast(`已將 ${name} 加入行前打包！`, "success");
  }
};

// 待辦項目互動
function toggleTodoItem(id) {
  const trip = trips.find(t => t.id === activeTripId);
  if (trip && trip.todoList) {
    const item = trip.todoList.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceChecklists();
    }
  }
}

function deleteTodoItem(id) {
  const trip = trips.find(t => t.id === activeTripId);
  if (trip && trip.todoList) {
    trip.todoList = trip.todoList.filter(i => i.id !== id);
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    renderWorkspaceChecklists();
  }
}

function handleTodoAdd() {
  const nameInput = document.getElementById("todo-new-name");
  const dateInput = document.getElementById("todo-new-date");
  const name = nameInput.value.trim();
  const date = dateInput.value.trim();
  if (!name) return;

  const trip = trips.find(t => t.id === activeTripId);
  if (trip) {
    if (!trip.todoList) trip.todoList = [];
    trip.todoList.push({
      id: Date.now(),
      name: name,
      date: date,
      checked: false
    });
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    nameInput.value = "";
    dateInput.value = "";
    renderWorkspaceChecklists();
    showToast(`待辦項目已加入！`, "success");
  }
}

// 願望項目互動
function toggleWishItem(id) {
  const trip = trips.find(t => t.id === activeTripId);
  if (trip && trip.wishlist) {
    const item = trip.wishlist.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceChecklists();
    }
  }
}

function deleteWishItem(id) {
  const trip = trips.find(t => t.id === activeTripId);
  if (trip && trip.wishlist) {
    trip.wishlist = trip.wishlist.filter(i => i.id !== id);
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    renderWorkspaceChecklists();
  }
}

function handleWishAdd() {
  const nameInput = document.getElementById("wish-new-name");
  const priceInput = document.getElementById("wish-new-price");
  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value) || 0;
  if (!name) return;

  const trip = trips.find(t => t.id === activeTripId);
  if (trip) {
    if (!trip.wishlist) trip.wishlist = [];
    trip.wishlist.push({
      id: Date.now(),
      name: name,
      price: price,
      checked: false
    });
    localStorage.setItem("voyage_trips", JSON.stringify(trips));
    nameInput.value = "";
    priceInput.value = "";
    renderWorkspaceChecklists();
    showToast(`願望清單已更新！`, "success");
  }
}


// ==================== WORKSPACE C: 費用預算與記帳 ====================
function renderWorkspaceBudget() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  // 1. 渲染費用明細表
  const expenses = trip.ledger || [];
  const tbody = document.getElementById("ws-expense-tbody");
  tbody.innerHTML = "";

  let expenseTotal = 0;
  let mePaidSum = 0;
  let friendPaidSum = 0;

  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-secondary);">尚未記錄任何消費，點擊右上方「新增支出」！</td></tr>`;
  } else {
    expenses.forEach(item => {
      const price = parseInt(item.cost) || 0;
      const qty = parseInt(item.splitCount) || 1;
      const subtotal = price; // 價格欄位為整筆總額，或小計，我們以 item.cost 作為總額
      expenseTotal += subtotal;

      // 檢查備註中是否有 google maps 連結
      let notesHtml = escapeHTML(item.notes || '—');
      const mapUrlMatch = item.notes ? item.notes.match(/https:\/\/maps\.[^\s]+/g) : null;
      if (mapUrlMatch) {
        notesHtml = notesHtml.replace(mapUrlMatch[0], `<a href="${mapUrlMatch[0]}" target="_blank" class="expense-map-link">🗺️ 查看地圖</a>`);
      } else {
        // 如果沒有填地圖連結，但有地標名稱，預設給搜尋連結
        notesHtml += ` <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}" target="_blank" class="expense-map-link" style="font-size:0.75rem;">🗺️ 搜尋</a>`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:700; color:var(--text-primary);">${escapeHTML(item.name)}</td>
        <td style="text-align:center;"><span class="iti-pill">DAY ${item.day}</span></td>
        <td><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${CATEGORY_COLORS[item.category] || '#6b7280'}; margin-right:6px;"></span>${item.category}</td>
        <td style="text-align:right; font-family:'Outfit';">NT$ ${price.toLocaleString()}</td>
        <td style="text-align:center;">${qty} 人分</td>
        <td style="text-align:right; font-weight:700; color:var(--accent-color); font-family:'Outfit';">NT$ ${Math.round(price / qty).toLocaleString()}</td>
        <td style="font-size:0.8rem;">${notesHtml}</td>
        <td style="text-align:center;">
          <div class="card-actions" style="justify-content:center; gap:0.25rem;">
            <button class="btn-icon" onclick="openExpenseModal('${item.id}')" style="width:1.8rem; height:1.8rem; padding:0;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn-icon" onclick="deleteExpenseItem('${item.id}')" style="width:1.8rem; height:1.8rem; padding:0; color:var(--danger); border-color:transparent;">✕</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 總計行
    const totalTr = document.createElement("tr");
    totalTr.className = "total-row";
    totalTr.innerHTML = `
      <td>總預算累計</td>
      <td colspan="2"></td>
      <td style="text-align:right; font-family:'Outfit';">NT$ ${expenseTotal.toLocaleString()}</td>
      <td></td>
      <td style="text-align:right; font-family:'Outfit'; color:var(--accent-color);">—</td>
      <td colspan="2">（整趟行程每人預算參考）</td>
    `;
    tbody.appendChild(totalTr);
  }

  // 2. 渲染同行代墊款項
  const advances = trip.advances || [];
  const advBody = document.getElementById("ws-advance-tbody");
  advBody.innerHTML = "";

  // 分帳累計字典
  const payersPaid = {}; // payer => total_amount

  if (advances.length === 0) {
    advBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-secondary);">暫無友人代墊，點擊右方新增。</td></tr>`;
  } else {
    advances.forEach(item => {
      const amount = parseInt(item.amount) || 0;
      const count = parseInt(item.splitCount) || 5;
      const share = Math.round(amount / count);

      const payerKey = item.payer.trim();
      payersPaid[payerKey] = (payersPaid[payerKey] || 0) + amount;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:700;">${escapeHTML(item.payer)}</td>
        <td>${escapeHTML(item.date || '—')}</td>
        <td>${escapeHTML(item.item)}</td>
        <td style="text-align:right; font-family:'Outfit';">NT$ ${amount.toLocaleString()}</td>
        <td style="text-align:center;">${count} 人</td>
        <td style="text-align:right; font-weight:700; font-family:'Outfit';">NT$ ${share.toLocaleString()}</td>
        <td style="font-size:0.8rem;">${escapeHTML(item.notes || '—')}</td>
        <td style="text-align:center;">
          <div class="card-actions" style="justify-content:center; gap:0.25rem;">
            <button class="btn-icon" onclick="openAdvanceModal('${item.id}')" style="width:1.6rem; height:1.6rem; padding:0;">✕</button>
            <button class="btn-icon" onclick="deleteAdvanceItem('${item.id}')" style="width:1.6rem; height:1.6rem; padding:0; color:var(--danger); border-color:transparent;">✕</button>
          </div>
        </td>
      `;
      advBody.appendChild(tr);
    });
  }

  // 3. 渲染還款管道資訊
  const repays = trip.repayInfo || [];
  const repayBody = document.getElementById("ws-repay-tbody");
  repayBody.innerHTML = "";

  if (repays.length === 0) {
    repayBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-secondary);">尚未設定收款轉帳帳戶。</td></tr>`;
  } else {
    repays.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:700;">${escapeHTML(item.name)}</td>
        <td><span class="iti-pill">${escapeHTML(item.method)}</span></td>
        <td style="font-family:monospace; font-size:0.85rem;">${escapeHTML(item.account)}</td>
        <td style="text-align:center;">
          <button class="btn-icon" onclick="deleteRepayItem('${item.id}')" style="width:1.6rem; height:1.6rem; padding:0; color:var(--danger); border-color:transparent;">✕</button>
        </td>
      `;
      repayBody.appendChild(tr);
    });
  }

  // 4. 計算債務清算關係 (極致 N 人分帳)
  // 設定此行旅伴人數
  const travelersCount = parseInt(trip.travelers) || 2; 

  // 我們以 advances 進行分帳：
  // 假設群組共有 N 個人。在代墊款項中，有朋友（例如：翔翔、郁魚）和 我 墊付。
  // 我們算「我付款」與「朋友付款」的債務抵銷。
  // 若 User 為「我」(me)，則 User 的代墊款項為 `payer === "我" || payer === "me" || payer.toLowerCase() === "user"`
  let userPaidTotal = 0;
  let othersPaidTotal = 0;
  const friendsLedger = {}; // friendName => net amount (User owes Friend if positive, Friend owes User if negative)

  // 計算每個人對 Advances 的代墊貢獻
  // 阿里山為例：翔翔代墊住宿 5400 (5人分)，郁魚代墊車票 750 (5人分)。
  // 對翔翔代墊的 5400，每人分攤 1080。因為翔翔是 payer，其他 4 個人每人欠翔翔 1080。User 欠翔翔 1080。
  // 對郁魚代墊的 750，每人分攤 150。User 欠郁魚 150。
  // 若 User 代墊 A，每人分攤 A/N。朋友每人欠 User A/N。
  
  advances.forEach(adv => {
    const amt = parseInt(adv.amount) || 0;
    const split = parseInt(adv.splitCount) || travelersCount;
    const share = amt / split;
    const payer = adv.payer.trim();

    const isUser = payer === "我" || payer === "me" || payer.toLowerCase() === "user" || payer === "User";

    if (isUser) {
      userPaidTotal += amt;
      // 朋友們均分這筆錢
      // 對於 Advances 列表，若我付了 A 且由 N 人均分。則除了我以外的 (N-1) 個人，每人欠我 A/N。
      // 我們可以用一個虛擬的好友集體（朋友）來欠我。
      // 或者如果有具體代墊，我們把它分攤到出現在 Advances 中的朋友或設定的旅伴。
      // 為了簡單且與 Excel 邏輯一致，我們將「我支付」的份額除了自己外，剩下的分攤給朋友。
      // 假設主要代墊對象為 Advances 出現的其他人。
      // 如果 Advances 中只有翔翔和郁魚，那麼債務直接抵消：
      // User 欠翔翔 = 翔翔代墊的個人分攤額。
      // User 欠郁魚 = 郁魚代墊的個人分攤額。
      // 翔翔、郁魚 欠 User = User 代墊的總額 / N。
    } else {
      othersPaidTotal += amt;
      // User 欠 payer 錢
      friendsLedger[payer] = (friendsLedger[payer] || 0) + share;
    }
  });

  // 分發 User 的代墊款項給所有其他朋友 (均分)
  const uniqueFriends = Object.keys(friendsLedger);
  const friendsCount = uniqueFriends.length || (travelersCount - 1) || 1;
  const userShare = userPaidTotal / travelersCount;
  
  uniqueFriends.forEach(friend => {
    // 該朋友應該分攤 User 墊付的 (UserPaidTotal / TravelersCount)
    friendsLedger[friend] -= userShare;
  });

  // 渲染債務結果
  const settlementDiv = document.getElementById("ws-ledger-settlement-render");
  settlementDiv.innerHTML = "";

  // 計算累計總花費 (為 expenses 總計與 advances 總計的總和)
  const grandTotalBudget = expenseTotal; // 以費用明細為總開銷
  document.getElementById("ws-ledger-grand-total").innerText = `NT$ ${grandTotalBudget.toLocaleString()}`;
  document.getElementById("ws-ledger-payer-summary").innerText = `由我支付(明細個人)：NT$ ${(expenses.filter(e=>e.splitCount === 1).reduce((s,i)=>s+i.cost,0) + userShare).toLocaleString()} | 同行代墊累計：NT$ ${(userPaidTotal + othersPaidTotal).toLocaleString()}`;

  let settlementHtml = "";
  let hasDebt = false;

  Object.entries(friendsLedger).forEach(([friendName, balance]) => {
    if (Math.abs(balance) < 1) return; // 忽略極小餘額
    hasDebt = true;

    if (balance > 0) {
      settlementHtml += `<div class="debt-highlight red" style="font-size:0.95rem; margin-bottom:0.35rem;">您需要向【${escapeHTML(friendName)}】還款：<strong>NT$ ${Math.round(balance).toLocaleString()} 元</strong></div>`;
    } else {
      settlementHtml += `<div class="debt-highlight green" style="font-size:0.95rem; margin-bottom:0.35rem;">【${escapeHTML(friendName)}】需要向您支付：<strong>NT$ ${Math.round(Math.abs(balance)).toLocaleString()} 元</strong></div>`;
    }
  });

  if (!hasDebt) {
    settlementDiv.innerHTML = `<div class="debt-highlight neutral" style="font-size:0.95rem;">同行代墊結算平衡，互不相欠 🤝</div>`;
  } else {
    settlementDiv.innerHTML = settlementHtml;
  }
}

// 記帳 CRUD
function openExpenseModal(itemId = null) {
  const modal = document.getElementById("expense-modal");
  const form = document.getElementById("expense-form");
  const title = document.getElementById("expense-modal-title");
  
  form.reset();
  document.getElementById("exp-id").value = "";

  // 載入天數下拉選單
  const select = document.getElementById("exp-day");
  select.innerHTML = "";
  const trip = trips.find(t => t.id === activeTripId);
  if (trip) {
    const daysCount = parseInt(trip.duration) || 1;
    for (let i = 1; i <= daysCount; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.innerText = `DAY ${i}`;
      select.appendChild(opt);
    }
  }

  if (itemId) {
    title.innerText = "修改消費支出明細";
    if (trip && trip.ledger) {
      const item = trip.ledger.find(e => e.id === itemId);
      if (item) {
        document.getElementById("exp-id").value = item.id;
        document.getElementById("exp-name").value = item.name;
        document.getElementById("exp-day").value = item.day;
        document.getElementById("exp-category").value = item.category;
        document.getElementById("exp-price").value = item.cost;
        document.getElementById("exp-qty").value = item.splitCount;
        document.getElementById("exp-notes").value = item.notes || "";
      }
    }
  } else {
    title.innerText = "新增旅程消費支出";
  }

  modal.classList.add("active");
}

function closeExpenseModal() {
  document.getElementById("expense-modal").classList.remove("active");
}

function handleExpenseSubmit(e) {
  e.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const id = document.getElementById("exp-id").value;
  const name = document.getElementById("exp-name").value.trim();
  const day = parseInt(document.getElementById("exp-day").value) || 1;
  const category = document.getElementById("exp-category").value;
  const cost = parseInt(document.getElementById("exp-price").value) || 0;
  const splitCount = parseInt(document.getElementById("exp-qty").value) || 1;
  const notes = document.getElementById("exp-notes").value.trim();

  if (!trip.ledger) trip.ledger = [];

  if (id) {
    const idx = trip.ledger.findIndex(item => item.id === id);
    if (idx !== -1) {
      trip.ledger[idx] = { id, name, day, category, cost, splitCount, notes };
    }
    showToast("帳目明細已修改！", "success");
  } else {
    trip.ledger.push({
      id: "exp-" + Date.now(),
      name, day, category, cost, splitCount, notes
    });
    showToast("記帳成功！", "success");
  }

  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  closeExpenseModal();
  renderWorkspaceBudget();
  renderBudgetCharts();
}

window.deleteExpenseItem = function(itemId) {
  if (confirm("確認要刪除這筆記帳明細嗎？")) {
    const trip = trips.find(t => t.id === activeTripId);
    if (trip && trip.ledger) {
      trip.ledger = trip.ledger.filter(item => item.id !== itemId);
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceBudget();
      renderBudgetCharts();
      showToast("支出明細已移除", "info");
    }
  }
};

// 同行代墊 CRUD
function openAdvanceModal(itemId = null) {
  const modal = document.getElementById("advance-modal");
  const form = document.getElementById("adv-form");
  const title = document.getElementById("adv-modal-title");
  
  form.reset();
  document.getElementById("adv-id").value = "";

  const trip = trips.find(t => t.id === activeTripId);
  if (trip) {
    document.getElementById("adv-travelers").value = parseInt(trip.travelers) || 5;
  }

  if (itemId) {
    title.innerText = "修改同行友人代墊款項";
    if (trip && trip.advances) {
      const item = trip.advances.find(a => a.id === itemId);
      if (item) {
        document.getElementById("adv-id").value = item.id;
        document.getElementById("adv-payer").value = item.payer;
        document.getElementById("adv-date").value = item.date || "";
        document.getElementById("adv-item").value = item.item;
        document.getElementById("adv-amount").value = item.amount;
        document.getElementById("adv-travelers").value = item.splitCount;
        document.getElementById("adv-notes").value = item.notes || "";
      }
    }
  } else {
    title.innerText = "新增旅伴付款代墊記錄";
  }

  modal.classList.add("active");
}

function closeAdvanceModal() {
  document.getElementById("advance-modal").classList.remove("active");
}

function handleAdvanceSubmit(e) {
  e.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const id = document.getElementById("adv-id").value;
  const payer = document.getElementById("adv-payer").value.trim();
  const date = document.getElementById("adv-date").value.trim();
  const item = document.getElementById("adv-item").value.trim();
  const amount = parseInt(document.getElementById("adv-amount").value) || 0;
  const splitCount = parseInt(document.getElementById("adv-travelers").value) || 5;
  const notes = document.getElementById("adv-notes").value.trim();

  if (!trip.advances) trip.advances = [];

  if (id) {
    const idx = trip.advances.findIndex(a => a.id === id);
    if (idx !== -1) {
      trip.advances[idx] = { id, payer, date, item, amount, splitCount, notes };
    }
    showToast("代墊記錄已成功修改！", "success");
  } else {
    trip.advances.push({
      id: "adv-" + Date.now(),
      payer, date, item, amount, splitCount, notes
    });
    showToast("成功新增代墊記錄！", "success");
  }

  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  closeAdvanceModal();
  renderWorkspaceBudget();
}

window.deleteAdvanceItem = function(id) {
  if (confirm("確認要刪除這筆代墊記錄嗎？")) {
    const trip = trips.find(t => t.id === activeTripId);
    if (trip && trip.advances) {
      trip.advances = trip.advances.filter(a => a.id !== id);
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceBudget();
      showToast("代墊記錄已刪除", "info");
    }
  }
};

// 收收款還款 CRUD
function openRepayModal(itemId = null) {
  const modal = document.getElementById("repay-modal");
  const form = document.getElementById("repay-form");
  form.reset();
  document.getElementById("repay-id").value = "";
  modal.classList.add("active");
}

function closeRepayModal() {
  document.getElementById("repay-modal").classList.remove("active");
}

function handleRepaySubmit(e) {
  e.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const id = document.getElementById("repay-id").value;
  const name = document.getElementById("rp-name").value.trim();
  const method = document.getElementById("rp-method").value.trim();
  const account = document.getElementById("rp-account").value.trim();

  if (!trip.repayInfo) trip.repayInfo = [];

  trip.repayInfo.push({
    id: "rp-" + Date.now(),
    name, method, account
  });

  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  closeRepayModal();
  renderWorkspaceBudget();
  showToast("收款設定已儲存！", "success");
}

window.deleteRepayItem = function(id) {
  if (confirm("確認要移除這個收款管道嗎？")) {
    const trip = trips.find(t => t.id === activeTripId);
    if (trip && trip.repayInfo) {
      trip.repayInfo = trip.repayInfo.filter(r => r.id !== id);
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceBudget();
      showToast("已移除還款通道", "info");
    }
  }
};


// ==================== WORKSPACE D: 故事回憶與日記 ====================
function renderWorkspaceDiary() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const diary = trip.diary || { content: "", rating: 5, weather: "晴天", companion: "", image: "", cost: 0 };
  
  document.getElementById("ws-diary-text").value = diary.content || "";
  document.getElementById("ws-diary-weather").value = diary.weather || "晴天";
  document.getElementById("ws-diary-companion").value = diary.companion || trip.companion || "";
  document.getElementById("ws-diary-cost").value = diary.cost || 0;

  // 圖片預覽
  const preview = document.getElementById("ws-diary-preview-img");
  const placeholder = document.getElementById("ws-diary-upload-placeholder");
  const imgUrl = diary.image || trip.image;
  
  if (imgUrl) {
    preview.src = imgUrl;
    preview.style.display = "block";
    placeholder.style.display = "none";
    document.getElementById("ws-diary-image-base64").value = imgUrl;
  } else {
    preview.style.display = "none";
    placeholder.style.display = "flex";
    document.getElementById("ws-diary-image-base64").value = "";
  }

  setDiaryRating(diary.rating || 5);
}

function setDiaryRating(rating) {
  document.getElementById("ws-diary-rating-val").value = rating;
  const stars = document.querySelectorAll("#ws-diary-rating-stars .ws-star");
  stars.forEach(star => {
    const starVal = parseInt(star.getAttribute("data-ws-rating"));
    if (starVal <= rating) {
      star.classList.add("active");
    } else {
      star.classList.remove("active");
    }
  });
}

function handleDiaryImportCost() {
  const trip = trips.find(t => t.id === activeTripId);
  if (trip) {
    // 預算總和
    const totalExp = (trip.ledger || []).reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0);
    const totalAdv = (trip.advances || []).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
    const grandCost = Math.max(totalExp, totalAdv);
    
    document.getElementById("ws-diary-cost").value = grandCost;
    showToast(`成功導入此行程預算總支出 $${grandCost.toLocaleString()} 元！`, "success");
  }
}

function handleDiarySave() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const content = document.getElementById("ws-diary-text").value.trim();
  const weather = document.getElementById("ws-diary-weather").value;
  const companion = document.getElementById("ws-diary-companion").value.trim();
  const cost = parseInt(document.getElementById("ws-diary-cost").value) || 0;
  const rating = parseInt(document.getElementById("ws-diary-rating-val").value) || 5;
  const image = document.getElementById("ws-diary-image-base64").value;

  if (!content) {
    showToast("請填寫日記內容！", "error");
    return;
  }

  trip.diary = { content, weather, companion, cost, rating, image };
  
  // 同步更新 trip 的基本數值，以更新儀表板顯示
  trip.rating = rating;
  if (image) trip.image = image;

  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  showToast("旅行日記與回憶已成功儲存！", "success");
  renderWorkspaceDiary();
}


// ==================== WORKSPACE E: 票券憑證與備忘錄 ====================
function renderWorkspaceVouchers() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  const vouchers = trip.vouchers || [];
  const grid = document.getElementById("ws-vouchers-grid");
  grid.innerHTML = "";

  vouchers.forEach(v => {
    const card = document.createElement("div");
    card.className = "voucher-card";
    
    // 依類別設定對應的 class
    let catClass = "cat-memo";
    if (v.category === "機票") catClass = "cat-flight";
    else if (v.category === "住宿") catClass = "cat-hotel";
    else if (v.category === "租車/車票") catClass = "cat-transport";
    else if (v.category === "景點門票") catClass = "cat-ticket";

    let filePreviewHtml = "";
    if (v.fileData) {
      if (v.fileType && v.fileType.startsWith("image/")) {
        filePreviewHtml = `
          <div class="voucher-preview-box" onclick="openLightbox('${v.fileData}')">
            <img src="${v.fileData}" alt="${escapeHTML(v.title)}">
          </div>
        `;
      } else if (v.fileType === "application/pdf" || (v.fileData.startsWith("data:application/pdf"))) {
        filePreviewHtml = `
          <div class="voucher-preview-box" onclick="openPDFInNewTab('${v.fileData}')">
            <div class="voucher-pdf-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span style="font-size:0.8rem; font-weight:600; color:var(--text-primary); max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(v.fileName || 'PDF 檔案')}</span>
              <span style="font-size:0.7rem; color:var(--text-secondary);">📄 點擊開啟 PDF 文件</span>
            </div>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="voucher-header">
        <div class="voucher-title">${escapeHTML(v.title)}</div>
        <span class="voucher-badge ${catClass}">${v.category}</span>
      </div>
      ${v.date ? `
      <div class="voucher-date">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <span>${v.date}</span>
      </div>` : ''}
      ${v.notes ? `<div class="voucher-notes">${escapeHTML(v.notes)}</div>` : ''}
      ${normalizeExternalUrl(v.link || v.bookingUrl || "") ? `<div class="voucher-link-row"><span>🔗</span><a class="voucher-link-btn" href="${escapeHTML(normalizeExternalUrl(v.link || v.bookingUrl || ""))}" target="_blank" rel="noopener noreferrer">查看訂單 / 連結</a></div>` : ''}
      ${filePreviewHtml}
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:auto; padding-top:0.5rem; border-top:1px solid var(--border-color);">
        <button class="btn btn-secondary" style="font-size:0.75rem; padding:0.35rem 0.65rem;" onclick="openVoucherModal(${v.id})">✏️ 編輯</button>
        <button class="btn btn-secondary" style="font-size:0.75rem; padding:0.35rem 0.65rem; color:var(--danger); border-color:rgba(169, 74, 66, 0.2);" onclick="deleteVoucherItem(${v.id})">🗑️ 刪除</button>
      </div>
    `;

    grid.appendChild(card);
  });

  if (vouchers.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5; margin-bottom: 0.75rem;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        <p>目前尚無票券憑證與備忘錄。</p>
        <p style="font-size: 0.8rem; opacity: 0.8; margin-top: 0.25rem;">您可以上傳機票、住宿預訂截圖、PDF 憑證等重要資料，方便隨時查找。</p>
      </div>
    `;
  }
}

// 憑證 Modal 動作
window.openVoucherModal = function(id = null) {
  const modal = document.getElementById("voucher-modal");
  const form = document.getElementById("voucher-form");
  const title = document.getElementById("voucher-modal-title");
  
  form.reset();
  
  // 清除預覽資訊
  document.getElementById("v-id").value = "";
  document.getElementById("v-file-data").value = "";
  document.getElementById("v-file-name").value = "";
  document.getElementById("v-file-type").value = "";
  
  const previewContainer = document.getElementById("v-file-preview-container");
  previewContainer.style.display = "none";
  previewContainer.innerHTML = "";
  
  if (id) {
    title.innerText = "編輯票券憑證與備忘";
    const trip = trips.find(t => t.id === activeTripId);
    if (trip && trip.vouchers) {
      const v = trip.vouchers.find(item => item.id === id);
      if (v) {
        document.getElementById("v-id").value = v.id;
        document.getElementById("v-title").value = v.title;
        document.getElementById("v-category").value = v.category;
        document.getElementById("v-date").value = v.date || "";
        document.getElementById("v-notes").value = v.notes || "";
        document.getElementById("v-link").value = v.link || v.bookingUrl || "";
        
        if (v.fileData) {
          document.getElementById("v-file-data").value = v.fileData;
          document.getElementById("v-file-name").value = v.fileName || "";
          document.getElementById("v-file-type").value = v.fileType || "";
          showVoucherFilePreview(v.fileName, v.fileSizeStr || "", v.fileType, v.fileData);
        }
      }
    }
  } else {
    title.innerText = "新增票券憑證與備忘";
  }
  
  modal.classList.add("active");
};

function closeVoucherModal() {
  document.getElementById("voucher-modal").classList.remove("active");
}

// 處理憑證上傳
function handleVoucherFileUpload(file) {
  if (!file) return;
  
  // PDF 檔案限制 1.5MB 以內
  if (file.type === "application/pdf") {
    if (file.size > 1.5 * 1024 * 1024) {
      showToast("PDF 檔案過大！請上傳小於 1.5MB 的 PDF 檔案。", "error");
      return;
    }
    
    // 讀取為 Base64
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      const sizeStr = formatBytes(file.size);
      
      document.getElementById("v-file-data").value = dataUrl;
      document.getElementById("v-file-name").value = file.name;
      document.getElementById("v-file-type").value = file.type;
      
      showVoucherFilePreview(file.name, sizeStr, file.type, dataUrl);
      showToast("PDF 憑證讀取成功！", "success");
    };
    reader.readAsDataURL(file);
  } 
  // 圖片檔案：自動壓縮處理
  else if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.src = event.target.result;
      img.onload = function() {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // 限制寬高最高 1200px
        const max_size = 1200;
        if (width > max_size || height > max_size) {
          if (width > height) {
            height *= max_size / width;
            width = max_size;
          } else {
            width *= max_size / height;
            height = max_size;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        // 以 JPEG 0.7 壓縮
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        
        // 計算壓縮後的大小
        const compressedSize = Math.round((compressedDataUrl.length - 22) * 3 / 4);
        const sizeStr = formatBytes(compressedSize);
        
        document.getElementById("v-file-data").value = compressedDataUrl;
        document.getElementById("v-file-name").value = file.name;
        document.getElementById("v-file-type").value = "image/jpeg";
        
        showVoucherFilePreview(file.name, sizeStr, "image/jpeg", compressedDataUrl);
        showToast("圖片憑證已成功壓縮並讀取！", "success");
      };
    };
    reader.readAsDataURL(file);
  } else {
    showToast("不支援的檔案格式！請上傳圖片或 PDF 檔案。", "error");
  }
}

// 顯示預覽 UI
function showVoucherFilePreview(name, sizeStr, type, dataUrl) {
  const container = document.getElementById("v-file-preview-container");
  container.style.display = "flex";
  
  let thumbnailHtml = "";
  if (type.startsWith("image/")) {
    thumbnailHtml = `<img src="${dataUrl}" class="file-preview-thumbnail" alt="預覽">`;
  } else {
    // PDF icon
    thumbnailHtml = `
      <div class="file-preview-thumbnail" style="display:flex; align-items:center; justify-content:center; background:rgba(239, 68, 68, 0.1); color:#ef4444;">
        <span style="font-size:0.8rem; font-weight:bold;">PDF</span>
      </div>
    `;
  }
  
  container.innerHTML = `
    ${thumbnailHtml}
    <div class="file-preview-info">
      <div class="file-preview-name">${escapeHTML(name)}</div>
      <div class="file-preview-size">${sizeStr}</div>
    </div>
    <button type="button" class="file-preview-remove" onclick="removeVoucherFilePreview()">✕</button>
  `;
}

window.removeVoucherFilePreview = function() {
  const container = document.getElementById("v-file-preview-container");
  container.style.display = "none";
  container.innerHTML = "";
  
  document.getElementById("v-file-data").value = "";
  document.getElementById("v-file-name").value = "";
  document.getElementById("v-file-type").value = "";
  
  // 清除 file input 的值以允許重複選擇同一個檔案
  document.getElementById("v-file-input").value = "";
};

// 提交憑證表單
function handleVoucherSubmit(e) {
  e.preventDefault();
  
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  
  const idVal = document.getElementById("v-id").value;
  const title = document.getElementById("v-title").value.trim();
  const category = document.getElementById("v-category").value;
  const date = document.getElementById("v-date").value;
  const notes = document.getElementById("v-notes").value.trim();
  const rawLink = document.getElementById("v-link").value.trim();
  const link = normalizeExternalUrl(rawLink);
  const fileData = document.getElementById("v-file-data").value;
  const fileName = document.getElementById("v-file-name").value;
  const fileType = document.getElementById("v-file-type").value;
  
  if (!title) {
    showToast("請填寫憑證名稱！", "error");
    return;
  }
  
  if (rawLink && !link) {
    showToast("請輸入正確的訂單連結或網址！", "error");
    return;
  }

  if (!trip.vouchers) trip.vouchers = [];
  
  if (idVal) {
    // 編輯
    const vId = parseInt(idVal);
    const voucherIndex = trip.vouchers.findIndex(item => item.id === vId);
    if (voucherIndex !== -1) {
      const original = trip.vouchers[voucherIndex];
      trip.vouchers[voucherIndex] = {
        id: vId,
        title,
        category,
        date,
        notes,
        link,
        fileData: fileData || original.fileData,
        fileName: fileName || original.fileName,
        fileType: fileType || original.fileType,
        fileSizeStr: fileData ? formatBytes(Math.round((fileData.length - 22) * 3 / 4)) : original.fileSizeStr
      };
      showToast("憑證已成功更新！", "success");
    }
  } else {
    // 新增
    const newVoucher = {
      id: Date.now(),
      title,
      category,
      date,
      notes,
      link,
      fileData,
      fileName,
      fileType,
      fileSizeStr: fileData ? formatBytes(Math.round((fileData.length - 22) * 3 / 4)) : ""
    };
    trip.vouchers.push(newVoucher);
    showToast("憑證已成功新增！", "success");
  }
  
  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  closeVoucherModal();
  renderWorkspaceVouchers();
}

// 刪除憑證
window.deleteVoucherItem = function(id) {
  if (confirm("確認要刪除此憑證備忘錄嗎？此動作無法復原。")) {
    const trip = trips.find(t => t.id === activeTripId);
    if (trip && trip.vouchers) {
      trip.vouchers = trip.vouchers.filter(item => item.id !== id);
      localStorage.setItem("voyage_trips", JSON.stringify(trips));
      renderWorkspaceVouchers();
      showToast("已成功刪除該憑證備忘", "info");
    }
  }
};

// Lightbox 與 PDF 動作
window.openLightbox = function(src) {
  const lightbox = document.getElementById("lightbox-modal");
  const lightboxImg = document.getElementById("lightbox-img");
  lightboxImg.src = src;
  lightbox.classList.add("active");
};

window.openPDFInNewTab = function(base64Data) {
  try {
    const parts = base64Data.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    
    const blob = new Blob([uInt8Array], {type: contentType});
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch (err) {
    window.open(base64Data, '_blank');
  }
};

// 輔助函數：格式化檔案大小
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


// ==================== WORKSPACE F: 旅程基本資訊編輯 ====================
function openTripEditorModal(tripId = null) {
  const modal = document.getElementById("trip-editor-modal");
  const form = document.getElementById("trip-form");
  const title = document.getElementById("trip-modal-title");
  
  form.reset();
  document.getElementById("t-image-base64").value = "";
  document.getElementById("t-upload-preview").style.display = "none";
  document.getElementById("t-upload-preview").src = "";
  document.getElementById("t-upload-text").style.display = "block";
  document.getElementById("trip-form-id").value = "";

  if (tripId) {
    title.innerText = "編輯您的旅程基本設定";
    const trip = trips.find(t => t.id === tripId);
    if (trip) {
      document.getElementById("trip-form-id").value = trip.id;
      document.getElementById("t-title").value = trip.title;
      document.getElementById("t-location").value = trip.location;
      document.getElementById("t-date").value = trip.date;
      document.getElementById("t-duration").value = trip.duration;
      document.getElementById("t-travelers").value = trip.travelers || "5人同行";
      document.getElementById("t-luggage").value = trip.luggage || "";
      document.getElementById("t-rental").value = trip.rental || "";
      document.getElementById("t-continent").value = trip.continent || "Asia";

      if (trip.image) {
        document.getElementById("t-image-base64").value = trip.image;
        const preview = document.getElementById("t-upload-preview");
        preview.src = trip.image;
        preview.style.display = "block";
        document.getElementById("t-upload-text").style.display = "none";
      }
    }
  } else {
    title.innerText = "規劃新的冒險旅程";
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("t-date").value = today;
  }

  modal.classList.add("active");
}

function closeTripEditorModal() {
  document.getElementById("trip-editor-modal").classList.remove("active");
}

function handleTripSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("trip-form-id").value;
  const title = document.getElementById("t-title").value.trim();
  const location = document.getElementById("t-location").value.trim();
  const date = document.getElementById("t-date").value;
  const duration = parseInt(document.getElementById("t-duration").value) || 2;
  const travelers = document.getElementById("t-travelers").value.trim();
  const luggage = document.getElementById("t-luggage").value.trim();
  const rental = document.getElementById("t-rental").value.trim();
  const continent = document.getElementById("t-continent").value;
  const image = document.getElementById("t-image-base64").value;

  // 生成格式化日期範圍 (例如 10/26 - 10/27)
  let dateRange = date;
  try {
    const start = new Date(date);
    const end = new Date(start);
    end.setDate(start.getDate() + duration - 1);
    const options = { month: '2-digit', day: '2-digit' };
    dateRange = `${start.toLocaleDateString('zh-TW', options)} - ${end.toLocaleDateString('zh-TW', options)}`;
  } catch (e) {
    console.error(e);
  }

  if (id) {
    // 修改旅程基本資料
    const idx = trips.findIndex(t => t.id === id);
    if (idx !== -1) {
      trips[idx] = {
        ...trips[idx],
        title, location, date, duration, travelers, luggage, rental, continent, dateRange,
        image: image || trips[idx].image
      };
      showToast("旅程基本設定已更新！", "success");
    }
  } else {
    // 新增旅程
    const newTrip = {
      id: "trip-" + Date.now(),
      title, location, date, duration, travelers, luggage, rental, continent, dateRange,
      image: image || "assets/paris_cafe.png",
      itinerary: null,
      alternativeSpots: { sights: [], restaurants: [] },
      packingList: [...DEFAULT_PACKING_TEMPLATE],
      todoList: [],
      wishlist: [],
      ledger: [],
      advances: [],
      repayInfo: [],
      diary: { content: "", rating: 5, weather: "晴天", companion: travelers, image: "", cost: 0 }
    };
    trips.unshift(newTrip);
    showToast("成功建立新旅程！立即開啟小本本規劃吧！", "success");
  }

  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  closeTripEditorModal();
  renderTripsList();
  renderDashboard();

  // 如果是在編輯現有旅程，同時重新整理 workspace
  if (activeTripId) {
    enterWorkspace(activeTripId);
  }
}

// 圖片轉 base64 上傳輔助
function handleImageUpload(file, base64InputId, previewImgId, uploadTextId) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Data = e.target.result;
    document.getElementById(base64InputId).value = base64Data;
    const preview = document.getElementById(previewImgId);
    preview.src = base64Data;
    preview.style.display = "block";
    const textEl = document.getElementById(uploadTextId);
    if (textEl) textEl.style.display = "none";
    showToast("封面照片上傳成功！", "success");
  };
  reader.readAsDataURL(file);
}


// ==================== 4. 🎛️ 綜合消費預算圖表分析 ====================
function renderBudgetCharts() {
  const categoryTotals = { "住宿": 0, "交通": 0, "餐飲": 0, "景點": 0, "購物": 0, "其他": 0, "雜支": 0 };
  let grandTotal = 0;

  trips.forEach(trip => {
    (trip.ledger || []).forEach(item => {
      const cat = item.category || "其他";
      const cost = parseInt(item.cost) || 0;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + cost;
      grandTotal += cost;
    });
  });

  // 1. 渲染消費明細摘要表
  const tableBody = document.getElementById("budget-table-body");
  tableBody.innerHTML = "";
  
  if (trips.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-secondary);">暫無消費預算手記明細</td></tr>`;
  } else {
    const sortedTrips = [...trips].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedTrips.forEach(trip => {
      // 算該旅程總預算
      const tripTotal = (trip.ledger || []).reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0);
      const mainCategory = trip.category || (trip.ledger?.[0]?.category) || "其他";

      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border-color)";
      tr.innerHTML = `
        <td style="padding: 1rem; font-weight:700; cursor:pointer; color:var(--accent-color);" onclick="enterWorkspace('${trip.id}')">${escapeHTML(trip.title)}</td>
        <td style="padding: 1rem;">${escapeHTML(trip.location)}</td>
        <td style="padding: 1rem;">${trip.date}</td>
        <td style="padding: 1rem;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${CATEGORY_COLORS[mainCategory] || '#6b7280'}; margin-right:6px;"></span>${mainCategory}</td>
        <td style="padding: 1rem; text-align: right; font-weight:700; color:var(--text-primary);">NT$ ${tripTotal.toLocaleString()}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // 2. 繪製圓餅圖 (分類佔比)
  const pieSvg = document.getElementById("pie-chart-svg");
  const pieLegend = document.getElementById("pie-chart-legend");
  pieSvg.innerHTML = "";
  pieLegend.innerHTML = "";

  if (grandTotal === 0) {
    pieSvg.innerHTML = `
      <circle cx="120" cy="120" r="90" fill="none" stroke="var(--border-color)" stroke-width="25" opacity="0.3"/>
      <text x="120" y="125" text-anchor="middle" font-size="14" fill="var(--text-secondary)">暫無消費資料</text>
    `;
    return;
  }

  let accumulatedAngle = 0;
  const cx = 120, cy = 120, r = 85;

  Object.entries(categoryTotals).forEach(([cat, val]) => {
    const percentage = val / grandTotal;
    if (percentage === 0) return;

    const angle = percentage * 360;
    const radStart = (accumulatedAngle - 90) * Math.PI / 180;
    const radEnd = (accumulatedAngle + angle - 90) * Math.PI / 180;
    
    const x1 = cx + r * Math.cos(radStart);
    const y1 = cy + r * Math.sin(radStart);
    const x2 = cx + r * Math.cos(radEnd);
    const y2 = cy + r * Math.sin(radEnd);

    const largeArcFlag = angle > 180 ? 1 : 0;
    
    let d = "";
    if (percentage >= 0.999) {
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    } else {
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", CATEGORY_COLORS[cat] || '#6b7280');
    path.setAttribute("stroke", "var(--bg-card)");
    path.setAttribute("stroke-width", "2");
    
    path.style.transition = "transform 0.2s ease, opacity 0.2s";
    path.style.cursor = "pointer";
    path.style.transformOrigin = `${cx}px ${cy}px`;
    path.onmouseover = () => {
      path.style.transform = "scale(1.04)";
      path.style.opacity = "0.9";
    };
    path.onmouseout = () => {
      path.style.transform = "scale(1)";
      path.style.opacity = "1";
    };

    pieSvg.appendChild(path);
    accumulatedAngle += angle;

    const legendItem = document.createElement("div");
    legendItem.className = "legend-item";
    legendItem.innerHTML = `
      <span class="legend-color" style="background-color: ${CATEGORY_COLORS[cat] || '#6b7280'};"></span>
      <span style="font-weight:600;">${cat}</span>
      <span style="margin-left:auto; color:var(--text-secondary); font-size:0.78rem;">
        ${(percentage * 100).toFixed(1)}% (NT$ ${val.toLocaleString()})
      </span>
    `;
    pieLegend.appendChild(legendItem);
  });

  // 3. 繪製長條圖 (行程預算排行)
  const barContainer = document.getElementById("bar-chart-container");
  const barLabels = document.getElementById("bar-chart-labels");
  barContainer.innerHTML = "";
  barLabels.innerHTML = "";

  const budgetedTrips = [...trips]
    .map(t => {
      const totalExp = (t.ledger || []).reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0);
      return { id: t.id, title: t.title, costSum: totalExp };
    })
    .filter(t => t.costSum > 0)
    .sort((a, b) => b.costSum - a.costSum)
    .slice(0, 5);

  if (budgetedTrips.length === 0) {
    barContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-secondary); margin-bottom: 50px;">無行程記帳支出</div>`;
    return;
  }

  const maxCost = budgetedTrips[0].costSum;

  budgetedTrips.forEach(t => {
    const percentHeight = (t.costSum / maxCost) * 85;
    
    const bar = document.createElement("div");
    bar.style.flex = "1";
    bar.style.height = `${percentHeight}%`;
    bar.style.background = `linear-gradient(to top, var(--accent-color), var(--accent-hover))`;
    bar.style.borderRadius = "8px 8px 0 0";
    bar.style.position = "relative";
    bar.style.cursor = "pointer";
    bar.style.transition = "transform 0.2s ease, filter 0.2s";

    bar.onmouseover = () => {
      bar.style.transform = "scaleY(1.04)";
      bar.style.filter = "brightness(1.1)";
    };
    bar.onmouseout = () => {
      bar.style.transform = "scaleY(1)";
      bar.style.filter = "none";
    };

    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.top = "-30px";
    tooltip.style.left = "50%";
    tooltip.style.transform = "translateX(-50%)";
    tooltip.style.backgroundColor = "rgba(0,0,0,0.85)";
    tooltip.style.color = "white";
    tooltip.style.padding = "2px 6px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.fontSize = "0.75rem";
    tooltip.style.fontWeight = "bold";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.innerText = `NT$ ${parseInt(t.costSum).toLocaleString()}`;
    bar.appendChild(tooltip);

    bar.onclick = () => enterWorkspace(t.id);
    barContainer.appendChild(bar);

    const label = document.createElement("div");
    label.style.flex = "1";
    label.style.textAlign = "center";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    label.style.whiteSpace = "nowrap";
    label.style.fontSize = "0.75rem";
    label.style.fontWeight = "600";
    label.innerText = t.title;
    barLabels.appendChild(label);
  });
}


// --- 9. Toast 提示框系統 ---
function showToast(message, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "";
  if (type === "success") icon = '✓';
  else if (type === "error") icon = '✕';
  else icon = 'ℹ';

  toast.innerHTML = `
    <span style="font-weight:bold; font-size:1.1rem; display:inline-block; border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px; background:rgba(255,255,255,0.2);">${icon}</span>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// --- 實用輔助函數 ---
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeExternalUrl(value) {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

// 複製地址到剪貼簿，提供給時間軸上的地址卡片點擊使用
window.copyAddress = function(e, text) {
  if (e) e.stopPropagation();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast("地址已複製，方便手機導航！", "success");
  }).catch(err => {
    console.error("無法複製地址:", err);
    showToast("複製失敗，請手動複製", "error");
  });
};

// 高解析度真實景點/商家資料庫，避免第三方 Map API CORS 限制
const LOCAL_GEO_DATABASE = [
  {
    keys: ["一月家", "rejrjhwnbrtdkxnq8"],
    name: "一月家",
    address: "三重縣伊勢市曾禰2-4-4",
    rating: "⭐️ 4.4 (530 則評論)",
    hours: "14:00 - 22:00",
    type: "food"
  },
  {
    keys: ["rental 819", "rental819", "5vbhsaaqtjkriknt6"],
    name: "Rental 819 伊勢店",
    address: "三重縣伊勢市本町2-1",
    rating: "⭐️ 4.6 (120 則評論)",
    hours: "10:00 - 19:00 (週三公休)",
    type: "bike"
  },
  {
    keys: ["伊勢神宮", "神宮內宮", "神宮外宮"],
    name: "伊勢神宮 內宮",
    address: "三重縣伊勢市宇治館町1",
    rating: "⭐️ 4.7 (12,500 則評論)",
    hours: "05:00 - 17:00",
    type: "sight"
  },
  {
    keys: ["蓬萊軒", "鰻魚飯"],
    name: "熱田蓬萊軒 總店",
    address: "愛知縣名古屋市熱田區神宮2-10-26",
    rating: "⭐️ 4.6 (5,400 則評論)",
    hours: "11:30 - 14:00, 16:30 - 20:30 (週三公休)",
    type: "food"
  },
  {
    keys: ["hana部落廚房", "hana廚房", "部落廚房"],
    name: "Hana部落廚房",
    address: "嘉義縣阿里山鄉第二鄰 (來吉部落)",
    rating: "⭐️ 4.5 (1,800 則評論)",
    hours: "11:00 - 17:00 (週一二公休)",
    type: "food"
  },
  {
    keys: ["游芭絲"],
    name: "游芭絲鄒宴專門店",
    address: "嘉義縣阿里山鄉山美村1鄰18號",
    rating: "⭐️ 4.4 (2,600 則評論)",
    hours: "11:00 - 15:00, 16:30 - 19:30 (週四公休)",
    type: "food"
  },
  {
    keys: ["永富苦茶油雞", "街角永富"],
    name: "街角永富苦茶油雞",
    address: "嘉義縣番路鄉公田村5鄰龍美10-6 號",
    rating: "⭐️ 4.3 (1,200 則評論)",
    hours: "11:00 - 19:00 (週二三公休)",
    type: "food"
  },
  {
    keys: ["山賓餐廳"],
    name: "山賓餐廳",
    address: "嘉義縣阿里山鄉中正村19號",
    rating: "⭐️ 4.3 (1,500 則評論)",
    hours: "11:00 - 20:30",
    type: "food"
  },
  {
    keys: ["茶田35號"],
    name: "茶田35號",
    address: "嘉義縣阿里山鄉中正村35號",
    rating: "⭐️ 4.6 (380 則評論)",
    hours: "04:00 - 13:00",
    type: "food"
  },
  {
    keys: ["熱田神宮"],
    name: "熱田神宮",
    address: "愛知縣名古屋市熱田區神宮1-1-1",
    rating: "⭐️ 4.5 (8,900 則評論)",
    hours: "24小時開放",
    type: "sight"
  },
  {
    keys: ["名古屋電視塔", "mirai tower"],
    name: "中部電力 MIRAI TOWER",
    address: "愛知縣名古屋市中區錦3-6-15",
    rating: "⭐️ 4.3 (4,200 則評論)",
    hours: "10:00 - 21:00",
    type: "sight"
  },
  {
    keys: ["oasis 21", "綠洲21"],
    name: "綠洲21 (Oasis 21)",
    address: "愛知縣名古屋市東區東櫻1-11-1",
    rating: "⭐️ 4.2 (8,900 則評論)",
    hours: "10:00 - 22:00",
    type: "sight"
  }
];

// 智慧 Google 地圖 URL 自動填充與 Mock 地區、星級預估
function setupScheduleAutofill() {
  const urlInput = document.getElementById("s-maps-url");
  const url = urlInput.value.trim();
  if (!url) return;

  const addressInput = document.getElementById("s-address");
  const ratingInput = document.getElementById("s-rating");
  const titleInput = document.getElementById("s-title");
  const hoursInput = document.getElementById("s-hours");

  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  let extractedName = extractPlaceNameFromUrl(url);

  // 1. 先匹配高解析度真實資料庫 LOCAL_GEO_DATABASE
  let foundSpot = null;
  const urlLower = url.toLowerCase();
  const searchName = (titleInput.value || extractedName || "").trim().toLowerCase();

  foundSpot = LOCAL_GEO_DATABASE.find(item => {
    if (urlLower) {
      const hasUrlKey = item.keys.some(k => k.length >= 6 && urlLower.includes(k.toLowerCase()));
      if (hasUrlKey) return true;
    }
    if (searchName) {
      const hasTitleKey = item.keys.some(k => k.length >= 2 && (searchName.includes(k.toLowerCase()) || k.toLowerCase().includes(searchName)));
      if (hasTitleKey) return true;
    }
    return false;
  });

  // 2. 如果沒匹配到，再匹配該旅程的備案庫 (景點/餐廳)
  if (!foundSpot) {
    const alt = trip.alternativeSpots || { sights: [], restaurants: [] };
    const allSpots = [...alt.sights, ...alt.restaurants];
    
    foundSpot = allSpots.find(spot => spot.mapsUrl && spot.mapsUrl.trim() === url);

    if (!foundSpot && extractedName) {
      const extractedLower = extractedName.toLowerCase();
      foundSpot = allSpots.find(spot => spot.name && spot.name.toLowerCase().includes(extractedLower));
    }
  }

  // 3. 如果在備案庫或真實資料庫中找到了，直接強制套用以保證資訊準確 (會覆蓋預設的 Nagoya mock 地址與 hours)
  if (foundSpot) {
    addressInput.value = foundSpot.address || "";
    ratingInput.value = foundSpot.rating || "";
    hoursInput.value = foundSpot.hours || "";
    if (foundSpot.name && (!titleInput.value || titleInput.value.includes("maps.app.goo.gl") || titleInput.value.startsWith("http"))) {
      titleInput.value = foundSpot.name;
    }
    if (foundSpot.type) {
      const typeSelect = document.getElementById("s-type");
      if (typeSelect) {
        typeSelect.value = foundSpot.type;
        typeSelect.dispatchEvent(new Event("change"));
      }
    }
    showToast(`已自動填充「${foundSpot.name || '商家'}」的真實營業時間與資訊！`, "success");
    return;
  }

  // 4. 若無匹配備案，進行智慧 Mock 預測
  const searchNameForMock = (titleInput.value || extractedName || "").trim();
  const urlForMock = url;

  // 1) Smart Mock Rating
  if (!ratingInput.value || ratingInput.value.startsWith("⭐️")) {
    const score = (4.2 + Math.random() * 0.7).toFixed(1);
    const reviews = Math.floor(Math.random() * 7500) + 500;
    ratingInput.value = `⭐️ ${score} (${reviews.toLocaleString()} 則評論)`;
  }

  // 2) Smart Mock Address
  const fullSearchStr = `${searchNameForMock} ${urlForMock} ${trip.location || ""}`.toLowerCase();
  let mockAddresses = [];
  if (fullSearchStr.includes("伊勢") || fullSearchStr.includes("神宮") || fullSearchStr.includes("鳥羽") || fullSearchStr.includes("志摩") || fullSearchStr.includes("三重") || fullSearchStr.includes("ise")) {
    mockAddresses = [
      "三重縣伊勢市宇治館町 1",
      "三重縣伊勢市本町 1-2-3",
      "三重縣鳥羽市鳥羽 3-3-6",
      "三重縣志摩市阿兒町神明 724-1"
    ];
  } else if (fullSearchStr.includes("名古屋") || fullSearchStr.includes("榮") || fullSearchStr.includes("大須") || fullSearchStr.includes("名站") || fullSearchStr.includes("錦") || fullSearchStr.includes("愛知") || fullSearchStr.includes("nagoya")) {
    mockAddresses = [
      "愛知縣名古屋市中區榮 3-5-1",
      "愛知縣名古屋市中村區名站 1-1-4",
      "愛知縣名古屋市中區錦 3-15-4",
      "愛知縣名古屋市千種區今池 1-3-2",
      "愛知縣名古屋市中區大須 2-18-4"
    ];
  } else if (fullSearchStr.includes("阿里山") || fullSearchStr.includes("奮起湖") || fullSearchStr.includes("竹崎") || fullSearchStr.includes("番路") || fullSearchStr.includes("嘉義")) {
    mockAddresses = [
      "嘉義縣阿里山鄉中正村 56 號",
      "嘉義縣竹崎鄉中和村奮起湖 178 號",
      "嘉義市東區中山路 199 號",
      "嘉義縣番路鄉公田村 1 號"
    ];
  } else if (fullSearchStr.includes("台北") || fullSearchStr.includes("信義") || fullSearchStr.includes("萬華") || fullSearchStr.includes("台灣")) {
    mockAddresses = [
      "台北市信義區信義路五段 7 號",
      "台北市萬華區成都路 10 號",
      "台中市西屯區台灣大道三段 99 號"
    ];
  } else {
    // Check trip location
    const loc = (trip.location || "").toLowerCase();
    if (loc.includes("名古屋") || loc.includes("愛知") || loc.includes("nagoya")) {
      mockAddresses = [
        "愛知縣名古屋市中區榮 3-5-1",
        "愛知縣名古屋市中村區名站 1-1-4",
        "愛知縣名古屋市中區錦 3-15-4"
      ];
    } else if (loc.includes("伊勢") || loc.includes("三重") || loc.includes("ise")) {
      mockAddresses = [
        "三重縣伊勢市宇治館町 1",
        "三重縣伊勢市本町 1-2-3"
      ];
    } else if (loc.includes("阿里山") || loc.includes("嘉義")) {
      mockAddresses = [
        "嘉義縣阿里山鄉中正村 56 號",
        "嘉義縣竹崎鄉中和村奮起湖 178 號"
      ];
    }
  }

  const currentAddress = addressInput.value.trim();
  const isDefaultNagoyaAddress = ["愛知縣名古屋市中區榮 3-5-1", "愛知縣名古屋市中村區名站 1-1-4", "愛知縣名古屋市中區錦 3-15-4", "愛知縣名古屋市千種區今池 1-3-2", "愛知縣名古屋市中區大須 2-18-4"].includes(currentAddress);
  if (!currentAddress || isDefaultNagoyaAddress) {
    if (mockAddresses.length > 0) {
      const randomIndex = Math.floor(Math.random() * mockAddresses.length);
      addressInput.value = mockAddresses[randomIndex];
    } else {
      const roadNum = Math.floor(Math.random() * 200) + 1;
      addressInput.value = `${trip.location || "未知目的地"}市中心路 ${roadNum} 號`;
    }
  }

  // 3) Smart Mock Business Hours
  const type = document.getElementById("s-type").value;
  let predictedHours = "";
  const nameLower = searchNameForMock.toLowerCase();

  if (nameLower.includes("居酒屋") || nameLower.includes("晚餐") || nameLower.includes("深夜") || nameLower.includes("酒吧") || nameLower.includes("bar") || nameLower.includes("pub") || nameLower.includes("一月家") || nameLower.includes("串燒") || nameLower.includes("燒肉")) {
    predictedHours = "17:00 - 23:00";
  } else if (nameLower.includes("日出") || nameLower.includes("晨曦") || nameLower.includes("清晨") || nameLower.includes("觀日") || nameLower.includes("祝山") || nameLower.includes("小笠原")) {
    predictedHours = "04:30 - 12:00";
  } else if (nameLower.includes("早餐") || nameLower.includes("早點") || nameLower.includes("早午餐")) {
    predictedHours = "06:00 - 11:30";
  } else if (nameLower.includes("租車") || nameLower.includes("牽車") || nameLower.includes("租重機") || nameLower.includes("車行") || nameLower.includes("rental")) {
    predictedHours = "09:00 - 19:00";
  } else if (nameLower.includes("咖啡") || nameLower.includes("下午茶") || nameLower.includes("甜點") || nameLower.includes("烘焙") || nameLower.includes("cafe") || nameLower.includes("coffee") || nameLower.includes("下午")) {
    predictedHours = "10:00 - 19:00";
  } else if (nameLower.includes("午餐") || nameLower.includes("餐廳") || nameLower.includes("美食") || nameLower.includes("食堂") || nameLower.includes("拉麵") || nameLower.includes("料理") || nameLower.includes("吃")) {
    predictedHours = "11:00 - 15:00, 17:00 - 21:30";
  } else if (nameLower.includes("24小時") || nameLower.includes("24h") || nameLower.includes("步道") || nameLower.includes("古道") || nameLower.includes("草原") || nameLower.includes("公園") || nameLower.includes("神宮") || nameLower.includes("內宮") || nameLower.includes("外宮")) {
    predictedHours = "24小時開放";
  } else {
    if (type === "food") {
      predictedHours = "11:00 - 15:00, 17:00 - 21:30";
    } else if (type === "sight") {
      predictedHours = Math.random() > 0.4 ? "08:00 - 17:00" : "24小時開放";
    } else if (type === "hotel" || type === "flight") {
      predictedHours = "24小時營業";
    } else {
      predictedHours = "09:00 - 18:00";
    }
  }

  const currentHours = hoursInput.value.trim();
  const isDefaultMockHours = ["08:00 - 17:00", "24小時開放", "11:00 - 15:00, 17:00 - 21:30", "24小時營業", "09:00 - 18:00"].includes(currentHours);
  if (!currentHours || isDefaultMockHours) {
    hoursInput.value = predictedHours;
  }

  if (!titleInput.value && extractedName) {
    titleInput.value = extractedName;
  }

  showToast("已依據關鍵字/類別預估並填充商家資訊！", "info");
}

// 智慧 Google 地圖 URL 自動填充 (備案庫卡片)
function setupAlternativeAutofill() {
  const urlInput = document.getElementById("a-mapsurl");
  const url = urlInput.value.trim();
  if (!url) return;

  const addressInput = document.getElementById("a-address");
  const ratingInput = document.getElementById("a-rating");
  const titleInput = document.getElementById("a-name");
  const hoursInput = document.getElementById("a-hours");
  const subtypeInput = document.getElementById("a-subtype");
  const typeGroup = document.getElementById("alt-type-group").value; // sights 或 restaurants

  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  let extractedName = extractPlaceNameFromUrl(url);

  // 1. 先匹配高解析度真實資料庫 LOCAL_GEO_DATABASE
  let foundSpot = null;
  const urlLower = url.toLowerCase();
  const searchName = (titleInput.value || extractedName || "").trim().toLowerCase();

  foundSpot = LOCAL_GEO_DATABASE.find(item => {
    if (urlLower) {
      const hasUrlKey = item.keys.some(k => k.length >= 6 && urlLower.includes(k.toLowerCase()));
      if (hasUrlKey) return true;
    }
    if (searchName) {
      const hasTitleKey = item.keys.some(k => k.length >= 2 && (searchName.includes(k.toLowerCase()) || k.toLowerCase().includes(searchName)));
      if (hasTitleKey) return true;
    }
    return false;
  });

  // 2. 如果沒匹配到，再匹配該旅程的備案庫 (景點/餐廳)
  if (!foundSpot) {
    const alt = trip.alternativeSpots || { sights: [], restaurants: [] };
    const allSpots = [...alt.sights, ...alt.restaurants];
    
    foundSpot = allSpots.find(spot => spot.mapsUrl && spot.mapsUrl.trim() === url);

    if (!foundSpot && extractedName) {
      const extractedLower = extractedName.toLowerCase();
      foundSpot = allSpots.find(spot => spot.name && spot.name.toLowerCase().includes(extractedLower));
    }
  }

  // 3. 如果找到了，直接強制套用
  if (foundSpot) {
    addressInput.value = foundSpot.address || "";
    ratingInput.value = foundSpot.rating || "";
    hoursInput.value = foundSpot.hours || "";
    if (foundSpot.name && (!titleInput.value || titleInput.value.includes("maps.app.goo.gl") || titleInput.value.startsWith("http"))) {
      titleInput.value = foundSpot.name;
    }
    if (foundSpot.subtype) {
      subtypeInput.value = foundSpot.subtype;
    } else if (foundSpot.type) {
      subtypeInput.value = foundSpot.type === "food" ? "美食餐廳" : "觀光景點";
    }
    showToast(`已自動填充「${foundSpot.name || '商家'}」的真實營業時間與資訊！`, "success");
    return;
  }

  // 4. 若無匹配備案，進行智慧 Mock 預測
  const searchNameForMock = (titleInput.value || extractedName || "").trim();
  const urlForMock = url;

  // 1) Smart Mock Rating
  if (!ratingInput.value || ratingInput.value.startsWith("⭐️")) {
    const score = (4.2 + Math.random() * 0.7).toFixed(1);
    const reviews = Math.floor(Math.random() * 7500) + 500;
    ratingInput.value = `⭐️ ${score} (${reviews.toLocaleString()} 則評論)`;
  }

  // 2) Smart Mock Address
  const fullSearchStr = `${searchNameForMock} ${urlForMock} ${trip.location || ""}`.toLowerCase();
  let mockAddresses = [];
  if (fullSearchStr.includes("伊勢") || fullSearchStr.includes("神宮") || fullSearchStr.includes("鳥羽") || fullSearchStr.includes("志摩") || fullSearchStr.includes("三重") || fullSearchStr.includes("ise")) {
    mockAddresses = [
      "三重縣伊勢市宇治館町 1",
      "三重縣伊勢市本町 1-2-3",
      "三重縣鳥羽市鳥羽 3-3-6",
      "三重縣志摩市阿兒町神明 724-1"
    ];
  } else if (fullSearchStr.includes("名古屋") || fullSearchStr.includes("榮") || fullSearchStr.includes("大須") || fullSearchStr.includes("名站") || fullSearchStr.includes("錦") || fullSearchStr.includes("愛知") || fullSearchStr.includes("nagoya")) {
    mockAddresses = [
      "愛知縣名古屋市中區榮 3-5-1",
      "愛知縣名古屋市中村區名站 1-1-4",
      "愛知縣名古屋市中區錦 3-15-4",
      "愛知縣名古屋市千種區今池 1-3-2",
      "愛知縣名古屋市中區大須 2-18-4"
    ];
  } else if (fullSearchStr.includes("阿里山") || fullSearchStr.includes("奮起湖") || fullSearchStr.includes("竹崎") || fullSearchStr.includes("番路") || fullSearchStr.includes("嘉義")) {
    mockAddresses = [
      "嘉義縣阿里山鄉中正村 56 號",
      "嘉義縣竹崎鄉中和村奮起湖 178 號",
      "嘉義市東區中山路 199 號",
      "嘉義縣番路鄉公田村 1 號"
    ];
  } else if (fullSearchStr.includes("台北") || fullSearchStr.includes("信義") || fullSearchStr.includes("萬華") || fullSearchStr.includes("台灣")) {
    mockAddresses = [
      "台北市信義區信義路五段 7 號",
      "台北市萬華區成都路 10 號",
      "台中市西屯區台灣大道三段 99 號"
    ];
  } else {
    const loc = (trip.location || "").toLowerCase();
    if (loc.includes("名古屋") || loc.includes("愛知") || loc.includes("nagoya")) {
      mockAddresses = [
        "愛知縣名古屋市中區榮 3-5-1",
        "愛知縣名古屋市中村區名站 1-1-4",
        "愛知縣名古屋市中區錦 3-15-4"
      ];
    } else if (loc.includes("伊勢") || loc.includes("三重") || loc.includes("ise")) {
      mockAddresses = [
        "三重縣伊勢市宇治館町 1",
        "三重縣伊勢市本町 1-2-3"
      ];
    } else if (loc.includes("阿里山") || loc.includes("嘉義")) {
      mockAddresses = [
        "嘉義縣阿里山鄉中正村 56 號",
        "嘉義縣竹崎鄉中和村奮起湖 178 號"
      ];
    }
  }

  const currentAddress = addressInput.value.trim();
  const isDefaultNagoyaAddress = ["愛知縣名古屋市中區榮 3-5-1", "愛知縣名古屋市中村區名站 1-1-4", "愛知縣名古屋市中區錦 3-15-4", "愛知縣名古屋市千種區今池 1-3-2", "愛知縣名古屋市中區大須 2-18-4"].includes(currentAddress);
  if (!currentAddress || isDefaultNagoyaAddress) {
    if (mockAddresses.length > 0) {
      const randomIndex = Math.floor(Math.random() * mockAddresses.length);
      addressInput.value = mockAddresses[randomIndex];
    } else {
      const roadNum = Math.floor(Math.random() * 200) + 1;
      addressInput.value = `${trip.location || "未知目的地"}市中心路 ${roadNum} 號`;
    }
  }

  // 3) Smart Mock Business Hours
  let predictedHours = "";
  const nameLower = searchNameForMock.toLowerCase();

  if (nameLower.includes("居酒屋") || nameLower.includes("晚餐") || nameLower.includes("深夜") || nameLower.includes("酒吧") || nameLower.includes("bar") || nameLower.includes("pub") || nameLower.includes("一月家") || nameLower.includes("串燒") || nameLower.includes("燒肉")) {
    predictedHours = "17:00 - 23:00";
  } else if (nameLower.includes("日出") || nameLower.includes("晨曦") || nameLower.includes("清晨") || nameLower.includes("觀日") || nameLower.includes("祝山") || nameLower.includes("小笠原")) {
    predictedHours = "04:30 - 12:00";
  } else if (nameLower.includes("早餐") || nameLower.includes("早點") || nameLower.includes("早午餐")) {
    predictedHours = "06:00 - 11:30";
  } else if (nameLower.includes("租車") || nameLower.includes("牽車") || nameLower.includes("租重機") || nameLower.includes("車行") || nameLower.includes("rental")) {
    predictedHours = "09:00 - 19:00";
  } else if (nameLower.includes("咖啡") || nameLower.includes("下午茶") || nameLower.includes("甜點") || nameLower.includes("烘焙") || nameLower.includes("cafe") || nameLower.includes("coffee") || nameLower.includes("下午")) {
    predictedHours = "10:00 - 19:00";
  } else if (nameLower.includes("午餐") || nameLower.includes("餐廳") || nameLower.includes("美食") || nameLower.includes("食堂") || nameLower.includes("拉麵") || nameLower.includes("料理") || nameLower.includes("吃")) {
    predictedHours = "11:00 - 15:00, 17:00 - 21:30";
  } else if (nameLower.includes("24小時") || nameLower.includes("24h") || nameLower.includes("步道") || nameLower.includes("古道") || nameLower.includes("草原") || nameLower.includes("公園") || nameLower.includes("神宮") || nameLower.includes("內宮") || nameLower.includes("外宮")) {
    predictedHours = "24小時開放";
  } else {
    if (typeGroup === "restaurants") {
      predictedHours = "11:00 - 15:00, 17:00 - 21:30";
    } else {
      predictedHours = Math.random() > 0.4 ? "08:00 - 17:00" : "24小時開放";
    }
  }

  const currentHours = hoursInput.value.trim();
  const isDefaultMockHours = ["08:00 - 17:00", "24小時開放", "11:00 - 15:00, 17:00 - 21:30", "24小時營業", "09:00 - 18:00"].includes(currentHours);
  if (!currentHours || isDefaultMockHours) {
    hoursInput.value = predictedHours;
  }

  if (!titleInput.value && extractedName) {
    titleInput.value = extractedName;
  }

  showToast("已依據關鍵字/類別預估並填充商家資訊！", "info");
}

// 從 Google 地圖 Place 長連結中提取名稱
function extractPlaceNameFromUrl(url) {
  try {
    const decoded = decodeURIComponent(url);
    const placeMatch = decoded.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch && placeMatch[1]) {
      return placeMatch[1].replace(/\+/g, ' ');
    }
  } catch (e) {
    console.error("Error decoding URL for place name:", e);
  }
  return null;
}

// 編輯單日行程摘要
function openDaySummaryModal() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip || !trip.itinerary || !trip.itinerary.days) return;

  const dayData = trip.itinerary.days.find(d => d.dayNum === activeItineraryDay);
  if (!dayData) return;

  document.getElementById("ds-theme").value = dayData.theme || "";
  document.getElementById("ds-desc").value = dayData.desc || "";

  document.getElementById("day-summary-modal").classList.add("active");
}

function closeDaySummaryModal() {
  document.getElementById("day-summary-modal").classList.remove("active");
}

function handleDaySummarySubmit(e) {
  e.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip || !trip.itinerary || !trip.itinerary.days) return;

  let dayData = trip.itinerary.days.find(d => d.dayNum === activeItineraryDay);
  if (!dayData) {
    dayData = { dayNum: activeItineraryDay, date: `Day ${activeItineraryDay}`, theme: "", desc: "", items: [] };
    trip.itinerary.days.push(dayData);
  }

  dayData.theme = document.getElementById("ds-theme").value.trim();
  dayData.desc = document.getElementById("ds-desc").value.trim();

  // 儲存至 LocalStorage 並重新渲染
  localStorage.setItem("voyage_trips", JSON.stringify(trips));
  closeDaySummaryModal();
  renderWorkspaceItinerary();
  showToast("今日行程摘要已成功更新！", "success");
}

// 智慧解析或 Mock 預測匯入的行程項目屬性
function autoFillImportedItem(item, title, type, tripLocation, allSpots) {
  let mapsUrl = item.mapsUrl || item.maps_url || item.google_maps || item.googleMaps || "";
  let address = item.address || item.location_address || "";
  let rating = item.rating || item.rating_score || "";
  let hours = item.hours || item.business_hours || item.opening_hours || "";

  // 1. 先匹配 LOCAL_GEO_DATABASE
  let matchedSpot = null;
  const urlLower = mapsUrl.toLowerCase();
  const searchTitle = (title || "").toLowerCase();
  
  matchedSpot = LOCAL_GEO_DATABASE.find(dbItem => {
    if (urlLower) {
      const hasUrlKey = dbItem.keys.some(k => k.length >= 6 && urlLower.includes(k.toLowerCase()));
      if (hasUrlKey) return true;
    }
    if (searchTitle) {
      const hasTitleKey = dbItem.keys.some(k => k.length >= 2 && (searchTitle.includes(k.toLowerCase()) || k.toLowerCase().includes(searchTitle)));
      if (hasTitleKey) return true;
    }
    return false;
  });

  // 2. 如果沒匹配到，再匹配備案庫
  if (!matchedSpot && mapsUrl) {
    matchedSpot = allSpots.find(s => s.mapsUrl && s.mapsUrl.trim() === mapsUrl.trim());
  }
  if (!matchedSpot && searchTitle) {
    matchedSpot = allSpots.find(s => s.name && s.name.toLowerCase().includes(searchTitle));
  }

  // 3. 備案庫/資料庫匹配成功，載入相關屬性
  if (matchedSpot) {
    if (!mapsUrl) mapsUrl = matchedSpot.mapsUrl || "";
    if (!address) address = matchedSpot.address || "";
    if (!rating) rating = matchedSpot.rating || "";
    if (!hours) hours = matchedSpot.hours || "";
    if (matchedSpot.type && !type) type = matchedSpot.type;
  }

  // 4. 若仍無屬性，且該活動屬於實體景點/餐廳/飯店，進行智慧 Mock 預測以保證精美排版
  if (type === "sight" || type === "food" || type === "hotel" || type === "bike") {
    // 預設地圖連結
    if (!mapsUrl && title) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`;
    }

    // 預期高分
    if (!rating) {
      const score = (4.2 + Math.random() * 0.7).toFixed(1);
      const reviews = Math.floor(Math.random() * 7500) + 500;
      rating = `⭐️ ${score} (${reviews.toLocaleString()} 則評論)`;
    }

    // 根據所在區域匹配 mock 地址
    if (!address) {
      const fullSearchStr = `${title || ""} ${mapsUrl} ${tripLocation || ""}`.toLowerCase();
      let mockAddresses = [];
      if (fullSearchStr.includes("伊勢") || fullSearchStr.includes("神宮") || fullSearchStr.includes("鳥羽") || fullSearchStr.includes("志摩") || fullSearchStr.includes("三重") || fullSearchStr.includes("ise")) {
        mockAddresses = [
          "三重縣伊勢市宇治館町 1",
          "三重縣伊勢市本町 1-2-3",
          "三重縣鳥羽市鳥羽 3-3-6",
          "三重縣志摩市阿兒町神明 724-1"
        ];
      } else if (fullSearchStr.includes("名古屋") || fullSearchStr.includes("榮") || fullSearchStr.includes("大須") || fullSearchStr.includes("名站") || fullSearchStr.includes("錦") || fullSearchStr.includes("愛知") || fullSearchStr.includes("nagoya")) {
        mockAddresses = [
          "愛知縣名古屋市中區榮 3-5-1",
          "愛知縣名古屋市中村區名站 1-1-4",
          "愛知縣名古屋市中區錦 3-15-4",
          "愛知縣名古屋市千種區今池 1-3-2",
          "愛知縣名古屋市中區大須 2-18-4"
        ];
      } else if (fullSearchStr.includes("阿里山") || fullSearchStr.includes("奮起湖") || fullSearchStr.includes("竹崎") || fullSearchStr.includes("番路") || fullSearchStr.includes("嘉義")) {
        mockAddresses = [
          "嘉義縣阿里山鄉中正村 56 號",
          "嘉義縣竹崎鄉中和村奮起湖 178 號",
          "嘉義市東區中山路 199 號",
          "嘉義縣番路鄉公田村 1 號"
        ];
      } else if (fullSearchStr.includes("台北") || fullSearchStr.includes("信義") || fullSearchStr.includes("萬華") || fullSearchStr.includes("台灣")) {
        mockAddresses = [
          "台北市信義區信義路五段 7 號",
          "台北市萬華區成都路 10 號",
          "台中市西屯區台灣大道三段 99 號"
        ];
      } else if (tripLocation) {
        const loc = tripLocation.toLowerCase();
        if (loc.includes("名古屋") || loc.includes("愛知") || loc.includes("nagoya")) {
          mockAddresses = [
            "愛知縣名古屋市中區榮 3-5-1",
            "愛知縣名古屋市中村區名站 1-1-4",
            "愛知縣名古屋市中區錦 3-15-4"
          ];
        } else if (loc.includes("伊勢") || loc.includes("三重") || loc.includes("ise")) {
          mockAddresses = [
            "三重縣伊勢市宇治館町 1",
            "三重縣伊勢市本町 1-2-3"
          ];
        } else if (loc.includes("阿里山") || loc.includes("嘉義")) {
          mockAddresses = [
            "嘉義縣阿里山鄉中正村 56 號",
            "嘉義縣竹崎鄉中和村奮起湖 178 號"
          ];
        }
      }

      if (mockAddresses.length > 0) {
        const randomIndex = Math.floor(Math.random() * mockAddresses.length);
        address = mockAddresses[randomIndex];
      } else {
        const roadNum = Math.floor(Math.random() * 200) + 1;
        address = `${tripLocation || "未知目的地"}市中心路 ${roadNum} 號`;
      }
    }

    // 營業時間預估
    if (!hours) {
      const nameLower = (title || "").toLowerCase();
      if (nameLower.includes("居酒屋") || nameLower.includes("晚餐") || nameLower.includes("深夜") || nameLower.includes("酒吧") || nameLower.includes("bar") || nameLower.includes("pub") || nameLower.includes("一月家") || nameLower.includes("串燒") || nameLower.includes("燒肉")) {
        hours = "17:00 - 23:00";
      } else if (nameLower.includes("日出") || nameLower.includes("晨曦") || nameLower.includes("清晨") || nameLower.includes("觀日") || nameLower.includes("祝山") || nameLower.includes("小笠原")) {
        hours = "04:30 - 12:00";
      } else if (nameLower.includes("早餐") || nameLower.includes("早點") || nameLower.includes("早午餐")) {
        hours = "06:00 - 11:30";
      } else if (nameLower.includes("租車") || nameLower.includes("牽車") || nameLower.includes("租重機") || nameLower.includes("車行") || nameLower.includes("rental")) {
        hours = "09:00 - 19:00";
      } else if (nameLower.includes("咖啡") || nameLower.includes("下午茶") || nameLower.includes("甜點") || nameLower.includes("烘焙") || nameLower.includes("cafe") || nameLower.includes("coffee") || nameLower.includes("下午")) {
        hours = "10:00 - 19:00";
      } else if (nameLower.includes("午餐") || nameLower.includes("餐廳") || nameLower.includes("美食") || nameLower.includes("食堂") || nameLower.includes("拉麵") || nameLower.includes("料理") || nameLower.includes("吃")) {
        hours = "11:00 - 15:00, 17:00 - 21:30";
      } else if (nameLower.includes("24小時") || nameLower.includes("24h") || nameLower.includes("步道") || nameLower.includes("古道") || nameLower.includes("草原") || nameLower.includes("公園") || nameLower.includes("神宮") || nameLower.includes("內宮") || nameLower.includes("外宮")) {
        hours = "24小時開放";
      } else {
        if (type === "food") {
          hours = "11:00 - 15:00, 17:00 - 21:30";
        } else if (type === "sight") {
          hours = Math.random() > 0.4 ? "08:00 - 17:00" : "24小時開放";
        } else if (type === "hotel") {
          hours = "24小時營業";
        } else {
          hours = "09:00 - 18:00";
        }
      }
    }
  }

  return { mapsUrl, address, rating, hours };
}

// 客製化 Logo 名稱與招呼語編輯邏輯
function startLogoEdit() {
  const logoText = document.getElementById("logo-text");
  const editBtn = document.getElementById("edit-logo-btn");
  const container = logoText.parentElement;

  const currentText = logoText.innerText;

  // 建立 inline 編輯輸入框
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentText;
  input.style.fontSize = "1.25rem";
  input.style.fontWeight = "700";
  input.style.fontFamily = "inherit";
  input.style.color = "var(--accent-color)";
  input.style.background = "var(--bg-card)";
  input.style.border = "1px solid var(--accent-color)";
  input.style.borderRadius = "6px";
  input.style.padding = "2px 6px";
  input.style.width = "150px";
  input.style.outline = "none";
  input.style.boxShadow = "var(--shadow-sm)";

  // 隱藏原始文字與按鈕，插入輸入框
  logoText.style.display = "none";
  editBtn.style.display = "none";
  container.insertBefore(input, editBtn);
  input.focus();
  input.select();

  // 防止點擊輸入框時觸發 logo-btn 的跳轉
  input.addEventListener("click", (e) => e.stopPropagation());

  function finishEdit() {
    const newText = input.value.trim();
    if (newText) {
      localStorage.setItem("voyage_logo_text", newText);
      logoText.innerText = newText;
    }
    input.remove();
    logoText.style.display = "";
    editBtn.style.display = "";
  }

  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      finishEdit();
    } else if (e.key === "Escape") {
      input.value = currentText;
      finishEdit();
    }
  });

  input.addEventListener("blur", () => {
    finishEdit();
  });
}

window.voyageApp = {
  rehydrateAndRender() {
    initData();
    setupTheme();
    renderAll();
    document.dispatchEvent(new CustomEvent("voyage:app-ready"));
  },
  showToast
};

function startGreetingEdit() {
  const title = document.getElementById("greeting-title");
  const editBtn = document.getElementById("edit-greeting-btn");
  const container = title.parentElement;

  const currentName = localStorage.getItem("voyage_user_name") || "旅人";

  // 建立 inline 編輯輸入框
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentName;
  input.style.fontSize = "1.75rem";
  input.style.fontWeight = "700";
  input.style.fontFamily = "inherit";
  input.style.color = "var(--text-primary)";
  input.style.background = "var(--bg-card)";
  input.style.border = "1px solid var(--accent-color)";
  input.style.borderRadius = "8px";
  input.style.padding = "4px 8px";
  input.style.width = "180px";
  input.style.outline = "none";
  input.style.boxShadow = "var(--shadow-sm)";

  // 隱藏原始標題與按鈕，插入輸入框
  title.style.display = "none";
  editBtn.style.display = "none";
  container.insertBefore(input, title);
  input.focus();
  input.select();

  function finishEdit() {
    const newName = input.value.trim();
    if (newName) {
      localStorage.setItem("voyage_user_name", newName);
    }
    input.remove();
    title.style.display = "";
    editBtn.style.display = "";
    renderDashboard(); // 重新渲染招呼語
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      finishEdit();
    } else if (e.key === "Escape") {
      input.value = currentName;
      finishEdit();
    }
  });

  input.addEventListener("blur", () => {
    finishEdit();
  });
}
