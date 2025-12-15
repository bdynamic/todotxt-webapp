#!/bin/bash

echo "====================================="
echo "Test: Git Remote Configuration"
echo "====================================="
echo ""

if [ ! "$(docker ps -q -f name=todowebapp)" ]; then
    echo "Error: todowebapp container is not running"
    echo "Start it with: docker-compose up"
    exit 1
fi

echo "1. Checking current Git configuration..."
echo ""

echo "   Git config file:"
docker exec todowebapp cat /root/.config/todotxt-git/config.json 2>/dev/null || echo "   (Config file not found)"
echo ""

echo "   Git user config:"
docker exec todowebapp sh -c "cd /tmp/tododata && git config user.name"
docker exec todowebapp sh -c "cd /tmp/tododata && git config user.email"
echo ""

echo "   Git remotes:"
docker exec todowebapp sh -c "cd /tmp/tododata && git remote -v"
echo ""

echo "2. Testing config update via API..."
echo ""

TEST_REMOTE="git@github.com:testuser/testrepo.git"

RESPONSE=$(curl -s -X POST http://localhost:5001/api/git/config \
    -H "Content-Type: application/json" \
    -d "{\"userName\":\"Test User\",\"userEmail\":\"test@example.com\",\"remoteUrl\":\"$TEST_REMOTE\"}")

echo "   API Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✓ Config update successful"
else
    echo "   ✗ Config update failed!"
    exit 1
fi

echo ""
echo "3. Verifying Git configuration was updated..."
echo ""

echo "   Updated Git user config:"
docker exec todowebapp sh -c "cd /tmp/tododata && git config user.name"
docker exec todowebapp sh -c "cd /tmp/tododata && git config user.email"
echo ""

echo "   Updated Git remotes:"
REMOTES=$(docker exec todowebapp sh -c "cd /tmp/tododata && git remote -v")
echo "$REMOTES"
echo ""

if echo "$REMOTES" | grep -q "$TEST_REMOTE"; then
    echo "   ✓ Remote URL correctly configured!"
else
    echo "   ✗ Remote URL not found in Git config"
    exit 1
fi

echo ""
echo "4. Checking Git status via API..."
echo ""

STATUS_RESPONSE=$(curl -s http://localhost:5001/api/git/status)
echo "   Status response:"
echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
echo ""

if echo "$STATUS_RESPONSE" | grep -q "\"remotes\""; then
    echo "   ✓ Remote info included in status"
else
    echo "   ⚠ Remote info not in status response"
fi

echo ""
echo "====================================="
echo "Summary"
echo "====================================="
echo ""
echo "Git remote configuration is working correctly!"
echo ""
echo "Next steps to test actual remote sync:"
echo ""
echo "1. Create a repository on GitHub/GitLab"
echo "2. Add your SSH public key to the Git hosting service:"
echo "   Get key: docker exec todowebapp cat /root/.config/todotxt-git/id_ed25519.pub"
echo "3. Configure the remote URL in the UI:"
echo "   - Click gear icon"
echo "   - Enter your repository URL (git@github.com:user/repo.git)"
echo "   - Click 'Save Configuration'"
echo "4. Click the cloud icon to sync with remote"
echo ""
echo "Or test with the API:"
echo "   curl -X POST http://localhost:5001/api/git/sync"
echo ""
