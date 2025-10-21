# Cashier Checkup

Веб-приложение для анализа данных кассиров с **полной приватностью** - все данные обрабатываются локально в браузере.

## 🔒 Гарантии приватности

- ✅ **100% локальная обработка** - CSV файлы не покидают браузер
- ✅ **Нет сетевых запросов** - Content Security Policy блокирует `connect-src`
- ✅ **Нет аналитики** - никаких трекеров или логирования
- ✅ **Open Source** - код доступен для аудита

## 📋 Возможности

### 1. Калькуляция
- Расчет комиссий (депозиты/выводы)
- Средний депозит/вывод
- Профит по каждому игроку
- Группировка по кассам

### 2. Проверка имен
- Поиск похожих имен (Levenshtein distance)
- Определение мультиаккаунтов
- Выявление дубликатов ID

### 3. Сводка по ФГ
- Агрегация по финансовым группам
- Связь с prepayments
- Покрытие предоплатами
- Количество игроков на касс

у

### 4. Фрод-анализ
- Высокие выводы (>110%)
- Пустые аккаунты
- Мусорные имена
- Группировка по агентам

## 🚀 Развертывание

### Способ 1: Netlify (рекомендуется)

#### Через Git:
```bash
# 1. Клонировать репозиторий
git clone https://github.com/yourusername/cashier-checkup.git
cd cashier-checkup

# 2. Пуш на GitHub
git remote add origin https://github.com/yourusername/cashier-checkup.git
git push -u origin main

# 3. В Netlify Dashboard:
# - New site from Git
# - Выбрать репо
# - Build settings: оставить пустыми
# - Deploy
```

#### Drag & Drop:
1. Перейти на [netlify.com](https://netlify.com)
2. Перетащить папку проекта в окно браузера
3. Получить ссылку `https://random-name.netlify.app`

### Способ 2: Локальный запуск

```bash
# Простой HTTP сервер (Python)
python3 -m http.server 8000

# Или (Node.js)
npx serve .

# Открыть http://localhost:8000
```

## 📁 Структура проекта

```
cashier-checkup/
├── index.html              # Главная страница
├── results.html            # Страница результатов
├── privacy-policy.html     # Политика приватности
├── netlify.toml           # Конфиг Netlify
├── css/
│   ├── main.css           # Основные стили
│   └── results.css        # Стили результатов
├── js/
│   ├── app.js             # Логика главной страницы
│   ├── results.js         # Логика результатов
│   ├── csv-loader.js      # Загрузка CSV (FileReader)
│   ├── core/
│   │   ├── processor.js        # Расчеты
│   │   ├── name-checker.js     # Проверка имен
│   │   ├── fraud-analyzer.js   # Фрод-анализ
│   │   └── fg-summary.js       # Сводка ФГ
│   ├── workers/
│   │   └── main.worker.js      # Web Worker
│   └── ui/
│       ├── results-renderer.js # Рендеринг таблиц
│       └── export.js           # Экспорт CSV
└── lib/
    └── papaparse.min.js   # Парсинг CSV
```

## 🔧 Формат входных данных

### Основной файл (analyze_cashdesck_deposits.csv)
```csv
Номер игрока;Игрок;Сумма пополнений;...;Касса
"1234567";"Иван Иванов";"100,50";...;"1249273 Baku - Gold Kassa"
...
"ФГ: Агент Имя";"1249273, Baku";...
"0";"Итого";...
```

**Требования:**
- Разделитель: точка с запятой (`;`)
- Десятичный разделитель: запятая (`,`)
- Кодировка: UTF-8
- Касса: колонка I-M (выбирается пользователем)

### Prepayments (cashbox_bet_check.csv)
```csv
Номер фин. группы;Фин. группа;Страна;Сумма пополнений (в валюте админа);Количество
"189385";"Агент Имя";"Uzbekistan";"782,44";"1"
...
"Итого";"";"";...
```

## 🛠️ Технологии

- **Vanilla JavaScript** - без фреймворков
- **Web Workers** - для производительности
- **FileReader API** - локальное чтение файлов
- **PapaParse** - парсинг CSV
- **Content Security Policy** - защита от утечек

## 🔍 Проверка приватности

### Способ 1: Network Monitor
```
F12 → Network → Загрузить CSV → Обработать
Результат: 0 запросов к внешним доменам
```

### Способ 2: Offline Test
```
1. Открыть приложение
2. Отключить WiFi
3. Загрузить CSV
4. Приложение работает → данные не уходят
```

### Способ 3: Code Audit
```bash
# Поиск сетевых вызовов
grep -r "fetch\|XMLHttpRequest\|axios" js/
# Результат: 0 найдено
```

## 📊 Пример использования

1. Открыть `https://your-app.netlify.app`
2. Загрузить основной CSV
3. (Опционально) Загрузить prepayments
4. Выбрать колонку с кассами (I-M)
5. Настроить комиссии
6. Нажать "Обработать"
7. Экспортировать результаты

## 🐛 Известные ограничения

- Размер файла: рекомендуется до 10,000 строк
- Браузеры: Chrome 90+, Firefox 88+, Safari 14+
- Формат CSV: только `;` разделитель

## 📝 Лицензия

MIT License

## 📧 Контакты

- Email: support@example.com
- GitHub: [github.com/username/cashier-checkup](https://github.com/username/cashier-checkup)

## 🙏 Благодарности

- [PapaParse](https://www.papaparse.com/) - CSV парсинг
- [Netlify](https://www.netlify.com/) - хостинг
