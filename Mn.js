/*
[22.05, 08:03] Азамат Ибрашев: Готово! Вот что теперь есть:

### Backend:

* **3 Lambda-функции**:

  * `getSignedUrl` — получает URL для загрузки в S3.
  * `analyzeImage` — вызывает Rekognition и сохраняет результаты в DynamoDB.
  * `getAnalysisHistory` — возвращает историю анализов.

### Frontend (React):

* Загрузка изображений в S3
* Анализ через AWS Rekognition
* Отображение меток опасного контента
* Получение и отображение истории анализов

### Следующие шаги:

1. **S3 Bucket**:

   * Создай бакет `image-analyzer-yourname`
   * Включи CORS:

     ```json
     [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "PUT", "POST"],
         "AllowedOrigins": ["*"],
         "ExposeHeaders": []
       }
     ]
     ```

2. **DynamoDB Table**:

   * Имя: `ImageAnalysisTable`
   * Partition Key: `id` (String)

3. **API Gateway**:

   * Три эндпоинта:

     * `POST /upload-url → getSignedUrl Lambda`
     * `POST /analyze → analyzeImage Lambda`
     * `GET /history → getAnalysisHistory Lambda`

4. **Разверни фронтенд**:

   * Например, в [AWS Amplify](https://docs.amplify.aws/)

5. **Настрой SSL и домен**:

   * Через Amplify или Route 53 (если хочешь очки за домен)

Если хочешь — я могу подробно расписать настройку API Gateway или загрузку в Amplify.
[22.05, 08:03] Азамат Ибрашев: Отлично, ниже подробная пошаговая инструкция:

---

## **Часть 1. Настройка API Gateway с 3 эндпоинтами**

### 1. Зайди в AWS Console → **API Gateway**

1. Нажми **Create API**
2. Выбери **HTTP API** → **Build**
3. В разделе **Integrations**:

   * Нажми **Add integration** → **Lambda function**
   * Добавь все три функции по очереди:

     * `getSignedUrl`
     * `analyzeImage`
     * `getAnalysisHistory`

### 2. Настрой маршруты:

| Route         | Method | Integration          |
| ------------- | ------ | -------------------- |
| `/upload-url` | POST   | `getSignedUrl`       |
| `/analyze`    | POST   | `analyzeImage`       |
| `/history`    | GET    | `getAnalysisHistory` |

1. Нажми **Add route** для каждого пути
2. Привяжи соответствующую Lambda-функцию

### 3. Настрой CORS:

* Включи `Access-Control-Allow-Origin: *`
* Методы: `GET`, `POST`

### 4. Разверни API:

* Нажми **Deploy**
* Получи URL, например:
  `https://abc123xyz.execute-api.region.amazonaws.com`

**Важно:** Используй этот URL во фронтенде (`App.js`)

---

## **Часть 2. Развёртывание Frontend в AWS Amplify**

### 1. Подготовь проект React

* В терминале выполни:

  ```bash
  npm run build
  ```

  Это создаст папку `build/`

### 2. Зайди в AWS Console → **Amplify**

1. Нажми **"New app" → "Host web app"**
2. Выбери:

   * **Manual deploy** (если без Git)
   * Загрузи содержимое папки `build/` (архивируй как `.zip`)
3. Дай имя проекту (например: `image-analyzer`)
4. Нажми **Deploy**

### 3. Получи публичный URL

* Amplify сгенерирует адрес вида:
  `https://main.d3xyz123.amplifyapp.com`
* Этот адрес можно **заменить в `App.js`** как основной сайт

---

## **Хочешь плюс 1 балл?**

* Подключи собственный домен (в Amplify → Domain management)
* Используй бесплатный **SSL-сертификат**

---

Хочешь, я помогу создать `build.zip` или настроить вручную через GitHub?
*/
