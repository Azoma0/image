/*
# Настройка AWS инфраструктуры для Image Analyzer

Для запуска вашего приложения Image Analyzer необходимо настроить следующие AWS сервисы:

## 1. IAM Роли и политики

Создайте IAM роль для Lambda функций с следующими разрешениями:

- **AmazonS3FullAccess** (для работы с S3 bucket)
- **AmazonRekognitionFullAccess** (для анализа изображений)
- **AmazonDynamoDBFullAccess** (для хранения истории анализов)
- **AWSLambdaBasicExecutionRole** (для логирования)

## 2. S3 Bucket

1. Создайте S3 bucket (например, `aiimageanalysebucket`)
2. Включите CORS конфигурацию:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

## 3. DynamoDB Таблица

Создайте таблицу с именем `ImageAnalysisHistory` (или другим, соответствующим переменной окружения `DDB_TABLE`):
- Первичный ключ: `ImageID` (строка)
- Включите TTL атрибут, если нужно автоматическое удаление старых записей

## 4. Lambda Функции

### Функция 1: generateuploadurl (основана на main (1).go)
- Имя: `ImageAnalyzer-Upload`
- Среда выполнения: Go 1.x
- Обработчик: `main`
- Переменные окружения:
  - `BUCKET_NAME=aiimageanalysebucket`
  - `AWS_REGION=eu-west-1`

### Функция 2: analyse-image (основана на main.go)
- Имя: `ImageAnalyzer-Process`
- Среда выполнения: Go 1.x
- Обработчик: `main`
- Переменные окружения:
  - `BUCKET_NAME=aiimageanalysebucket`
  - `DDB_TABLE=ImageAnalysisHistory`
  - `AWS_REGION=eu-west-1`

### Функция 3: get-history (основана на main (2).go)
- Имя: `ImageAnalyzer-History`
- Среда выполнения: Go 1.x
- Обработчик: `main`
- Переменные окружения:
  - `DDB_TABLE=ImageAnalysisHistory`
  - `AWS_REGION=eu-west-1`

## 5. API Gateway

1. Создайте новый REST API с именем `ImageAnalyzerAPI`
2. Создайте ресурсы и методы:
   - `/generateuploadurl` (POST) → подключите к `ImageAnalyzer-Upload`
   - `/analyse-image` (POST) → подключите к `ImageAnalyzer-Process`
   - `/get-history` (GET) → подключите к `ImageAnalyzer-History`

3. Для каждого метода:
   - Включите CORS
   - Установите "Integration Request":
     - Content-Type: `multipart/form-data` для `/generateuploadurl`
     - Content-Type: `application/json` для остальных методов

4. Разверните API на стадии (например, `prod`)

## 6. Amplify (для хостинга фронтенда)

1. Создайте новое Amplify приложение
2. Подключите репозиторий с вашим HTML/CSS/JS кодом
3. В настройках сборки укажите:
   - Framework: `Static`
   - Build command: (оставьте пустым)
   - Publish directory: `./`

4. Обновите `index.html`, заменив `API_BASE_URL` на URL вашего API Gateway

## Проверка работы

После настройки:
1. Загрузите изображение через форму
2. Проверьте, что оно появляется в S3 bucket
3. Убедитесь, что анализ сохраняется в DynamoDB
4. Проверьте, что история отображается на странице

## Дополнительные рекомендации

1. Для продакшн среды ограничьте CORS конкретными доменами
2. Добавьте авторизацию через Cognito для защиты API
3. Настройте мониторинг и логирование через CloudWatch
4. Рассмотрите возможность использования AWS SAM или Terraform для управления инфраструктурой как кодом

Ваше приложение теперь должно быть полностью функциональным в AWS среде!
*/
