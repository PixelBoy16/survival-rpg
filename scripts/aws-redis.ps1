param(
  [ValidateSet('Plan','Apply','Tunnel','Test','Destroy')][string]$Action='Plan',
  [string]$Profile,
  [ValidateRange(1024,65535)][int]$LocalPort=16379
)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$infra=Join-Path $repo 'infra/aws/redis-dev'
foreach($command in @('terraform','aws')) {
  if(-not (Get-Command $command -ErrorAction SilentlyContinue)){throw "Install $command and add it to PATH first. See docs/AWS_REDIS_DEV.md."}
}
$awsArgs=@('--region','ap-southeast-1')
if($Profile){$awsArgs+=@('--profile',$Profile)}
$previousProfile=$env:AWS_PROFILE
try {
  if($Profile){$env:AWS_PROFILE=$Profile}
  & aws sts get-caller-identity @awsArgs
  if($LASTEXITCODE -ne 0){throw 'AWS authentication failed. Sign in to the selected profile.'}
  if($Action -in @('Plan','Apply')) {
    & terraform "-chdir=$infra" init
    if($LASTEXITCODE -ne 0){throw 'Terraform init failed'}
    & terraform "-chdir=$infra" validate
    if($LASTEXITCODE -ne 0){throw 'Terraform validation failed'}
    if($Action -eq 'Plan') { & terraform "-chdir=$infra" plan }
    else { & terraform "-chdir=$infra" apply }
    if($LASTEXITCODE -ne 0){throw 'Terraform operation failed'}
  } elseif($Action -eq 'Destroy') {
    & terraform "-chdir=$infra" destroy
    if($LASTEXITCODE -ne 0){throw 'Terraform destroy failed'}
  } else {
    $raw=& terraform "-chdir=$infra" output -json
    if($LASTEXITCODE -ne 0){throw 'Read Terraform outputs failed; apply the stack first'}
    $outputs=($raw -join "`n") | ConvertFrom-Json
    $endpoint=$outputs.redis_endpoint.value
    if(-not $endpoint){throw 'Redis endpoint missing'}
    if($Action -eq 'Tunnel') {
      if(-not (Get-Command session-manager-plugin -ErrorAction SilentlyContinue)){throw 'Install the AWS Session Manager plugin first'}
      $paramsFile=Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
      try {
        $params=@{host=@($endpoint);portNumber=@('6379');localPortNumber=@([string]$LocalPort)} | ConvertTo-Json -Compress
        [IO.File]::WriteAllText($paramsFile,$params)
        & aws ssm start-session --target $outputs.tunnel_instance_id.value --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters "file://$paramsFile" @awsArgs
        if($LASTEXITCODE -ne 0){throw 'SSM tunnel failed; verify instance Online status and profile permissions'}
      } finally {Remove-Item -LiteralPath $paramsFile -ErrorAction SilentlyContinue}
    } else {
      $secret=& aws secretsmanager get-secret-value --secret-id $outputs.redis_secret_arn.value --query SecretString --output text @awsArgs
      if($LASTEXITCODE -ne 0){throw 'Unable to retrieve Redis authentication secret'}
      $previousUrl=$env:TEST_REDIS_URL
      $previousServername=$env:REDIS_TLS_SERVERNAME
      try {
        $env:TEST_REDIS_URL="rediss://:$([Uri]::EscapeDataString(($secret -join '').Trim()))@127.0.0.1:$LocalPort"
        $env:REDIS_TLS_SERVERNAME=$endpoint
        Push-Location $repo
        try { & node --import tsx --test '--test-name-pattern=Redis' tests/persistence.integration.test.ts
          if($LASTEXITCODE -ne 0){throw 'Redis integration test failed'}
        } finally {Pop-Location}
      } finally {
        $env:TEST_REDIS_URL=$previousUrl
        $env:REDIS_TLS_SERVERNAME=$previousServername
        $secret=$null
      }
    }
  }
} finally {$env:AWS_PROFILE=$previousProfile}
