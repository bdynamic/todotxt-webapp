#!/bin/bash

echo "====================================="
echo "Git Backend Fix Verification"
echo "====================================="
echo ""

echo "This script will verify the Git backend initialization bug is fixed."
echo ""

# Clean up any previous test
echo "1. Cleaning up previous test data..."
rm -rf /tmp/tododata-verify /tmp/todotxt-git-verify
export TODO_DATA_DIR=/tmp/tododata-verify
export TODO_CONFIG_DIR=/tmp/todotxt-git-verify

echo "   ✓ Cleaned"
echo ""

# Start server in background
echo "2. Starting server..."
DEBUG=true node node-server.js --verbose > /tmp/server-test.log 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"

# Wait for initialization
echo ""
echo "3. Waiting for Git backend to initialize..."
sleep 3

# Check if server is still running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "   ✗ FAILED - Server crashed!"
    echo ""
    echo "Last 20 lines of log:"
    tail -20 /tmp/server-test.log
    exit 1
fi

echo "   ✓ Server is running"
echo ""

# Check the logs for success message
echo "4. Checking initialization logs..."
if grep -q "Git backend initialized successfully" /tmp/server-test.log; then
    echo "   ✓ Git backend initialized successfully"
else
    echo "   ✗ FAILED - Git backend did not initialize"
    echo ""
    echo "Server log:"
    cat /tmp/server-test.log
    kill $SERVER_PID
    exit 1
fi

# Check for the error that was happening before
if grep -q "fatal: --local can only be used inside a git repository" /tmp/server-test.log; then
    echo "   ✗ FAILED - The bug still exists!"
    kill $SERVER_PID
    exit 1
fi

echo ""
echo "5. Verifying Git repository..."

# Check Git repo exists
if [ -d "/tmp/tododata-verify/.git" ]; then
    echo "   ✓ Git repository created"
else
    echo "   ✗ FAILED - Git repository not created"
    kill $SERVER_PID
    exit 1
fi

# Check Git config
cd /tmp/tododata-verify
GIT_USER=$(git config user.name)
GIT_EMAIL=$(git config user.email)

if [ -n "$GIT_USER" ] && [ -n "$GIT_EMAIL" ]; then
    echo "   ✓ Git config set (user: $GIT_USER, email: $GIT_EMAIL)"
else
    echo "   ✗ FAILED - Git config not set properly"
    kill $SERVER_PID
    exit 1
fi

# Check initial commit
COMMIT_COUNT=$(git log --oneline | wc -l)
if [ "$COMMIT_COUNT" -ge 1 ]; then
    echo "   ✓ Initial commit created ($COMMIT_COUNT commits)"
else
    echo "   ✗ FAILED - No commits found"
    kill $SERVER_PID
    exit 1
fi

echo ""
echo "6. Verifying SSH keys..."

if [ -f "/tmp/todotxt-git-verify/id_ed25519" ] && [ -f "/tmp/todotxt-git-verify/id_ed25519.pub" ]; then
    echo "   ✓ SSH keys generated"
else
    echo "   ✗ FAILED - SSH keys not generated"
    kill $SERVER_PID
    exit 1
fi

echo ""
echo "7. Testing API endpoints..."

# Test status endpoint
STATUS_RESPONSE=$(curl -s http://localhost:5001/api/git/status)
if echo "$STATUS_RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ GET /api/git/status works"
else
    echo "   ✗ FAILED - Status endpoint failed"
    echo "   Response: $STATUS_RESPONSE"
    kill $SERVER_PID
    exit 1
fi

# Test file write
WRITE_RESPONSE=$(curl -s -X POST http://localhost:5001/api/git/file/test.txt \
    -H "Content-Type: application/json" \
    -d '{"content":"Test content","commitMessage":"Test"}')
if echo "$WRITE_RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ POST /api/git/file/test.txt works"
else
    echo "   ✗ FAILED - File write failed"
    echo "   Response: $WRITE_RESPONSE"
    kill $SERVER_PID
    exit 1
fi

# Verify the commit was created
sleep 1
cd /tmp/tododata-verify
NEW_COMMIT_COUNT=$(git log --oneline | wc -l)
if [ "$NEW_COMMIT_COUNT" -gt "$COMMIT_COUNT" ]; then
    echo "   ✓ File commit created (now $NEW_COMMIT_COUNT commits)"
else
    echo "   ✗ FAILED - No new commit after file write"
    kill $SERVER_PID
    exit 1
fi

echo ""
echo "8. Cleanup..."
kill $SERVER_PID
sleep 1
rm -rf /tmp/tododata-verify /tmp/todotxt-git-verify /tmp/server-test.log
echo "   ✓ Cleaned up"

echo ""
echo "====================================="
echo "✓ ALL TESTS PASSED!"
echo "====================================="
echo ""
echo "The Git backend bug is FIXED!"
echo "The server initializes correctly and all operations work."
echo ""
