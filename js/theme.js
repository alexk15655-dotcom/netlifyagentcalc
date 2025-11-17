'use strict';

/**
 * ThemeManager - управление темной/светлой темой
 * - Автоопределение системной темы
 * - Сохранение выбора в localStorage
 * - Плавное переключение
 * - Слежение за системными изменениями
 */
class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'cashier-checkup-theme';
    this.theme = this.loadTheme();
    this.applyTheme(this.theme);
    this.initToggle();
    this.watchSystemTheme();
  }
  
  /**
   * Загрузка темы из localStorage или системных настроек
   */
  loadTheme() {
    // 1. Проверяем сохраненную тему
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      console.log('[Theme] Загружена тема из localStorage:', saved);
      return saved;
    }
    
    // 2. Проверяем системную тему
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      console.log('[Theme] Определена системная тема: dark');
      return 'dark';
    }
    
    // 3. По умолчанию - светлая
    console.log('[Theme] Используется дефолтная тема: light');
    return 'light';
  }
  
  /**
   * Применение темы к документу
   */
  applyTheme(theme) {
    // Устанавливаем data-атрибут на html
    document.documentElement.setAttribute('data-theme', theme);
    
    // Обновляем иконку
    this.updateIcon(theme);
    
    // Сохраняем текущую тему
    this.theme = theme;
    
    console.log('[Theme] Применена тема:', theme);
  }
  
  /**
   * Обновление иконки кнопки
   */
  updateIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    if (icon) {
      // 🌙 для светлой темы (предлагает переключить на темную)
      // ☀️ для темной темы (предлагает переключить на светлую)
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }
  
  /**
   * Переключение темы
   */
  toggle() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
    
    // Сохраняем в localStorage
    localStorage.setItem(this.STORAGE_KEY, newTheme);
    
    console.log('[Theme] Тема переключена на:', newTheme);
  }
  
  /**
   * Инициализация кнопки переключения
   */
  initToggle() {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
      console.log('[Theme] Кнопка переключения инициализирована');
    } else {
      console.warn('[Theme] Кнопка #themeToggle не найдена');
    }
  }
  
  /**
   * Слежение за системными изменениями темы
   */
  watchSystemTheme() {
    if (!window.matchMedia) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', (e) => {
      // Меняем тему только если пользователь не выбрал явно
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        const newTheme = e.matches ? 'dark' : 'light';
        this.applyTheme(newTheme);
        console.log('[Theme] Системная тема изменена на:', newTheme);
      }
    });
    
    console.log('[Theme] Слежение за системной темой включено');
  }
  
  /**
   * Сброс к системной теме
   */
  resetToSystem() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.theme = this.loadTheme();
    this.applyTheme(this.theme);
    console.log('[Theme] Сброс к системной теме');
  }
  
  /**
   * Получить текущую тему
   */
  getCurrentTheme() {
    return this.theme;
  }
  
  /**
   * Установить конкретную тему
   */
  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      console.error('[Theme] Неверное значение темы:', theme);
      return;
    }
    
    this.applyTheme(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
  }
}

// Глобальная инициализация
(function() {
  // Применяем тему как можно раньше (до загрузки DOM)
  const savedTheme = localStorage.getItem('cashier-checkup-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  window.themeManager = new ThemeManager();
  console.log('[Theme] ThemeManager инициализирован');
});

// Экспорт для возможного использования в других скриптах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
