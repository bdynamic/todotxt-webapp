#!/bin/bash

echo "====================================="
echo "Git Backend Verification Script"
echo "====================================="
echo ""

# Check if required commands exist
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "Error: node is required but not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Error: git is required but not installed."; exit 1; }
command -v ssh-keygen >/dev/null 2>&1 || { echo "Error: ssh-keygen is required but not installed."; exit 1; }
echo "✓ All prerequisites installed"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Set test environment variables
export TODO_DATA_DIR="/tmp/tododata-test"
export TODO_CONFIG_DIR="/tmp/todotxt-git-test"

# Clean up any previous test data
echo "Cleaning up previous test data..."
rm -rf "$TODO_DATA_DIR" "$TODO_CONFIG_DIR"
echo "✓ Cleaned"
echo ""

# Start the server in background
echo "Starting server..."
node node-server.js &
SERVER_PID=$!
sleep 2
echo "✓ Server started (PID: $SERVER_PID)"
echo ""

# Test API endpoints
echo "Testing API endpoints..."

# Test status endpoint
echo -n "- GET /api/git/status: "
STATUS=$(curl -s http://localhost:5001/api/git/status)
if echo "$STATUS" | grep -q "success"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Test config endpoint
echo -n "- GET /api/git/config: "
CONFIG=$(curl -s http://localhost:5001/api/git/config)
if echo "$CONFIG" | grep -q "publicKey"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Test file list endpoint
echo -n "- GET /api/git/files: "
FILES=$(curl -s http://localhost:5001/api/git/files)
if echo "$FILES" | grep -q "success"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Test file write endpoint
echo -n "- POST /api/git/file/test.txt: "
WRITE=$(curl -s -X POST http://localhost:5001/api/git/file/test.txt \
    -H "Content-Type: application/json" \
    -d '{"content":"Test todo item\n(A) Another test item","commitMessage":"Test commit"}')
if echo "$WRITE" | grep -q "success"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Test file read endpoint
echo -n "- GET /api/git/file/test.txt: "
READ=$(curl -s http://localhost:5001/api/git/file/test.txt)
if echo "$READ" | grep -q "Test todo item"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

# Test history endpoint
echo -n "- GET /api/git/history/test.txt: "
HISTORY=$(curl -s http://localhost:5001/api/git/history/test.txt)
if echo "$HISTORY" | grep -q "Test commit"; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

echo ""

# Verify filesystem
echo "Verifying filesystem..."
echo -n "- Git repository created: "
if [ -d "$TODO_DATA_DIR/.git" ]; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

echo -n "- SSH keys generated: "
if [ -f "$TODO_CONFIG_DIR/id_ed25519" ] && [ -f "$TODO_CONFIG_DIR/id_ed25519.pub" ]; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

echo -n "- Config file created: "
if [ -f "$TODO_CONFIG_DIR/config.json" ]; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

echo -n "- Test file created: "
if [ -f "$TODO_DATA_DIR/test.txt" ]; then
    echo "✓ OK"
else
    echo "✗ FAILED"
fi

echo ""

# Verify Git commits
echo "Verifying Git operations..."
cd "$TODO_DATA_DIR" || exit
COMMIT_COUNT=$(git log --oneline | wc -l)
echo "- Commit count: $COMMIT_COUNT"
if [ "$COMMIT_COUNT" -ge 2 ]; then
    echo "✓ OK (Initial commit + test commit)"
else
    echo "✗ FAILED (Expected at least 2 commits)"
fi

echo ""
echo "Latest commit:"
git log -1 --oneline

echo ""
echo "====================================="
echo "Stopping server..."
kill $SERVER_PID
sleep 1

echo ""
echo "Cleaning up test data..."
rm -rf "$TODO_DATA_DIR" "$TODO_CONFIG_DIR"

echo ""
echo "====================================="
echo "Test complete!"
echo "====================================="
