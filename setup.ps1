#requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path $PSScriptRoot).Path

& (Join-Path $Root "setup\setup.ps1")
