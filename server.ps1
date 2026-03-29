# server.ps1 - PowerShell Localhost Development Server

param (
    [int]$Port = 3000,
    [string]$PublicDir = "public"
)

# Function to log with timestamp
function Log-Message {
    param ([string]$Level, [string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] ${Level}: $Message"
}

# Ensure public directory exists
if (-not (Test-Path $PublicDir)) {
    New-Item -ItemType Directory -Path $PublicDir | Out-Null
}

$script:DataFile = Join-Path $PSScriptRoot "data.json"
if (-not (Test-Path $script:DataFile)) {
    $initialData = @{
        courses = @()
        topics = @()
        syncTime = (Get-Date).Ticks
    }
    $initialData | ConvertTo-Json -Depth 10 | Set-Content $script:DataFile
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
# Try to add wildcard prefix (may require Admin privileges)
try {
    $listener.Prefixes.Add("http://+:$Port/")
} catch {
    Log-Message "WARNING" "Could not bind to wildcard prefix. Server only accessible via localhost."
}
$listener.Start()

Log-Message "INFO" "Server is starting..."
Log-Message "SUCCESS" "Server is running at http://localhost:$Port"

# Display all local IP addresses to help user connect phone
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }
Log-Message "INFO" "Use one of these IPs in your phone's Admin Settings:"
foreach ($ip in $ipAddresses) {
    Log-Message "SUCCESS" " -> http://$($ip.IPAddress):$Port"
}

Log-Message "INFO" "Local Network access enabled if bound to http://+:$Port"

# Hot-reload: track the latest change timestamp
$script:LastChange = (Get-ChildItem -Path $PublicDir -Recurse | Measure-Object -Property LastWriteTime -Maximum).Maximum.Ticks

# Watcher for changes
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = Resolve-Path $PublicDir
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$onChange = {
    $script:LastChange = (Get-Date).Ticks
    Log-Message "DEBUG" "File change detected, triggering reload..."
}

Register-ObjectEvent $watcher "Changed" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Created" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action $onChange | Out-Null

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
        } catch {
            Log-Message "ERROR" "Error getting context: $_"
            continue
        }
        $request = $context.Request
        $response = $context.Response

        $url = $request.Url.LocalPath
        Log-Message "REQUEST" "$($request.HttpMethod) $url"

        # Handle CORS
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # Handle Hot-reload polling
        if ($url -eq "/_reload") {
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($script:LastChange.ToString())
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # API: Get Data
        if ($url -eq "/api/data" -and $request.HttpMethod -eq "GET") {
            $data = Get-Content $script:DataFile -Raw
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($data)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # API: Update Data
        if ($url -eq "/api/data" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $body | Set-Content $script:DataFile
            
            $response.StatusCode = 200
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("Data Updated")
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Resolve file path
        $filePath = Join-Path $PublicDir $url
        if (Test-Path $filePath -PathType Container) {
            $filePath = Join-Path $filePath "index.html"
        }

        if (Test-Path $filePath) {
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($extension) {
                ".html" { "text/html" }
                ".css" { "text/css" }
                ".js" { "application/javascript" }
                ".png" { "image/png" }
                ".jpg" { "image/jpeg" }
                ".svg" { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $buffer = [System.IO.File]::ReadAllBytes($filePath)

            # Inject reload script into HTML
            if ($extension -eq ".html") {
                $content = [System.Text.Encoding]::UTF8.GetString($buffer)
                $reloadScript = @"
                <script>
                    (function() {
                        let lastChange = null;
                        const poll = () => {
                            fetch('/_reload')
                                .then(res => res.text())
                                .then(timestamp => {
                                    if (lastChange === null) {
                                        lastChange = timestamp;
                                    } else if (lastChange !== timestamp) {
                                        console.log('File change detected. Reloading...');
                                        window.location.reload();
                                    }
                                })
                                .catch(err => {
                                    // Quietly ignore aborted requests or connection resets
                                    if (err.name !== 'AbortError') {
                                        console.debug('Hot-reload poll interrupted');
                                    }
                                })
                                .finally(() => {
                                    // Slightly longer delay to reduce console noise during rapid saves
                                    setTimeout(poll, 2000);
                                });
                        };
                        // Delay initial poll to ensure page is fully stable
                        setTimeout(poll, 1000);
                    })();
                </script>
"@
                if ($content -like "*</body>*") {
                    $content = $content.Replace("</body>", "$reloadScript</body>")
                } else {
                    $content += $reloadScript
                }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
            }

            $response.ContentType = $contentType
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } else {
            Log-Message "ERROR" "File not found: $url"
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    }
} catch {
    Log-Message "ERROR" "Unexpected error: $_"
} finally {
    Log-Message "INFO" "Shutting down server..."
    $listener.Stop()
    $watcher.Dispose()
    Unregister-Event -SourceIdentifier "Changed" -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier "Created" -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier "Deleted" -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier "Renamed" -ErrorAction SilentlyContinue
    exit 0
}
