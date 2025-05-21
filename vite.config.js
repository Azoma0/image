import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
})

/*

npm create vite@latest my-app -- --template react
cd my-app
npm install

npm install axios

В AWS Console:

Перейдите в сервис S3

Создайте bucket (например, image-analysis-bucket-{your-name})

В настройках CORS добавьте:

json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT", "POST", "GET"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]


3. Настройка API Gateway
Создайте новый REST API

Создайте ресурсы:

/upload-url (GET) → Lambda generate_upload_url

/analyze (GET) → Lambda analyze_image

/history (GET) → Lambda get_history

Включите CORS для всех методов

Деплойте API и получите URL (например: https://{api-id}.execute-api.{region}.amazonaws.com/prod)


1. Создание REST API
Перейдите в API Gateway в AWS Console

Нажмите "Create API"

Выберите "REST API" → "Build"

В настройках:

Тип: New API

Имя API: ImageAnalysisAPI

Описание: "API for image analysis application"

Endpoint Type: Regional (для минимизации затрат)

5. Деплой API
В меню действий выберите "Deploy API"

Создайте новую стадию:

Deployment stage: prod

Description: "Production environment"

После деплоя вы получите URL вида:

https://{api-id}.execute-api.{region}.amazonaws.com/prod
*/