@echo off
rem Runs a command with this project's own Node 24 (in .node\) first on PATH,
rem so the machine-wide Node 16 used by the other apps is left untouched.
rem   .\run npm install
rem   .\run npm run dev
rem   .\run npx wrangler login
if not exist "%~dp0.node\node.exe" (
  echo Project Node is missing. Run: powershell -ExecutionPolicy Bypass -File scripts\get-node.ps1
  exit /b 1
)
set "PATH=%~dp0.node;%PATH%"
%*
