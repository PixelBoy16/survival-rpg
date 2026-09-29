terraform {
  required_version = ">= 1.7, < 2.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
  }
}

provider "aws" {
  region = "ap-southeast-1"
  default_tags {
    tags = { Project = "LAST-HAVEN", Environment = "dev", ManagedBy = "Terraform" }
  }
}

variable "name" {
  type    = string
  default = "haven-redis-dev"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,29}$", var.name)) && !endswith(var.name, "-") && !strcontains(var.name, "--")
    error_message = "Use 3–30 lowercase letters, digits and single internal hyphens, starting with a letter."
  }
}

data "aws_availability_zones" "available" { state = "available" }
data "aws_ssm_parameter" "ami" { name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64" }
resource "aws_vpc" "dev" {
  cidr_block           = "10.84.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
}
resource "aws_internet_gateway" "dev" { vpc_id = aws_vpc.dev.id }
resource "aws_subnet" "tunnel" {
  vpc_id            = aws_vpc.dev.id
  cidr_block        = "10.84.0.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
}
resource "aws_subnet" "cache" {
  count             = 2
  vpc_id            = aws_vpc.dev.id
  cidr_block        = "10.84.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
}
resource "aws_route_table" "tunnel" {
  vpc_id = aws_vpc.dev.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dev.id
  }
}
resource "aws_route_table_association" "tunnel" {
  subnet_id      = aws_subnet.tunnel.id
  route_table_id = aws_route_table.tunnel.id
}
resource "aws_security_group" "tunnel" {
  name_prefix = "${var.name}-tunnel-"
  vpc_id      = aws_vpc.dev.id
  description = "SSM tunnel: no inbound access"
}
resource "aws_security_group" "cache" {
  name_prefix = "${var.name}-cache-"
  vpc_id      = aws_vpc.dev.id
  description = "Redis only from the SSM tunnel host"
}
resource "aws_vpc_security_group_egress_rule" "ssm" {
  security_group_id = aws_security_group.tunnel.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}
resource "aws_vpc_security_group_egress_rule" "redis" {
  security_group_id            = aws_security_group.tunnel.id
  referenced_security_group_id = aws_security_group.cache.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}
resource "aws_vpc_security_group_ingress_rule" "redis" {
  security_group_id            = aws_security_group.cache.id
  referenced_security_group_id = aws_security_group.tunnel.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}
resource "aws_iam_role" "tunnel" {
  name_prefix        = "${var.name}-"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.tunnel.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_instance_profile" "tunnel" {
  name_prefix = "${var.name}-"
  role        = aws_iam_role.tunnel.name
}
resource "aws_instance" "tunnel" {
  ami                         = data.aws_ssm_parameter.ami.value
  instance_type               = "t4g.nano"
  subnet_id                   = aws_subnet.tunnel.id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.tunnel.id]
  iam_instance_profile        = aws_iam_instance_profile.tunnel.name
  metadata_options { http_tokens = "required" }
  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 8
  }
  tags       = { Name = "${var.name}-tunnel" }
  depends_on = [aws_route_table_association.tunnel, aws_iam_role_policy_attachment.ssm]
}
resource "random_password" "redis" {
  length  = 40
  special = false
}
resource "aws_secretsmanager_secret" "redis" {
  name_prefix             = "${var.name}/auth-"
  recovery_window_in_days = 7
}
resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = random_password.redis.result
}
resource "aws_elasticache_subnet_group" "dev" {
  name       = var.name
  subnet_ids = aws_subnet.cache[*].id
}
resource "aws_elasticache_replication_group" "dev" {
  replication_group_id       = var.name
  description                = "Disposable LAST HAVEN development Redis"
  engine                     = "redis"
  engine_version             = "7.1"
  parameter_group_name       = "default.redis7"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 1
  automatic_failover_enabled = false
  multi_az_enabled           = false
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.dev.name
  security_group_ids         = [aws_security_group.cache.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"
  auth_token                 = random_password.redis.result
  auth_token_update_strategy = "SET"
  snapshot_retention_limit   = 0
  auto_minor_version_upgrade = true
  apply_immediately          = true
}
output "redis_endpoint" { value = aws_elasticache_replication_group.dev.primary_endpoint_address }
output "tunnel_instance_id" { value = aws_instance.tunnel.id }
output "redis_secret_arn" { value = aws_secretsmanager_secret.redis.arn }
