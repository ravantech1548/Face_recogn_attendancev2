@echo off
echo Killing process on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    echo Found process: %%a
    taskkill /F /PID %%a
)
echo Done!
pause

