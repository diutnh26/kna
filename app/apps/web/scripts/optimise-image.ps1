<#
.SYNOPSIS
  Re-encodes a photograph for the web: JPEG, bounded dimensions, reported.

.DESCRIPTION
  Photographs arrive in whatever the camera or the phone produced. Two of
  the first five were PNGs carrying photographs — one at 1.33MB for a single
  card, which would have been most of the site's image weight on its own.
  That matters more here than on most projects: a good share of the people
  this platform is for are on mobile data in Đắk Lắk.

  Uses System.Drawing from .NET, which is already on any Windows machine.
  No dependency to install, nothing added to package.json — deliberately,
  because this runs a handful of times while photographs are collected and
  then not again.

  Does not upscale. Nothing can restore detail that was never captured, and
  a file that claims a resolution it does not have is worse than an honest
  small one.

.EXAMPLE
  ./optimise-image.ps1 -Path "~/Downloads/Photo.png" `
                       -Destination ../public/images/projects/lak.jpg

.EXAMPLE
  # Check what it would do without writing anything
  ./optimise-image.ps1 -Path in.png -Destination out.jpg -WhatIf
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)][string]$Path,
  [Parameter(Mandatory)][string]$Destination,

  # Longest edge. 1600 is generous for the largest frame on any screen here
  # (a full-width editorial image at 2x on a laptop).
  [int]$MaxEdge = 1600,

  # 82 is where JPEG stops being visibly lossy on photographs of this kind
  # and starts only costing bytes.
  [ValidateRange(1, 100)][int]$Quality = 82
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Path)) { throw "No such file: $Path" }
$src = (Resolve-Path $Path).Path
$before = (Get-Item $src).Length

$img = [System.Drawing.Image]::FromFile($src)
try {
  $w = $img.Width
  $h = $img.Height

  # Scale only downwards.
  $scale = [Math]::Min(1.0, $MaxEdge / [Math]::Max($w, $h))
  $tw = [int][Math]::Round($w * $scale)
  $th = [int][Math]::Round($h * $scale)

  if (-not $PSCmdlet.ShouldProcess($Destination, "write ${tw}x${th} JPEG q$Quality")) { return }

  $canvas = New-Object System.Drawing.Bitmap $tw, $th
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode  = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    # White ground: JPEG has no alpha, and a transparent PNG would
    # otherwise composite onto black and look like a different photograph.
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $tw, $th)
  } finally { $g.Dispose() }

  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
             Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

  $dir = Split-Path -Parent $Destination
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }

  # Bitmap.Save resolves a relative path against .NET's current directory,
  # which is the process working directory and not PowerShell's location.
  # A relative -Destination would otherwise land somewhere unrelated, or
  # fail claiming a directory that plainly exists does not.
  $Destination = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Destination)

  $canvas.Save($Destination, $encoder, $params)
  $canvas.Dispose()
} finally { $img.Dispose() }

$after = (Get-Item $Destination).Length

# Re-encoding an already-compressed JPEG at a fixed quality can produce a
# LARGER file than it started with, while also costing a second generation
# of JPEG loss. When nothing was resized and nothing was saved, the honest
# result is the original: copy it across instead and say so.
if ($tw -eq $w -and $th -eq $h -and $after -ge $before) {
  $sameFormat = [IO.Path]::GetExtension($src).ToLower() -in '.jpg', '.jpeg'
  if ($sameFormat) {
    Copy-Item -LiteralPath $src -Destination $Destination -Force
    "{0}x{1}   {2:N0} KB kept as-is (re-encoding would have added {3:N0} KB and a second generation of loss)" -f `
      $w, $h, ($before / 1KB), (($after - $before) / 1KB)
    return
  }
}

"{0}x{1} -> {2}x{3}   {4:N0} KB -> {5:N0} KB   ({6:N0}% smaller)" -f `
  $w, $h, $tw, $th, ($before / 1KB), ($after / 1KB), ((1 - $after / $before) * 100)
