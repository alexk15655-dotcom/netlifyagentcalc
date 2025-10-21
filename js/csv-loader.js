'use strict';

/**
 * Загружает CSV файл ЛОКАЛЬНО через FileReader API
 * НЕТ сетевых запросов - файл читается из памяти браузера
 */
function loadCSV(file, onSuccess, onError) {
  // Проверка типа файла
  if (!file.name.endsWith('.csv')) {
    onError('Поддерживаются только .csv файлы');
    return;
  }
  
  // FileReader - читает файл ЛОКАЛЬНО из FileList
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const csvText = e.target.result;
    
    // PapaParse работает ЛОКАЛЬНО - парсит строку в массив объектов
    Papa.parse(csvText, {
      header: true,
      delimiter: ';',          // точка с запятой
      quoteChar: '"',
      skipEmptyLines: true,
      dynamicTyping: false,    // оставляем строками
      
      transformHeader: (header) => {
        // Убираем BOM и лишние пробелы
        return header.replace(/^\uFEFF/, '').trim();
      },
      
      transform: (value, header) => {
        // Убираем кавычки
        let cleaned = value.replace(/^"|"$/g, '').trim();
        
        // Для числовых полей заменяем запятую на точку
        const numericFields = [
          'Сумма пополнений',
          'Сумма вывода',
          'Сумма пополнений (в валюте админа по курсу текущего дня)',
          'Сумма вывода (в валюте админа по курсу текущего дня)',
          'Сумма пополнений (в валюте админа)',
          'Количество пополнений',
          'Количество выводов',
          'Количество'
        ];
        
        if (numericFields.some(f => header.includes(f))) {
          cleaned = cleaned.replace(',', '.');
        }
        
        return cleaned;
      },
      
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
        }
        
        // Фильтруем пустые строки
        const filtered = results.data.filter(row => {
          const values = Object.values(row);
          return values.some(v => v && v.trim() !== '');
        });
        
        console.log(`[CSV Loader] Загружено строк: ${filtered.length}`);
        onSuccess(filtered);
      },
      
      error: (error) => {
        onError(error.message);
      }
    });
  };
  
  reader.onerror = () => {
    onError('Ошибка чтения файла');
  };
  
  // Читаем как текст (НЕ отправляем куда-либо)
  reader.readAsText(file, 'UTF-8');
}
