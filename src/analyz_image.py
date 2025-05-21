import boto3
import json
import os
from datetime import datetime

rekognition = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['ImageAnalysisResults'])

def lambda_handler(event, context):
    try:
        bucket_name = os.environ['image-analys']
        file_name = event['queryStringParameters']['filename']
        
        # Анализ объектов на изображении
        labels_response = rekognition.detect_labels(
            Image={'S3Object': {'Bucket': bucket_name, 'Name': file_name}},
            MaxLabels=10,
            MinConfidence=70
        )
        
        # Проверка на непристойный контент
        moderation_response = rekognition.detect_moderation_labels(
            Image={'S3Object': {'Bucket': bucket_name, 'Name': file_name}}
        )
        
        # Формирование описания
        top_labels = [f"{label['Name']} ({label['Confidence']:.0f}%)" 
                     for label in sorted(labels_response['Labels'], 
                                       key=lambda x: x['Confidence'], 
                                       reverse=True)[:3]]
        description = f"На изображении обнаружены: {', '.join(top_labels)}"
        
        # Сохранение в DynamoDB
        item = {
            'imageId': file_name,
            'timestamp': datetime.utcnow().isoformat(),
            'labels': [label['Name'] for label in labels_response['Labels']],
            'moderationLabels': [label['Name'] for label in moderation_response['ModerationLabels']],
            'description': description,
            's3Url': f"https://{bucket_name}.s3.amazonaws.com/{file_name}"
        }
        
        table.put_item(Item=item)
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({
                'description': description,
                'moderation': item['moderationLabels'],
                'imageUrl': item['s3Url']
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }