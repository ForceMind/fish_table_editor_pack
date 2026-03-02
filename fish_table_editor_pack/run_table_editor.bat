@echo off
cd /d %~dp0
set HOST=127.0.0.1

echo ----------------------------------------
echo Fish Table Editor
echo [1] Local only    (127.0.0.1)
echo [2] LAN visible   (0.0.0.0)
where choice >nul 2>nul
if %errorlevel%==0 (
  choice /c 12 /n /m "Select mode: "
  if errorlevel 2 set HOST=0.0.0.0
  if errorlevel 1 if not errorlevel 2 set HOST=127.0.0.1
) else (
  set /p MODE=Select mode [1/2]:
  if "%MODE%"=="2" set HOST=0.0.0.0
)
echo Host: %HOST%
echo Open: http://127.0.0.1:18888
echo ----------------------------------------
start "" http://127.0.0.1:18888

set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 fish_table_editor.py --host %HOST% --port 18888
) else (
  python fish_table_editor.py --host %HOST% --port 18888
)
pause
