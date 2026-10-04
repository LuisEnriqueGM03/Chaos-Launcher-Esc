$ErrorActionPreference = "Stop"

$certsDir = Join-Path $PSScriptRoot "..\certs"
if (!(Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
}

$pfxPath = Join-Path $certsDir "ChaosLauncher.pfx"
$cerPath = Join-Path $certsDir "ChaosLauncher.cer"
$passwordPlain = $env:CHAOS_CERT_PASSWORD
if ([string]::IsNullOrWhiteSpace($passwordPlain)) { throw "Define la variable de entorno CHAOS_CERT_PASSWORD antes de ejecutar este script." }
$securePassword = ConvertTo-SecureString -String $passwordPlain -Force -AsPlainText

Write-Host "[+] Generando certificado de firma de codigo para Chaos Studio..."

$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=Chaos Studio, O=Chaos Launcher Community, C=US" `
    -KeyUsage DigitalSignature `
    -FriendlyName "Chaos Studio Code Signing Certificate" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(5)

Write-Host "[+] Certificado generado. Thumbprint: $($cert.Thumbprint)"

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
Write-Host "[+] PFX exportado a: $pfxPath"

Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
Write-Host "[+] Certificado publico exportado a: $cerPath"
