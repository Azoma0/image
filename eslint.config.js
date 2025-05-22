import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]


/*
[22.05, 07:44] Азамат Ибрашев: # План создания веб-приложения для анализа изображений с использованием AWS

## 1. Вход в AWS Console
- Используйте предоставленные организатором учетные данные для входа в AWS Management Console
- Убедитесь, что у вас есть необходимые разрешения для создания ресурсов

## 2. Создание S3 бакета
1. Перейдите в сервис S3
2. Нажмите "Create bucket"
3. Укажите уникальное имя (например, "image-analysis-bucket-[yourname]")
4. Выберите регион
5. Настройте параметры:
   - Block Public Access: оставьте включенным
   - Versioning: по желанию
   - Tags: добавьте при необходимости

### Настройка политики доступа:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::[your-account-id]:role/[your-lambda-role]"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::image-analysis-bucket-[yourname]",
        "arn:aws:s3:::image-analysis-bucket-[yourname]/*"
      ]
    }
  ]
}
```

### Настройка CORS:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

## 3. Разработка Lambda-функций

### Функция для генерации URL загрузки (generate-upload-url):
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const bucketName = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    const { filename, filetype } = JSON.parse(event.body);
    
    const params = {
        Bucket: bucketName,
        Key: filename,
        ContentType: filetype,
        Expires: 60 * 5 // URL действителен 5 минут
    };
    
    try {
        const url = await s3.getSignedUrlPromise('putObject', params);
        return {
            statusCode: 200,
            body: JSON.stringify({ url })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
```

### Функция анализа изображения (analyze-image):
```javascript
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();
const bucketName = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    const { filename } = JSON.parse(event.body);
    
    try {
        // Детекция объектов
        const detectLabelsParams = {
            Image: {
                S3Object: {
                    Bucket: bucketName,
                    Name: filename
                }
            },
            MaxLabels: 10,
            MinConfidence: 70
        };
        
        // Детекция неприемлемого контента
        const detectModerationParams = {
            Image: {
                S3Object: {
                    Bucket: bucketName,
                    Name: filename
                }
            },
            MinConfidence: 70
        };
        
        const [labelsResult, moderationResult] = await Promise.all([
            rekognition.detectLabels(detectLabelsParams).promise(),
            rekognition.detectModerationLabels(detectModerationParams).promise()
        ]);
        
        // Сохранение результатов в DynamoDB
        const dbParams = {
            TableName: process.env.TABLE_NAME,
            Item: {
                imageId: filename,
                labels: labelsResult.Labels,
                moderationLabels: moderationResult.ModerationLabels,
                createdAt: new Date().toISOString()
            }
        };
        
        await dynamoDb.put(dbParams).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                labels: labelsResult.Labels,
                moderationLabels: moderationResult.ModerationLabels
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
```

### Функция получения истории (get-history):
```javascript
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        const result = await dynamoDb.scan({
            TableName: process.env.TABLE_NAME,
            Limit: 10
        }).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify(result.Items)
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
```

## 4. Настройка DynamoDB
1. Создайте таблицу с именем "ImageAnalysisResults"
2. Первичный ключ: "imageId" (String)
3. Добавьте индексы по необходимости

## 5. Настройка API Gateway
1. Создайте новый REST API
2. Создайте ресурсы:
   - /upload-url (POST)
   - /analyze (POST)
   - /history (GET)
3. Настройте интеграцию с соответствующими Lambda-функциями
4. Разверните API (Deploy API)
5. Запишите конечный URL

## 6. Разработка веб-приложения (HTML/JS)

### index.html
```html
<!DOCTYPE html>
<html>
<head>
    <title>Image Analysis Tool</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        #upload-section, #results-section { margin-bottom: 20px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        #image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
        .label { display: inline-block; margin: 5px; padding: 5px 10px; background: #f0f0f0; border-radius: 3px; }
        .moderation { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Image Analysis Tool</h1>
    
    <div id="upload-section">
        <h2>Upload Image</h2>
        <input type="file" id="file-input" accept="image/*">
        <button id="upload-btn">Upload and Analyze</button>
        <div id="image-container">
            <img id="image-preview" style="display: none;">
        </div>
    </div>
    
    <div id="results-section" style="display: none;">
        <h2>Analysis Results</h2>
        <div id="labels-container">
            <h3>Detected Objects:</h3>
            <div id="labels"></div>
        </div>
        <div id="moderation-container">
            <h3>Content Moderation:</h3>
            <div id="moderation"></div>
        </div>
    </div>
    
    <div id="history-section">
        <h2>Analysis History</h2>
        <button id="load-history">Load History</button>
        <div id="history-items"></div>
    </div>
    
    <script src="app.js"></script>
</body>
</html>
```

### app.js
```javascript
const API_URL = 'YOUR_API_GATEWAY_URL';

document.getElementById('upload-btn').addEventListener('click', uploadImage);
document.getElementById('load-history').addEventListener('click', loadHistory);

async function uploadImage() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select an image file');
        return;
    }
    
    try {
        // 1. Получаем URL для загрузки
        const uploadUrlResponse = await fetch(`${API_URL}/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: file.name,
                filetype: file.type
            })
        });
        
        const { url } = await uploadUrlResponse.json();
        
        // 2. Загружаем изображение напрямую в S3
        await fetch(url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
        });
        
        // 3. Показываем превью
        const preview = document.getElementById('image-preview');
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
        
        // 4. Анализируем изображение
        const analysisResponse = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name })
        });
        
        const { labels, moderationLabels } = await analysisResponse.json();
        
        // 5. Отображаем результаты
        displayResults(labels, moderationLabels);
        
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during image upload and analysis');
    }
}

function displayResults(labels, moderationLabels) {
    const labelsContainer = document.getElementById('labels');
    const moderationContainer = document.getElementById('moderation');
    
    labelsContainer.innerHTML = '';
    moderationContainer.innerHTML = '';
    
    // Отображаем обнаруженные объекты
    labels.forEach(label => {
        const labelElement = document.createElement('div');
        labelElement.className = 'label';
        labelElement.textContent = `${label.Name} (${Math.round(label.Confidence)}%)`;
        labelsContainer.appendChild(labelElement);
    });
    
    // Отображаем результаты модерации
    if (moderationLabels.length > 0) {
        moderationLabels.forEach(label => {
            const modElement = document.createElement('div');
            modElement.className = 'label moderation';
            modElement.textContent = `${label.Name} (${Math.round(label.Confidence)}%)`;
            moderationContainer.appendChild(modElement);
        });
    } else {
        moderationContainer.textContent = 'No inappropriate content detected';
    }
    
    document.getElementById('results-section').style.display = 'block';
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_URL}/history`);
        const historyItems = await response.json();
        
        const container = document.getElementById('history-items');
        container.innerHTML = '';
        
        historyItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'history-item';
            itemElement.innerHTML = `
                <h4>${item.imageId}</h4>
                <p>${item.createdAt}</p>
                <p>Detected: ${item.labels.map(l => l.Name).join(', ')}</p>
                ${item.moderationLabels.length > 0 ? 
                 `<p class="moderation">Warning: ${item.moderationLabels.map(l => l.Name).join(', ')}</p>` : ''}
                <hr>
            `;
            container.appendChild(itemElement);
        });
    } catch (error) {
        console.error('Error loading history:', error);
    }
}
```

## 7. Развертывание веб-приложения
1. Разместите файлы index.html и app.js в S3 бакете с настройкой статического хостинга
2. Или используйте AWS Amplify для развертывания
3. Настройте пользовательский домен и SSL (можно использовать AWS Certificate Manager)

## 8. Настройка IAM ролей
Убедитесь, что ваши Lambda-функции имеют разрешения на:
- Доступ к S3
- Вызов Rekognition
- Доступ к DynamoDB

## 9. Мониторинг расходов
- Установите бюджет в AWS Budgets
- Используйте AWS Cost Explorer для отслеживания расходов
- Удаляйте ненужные ресурсы после завершения работы

## Дополнительные улучшения:
1. Добавьте аутентификацию с помощью Amazon Cognito
2. Реализуйте пагинацию для истории
3. Добавьте возможность фильтрации результатов
4. Реализуйте уведомления через SNS при обнаружении неприемлемого контента

Это комплексное решение, которое вы можете адаптировать под свои конкретные требования. Начните с базовой реализации и затем добавляйте дополнительные функции по мере необходимости.
[22.05, 07:44] Азамат Ибрашев: # Настройка DynamoDB для хранения результатов анализа изображений

Для хранения результатов анализа изображений из S3 в DynamoDB, выполните следующие шаги:

## 1. Создание таблицы DynamoDB

1. Перейдите в сервис DynamoDB в AWS Console
2. Нажмите "Create table"
3. Укажите параметры:
   - Table name: `ImageAnalysisResults`
   - Partition key: `imageId` (String)
   - Остальные настройки оставьте по умолчанию
4. Нажмите "Create"

## 2. Настройка доступа Lambda к DynamoDB

Обновите политику IAM для роли ваших Lambda-функций:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "arn:aws:dynamodb:YOUR_REGION:YOUR_ACCOUNT_ID:table/ImageAnalysisResults"
        }
    ]
}
```

## 3. Модификация Lambda-функции для сохранения в DynamoDB

Обновите вашу Lambda-функцию `analyze-image`:

```javascript
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const bucketName = process.env.BUCKET_NAME;
const tableName = process.env.TABLE_NAME || 'ImageAnalysisResults';

exports.handler = async (event) => {
    const { filename } = JSON.parse(event.body);
    
    try {
        // Получаем метаданные изображения из S3
        const headObjectParams = {
            Bucket: bucketName,
            Key: filename
        };
        
        const metadata = await s3.headObject(headObjectParams).promise();
        
        // Анализ изображения с Rekognition
        const detectLabelsParams = {
            Image: {
                S3Object: {
                    Bucket: bucketName,
                    Name: filename
                }
            },
            MaxLabels: 10,
            MinConfidence: 70
        };
        
        const detectModerationParams = {
            Image: {
                S3Object: {
                    Bucket: bucketName,
                    Name: filename
                }
            },
            MinConfidence: 70
        };
        
        const [labelsResult, moderationResult] = await Promise.all([
            rekognition.detectLabels(detectLabelsParams).promise(),
            rekognition.detectModerationLabels(detectModerationParams).promise()
        ]);
        
        // Подготовка данных для сохранения в DynamoDB
        const dbParams = {
            TableName: tableName,
            Item: {
                imageId: filename,
                s3Bucket: bucketName,
                s3Key: filename,
                contentType: metadata.ContentType,
                size: metadata.ContentLength,
                lastModified: metadata.LastModified.toISOString(),
                labels: labelsResult.Labels,
                moderationLabels: moderationResult.ModerationLabels,
                analysisDate: new Date().toISOString(),
                metadata: {
                    ...metadata.Metadata // Дополнительные метаданные если есть
                }
            }
        };
        
        // Сохранение в DynamoDB
        await dynamoDb.put(dbParams).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                labels: labelsResult.Labels,
                moderationLabels: moderationResult.ModerationLabels,
                s3Info: {
                    bucket: bucketName,
                    key: filename,
                    size: metadata.ContentLength,
                    lastModified: metadata.LastModified
                }
            })
        };
    } catch (err) {
        console.error('Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: err.message,
                stack: err.stack
            })
        };
    }
};
```

## 4. Настройка вторичных индексов (по необходимости)

Если вам нужно выполнять запросы по другим атрибутам, создайте вторичные индексы:

1. Перейдите в таблицу DynamoDB
2. Откройте вкладку "Indexes"
3. Нажмите "Create index"
4. Например, для запросов по дате анализа:
   - Partition key: `analysisDate` (String)
   - Sort key: `imageId` (String)
   - Index name: `AnalysisDateIndex`

## 5. Обновление функции получения истории

Модифицируйте функцию `get-history` для использования DynamoDB:

```javascript
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME || 'ImageAnalysisResults';

exports.handler = async (event) => {
    const limit = event.queryStringParameters?.limit || 10;
    
    try {
        const result = await dynamoDb.scan({
            TableName: tableName,
            Limit: limit,
            ProjectionExpression: "imageId, analysisDate, labels, moderationLabels, s3Bucket, s3Key"
        }).promise();
        
        // Добавляем URL для доступа к изображению
        const itemsWithUrls = result.Items.map(item => {
            return {
                ...item,
                imageUrl: `https://${item.s3Bucket}.s3.amazonaws.com/${encodeURIComponent(item.s3Key)}`
            };
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify(itemsWithUrls)
        };
    } catch (err) {
        console.error('Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: err.message,
                stack: err.stack
            })
        };
    }
};
```

## 6. Настройка триггеров (опционально)

Если вы хотите автоматически запускать анализ при загрузке в S3:

1. Перейдите к своей Lambda-функции `analyze-image`
2. Добавьте триггер S3
3. Укажите ваш S3 бакет
4. Тип события: "All object create events"
5. Добавьте префикс/суффикс фильтры при необходимости

## 7. Проверка работы

После настройки:
1. Загрузите изображение через ваше веб-приложение
2. Проверьте таблицу DynamoDB - должна появиться новая запись
3. Проверьте историю через API - должны отображаться последние анализы

## 8. Оптимизация (по необходимости)

1. **TTL (Time-to-Live)**: Если записи должны автоматически удаляться через время
   - Добавьте атрибут `expirationTime` (Number)
   - Включите TTL для этого атрибута

2. **Глобальные таблицы**: Если нужно реплицировать данные в другие регионы

3. **Резервное копирование**: Настройте PITR (Point-in-Time Recovery) для защиты данных

Теперь ваша система будет автоматически сохранять все результаты анализа изображений из S3 в DynamoDB, включая метаданные, обнаруженные объекты и результаты модерации контента.
[22.05, 07:45] Азамат Ибрашев: # Настройка API Gateway для интеграции с Lambda-функциями

## Пошаговая инструкция по созданию REST API

### 1. Создание нового REST API
1. Войдите в AWS Console и откройте сервис API Gateway
2. Нажмите "Create API"
3. В разделе "REST API" выберите "Build"
4. Выберите "New API"
5. Введите:
   - Имя API: `ImageAnalysisAPI`
   - Описание: "API for image analysis with Rekognition"
   - Тип: Regional (для меньшей задержки)
6. Нажмите "Create API"

### 2. Создание ресурсов и методов
#### Ресурс `/upload-url` (POST)
1. В панели ресурсов нажмите "Create Resource"
   - Имя ресурса: `upload-url`
   - Путь ресурса: `upload-url`
2. Выберите созданный ресурс и нажмите "Create Method"
   - Выберите `POST` из выпадающего списка
   - Нажмите галочку для сохранения
3. Настройте интеграцию:
   - Тип интеграции: Lambda Function
   - Lambda Region: выберите ваш регион
   - Lambda Function: выберите вашу функцию `generate-upload-url`
4. Нажмите "Save" и подтвердите разрешение для API Gateway вызывать Lambda

#### Ресурс `/analyze` (POST)
1. Создайте новый ресурс `analyze`
2. Создайте метод `POST`
3. Настройте интеграцию с Lambda-функцией `analyze-image`

#### Ресурс `/history` (GET)
1. Создайте новый ресурс `history`
2. Создайте метод `GET`
3. Настройте интеграцию с Lambda-функцией `get-history`

### 3. Настройка CORS (Cross-Origin Resource Sharing)
Для каждого ресурса (`/upload-url`, `/analyze`, `/history`):
1. Выберите ресурс
2. Нажмите "Enable CORS"
3. Оставьте настройки по умолчанию:
   - Access-Control-Allow-Origin: '*'
   - Access-Control-Allow-Methods: выбранные методы (POST/GET)
4. Нажмите "Enable CORS and replace existing CORS headers"
5. Подтвердите замену существующих заголовков

### 4. Настройка моделей ответов (опционально)
Для лучшей документации API вы можете добавить модели ответов:
1. В разделе "Models" нажмите "Create"
2. Для успешного ответа от `/analyze`:
   - Имя: `AnalyzeResponse`
   - Content type: `application/json`
   - Схема:
```json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "AnalyzeResponse",
  "type": "object",
  "properties": {
    "labels": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "Name": {"type": "string"},
          "Confidence": {"type": "number"}
        }
      }
    },
    "moderationLabels": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "Name": {"type": "string"},
          "Confidence": {"type": "number"}
        }
      }
    }
  }
}
```

### 5. Развертывание API
1. В меню "Actions" выберите "Deploy API"
2. Выберите "[New Stage]" в выпадающем списке
3. Введите имя stage: `prod`
4. Нажмите "Deploy"

### 6. Получение конечного URL
После развертывания вы увидите:
- Invoke URL: `https://{api-id}.execute-api.{region}.amazonaws.com/prod`

Это будет базовый URL вашего API. Конечные точки будут:
- `POST https://{api-id}.execute-api.{region}.amazonaws.com/prod/upload-url`
- `POST https://{api-id}.execute-api.{region}.amazonaws.com/prod/analyze`
- `GET https://{api-id}.execute-api.{region}.amazonaws.com/prod/history`

### 7. Настройка логгирования и мониторинга (опционально)
1. Перейдите в "Stages" > выберите ваш stage
2. Вкладка "Logs/Tracing":
   - Включите "CloudWatch Logs"
   - Установите уровень логгирования (например, ERROR)
   - Включите "Detailed metrics"

### 8. Настройка доменного имени (для дополнительных баллов)
1. В разделе "Custom Domain Names" нажмите "Create"
2. Введите ваше доменное имя (например, `api.yourdomain.com`)
3. Настройте SSL сертификат в AWS Certificate Manager
4. После создания сопоставьте домен с вашим API и stage

### 9. Тестирование API
Используйте curl или Postman для тестирования:
```bash
# Получение URL для загрузки
curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/prod/upload-url \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","filetype":"image/jpeg"}'

# Анализ изображения (после загрузки в S3)
curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/prod/analyze \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg"}'

# Получение истории
curl -X GET https://{api-id}.execute-api.{region}.amazonaws.com/prod/history
```

## Итоговая архитектура API Gateway
```
API Gateway (REST API)
│
├── POST /upload-url → Lambda (generate-upload-url)
├── POST /analyze → Lambda (analyze-image)
└── GET /history → Lambda (get-history)
```

Теперь ваш API полностью настроен и готов к использованию в веб-приложении. Обновите переменную `API_URL` в вашем JavaScript коде на полученный URL.
[22.05, 07:45] Азамат Ибрашев: # Развертывание веб-приложения на AWS

## Вариант 1: Размещение в S3 с настройкой статического хостинга

### 1. Подготовка S3 бакета
1. Перейдите в сервис S3
2. Создайте новый бакет с именем, например `web-image-analysis-app` (имя должно быть уникальным глобально)
3. В настройках бакета отключите "Block all public access" (снимите галочку и подтвердите)
4. Включите "Static website hosting" в свойствах бакета:
   - Тип хостинга: "Host a static website"
   - Индексный документ: `index.html`
   - Документ ошибки: `index.html` (для SPA)

### 2. Загрузка файлов приложения
1. Подготовьте файлы:
   - `index.html` (ваш основной HTML файл)
   - `app.js` (JavaScript код)
   - (опционально) `styles.css` и другие ресурсы
2. Загрузите файлы в бакет:
   - Нажмите "Upload"
   - Перетащите файлы или выберите вручную
   - Для каждого файла установите разрешения:
     - В разделе "Permissions" выберите "Grant public-read access"

### 3. Настройка политики доступа
Добавьте следующую политику к бакету (вкладка "Permissions" > "Bucket Policy"):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::web-image-analysis-app/*"
        }
    ]
}
```

### 4. Настройка пользовательского домена и SSL
1. Перейдите в сервис AWS Certificate Manager (ACM)
2. Запросите сертификат для вашего домена (например, `app.yourdomain.com`)
3. Подтвердите владение доменом (по email или DNS)
4. Создайте CloudFront распределение:
   - Origin Domain Name: выберите ваш S3 бакет
   - Viewer Protocol Policy: "Redirect HTTP to HTTPS"
   - Alternate Domain Names: введите ваш домен (app.yourdomain.com)
   - SSL Certificate: выберите созданный сертификат
5. Настройте DNS запись (CNAME) у вашего регистратора домена, указывающую на CloudFront распределение

### 5. Получение URL приложения
- S3 endpoint: `http://web-image-analysis-app.s3-website-<region>.amazonaws.com`
- CloudFront URL: `https://<distribution-id>.cloudfront.net`
- Пользовательский домен: `https://app.yourdomain.com`

## Вариант 2: Развертывание с помощью AWS Amplify

### 1. Подготовка репозитория
1. Создайте репозиторий на GitHub/GitLab/Bitbucket с вашими файлами:
   - `index.html`
   - `app.js`
   - (опционально) другие ресурсы

### 2. Создание Amplify приложения
1. Перейдите в сервис AWS Amplify
2. Нажмите "Connect app" > "Host web app"
3. Выберите ваш Git-провайдер и репозиторий
4. Настройте ветку для деплоя (обычно `main` или `master`)
5. Настройки сборки:
   - Build settings: оставьте по умолчанию (Amplify автоматически определит статический сайт)
6. Нажмите "Save and deploy"

### 3. Настройка пользовательского домена
1. В Amplify Console выберите ваше приложение
2. Перейдите в "Domain management"
3. Нажмите "Add domain"
4. Введите ваш домен (например, `app.yourdomain.com`)
5. Настройте SSL сертификат (Amplify может запросить его автоматически)
6. Подтвердите владение доменом (DNS проверка)

### 4. Настройка переменных окружения
Если вашему приложению нужны переменные (например, API endpoint):
1. В Amplify Console выберите ваше приложение
2. Перейдите в "App settings" > "Environment variables"
3. Добавьте переменные:
   - Например: `VUE_APP_API_URL=https://yourapi.execute-api.region.amazonaws.com/prod`

### 5. Получение URL приложения
- Amplify предоставляет URL по умолчанию: `https://<branch>.<app-id>.amplifyapp.com`
- Ваш пользовательский домен: `https://app.yourdomain.com`

## Обновление приложения
### Для S3:
- Просто загрузите новые версии файлов с теми же именами

### Для Amplify:
- Сделайте push изменений в подключенную ветку репозитория
- Amplify автоматически запустит процесс сборки и деплоя

## Рекомендации
1. Для продакшн окружения используйте CloudFront + S3 или Amplify
2. Настройте мониторинг и логирование:
   - Для S3: CloudFront access logs
   - Для Amplify: встроенный мониторинг в консоли
3. Регулярно проверяйте расходы в AWS Cost Explorer
4. Для лучшей производительности:
   - Включите кэширование в CloudFront
   - Используйте CDN для статических ресурсов

Ваше приложение теперь доступно по выбранному URL с поддержкой HTTPS и пользовательского домена.
[22.05, 07:45] Азамат Ибрашев: # Полная структура проекта и интеграция компонентов

Вот как соединить все части вместе в единое работающее приложение:

## Структура проекта

```
image-analysis-app/
├── frontend/                  # Веб-приложение
│   ├── index.html             # Главная страница
│   ├── app.js                 # Основная логика приложения
│   ├── styles.css             # Стили (опционально)
│   └── assets/                # Дополнительные ресурсы
├── backend/                   # AWS ресурсы
│   ├── templates/             # CloudFormation шаблоны (опционально)
│   └── scripts/               # Скрипты для деплоя
├── README.md                  # Инструкции по развертыванию
└── package.json               # Для зависимостей (если используете сборку)
```

## Полный код frontend

### index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS Image Analysis</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>AWS Image Analysis</h1>
        
        <div class="upload-section">
            <input type="file" id="file-input" accept="image/*">
            <button id="upload-btn">Upload and Analyze</button>
            <div id="image-container">
                <img id="image-preview">
            </div>
        </div>
        
        <div class="results-section">
            <h2>Analysis Results</h2>
            <div class="results-grid">
                <div class="result-card">
                    <h3>Detected Objects</h3>
                    <div id="labels-container"></div>
                </div>
                <div class="result-card">
                    <h3>Content Moderation</h3>
                    <div id="moderation-container"></div>
                </div>
            </div>
        </div>
        
        <div class="history-section">
            <h2>Analysis History</h2>
            <button id="load-history">Load History</button>
            <div id="history-container"></div>
        </div>
    </div>
    
    <script src="app.js"></script>
</body>
</html>
```

### app.js
```javascript
// Конфигурация
const API_ENDPOINT = 'https://your-api-id.execute-api.region.amazonaws.com/prod';

// DOM элементы
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const imagePreview = document.getElementById('image-preview');
const labelsContainer = document.getElementById('labels-container');
const moderationContainer = document.getElementById('moderation-container');
const loadHistoryBtn = document.getElementById('load-history');
const historyContainer = document.getElementById('history-container');

// Обработчики событий
uploadBtn.addEventListener('click', handleUpload);
loadHistoryBtn.addEventListener('click', loadHistory);

async function handleUpload() {
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select an image file');
        return;
    }

    try {
        // 1. Получаем URL для загрузки
        const uploadUrl = await getUploadUrl(file.name, file.type);
        
        // 2. Загружаем изображение в S3
        await uploadToS3(uploadUrl, file);
        
        // 3. Показываем превью
        showImagePreview(file);
        
        // 4. Анализируем изображение
        const analysisResults = await analyzeImage(file.name);
        
        // 5. Отображаем результаты
        displayResults(analysisResults);
        
        // 6. Обновляем историю
        await loadHistory();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Upload and analysis failed');
    }
}

async function getUploadUrl(filename, filetype) {
    const response = await fetch(`${API_ENDPOINT}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, filetype })
    });
    
    const data = await response.json();
    return data.url;
}

async function uploadToS3(url, file) {
    await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
    });
}

function showImagePreview(file) {
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.style.display = 'block';
}

async function analyzeImage(filename) {
    const response = await fetch(`${API_ENDPOINT}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
    });
    
    return await response.json();
}

function displayResults({ labels, moderationLabels }) {
    labelsContainer.innerHTML = labels
        .map(label => `<div class="label">${label.Name} (${Math.round(label.Confidence)}%)</div>`)
        .join('');
    
    moderationContainer.innerHTML = moderationLabels.length > 0
        ? moderationLabels.map(label => 
            `<div class="label warning">${label.Name} (${Math.round(label.Confidence)}%)</div>`)
            .join('')
        : '<div class="label safe">No inappropriate content detected</div>';
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_ENDPOINT}/history`);
        const history = await response.json();
        
        historyContainer.innerHTML = history
            .map(item => createHistoryItem(item))
            .join('');
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function createHistoryItem(item) {
    return `
        <div class="history-item">
            <h4>${item.imageId}</h4>
            <p>Analyzed at: ${new Date(item.analysisDate).toLocaleString()}</p>
            <p>Detected: ${item.labels.slice(0, 3).map(l => l.Name).join(', ')}</p>
            ${item.moderationLabels.length > 0 
                ? `<p class="warning">Warning: ${item.moderationLabels[0].Name}</p>` 
                : ''}
        </div>
    `;
}
```

## Backend: Lambda функции (сводка)

### 1. generate-upload-url.js
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const bucketName = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    // ... (код из предыдущего ответа)
};
```

### 2. analyze-image.js
```javascript
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const bucketName = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    // ... (полный код из предыдущего ответа с анализом через Rekognition)
};
```

### 3. get-history.js
```javascript
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    // ... (код из предыдущего ответа для получения истории)
};
```

## Как соединить все компоненты

1. **Разверните backend**:
   - Создайте Lambda функции с приведенным выше кодом
   - Настройте API Gateway как описано ранее
   - Запишите конечный URL API

2. **Настройте frontend**:
   - В файле `app.js` замените `API_ENDPOINT` на ваш URL API Gateway
   - Убедитесь, что CORS правильно настроен в API Gateway

3. **Разверните frontend**:
   - Вариант A: Загрузите файлы в S3 и настройте хостинг
   - Вариант B: Используйте AWS Amplify для автоматического деплоя

4. **Проверьте интеграцию**:
   - Загрузите изображение - оно должно появиться в S3
   - Проверьте, что результаты анализа сохраняются в DynamoDB
   - Убедитесь, что история загрузок отображается корректно

## Политики IAM (основные)

1. **Для Lambda функций**:
   - Доступ к S3 (чтение/запись)
   - Вызов Rekognition (detectLabels, detectModerationLabels)
   - Доступ к DynamoDB (PutItem, Scan)

2. **Для API Gateway**:
   - Разрешение на вызов Lambda функций

3. **Для S3 бакета**:
   - Публичный доступ для статического хостинга
   - CORS политика для доступа с вашего домена

## Полный цикл работы

1. Пользователь загружает изображение через интерфейс
2. Frontend получает временный URL от API Gateway/Lambda
3. Изображение загружается напрямую в S3
4. Frontend вызывает анализ изображения
5. Lambda получает изображение из S3, анализирует через Rekognition
6. Результаты сохраняются в DynamoDB
7. Frontend получает и отображает результаты
8. По запросу загружается история анализов из DynamoDB

Теперь у вас есть полностью рабочее приложение для анализа изображений с использованием AWS сервисов!
[22.05, 07:45] Азамат Ибрашев: Вот как интегрировать AWS Rekognition в ваш код для анализа изображений:

## 1. Обновленный Lambda-код для анализа изображений (`analyze-image.js`)

```javascript
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const { filename } = JSON.parse(event.body);
    
    try {
        // Конфигурация для анализа изображения
        const imageParams = {
            Image: {
                S3Object: {
                    Bucket: process.env.BUCKET_NAME,
                    Name: filename
                }
            }
        };

        // 1. Обнаружение объектов на изображении
        const labelsParams = {
            ...imageParams,
            MaxLabels: 10,
            MinConfidence: 75
        };
        
        // 2. Модерация контента
        const moderationParams = {
            ...imageParams,
            MinConfidence: 75
        };
        
        // 3. Детекция текста (опционально)
        const textParams = {
            ...imageParams,
            Filters: {
                WordFilter: {
                    MinConfidence: 80
                }
            }
        };

        // Параллельный вызов всех функций Rekognition
        const [labelsData, moderationData, textData] = await Promise.all([
            rekognition.detectLabels(labelsParams).promise(),
            rekognition.detectModerationLabels(moderationParams).promise(),
            rekognition.detectText(textParams).promise()
        ]);

        // Форматирование результатов
        const results = {
            objects: labelsData.Labels.map(label => ({
                name: label.Name,
                confidence: label.Confidence,
                parents: label.Parents?.map(p => p.Name) || []
            })),
            moderation: moderationData.ModerationLabels.map(label => ({
                name: label.Name,
                confidence: label.Confidence,
                category: label.ParentName
            })),
            text: textData.TextDetections
                .filter(t => t.Type === 'LINE')
                .map(t => ({
                    text: t.DetectedText,
                    confidence: t.Confidence
                }))
        };

        // Сохранение в DynamoDB
        await dynamoDb.put({
            TableName: process.env.TABLE_NAME,
            Item: {
                imageId: filename,
                analysisDate: new Date().toISOString(),
                results: results,
                s3Location: {
                    bucket: process.env.BUCKET_NAME,
                    key: filename
                }
            }
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify(results),
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        };
    } catch (error) {
        console.error('Rekognition error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Image analysis failed' }),
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        };
    }
};
```

## 2. Обновленный фронтенд для отображения всех результатов

### В `app.js` добавьте:

```javascript
function displayResults(results) {
    // Отображение объектов
    const objectsHtml = results.objects
        .map(obj => `
            <div class="result-item">
                <span class="label">${obj.name}</span>
                <span class="confidence">${obj.confidence.toFixed(1)}%</span>
                ${obj.parents.length ? `<div class="parents">${obj.parents.join(' > ')}</div>` : ''}
            </div>
        `).join('');
    
    // Отображение модерации
    const moderationHtml = results.moderation.length
        ? results.moderation.map(mod => `
            <div class="result-item warning">
                <span class="label">${mod.category ? `${mod.category} > ` : ''}${mod.name}</span>
                <span class="confidence">${mod.confidence.toFixed(1)}%</span>
            </div>
        `).join('')
        : '<div class="result-item safe">No inappropriate content found</div>';
    
    // Отображение текста (если есть)
    const textHtml = results.text.length
        ? `<div class="text-results">
               <h4>Detected Text:</h4>
               ${results.text.map(t => `<div class="text-line">${t.text} (${t.confidence.toFixed(1)}%)</div>`).join('')}
           </div>`
        : '';
    
    // Вставка в DOM
    document.getElementById('objects-container').innerHTML = objectsHtml;
    document.getElementById('moderation-container').innerHTML = moderationHtml;
    document.getElementById('text-container').innerHTML = textHtml;
    
    // Показываем секцию с результатами
    document.querySelector('.results-section').style.display = 'block';
}
```

## 3. Обновленный HTML для отображения всех данных

```html
<div class="results-section">
    <h2>Analysis Results</h2>
    
    <div class="result-category">
        <h3>Detected Objects</h3>
        <div id="objects-container" class="results-container"></div>
    </div>
    
    <div class="result-category">
        <h3>Content Moderation</h3>
        <div id="moderation-container" class="results-container"></div>
    </div>
    
    <div class="result-category">
        <h3>Text Recognition</h3>
        <div id="text-container" class="results-container"></div>
    </div>
</div>
```

## 4. Дополнительные CSS стили

```css
.results-section {
    display: none;
    margin-top: 2rem;
}

.result-category {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
}

.results-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.result-item {
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.result-item.warning {
    border-left: 3px solid #dc3545;
    background-color: #fff0f0;
}

.result-item.safe {
    color: #28a745;
}

.confidence {
    float: right;
    color: #6c757d;
    font-size: 0.8em;
}

.parents {
    font-size: 0.8em;
    color: #6c757d;
    margin-top: 0.2rem;
}

.text-results {
    background: white;
    padding: 1rem;
    border-radius: 4px;
}

.text-line {
    margin: 0.3rem 0;
    padding: 0.3rem;
    background: #f8f9fa;
    border-radius: 3px;
}
```

## 5. Дополнительные возможности Rekognition

Вы можете расширить анализ, добавив:

```javascript
// Детекция лиц
const facesData = await rekognition.detectFaces({
    ...imageParams,
    Attributes: ['ALL']
}).promise();

// Детекция знаменитостей
const celebritiesData = await rekognition.recognizeCelebrities(imageParams).promise();

// Детекция ландшафтов
const landmarksData = await rekognition.detectLabels({
    ...imageParams,
    Features: ['GENERAL_LABELS']
}).promise();
```

## Полный цикл работы с Rekognition

1. Изображение загружается в S3
2. Lambda функция получает триггер
3. Rekognition анализирует изображение по нескольким параметрам:
   - Объекты и сцены (`detectLabels`)
   - Неприемлемый контент (`detectModerationLabels`)
   - Текст (`detectText`)
   - Лица, знаменитости и др. (опционально)
4. Результаты форматируются и сохраняются в DynamoDB
5. Фронтенд получает и красиво отображает все данные

Это полная интеграция AWS Rekognition в ваше приложение с отображением всех возможных данных анализа изображений.
*/
