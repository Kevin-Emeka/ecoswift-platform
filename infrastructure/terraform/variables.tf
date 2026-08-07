variable "aws_region" {
  description = "AWS region to deploy Ecoswift Bank infrastructure into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (development | staging | production)"
  type        = string
  default     = "development"
}
