param([switch]$Smoke, [string]$Out)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $python = if ($env:STUDY_PYTHON) { $env:STUDY_PYTHON } else { Join-Path $PSScriptRoot '.venv/Scripts/python.exe' }
    $options = @('-m','experiments.run_all')
    if ($Smoke) { $options += '--smoke' }
    if ($Out) { $options += @('--out',$Out) }
    & $python @options
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
exit 0
