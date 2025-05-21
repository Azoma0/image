import boto3
import json
import os

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['ImageAnalysisResults'])

def lambda_handler(event, context):
    try:
        response = table.scan()
        items = response.get('Items', [])
        
        # Сортируем по дате (новые сначала)
        sorted_items = sorted(items, key=lambda x: x['timestamp'], reverse=True)
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps(sorted_items)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }