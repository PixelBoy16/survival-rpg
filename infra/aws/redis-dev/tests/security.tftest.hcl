mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-southeast-1a", "ap-southeast-1b"] }
  }
  mock_data "aws_ssm_parameter" {
    defaults = { value = "ami-0123456789abcdef0" }
  }
}
mock_provider "random" {}

run "private_encrypted_development_cache" {
  command = plan
  assert {
    condition     = aws_elasticache_replication_group.dev.transit_encryption_enabled && aws_elasticache_replication_group.dev.transit_encryption_mode == "required" && aws_elasticache_replication_group.dev.at_rest_encryption_enabled
    error_message = "Redis must require TLS and encryption at rest."
  }
  assert {
    condition     = aws_elasticache_replication_group.dev.num_cache_clusters == 1 && !aws_elasticache_replication_group.dev.automatic_failover_enabled
    error_message = "Keep this disposable environment single-node."
  }
  assert {
    condition     = aws_vpc_security_group_ingress_rule.redis.cidr_ipv4 == null && aws_vpc_security_group_ingress_rule.redis.from_port == 6379 && aws_vpc_security_group_ingress_rule.redis.to_port == 6379
    error_message = "Redis must not allow public CIDR ingress."
  }
  assert {
    condition     = aws_instance.tunnel.metadata_options[0].http_tokens == "required" && aws_instance.tunnel.root_block_device[0].encrypted
    error_message = "Tunnel host requires IMDSv2 and encrypted disk."
  }
}
