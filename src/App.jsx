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

      // 4. Обновляем историю
      loadHistory();
    } catch (err) {
      console.error('Ошибка:', err);
      setError('Произошла ошибка при обработке изображения');
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузка истории анализов
  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API_ENDPOINT}/history`);
      setHistory(response.data);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
    }
  };

  // Форматирование даты
  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
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
      </main>
    </div>
  );
}

export default App;