#!/bin/bash

echo "====================================="
echo "Test: Add Todo and Verify Git Commit"
echo "====================================="
echo ""

if [ ! "$(docker ps -q -f name=todowebapp)" ]; then
    echo "Error: todowebapp container is not running"
    echo "Start it with: docker-compose up"
    exit 1
fi

echo "1. Checking initial Git state..."
INITIAL_COMMITS=$(docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline | wc -l" 2>/dev/null || echo "0")
echo "   Initial commits: $INITIAL_COMMITS"
echo ""

echo "2. Current todo.txt content:"
docker exec todowebapp sh -c "cd /tmp/tododata && cat todo.txt 2>/dev/null || echo '(File does not exist yet)'"
echo ""

echo "3. Simulating adding a todo via API..."
RESPONSE=$(curl -s -X POST http://localhost:5001/api/git/file/todo.txt \
    -H "Content-Type: application/json" \
    -d '{"content":"(A) Test todo from script\n(B) Second test todo","commitMessage":"Test: Add todos via API"}')

echo "   API Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ API call successful"
else
    echo "   ✗ API call failed!"
    exit 1
fi

echo ""
echo "4. Checking new Git state..."
sleep 1
NEW_COMMITS=$(docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline | wc -l")
echo "   New commits: $NEW_COMMITS"

if [ "$NEW_COMMITS" -gt "$INITIAL_COMMITS" ]; then
    echo "   ✓ New commit created!"
else
    echo "   ✗ No new commit created"
    exit 1
fi

echo ""
echo "5. Latest commit:"
docker exec todowebapp sh -c "cd /tmp/tododata && git log --oneline -1"
echo ""

echo "6. Current todo.txt content:"
docker exec todowebapp sh -c "cd /tmp/tododata && cat todo.txt"
echo ""

echo "7. Verifying content matches..."
CONTENT=$(docker exec todowebapp sh -c "cd /tmp/tododata && cat todo.txt")
if echo "$CONTENT" | grep -q "Test todo from script"; then
    echo "   ✓ Content found in Git!"
else
    echo "   ✗ Content not found in Git"
    exit 1
fi

echo ""
echo "====================================="
echo "✓ All tests passed!"
echo "====================================="
echo ""
echo "The Git sync is working correctly."
echo ""
echo "To test from the UI:"
echo "1. Open http://localhost:5001 in browser"
echo "2. Open browser console (F12)"
echo "3. Click the Git icon to enable sync"
echo "4. Add a todo item"
echo "5. Watch the console logs"
echo "6. After 3 seconds, check: docker exec todowebapp sh -c 'cd /tmp/tododata && git log --oneline -3'"
echo ""
