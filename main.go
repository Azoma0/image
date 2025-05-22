package main

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	rek "github.com/aws/aws-sdk-go-v2/service/rekognition"
	rekTypes "github.com/aws/aws-sdk-go-v2/service/rekognition/types"
)

var rekClient *rek.Client
var dbClient *dynamodb.Client
var bucketEnv = os.Getenv("BUCKET_NAME")
var tableName = os.Getenv("DDB_TABLE")

// AnalyzeRequest defines incoming JSON
// { "key": "path/to/object.jpg" }
type AnalyzeRequest struct {
	Key string `json:"key"`
}

// AnalysisResult is stored in DynamoDB and returned
type AnalysisResult struct {
	ImageID    string                     `dynamodbav:"ImageID" json:"key"`
	Timestamp  string                     `dynamodbav:"Timestamp" json:"timestamp"`
	Labels     []rekTypes.Label           `dynamodbav:"Labels" json:"labels"`
	Moderation []rekTypes.ModerationLabel `dynamodbav:"Moderation" json:"moderation"`
}

func init() {
	// Get AWS region from environment or use default
	awsRegion := os.Getenv("AWS_REGION")
	if awsRegion == "" {
		// If region not set in environment, use default
		awsRegion = "eu-west-1"
	}

	// Configuration for DynamoDB (using the Lambda's region)
	dbCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(awsRegion),
	)
	if err != nil {
		panic(err)
	}
	dbClient = dynamodb.NewFromConfig(dbCfg)

	// Configuration for Rekognition (explicitly using eu-west-1 where Rekognition is available)
	rekCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion("eu-west-1"),
	)
	if err != nil {
		panic(err)
	}
	rekClient = rek.NewFromConfig(rekCfg)
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Handle preflight OPTIONS request
	if req.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers: map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
				"Access-Control-Allow-Methods": "OPTIONS,POST,GET",
			},
			Body: "",
		}, nil
	}
	var r AnalyzeRequest
	if err := json.Unmarshal([]byte(req.Body), &r); err != nil {
		return errorResponse(400, "Invalid JSON: "+err.Error()), nil
	}

	// Detect labels
	labelsOut, err := rekClient.DetectLabels(ctx, &rek.DetectLabelsInput{
		Image:         &rekTypes.Image{S3Object: &rekTypes.S3Object{Bucket: aws.String(bucketEnv), Name: aws.String(r.Key)}},
		MaxLabels:     aws.Int32(10),
		MinConfidence: aws.Float32(75),
	})
	if err != nil {
		return errorResponse(500, "Rekognition DetectLabels error: "+err.Error()), nil
	}

	// Detect moderation labels
	modOut, err := rekClient.DetectModerationLabels(ctx, &rek.DetectModerationLabelsInput{
		Image: &rekTypes.Image{S3Object: &rekTypes.S3Object{Bucket: aws.String(bucketEnv), Name: aws.String(r.Key)}},
	})
	if err != nil {
		return errorResponse(500, "Rekognition DetectModerationLabels error: "+err.Error()), nil
	}

	// Build result
	result := AnalysisResult{
		ImageID:        r.Key,
		Timestamp:  time.Now().Format(time.RFC3339),
		Labels:     labelsOut.Labels,
		Moderation: modOut.ModerationLabels,
	}

	// Put into DynamoDB
	item, err := attributevalue.MarshalMap(result)
	if err != nil {
		return errorResponse(500, "Failed to marshal DynamoDB item: "+err.Error()), nil
	}

	if _, err := dbClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(tableName),
		Item:      item,
	}); err != nil {
		return errorResponse(500, "DynamoDB PutItem error: "+err.Error()), nil
	}

	// Return to client
	body, _ := json.Marshal(result)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       string(body),
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
			"Access-Control-Allow-Methods": "OPTIONS,POST,GET",
		},
		IsBase64Encoded: false,
	}, nil
}

// Helper function for error responses
func errorResponse(statusCode int, message string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"error": message})
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Body:       string(body),
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
			"Access-Control-Allow-Methods": "OPTIONS,POST,GET",
		},
		IsBase64Encoded: false,
	}
}

func main() {
	lambda.Start(handler)
}
