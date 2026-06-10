param(
  [string]$SourceJpeg,
  [string]$DestPng
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($SourceJpeg)
$bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x++) {
    $c = $src.GetPixel($x, $y)
    if ($c.R -gt 242 -and $c.G -gt 242 -and $c.B -gt 242) {
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    } else {
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
    }
  }
}

$dir = Split-Path $DestPng -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($DestPng, [System.Drawing.Imaging.ImageFormat]::Png)

$src.Dispose()
$bmp.Dispose()

Write-Host "[convert-logo-to-png] Saved $DestPng"
