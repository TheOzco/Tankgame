// ==============================
// تنظیمات انواع تانک‌ها
// برای اضافه کردن تانک جدید در آینده:
// 1) یک آیتم جدید به TANK_TYPES اضافه کن
// 2) کلیدش رو به آرایه ROSTER اضافه کن
// همین! بقیه بازی خودکار باهاش کار می‌کنه
// ==============================

const TANK_TYPES = {
  power: {
    key: 'power',
    name: 'تانک قدرتی',
    hp: 3,
    damage: 1,
    move: 1,
    range: 2,
    color: '#3b6ea5',
    icon: '🛡️'
  },
  speed: {
    key: 'speed',
    name: 'تانک سرعتی',
    hp: 2,
    damage: 2,
    move: 4,
    range: 2,
    color: '#4a8f4a',
    icon: '⚡'
  },
  sniper: {
    key: 'sniper',
    name: 'تانک اسنایپر',
    hp: 1,
    damage: 3,
    move: 1,
    range: 4,
    color: '#a5473b',
    icon: '🎯'
  }
};

// ترتیب تانک‌هایی که هر بازیکن در ابتدای بازی باید بچینه
const ROSTER = ['power', 'speed', 'sniper'];
