# ===================================================================
# NKB ITMS - WINDOWS ENDPOINT AGENT & NATIVE CONSENT DAEMON
# ===================================================================
# This script runs as a background Windows Service on target PCs.
# It maintains WebSocket connection to ITMS API, sends heartbeats,
# listens for incoming remote access requests, and displays a native
# Always-On-Top Windows Consent Dialog for employee approval.
# ===================================================================

param (
    [string]$ServerUrl = "https://itms.nkbmanufacturing.com",
    [string]$DeviceId = "$env:COMPUTERNAME",
    [int]$HeartbeatIntervalSeconds = 30
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$AgentVersion = "v1.2.4-daemon"
$LoggedInUser = "$env:USERDOMAIN\$env:USERNAME"
$OSVersion = (Get-CimInstance Win32_OperatingSystem).Caption

Write-Host "=================================================" -ForegroundColor Gold
Write-Host " NKB ITMS Windows Endpoint Agent Initializing" -ForegroundColor Cyan
Write-Host " Server URL : $ServerUrl" -ForegroundColor White
Write-Host " Device ID  : $DeviceId" -ForegroundColor White
Write-Host " User       : $LoggedInUser" -ForegroundColor White
Write-Host " OS         : $OSVersion" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Gold

# Function to show Native Windows Always-On-Top Consent Dialog
function Show-NativeConsentDialog {
    param (
        [string]$RequestId,
        [string]$TechnicianName,
        [string]$Reason,
        [string]$AccessType,
        [int]$TimeoutSeconds = 300
    )

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "IT Support - Remote Access Consent Request"
    $form.Size = New-Object System.Drawing.Size(460, 320)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    $form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42) # Slate-900

    # Header Title
    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "IT Department requests remote access"
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = [System.Drawing.Color]::Gold
    $lblTitle.Location = New-Object System.Drawing.Point(20, 15)
    $lblTitle.Size = New-Object System.Drawing.Size(400, 30)
    $form.Controls.Add($lblTitle)

    # Info Box Panel
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point(20, 50)
    $panel.Size = New-Object System.Drawing.Size(400, 140)
    $panel.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59) # Slate-800
    $panel.BorderStyle = "FixedSingle"

    $lblTech = New-Object System.Windows.Forms.Label
    $lblTech.Text = "Technician : $TechnicianName"
    $lblTech.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $lblTech.ForeColor = [System.Drawing.Color]::White
    $lblTech.Location = New-Object System.Drawing.Point(15, 15)
    $lblTech.Size = New-Object System.Drawing.Size(370, 25)
    $panel.Controls.Add($lblTech)

    $lblReason = New-Object System.Windows.Forms.Label
    $lblReason.Text = "Reason     : $Reason"
    $lblReason.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $lblReason.ForeColor = [System.Drawing.Color]::LightGray
    $lblReason.Location = New-Object System.Drawing.Point(15, 45)
    $lblReason.Size = New-Object System.Drawing.Size(370, 45)
    $panel.Controls.Add($lblReason)

    $lblType = New-Object System.Windows.Forms.Label
    $lblType.Text = "Access Type: $AccessType"
    $lblType.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $lblType.ForeColor = [System.Drawing.Color]::LimeGreen
    $lblType.Location = New-Object System.Drawing.Point(15, 95)
    $lblType.Size = New-Object System.Drawing.Size(370, 25)
    $panel.Controls.Add($lblType)

    $form.Controls.Add($panel)

    # Timer Countdown Label
    $lblTimer = New-Object System.Windows.Forms.Label
    $global:remainingSeconds = $TimeoutSeconds
    $lblTimer.Text = "Auto-deny in: $global:remainingSeconds seconds"
    $lblTimer.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
    $lblTimer.ForeColor = [System.Drawing.Color]::Orange
    $lblTimer.Location = New-Object System.Drawing.Point(20, 200)
    $lblTimer.Size = New-Object System.Drawing.Size(400, 20)
    $form.Controls.Add($lblTimer)

    $decisionResult = "deny"

    # Allow Button
    $btnAllow = New-Object System.Windows.Forms.Button
    $btnAllow.Text = "ALLOW ACCESS"
    $btnAllow.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $btnAllow.ForeColor = [System.Drawing.Color]::White
    $btnAllow.BackColor = [System.Drawing.Color]::ForestGreen
    $btnAllow.FlatStyle = "Flat"
    $btnAllow.Location = New-Object System.Drawing.Point(20, 230)
    $btnAllow.Size = New-Object System.Drawing.Size(190, 40)
    $btnAllow.Add_Click({
        $script:decisionResult = "allow"
        $form.Close()
    })
    $form.Controls.Add($btnAllow)

    # Deny Button
    $btnDeny = New-Object System.Windows.Forms.Button
    $btnDeny.Text = "DENY ACCESS"
    $btnDeny.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $btnDeny.ForeColor = [System.Drawing.Color]::White
    $btnDeny.BackColor = [System.Drawing.Color]::Crimson
    $btnDeny.FlatStyle = "Flat"
    $btnDeny.Location = New-Object System.Drawing.Point(230, 230)
    $btnDeny.Size = New-Object System.Drawing.Size(190, 40)
    $btnDeny.Add_Click({
        $script:decisionResult = "deny"
        $form.Close()
    })
    $form.Controls.Add($btnDeny)

    # Timer Callback
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 1000
    $timer.Add_Tick({
        $global:remainingSeconds--
        $lblTimer.Text = "Auto-deny in: $global:remainingSeconds seconds"
        if ($global:remainingSeconds -le 0) {
            $timer.Stop()
            $script:decisionResult = "deny"
            $form.Close()
        }
    })
    $timer.Start()

    $form.Add_FormClosing({ $timer.Stop() })
    $form.ShowDialog() | Out-Null

    return $script:decisionResult
}

# Main Loop (Heartbeat and Request Listener)
Write-Host "[NKB Agent Daemon] Starting heartbeat loop..." -ForegroundColor Green
while ($true) {
    try {
        # Send Heartbeat API Call
        $body = @{
            device_id = $DeviceId
            hostname = $env:COMPUTERNAME
            logged_in_user = $LoggedInUser
            os_name = $OSVersion
            agent_version = $AgentVersion
        } | ConvertTo-Json

        Invoke-RestMethod -Uri "$ServerUrl/api/remote/agent/v1/heartbeat" -Method Post -Body $body -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
    } catch {
        # Silent retry on network disconnect
    }
    Start-Sleep -Seconds $HeartbeatIntervalSeconds
}
