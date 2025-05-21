import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  // Конфигурация API
  const API_ENDPOINT = 'https://n4lztxcjn6.execute-api.eu-north-1.amazonaws.com/prod';

  // Генерация превью при выборе файла
  useEffect(() => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }, [file]);

  // Загрузка истории при монтировании компонента
  useEffect(() => {
    loadHistory();
  }, []);

  // Загрузка и анализ изображения
  const handleUpload = async () => {
    if (!file) {
      setError('Пожалуйста, выберите файл');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // 1. Получаем URL для загрузки в S3
      const filename = `uploads/${Date.now()}_${file.name}`;
      const uploadUrlResponse = await axios.get(
        `${API_ENDPOINT}/upload-url?filename=${encodeURIComponent(filename)}`
      );
      
      // 2. Загружаем файл напрямую в S3
      await axios.put(uploadUrlResponse.data.uploadUrl, file, {
        headers: { 'Content-Type': file.type }
      });

      // 3. Запускаем анализ изображения
      const analysisResponse = await axios.get(
        `${API_ENDPOINT}/analyze?filename=${encodeURIComponent(filename)}`
      );

      setResults({
        ...analysisResponse.data,
        imageUrl: `https://image-analys.s3.amazonaws.com/${filename}`
      });

      // 4. Обновляем историю после успешного анализа
      await loadHistory();
    } catch (err) {
      console.error('Ошибка:', err);
      setError('Произошла ошибка при обработке изображения');
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузка истории анализов
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API_ENDPOINT}/history`);
      // Сортируем по дате (новые сначала)
      const sortedHistory = response.data.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      setHistory(sortedHistory);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
      setError('Не удалось загрузить историю анализов');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Форматирование даты
  const formatDate = (isoString) => {
    if (!isoString) return 'Неизвестно';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Анализатор изображений AWS</h1>
      </header>

      <main className="main-content">
        {/* Блок загрузки */}
        <section className="upload-section">
          <h2>Загрузите изображение для анализа</h2>
          <div className="file-input-container">
            <input
              type="file"
              id="image-upload"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
            />
            <label htmlFor="image-upload" className="file-label">
              {file ? file.name : 'Выберите файл'}
            </label>
            <button 
              onClick={handleUpload} 
              disabled={!file || isLoading}
              className="upload-button"
            >
              {isLoading ? 'Анализ...' : 'Анализировать'}
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}
        </section>

        {/* Превью и результаты */}
        {preview && (
          <section className="preview-section">
            <h2>Превью изображения</h2>
            <div className="image-container">
              <img 
                src={preview} 
                alt="Предпросмотр" 
                className="preview-image"
              />
            </div>
          </section>
        )}

        {/* Результаты анализа */}
        {results && (
          <section className="results-section">
            <h2>Результаты анализа</h2>
            
            <div className="result-item">
              <h3>Описание изображения:</h3>
              <p>{results.description || 'Описание недоступно'}</p>
            </div>

            {results.moderation && results.moderation.length > 0 ? (
              <div className="result-item warning">
                <h3>⚠️ Обнаружен потенциально нежелательный контент:</h3>
                <ul>
                  {results.moderation.map((label, index) => (
                    <li key={index}>{label}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="result-item success">
                <h3>✓ Контент безопасен</h3>
                <p>Не обнаружено неприемлемых элементов</p>
              </div>
            )}

            {results.imageUrl && (
              <div className="result-item">
                <h3>Ссылка на изображение:</h3>
                <a 
                  href={results.imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="image-link"
                >
                  {results.imageUrl}
                </a>
              </div>
            )}
          </section>
        )}

        {/* История анализов */}
        <section className="history-section">
          <div className="history-header">
            <h2>История анализов</h2>
            <button 
              onClick={loadHistory} 
              disabled={historyLoading}
              className="refresh-button"
            >
              {historyLoading ? 'Загрузка...' : 'Обновить'}
            </button>
          </div>

          {historyLoading ? (
            <p>Загрузка истории...</p>
          ) : history.length > 0 ? (
            <div className="history-grid">
              {history.map((item) => (
                <div key={item.imageId} className="history-card">
                  <div className="card-header">
                    <h3>{item.imageId.split('/').pop().split('_')[1] || item.imageId}</h3>
                    <span className="card-date">{formatDate(item.timestamp)}</span>
                  </div>
                  
                  {item.imageUrl && (
                    <img 
                      src={item.imageUrl} 
                      alt="Из истории" 
                      className="history-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}

                  <div className="card-labels">
                    <strong>Объекты:</strong> 
                    {item.labels?.join(', ') || 'не обнаружены'}
                  </div>

                  {item.moderationLabels?.length > 0 && (
                    <div className="card-moderation">
                      <strong>Проблемы:</strong> 
                      {item.moderationLabels.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>Нет данных об анализах</p>
          )}
        </section>
      </main>

      
    </div>
  );
}

export default App;