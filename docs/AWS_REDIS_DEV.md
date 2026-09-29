# AWS Redis for local development

This stack creates real ElastiCache Redis OSS 7.1 in Singapore (`ap-southeast-1`). Local Node integration tests connect through an SSM tunnel with Redis authentication and certificate verification. No browser connects to Redis. The game server's gameplay coordination is still not wired to the adapter; this setup enables the real Redis adapter tests first.

## Resources and cost scope

- Dedicated development VPC, two private cache subnets and a public tunnel subnet.
- One `cache.t4g.micro` Redis node, cluster mode disabled, no replicas or backups; disposable coordination data only.
- One `t4g.nano` Amazon Linux 2023 ARM64 tunnel host with 8 GiB encrypted gp3 disk, IMDSv2 and no inbound ports. Its public IPv4 permits outbound HTTPS to SSM without a NAT gateway.
- Redis security group accepts 6379 only from the tunnel host security group. Cache subnets have no internet route.
- Generated authentication token in Secrets Manager; encryption at rest and required TLS.
- Instance role has AmazonSSMManagedInstanceCore only; it cannot retrieve the Redis secret. Your local authenticated AWS profile retrieves the secret for tests.

Applying this stack starts billable cache, EC2, EBS, public IPv4 and Secrets Manager resources. Closing the tunnel does not stop billing. Check current Singapore prices in the AWS calculator before applying; no free-tier or fixed monthly price is assumed. This is not a production/high-availability topology.

## Prerequisites

Install [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html), and [Terraform](https://developer.hashicorp.com/terraform/install) 1.7 or newer. Node and repository dependencies must also be available in PATH. Terraform downloaded for this task is available locally at `artifacts/terraform/terraform.exe`; that ignored tool folder is not part of the source distribution.

Use a development AWS account/profile, preferably IAM Identity Center:

```powershell
aws configure sso --profile haven-dev
aws sso login --profile haven-dev
aws sts get-caller-identity --profile haven-dev
# Optional: use the downloaded workspace Terraform binary in this shell.
$env:PATH = "$PWD\artifacts\terraform;$env:PATH"
```

The deploying role needs permissions to manage the listed VPC, EC2, IAM instance-role/profile, ElastiCache and Secrets Manager resources, read the public AMI SSM parameter, and create the ElastiCache service-linked role if the account lacks one. It also needs `iam:PassRole` for the tunnel instance role. Use an infrastructure role approved for your account; do not give the game runtime those permissions.

The testing role needs `secretsmanager:GetSecretValue` on the output secret ARN and SSM session permissions on the output instance and the `AWS-StartPortForwardingSessionToRemoteHost` document, plus resume/terminate permissions for its own sessions. Remote-host forwarding is powerful: limit who can use this development tunnel host.

## Deploy and test

From the repository root:

```powershell
.\scripts\aws-redis.ps1 -Action Plan -Profile haven-dev
.\scripts\aws-redis.ps1 -Action Apply -Profile haven-dev
```

Plan prints the selected AWS account and proposed resources. Apply shows Terraform's resource plan and requires its normal confirmation. The default name is `haven-redis-dev`; keep one local state directory per deployed environment. Wait until the EC2 instance appears Online in Systems Manager before opening the tunnel.

Terminal A, leave running:

```powershell
.\scripts\aws-redis.ps1 -Action Tunnel -Profile haven-dev
```

Terminal B:

```powershell
.\scripts\aws-redis.ps1 -Action Test -Profile haven-dev
```

The script fetches the secret into the test process environment, connects to `127.0.0.1:16379`, and uses the actual ElastiCache hostname as TLS SNI/certificate identity. It restores environment variables afterward and does not print the token or save an `.env` file. Use the same `-LocalPort` in both commands if 16379 is occupied. Never use `NODE_TLS_REJECT_UNAUTHORIZED=0` to bypass certificate failures.

The test exercises exclusive leases, incorrect-owner rejection, renewal, presence and rate limits, then deletes only its randomly named keys. A tunnel/auth/network failure fails the test. PostgreSQL is not needed for this Redis-only run. Keep terminal A open until terminal B finishes.

## State and teardown

Terraform local state contains the authentication token even though outputs omit it. State, backup state, plans and `.tfvars` are ignored by Git. This repository is inside OneDrive: before applying, copy the repository into a local non-synced secure workspace or configure an encrypted access-controlled remote Terraform backend. Do not upload state or plans to chat or commit them. Preserve state until the resources are destroyed.

```powershell
# Close the tunnel with Ctrl+C, then remove this development stack.
.\scripts\aws-redis.ps1 -Action Destroy -Profile haven-dev
```

Destroy removes the cache data and infrastructure, with Terraform confirmation. Secrets Manager schedules the secret for deletion after seven days. Verify the destroy completed; failed cleanup can leave billable resources.

## Verification and troubleshooting

Static validation and mocked infrastructure tests do not contact AWS:

```powershell
terraform -chdir=infra/aws/redis-dev init -backend=false
terraform -chdir=infra/aws/redis-dev validate
terraform -chdir=infra/aws/redis-dev test
```

Verified locally: Terraform 1.14.9 validation, one mocked infrastructure test (encryption, ingress scope, single-node sizing, IMDSv2/disk encryption), and PowerShell syntax parsing. Provider versions/checksums are recorded in `.terraform.lock.hcl`.

No AWS deployment or live Redis test has been completed on this host yet. AWS CLI/profile and Session Manager setup are required. If SSM says the target is not connected, check instance Online status, role attachment and outbound HTTPS. If TLS verification fails, keep the endpoint identity override and verify the tunnel targets the current stack's endpoint. If auth fails, fetch the current Secrets Manager token through the test script. For resource/engine availability errors, review the regional Terraform plan and AWS response rather than silently changing regions.

References: [AWS remote-host port forwarding](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html), [ElastiCache Terraform resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/elasticache_replication_group).
