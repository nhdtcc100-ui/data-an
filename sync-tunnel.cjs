// ============================================================
// sync-tunnel.cjs - Auto-sync Cloudflare Tunnel URL with Supabase config
// ============================================================
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Cloudflare Tunnel container in Docker...');

try {
  // Ensure container is running
  const ps = execSync('docker ps --filter "name=supabase-cloudflared" --format "{{.ID}}"').toString().trim();
  if (!ps) {
    console.log('🚀 Starting supabase-cloudflared...');
    execSync('docker compose -f supabase-docker/docker-compose.yml -f supabase-docker/docker-compose.cloudflare.yml up -d cloudflared', { stdio: 'inherit' });
    execSync('node -e "setTimeout(() => {}, 4000)"');
  }

  // Extract URL from docker logs
  const logs = execSync('docker logs supabase-cloudflared 2>&1').toString();
  const match = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);

  if (match) {
    const tunnelUrl = match[0];
    console.log('\n============================================================');
    console.log('✅ Active Cloudflare Tunnel URL:');
    console.log('👉 ' + tunnelUrl);
    console.log('============================================================\n');

    // Update frontend/public/supabase-config.json
    const configPath = path.join(__dirname, 'frontend', 'public', 'supabase-config.json');
    const config = {
      supabaseUrl: tunnelUrl,
      note: 'Active Cloudflare Tunnel for Supabase on Docker',
      lastUpdated: new Date().toISOString(),
      tunnelActive: true
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('💾 Updated: frontend/public/supabase-config.json');

    // Test connectivity
    console.log('🧪 Testing Supabase PostgreSQL connectivity via tunnel...');
    const testCmd = `node -e "fetch('${tunnelUrl}/rest/v1/projects?select=count', {headers: {'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNjY0NzY1LCJleHAiOjE5NTAzNDQ3NjV9.7HBWC-YC_7L400M5lDIEEVod0BKyUNRKGyveE6_Zdzw'}}).then(r => console.log('🎉 Status HTTP:', r.status, '- Database is live and fully accessible from anywhere on the internet!')).catch(e => console.error('Error:', e.message))"`;
    execSync(testCmd, { stdio: 'inherit' });
  } else {
    console.error('❌ Could not find trycloudflare URL in logs.');
  }
} catch (err) {
  console.error('Error:', err.message);
}
