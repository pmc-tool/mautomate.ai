const { Pool } = require('pg')
require('dotenv').config({ path: '/home/ratul/brandtodoor/apps/backend/.env' })

const TENANT_ID = 'concurrent_burn_test_' + Date.now()
const INITIAL_BALANCE = 1000
const RESERVE_AMOUNT = 20
const WORKERS = 200

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 50 })

  // Ensure test wallet
  await pool.query(
    `INSERT INTO credit_wallet (id, tenant_id, balance, reserved, currency)
     VALUES ($1, $2, $3, 0, 'credit')
     ON CONFLICT (tenant_id) WHERE deleted_at IS NULL
     DO UPDATE SET balance = $3, reserved = 0, deleted_at = NULL`,
    [`cw_${TENANT_ID}`, TENANT_ID, INITIAL_BALANCE]
  )

  // Clean old transactions for this tenant
  await pool.query(`DELETE FROM credit_transaction WHERE tenant_id = $1`, [TENANT_ID])

  console.log(`Starting ${WORKERS} concurrent reserves of ${RESERVE_AMOUNT} credits against balance ${INITIAL_BALANCE}`)
  const start = Date.now()

  const results = await Promise.all(
    Array.from({ length: WORKERS }, (_, i) =>
      burnAtomic(pool, TENANT_ID, RESERVE_AMOUNT, `r_${i}_${Date.now()}`)
    )
  )

  const elapsed = Date.now() - start
  const successful = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  const { rows: [wallet] } = await pool.query(
    `SELECT balance, reserved FROM credit_wallet WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [TENANT_ID]
  )

  const { rows: txRows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total_reserved FROM credit_transaction WHERE tenant_id = $1 AND type = 'reserve'`,
    [TENANT_ID]
  )

  const totalReserved = Math.abs(Number(txRows[0].total_reserved))
  const expectedSuccessful = Math.floor(INITIAL_BALANCE / RESERVE_AMOUNT)
  const expectedBalance = 0
  const expectedReserved = 0

  console.log({
    tenant: TENANT_ID,
    workers: WORKERS,
    successful,
    failed,
    elapsed_ms: elapsed,
    wallet_balance: Number(wallet.balance),
    wallet_reserved: Number(wallet.reserved),
    ledger_total_reserved: totalReserved,
    expected_successful: expectedSuccessful,
    expected_balance: expectedBalance,
    expected_reserved: expectedReserved,
  })

  const passed =
    successful === expectedSuccessful &&
    Number(wallet.balance) === expectedBalance &&
    Number(wallet.reserved) === expectedReserved &&
    totalReserved === successful * RESERVE_AMOUNT

  if (!passed) {
    console.error('FAILED: concurrent burn test detected double-spend or mismatch')
    process.exitCode = 1
  } else {
    console.log('PASSED: atomic reserve gate prevented overdraft under concurrent load')
  }

  // Cleanup
  await pool.query(`DELETE FROM credit_transaction WHERE tenant_id = $1`, [TENANT_ID])
  await pool.query(`DELETE FROM credit_wallet WHERE tenant_id = $1`, [TENANT_ID])
  await pool.end()
}

async function burnAtomic(pool, tenantId, amount, reservationId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `UPDATE credit_wallet
          SET balance = balance - $1, reserved = reserved + $1
        WHERE tenant_id = $2 AND deleted_at IS NULL AND balance >= $1
        RETURNING id`,
      [amount, tenantId]
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return { ok: false }
    }
    const { rows: walletRows } = await client.query(
      `SELECT balance FROM credit_wallet WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId]
    )
    await client.query(
      `INSERT INTO credit_transaction (id, tenant_id, type, amount, balance_after, reservation_id, idempotency_key, action, meta)
       VALUES ($1, $2, 'reserve', $3, $4, $5, $6, 'ai_call_minute', NULL)`,
      [`ctxn_r_${reservationId}`, tenantId, -amount, walletRows[0].balance, reservationId, `idem_${reservationId}`]
    )
    // Commit the burn immediately: move reserved back to 0, balance stays down.
    await client.query(
      `UPDATE credit_wallet
          SET reserved = reserved - $1
        WHERE tenant_id = $2 AND deleted_at IS NULL`,
      [amount, tenantId]
    )
    await client.query(
      `INSERT INTO credit_transaction (id, tenant_id, type, amount, balance_after, reservation_id, idempotency_key, action, meta)
       VALUES ($1, $2, 'commit', $3, $4, $5, $6, 'ai_call_minute', NULL)`,
      [`ctxn_c_${reservationId}`, tenantId, 0, walletRows[0].balance, reservationId, `idem_commit_${reservationId}`]
    )
    await client.query('COMMIT')
    return { ok: true }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
