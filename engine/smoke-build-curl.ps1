# Usage: .\smoke-build-curl.ps1 <logo> <photo1> <photo2>
param(
  [Parameter(Mandatory=$true)][string]$Logo,
  [Parameter(Mandatory=$true)][string]$Photo1,
  [Parameter(Mandatory=$true)][string]$Photo2
)

function ToDataUri($path, $mime) {
  $bytes = [IO.File]::ReadAllBytes($path)
  $b64 = [Convert]::ToBase64String($bytes)
  "data:$mime;base64,$b64"
}

$payload = @{
  vertical  = 'barber'
  business  = @{
    name    = 'Phase 5 Smoke Barbershop'
    address = '123 Main St'
    phone   = '555-0100'
    hours   = 'Mon-Sat 9-6'
    slogan  = 'Walk-ins welcome'
  }
  sections  = @{ hours = $true; services = $true }
  reference = @{ url = 'https://www.fellowbarber.com' }
  assets    = @{
    logo   = ToDataUri $Logo   'image/png'
    photo1 = ToDataUri $Photo1 'image/jpeg'
    photo2 = ToDataUri $Photo2 'image/jpeg'
  }
  anythingSpecial = ''
} | ConvertTo-Json -Depth 6 -Compress

# Write payload to temp file (curl.exe -d @file handles large bodies)
$tmpFile = [System.IO.Path]::GetTempFileName()
Set-Content -Path $tmpFile -Value $payload -NoNewline -Encoding UTF8

Write-Host "payload size: $((Get-Item $tmpFile).Length) bytes"
Write-Host "calling engine (expect 80-120s)..."

$start = Get-Date
curl.exe -X POST http://localhost:3000/build `
  -H "Content-Type: application/json" `
  --data-binary "@$tmpFile" `
  --max-time 300
$elapsed = (New-TimeSpan $start (Get-Date)).TotalSeconds

Remove-Item $tmpFile
Write-Host ""
Write-Host "elapsed: $([math]::Round($elapsed,1))s"