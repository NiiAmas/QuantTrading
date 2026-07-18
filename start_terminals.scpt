tell application "Terminal"
    activate
    
    -- DB Fix
    do script "cd ~/QuantTrading && ./venv/bin/python fix_db.py && echo 'Database fix complete. You can close this window.'"
    
    -- API Server
    do script "cd ~/QuantTrading && ./venv/bin/python main.py"
    
    -- Bot Engine
    do script "cd ~/QuantTrading && ./venv/bin/python bot_engine.py"
    
    -- Frontend
    do script "cd ~/QuantTrading/frontend && npm run dev"
end tell
