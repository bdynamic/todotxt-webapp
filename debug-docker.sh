#!/bin/bash

echo "====================================="
echo "Todo.txt Docker Debug Helper"
echo "====================================="
echo ""

show_menu() {
    echo "Select an option:"
    echo "1) View live logs (follow)"
    echo "2) View last 50 lines of logs"
    echo "3) View all logs"
    echo "4) Check container status"
    echo "5) Inspect Git data directory"
    echo "6) Inspect Git config directory"
    echo "7) Execute shell in container"
    echo "8) Test API endpoints"
    echo "9) Rebuild and restart container"
    echo "0) Exit"
    echo ""
    read -p "Enter choice: " choice
    echo ""
}

view_logs_follow() {
    echo "Following logs (Ctrl+C to stop)..."
    docker-compose logs -f todo-webapp
}

view_logs_tail() {
    echo "Last 50 lines of logs:"
    docker-compose logs --tail=50 todo-webapp
}

view_logs_all() {
    echo "All logs:"
    docker-compose logs todo-webapp
}

check_status() {
    echo "Container status:"
    docker-compose ps
    echo ""
    echo "Docker container details:"
    docker inspect todowebapp --format='{{.State.Status}}: {{.State.Error}}'
}

inspect_data_dir() {
    echo "Git data directory contents (/tmp/tododata):"
    docker exec todowebapp ls -la /tmp/tododata 2>/dev/null || echo "Container not running or directory not accessible"
    echo ""
    echo "Git status:"
    docker exec todowebapp sh -c "cd /tmp/tododata && git status" 2>/dev/null || echo "Git repo not initialized or container not running"
    echo ""
    echo "Git log (last 5 commits):"
    docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline -5" 2>/dev/null || echo "No commits yet or container not running"
}

inspect_config_dir() {
    echo "Git config directory contents (~/.config/todotxt-git):"
    docker exec todowebapp ls -la /root/.config/todotxt-git 2>/dev/null || echo "Container not running or directory not accessible"
    echo ""
    echo "SSH public key:"
    docker exec todowebapp cat /root/.config/todotxt-git/id_ed25519.pub 2>/dev/null || echo "SSH key not generated yet or container not running"
    echo ""
    echo "Git config:"
    docker exec todowebapp cat /root/.config/todotxt-git/config.json 2>/dev/null || echo "Config not created yet or container not running"
}

exec_shell() {
    echo "Opening shell in container (type 'exit' to quit)..."
    docker exec -it todowebapp sh
}

test_api() {
    echo "Testing API endpoints..."
    echo ""
    
    echo "1. GET /api/git/status"
    curl -s http://localhost:5001/api/git/status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5001/api/git/status
    echo ""
    echo ""
    
    echo "2. GET /api/git/config"
    curl -s http://localhost:5001/api/git/config | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5001/api/git/config
    echo ""
    echo ""
    
    echo "3. GET /api/git/files"
    curl -s http://localhost:5001/api/git/files | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5001/api/git/files
    echo ""
    echo ""
    
    echo "4. Testing file write (creating test.txt)..."
    curl -s -X POST http://localhost:5001/api/git/file/test.txt \
        -H "Content-Type: application/json" \
        -d '{"content":"(A) Test todo item\n(B) Another test","commitMessage":"API test commit"}' \
        | python3 -m json.tool 2>/dev/null || curl -s -X POST http://localhost:5001/api/git/file/test.txt \
        -H "Content-Type: application/json" \
        -d '{"content":"(A) Test todo item\n(B) Another test","commitMessage":"API test commit"}'
    echo ""
    echo ""
    
    echo "5. GET /api/git/file/test.txt"
    curl -s http://localhost:5001/api/git/file/test.txt | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5001/api/git/file/test.txt
    echo ""
}

rebuild_restart() {
    echo "Stopping containers..."
    docker-compose down
    echo ""
    echo "Rebuilding images..."
    docker-compose build --no-cache
    echo ""
    echo "Starting containers..."
    docker-compose up -d
    echo ""
    echo "Waiting for container to start..."
    sleep 3
    echo ""
    echo "Container status:"
    docker-compose ps
    echo ""
    echo "Recent logs:"
    docker-compose logs --tail=20 todo-webapp
}

# Main loop
while true; do
    show_menu
    case $choice in
        1) view_logs_follow ;;
        2) view_logs_tail ;;
        3) view_logs_all ;;
        4) check_status ;;
        5) inspect_data_dir ;;
        6) inspect_config_dir ;;
        7) exec_shell ;;
        8) test_api ;;
        9) rebuild_restart ;;
        0) echo "Exiting..."; exit 0 ;;
        *) echo "Invalid option. Please try again." ;;
    esac
    echo ""
    echo "Press Enter to continue..."
    read
    echo ""
done
