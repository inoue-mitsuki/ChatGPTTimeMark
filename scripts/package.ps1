param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageRoot = Split-Path $PSScriptRoot -Parent
$packageManifest = Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw | ConvertFrom-Json
$packageVersion = $packageManifest.version
$packageRelease = Join-Path $packageRoot "Release/$packageVersion"
$packageFiles = @('manifest.json','LICENSE')
foreach ($packageContent in $packageManifest.content_scripts) { $packageFiles += @($packageContent.js) + @($packageContent.css) }
$packageFiles += @($packageManifest.icons.PSObject.Properties.Value)
$packageFiles = @($packageFiles | Where-Object { $_ } | Sort-Object -Unique)
foreach ($packageFile in $packageFiles) {
 $packageAbsolute = [IO.Path]::GetFullPath((Join-Path $packageRoot $packageFile))
 if (-not $packageAbsolute.StartsWith($packageRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe path: $packageFile" }
 if (-not (Test-Path -LiteralPath $packageAbsolute -PathType Leaf)) { throw "Missing file: $packageFile" }
}
New-Item -ItemType Directory -Path $packageRelease -Force | Out-Null
$packageZipPath = Join-Path $packageRelease "$($packageManifest.name)-$packageVersion.zip"
if (Test-Path -LiteralPath $packageZipPath) { throw 'ZIP already exists; inspect before replacing it.' }
$packageZip = [IO.Compression.ZipFile]::Open($packageZipPath,[IO.Compression.ZipArchiveMode]::Create)
try { foreach ($packageFile in $packageFiles) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageZip,(Join-Path $packageRoot $packageFile),$packageFile) | Out-Null } } finally { $packageZip.Dispose() }
$packageZip = [IO.Compression.ZipFile]::OpenRead($packageZipPath)
try {
 if ($packageZip.Entries.Count -ne $packageFiles.Count) { throw 'Unexpected entry count' }
 foreach ($packageEntry in $packageZip.Entries) {
  if ($packageEntry.FullName -cnotin $packageFiles) { throw 'Unexpected entry/case' }
  $packageStream=$packageEntry.Open(); $packageMemory=[IO.MemoryStream]::new()
  try {
   $packageStream.CopyTo($packageMemory)
   if ([Convert]::ToBase64String($packageMemory.ToArray()) -cne [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $packageRoot $packageEntry.FullName)))) { throw 'Source mismatch' }
  } finally { $packageStream.Dispose();$packageMemory.Dispose() }
 }
} finally { $packageZip.Dispose() }
[pscustomobject]@{Path=$packageZipPath;Files=$packageFiles;Bytes=(Get-Item -LiteralPath $packageZipPath).Length;SHA256=(Get-FileHash -LiteralPath $packageZipPath).Hash}
