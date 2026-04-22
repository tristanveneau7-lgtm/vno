# Usage: .\smoke-build-phase5.ps1 <logo.png> <photo1.jpg> <photo2.jpg>
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

$start = Get-Date
$res = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/build' `
  -ContentType 'application/json' -Body $payload -TimeoutSec 300
$elapsed = (New-TimeSpan $start (Get-Date)).TotalSeconds
Write-Host "elapsed: $([math]::Round($elapsed,1))s"
$res | ConvertTo-Json