/**
 * ShareTokenService 单元测试
 * ----------------------------------------------------------------------------
 * 验证核心安全下载机制：
 * 1. 生成令牌并校验通过
 * 2. 普通文件（<100MB）→ 15 分钟有效期
 * 3. 大文件（≥100MB）→ 30 分钟有效期
 * 4. 篡改令牌 → 校验失败
 * 5. 过期令牌 → 校验失败
 */
import { shareTokenService, ShareTokenError } from '../services/ShareTokenService.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

console.log('\n🧪 ShareTokenService 测试\n');

// 测试 1：普通文件生成与校验
{
  const fileId = 'test-file-001';
  const size = 50 * 1024 * 1024; // 50MB 普通文件
  const result = shareTokenService.generate(fileId, size);
  assert(result.sizeTier === 'normal', '普通文件 sizeTier 应为 normal');
  assert(result.shareToken.includes('.'), '令牌应包含分隔符');
  assert(result.downloadUrl.includes('/api/share/'), '下载 URL 应包含 /api/share/');

  const payload = shareTokenService.verify(result.shareToken);
  assert(payload.fileId === fileId, '校验后 fileId 应匹配');
  assert(payload.sizeTier === 'normal', '校验后 sizeTier 应为 normal');

  // 验证有效期约为 15 分钟
  const ttlMin = (result.expireAt - Date.now()) / 60000;
  assert(ttlMin > 14.9 && ttlMin < 15.1, `普通文件有效期应约 15 分钟（实际 ${ttlMin.toFixed(2)} 分钟）`);
}

// 测试 2：大文件生成与校验
{
  const fileId = 'test-file-002';
  const size = 200 * 1024 * 1024; // 200MB 大文件
  const result = shareTokenService.generate(fileId, size);
  assert(result.sizeTier === 'large', '大文件 sizeTier 应为 large');

  const payload = shareTokenService.verify(result.shareToken);
  assert(payload.sizeTier === 'large', '大文件校验后 sizeTier 应为 large');

  const ttlMin = (result.expireAt - Date.now()) / 60000;
  assert(ttlMin > 29.9 && ttlMin < 30.1, `大文件有效期应约 30 分钟（实际 ${ttlMin.toFixed(2)} 分钟）`);
}

// 测试 3：边界值（恰好 100MB → 大文件）
{
  const size = 100 * 1024 * 1024; // 恰好 100MB
  const result = shareTokenService.generate('boundary', size);
  assert(result.sizeTier === 'large', '100MB 应判定为大文件');
}

// 测试 4：篡改令牌 → 校验失败
{
  const result = shareTokenService.generate('test', 1000);
  // 篡改签名部分
  const [payloadStr] = result.shareToken.split('.');
  const tamperedToken = `${payloadStr}.invalid_signature_here`;
  try {
    shareTokenService.verify(tamperedToken);
    assert(false, '篡改签名的令牌应校验失败');
  } catch (err) {
    assert(err instanceof ShareTokenError, '篡改令牌应抛出 ShareTokenError');
  }
}

// 测试 5：过期令牌 → 校验失败
{
  // 手动构造一个已过期的令牌
  const crypto = await import('node:crypto');
  const config = (await import('../config/index.js')).config;
  const payload = {
    fileId: 'expired-file',
    expireAt: Date.now() - 1000, // 1 秒前过期
    sizeTier: 'normal' as const,
    nonce: crypto.randomUUID(),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const hmac = crypto.createHmac('sha256', config.share.secret);
  hmac.update(payloadStr, 'utf8');
  const signature = hmac.digest('base64url');
  const expiredToken = `${payloadStr}.${signature}`;

  try {
    shareTokenService.verify(expiredToken);
    assert(false, '过期令牌应校验失败');
  } catch (err) {
    const msg = (err as Error).message;
    assert(msg.includes('过期'), `过期令牌应提示已过期（实际: ${msg}）`);
  }
}

// 测试 6：格式错误的令牌
{
  try {
    shareTokenService.verify('malformed-token-without-separator');
    assert(false, '格式错误的令牌应校验失败');
  } catch (err) {
    assert(err instanceof ShareTokenError, '格式错误令牌应抛出 ShareTokenError');
  }
}

console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
