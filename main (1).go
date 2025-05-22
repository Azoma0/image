package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	s3manager "github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/rekognition"
	rekTypes "github.com/aws/aws-sdk-go-v2/service/rekognition/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	bucket      string
	rekClient   *rekognition.Client
	uploader    *s3manager.Uploader
	corsHeaders = map[string]string{
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
		"Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT",
	}
)

func init() {
	bucketRegion := os.Getenv("AWS_REGION")
	if bucketRegion == "" {
		bucketRegion = "eu-west-1"
	}
	bucket = os.Getenv("BUCKET_NAME")
	s3cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(bucketRegion))
	if err != nil {
		panic(fmt.Sprintf("failed to load S3 AWS config: %v", err))
	}
	uploader = s3manager.NewUploader(s3.NewFromConfig(s3cfg))
	rekognitioncfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion("eu-west-1"))
	if err != nil {
		panic(fmt.Sprintf("failed to load Rekognition AWS config: %v", err))
	}
	rekClient = rekognition.NewFromConfig(rekognitioncfg)
}

type responseBody struct {
	Description string                     `json:"description"`
	Labels      []rekTypes.Label           `json:"labels"`
	Moderation  []rekTypes.ModerationLabel `json:"moderation"`
	DurationMs  int64                      `json:"durationMs"`
	Key         string                     `json:"key"`
}

type URLRequest struct {
	URL string `json:"url"`
}

// fileFromMultipart извлекает файл из multipart данных, возвращает []byte и имя файла
func fileFromMultipart(body []byte, contentType string) ([]byte, string, error) {
	boundary := ""
	parts := strings.Split(contentType, "boundary=")
	if len(parts) > 1 {
		boundary = parts[1]
	}
	if boundary == "" {
		return nil, "", fmt.Errorf("boundary not found in Content-Type")
	}
	mr := multipart.NewReader(bytes.NewReader(body), boundary)
	part, err := mr.NextPart()
	if err != nil {
		return nil, "", err
	}
	defer part.Close()
	var buffer bytes.Buffer
	if _, err := io.Copy(&buffer, part); err != nil {
		return nil, "", err
	}
	return buffer.Bytes(), part.FileName(), nil
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	start := time.Now()
	var imageBytes []byte
	var filename string
	var err error

	contentType := req.Headers["Content-Type"]
	if req.Headers["content-type"] != "" {
		contentType = req.Headers["content-type"]
	}

	if strings.HasPrefix(contentType, "multipart/form-data") {
		var multipartBody []byte
		if req.IsBase64Encoded {
			multipartBody, err = base64.StdEncoding.DecodeString(req.Body)
			if err != nil {
				return errorResp(400, fmt.Sprintf("failed to decode base64: %v", err)), nil
			}
		} else {
			multipartBody = []byte(req.Body)
		}
		imageBytes, filename, err = fileFromMultipart(multipartBody, contentType)
		if err != nil {
			return errorResp(400, fmt.Sprintf("failed to extract file from multipart: %v", err)), nil
		}
		// Проверка расширения файла (допускаем .jpg, .jpeg, .png, .gif)
		ext := strings.ToLower(filepath.Ext(filename))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" {
			return errorResp(400, "Разрешены только изображения JPG, PNG, GIF"), nil
		}
	} else {
		var urlReq URLRequest
		if err := json.Unmarshal([]byte(req.Body), &urlReq); err != nil {
			return errorResp(400, fmt.Sprintf("invalid JSON: %v", err)), nil
		}
		resp, err := http.Get(urlReq.URL)
		if err != nil {
			return errorResp(500, fmt.Sprintf("failed to fetch URL: %v", err)), nil
		}
		defer resp.Body.Close()
		var buffer bytes.Buffer
		if _, err := io.Copy(&buffer, resp.Body); err != nil {
			return errorResp(500, fmt.Sprintf("failed to read URL data: %v", err)), nil
		}
		imageBytes = buffer.Bytes()
		filename = "image_from_url.jpg"
	}

	key := fmt.Sprintf("uploads/%d_%s", time.Now().Unix(), sanitizeFilename(filename))
	if _, err := uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(imageBytes),
	}); err != nil {
		return errorResp(500, fmt.Sprintf("upload error: %v", err)), nil
	}

	labelsOut, err := rekClient.DetectLabels(ctx, &rekognition.DetectLabelsInput{
		Image:         &rekTypes.Image{S3Object: &rekTypes.S3Object{Bucket: aws.String(bucket), Name: aws.String(key)}},
		MaxLabels:     aws.Int32(10),
		MinConfidence: aws.Float32(75),
	})
	if err != nil {
		return errorResp(500, fmt.Sprintf("detect labels error: %v", err)), nil
	}

	modOut, err := rekClient.DetectModerationLabels(ctx, &rekognition.DetectModerationLabelsInput{
		Image: &rekTypes.Image{S3Object: &rekTypes.S3Object{Bucket: aws.String(bucket), Name: aws.String(key)}},
	})
	if err != nil {
		return errorResp(500, fmt.Sprintf("detect moderation error: %v", err)), nil
	}

	var parts []string
	for _, l := range labelsOut.Labels {
		parts = append(parts, strings.ToLower(*l.Name))
	}
	desc := "На изображении: " + strings.Join(parts, ", ") + "."

	dur := time.Since(start).Milliseconds()
	res := responseBody{
		Description: desc,
		Labels:      labelsOut.Labels,
		Moderation:  modOut.ModerationLabels,
		DurationMs:  dur,
		Key:         key,
	}
	b, _ := json.Marshal(res)

	return events.APIGatewayProxyResponse{
		StatusCode:      200,
		Body:            string(b),
		Headers:         corsHeaders,
		IsBase64Encoded: false,
	}, nil
}

func errorResp(code int, msg string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"error": msg})
	return events.APIGatewayProxyResponse{
		StatusCode:      code,
		Body:            string(body),
		Headers:         corsHeaders,
		IsBase64Encoded: false,
	}
}

func sanitizeFilename(name string) string {
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == ':' || r == '/' || r == '\\' {
			return '_'
		}
		return r
	}, name)
}

func main() {
	lambda.Start(handler)
}
