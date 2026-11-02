@echo off
setlocal
cd /d "%~dp0"

rem GitHub CLI is installed outside the default PATH of a double-clicked window.
if not exist "%ProgramFiles%\GitHub CLI\gh.exe" goto :no_gh
set "PATH=%PATH%;%ProgramFiles%\GitHub CLI"

rem Stage everything, commit only if something changed.
git add -A
git diff --cached --quiet
if not errorlevel 1 goto :push_only
if "%~1"=="" (set "MSG=Update") else (set "MSG=%*")
git commit -q -m "%MSG%"
if errorlevel 1 goto :failed

:push_only
rem First run creates the GitHub repository and links it as origin.
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo Creating GitHub repository Scoutbot ^(private^)...
  gh repo create Scoutbot --private --source=. --remote=origin --push
  if errorlevel 1 goto :failed
) else (
  git push
  if errorlevel 1 goto :failed
)

echo.
echo Done. Your changes are on GitHub.
pause
exit /b 0

:no_gh
echo GitHub CLI not found. Install it with: winget install --id GitHub.cli
pause
exit /b 1

:failed
echo.
echo Push failed. See the message above.
pause
exit /b 1
