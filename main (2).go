package main

import (
	"context"
	"encoding/json"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

var dbClient *dynamodb.Client
var tableNameHist = os.Getenv("DDB_TABLE")
var corsHeaders = map[string]string{
	"Access-Control-Allow-Origin":  "*", // Для продакшна лучше указать конкретные домены
	"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
	"Access-Control-Allow-Methods": "OPTIONS,GET",
}

func init() {
	// Get AWS region from environment or use default

	// Configuration for DynamoDB using the correct region
	dbCfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic(err)
	}
	dbClient = dynamodb.NewFromConfig(dbCfg)
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Scan the DynamoDB table to retrieve all items
	out, err := dbClient.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(tableNameHist),
	})
	if err != nil {
		return errorResponse(500, "DynamoDB Scan error: "+err.Error()), nil
	}

	// Unmarshal DynamoDB items to a more generic format
	var items []map[string]interface{}
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return errorResponse(500, "Failed to unmarshal DynamoDB items: "+err.Error()), nil
	}

	// Convert to JSON and return
	body, err := json.Marshal(items)
	if err != nil {
		return errorResponse(500, "Failed to marshal response to JSON: "+err.Error()), nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode:      200,
		Body:            string(body),
		Headers:         corsHeaders,
		IsBase64Encoded: false,
	}, nil
}

// Helper function for error responses
func errorResponse(statusCode int, message string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"error": message})
	return events.APIGatewayProxyResponse{
		StatusCode:      statusCode,
		Body:            string(body),
		Headers:         corsHeaders,
		IsBase64Encoded: false,
	}
}

func main() {
	lambda.Start(handler)
}
