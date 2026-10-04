// Multi-Firm Tenant Isolation Automated Verification Suite
// Verifies strict database isolation across tenants via API Gateway (8089)

const GATEWAY_BASE = process.env.GATEWAY_BASE || 'http://localhost:8089';

const TENANT_A = '101';
const TENANT_B = '202';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  process.stdout.write(`  • ${name}... `);
  try {
    await fn();
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}`);
    failed++;
  }
}

async function runTenantTests() {
  console.log(`\n🔒 Starting Multi-Firm Tenant Isolation Verification Suite`);
  console.log(`Gateway: ${GATEWAY_BASE}`);
  console.log(`Tenant A: ${TENANT_A} | Tenant B: ${TENANT_B}\n`);

  let clientA_id, clientB_id;
  let productA_id, productB_id;
  let invoiceA_id, invoiceB_id;

  // 1. Create Client for Tenant A
  await check('Tenant A creates Client (Tenant A only)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A
      },
      body: JSON.stringify({
        name: 'Apex Industrial Corp',
        email: 'billing@apex.org',
        phone: '9888811111',
        gstin: '29AAAAA0000A1Z5',
        state: 'Karnataka'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.id) throw new Error('Client ID missing');
    clientA_id = data.id;
  });

  // 2. Create Client for Tenant B
  await check('Tenant B creates Client (Tenant B only)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_B
      },
      body: JSON.stringify({
        name: 'Zephyr Logistics LLC',
        email: 'accounts@zephyr.co',
        phone: '9777722222',
        gstin: '27BBBBB1111B2Z6',
        state: 'Maharashtra'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.id) throw new Error('Client ID missing');
    clientB_id = data.id;
  });

  // 3. Verify Client Isolation
  await check('Tenant A cannot see Tenant B Client & vice-versa', async () => {
    const resA = await fetch(`${GATEWAY_BASE}/api/v1/clients`, {
      headers: { 'X-Tenant-ID': TENANT_A }
    });
    const listA = await resA.json();
    const hasA_in_A = listA.some(c => c.id === clientA_id);
    const hasB_in_A = listA.some(c => c.id === clientB_id);
    if (!hasA_in_A) throw new Error('Tenant A cannot find its own client');
    if (hasB_in_A) throw new Error('ISOLATION LEAK: Tenant A can see Tenant B client!');

    const resB = await fetch(`${GATEWAY_BASE}/api/v1/clients`, {
      headers: { 'X-Tenant-ID': TENANT_B }
    });
    const listB = await resB.json();
    const hasB_in_B = listB.some(c => c.id === clientB_id);
    const hasA_in_B = listB.some(c => c.id === clientA_id);
    if (!hasB_in_B) throw new Error('Tenant B cannot find its own client');
    if (hasA_in_B) throw new Error('ISOLATION LEAK: Tenant B can see Tenant A client!');
  });

  // 4. Create Product for Tenant A
  await check('Tenant A creates Product (Inventory Service)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A
      },
      body: JSON.stringify({
        name: 'Apex Super Turbine T101',
        sellingPrice: 45000.0,
        purchasePrice: 32000.0,
        taxRate: 18.0,
        stock: 12,
        hsnCode: '8406'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.id) throw new Error('Product ID missing');
    productA_id = data.id;
  });

  // 5. Create Product for Tenant B
  await check('Tenant B creates Product (Inventory Service)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_B
      },
      body: JSON.stringify({
        name: 'Zephyr Cargo Drone Z202',
        sellingPrice: 85000.0,
        purchasePrice: 60000.0,
        taxRate: 18.0,
        stock: 5,
        hsnCode: '8802'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.id) throw new Error('Product ID missing');
    productB_id = data.id;
  });

  // 6. Verify Product Isolation
  await check('Tenant A cannot see Tenant B Product & vice-versa', async () => {
    const resA = await fetch(`${GATEWAY_BASE}/api/v1/products`, {
      headers: { 'X-Tenant-ID': TENANT_A }
    });
    const listA = await resA.json();
    const hasA_in_A = listA.some(p => p.id === productA_id);
    const hasB_in_A = listA.some(p => p.id === productB_id);
    if (!hasA_in_A) throw new Error('Tenant A cannot find its own product');
    if (hasB_in_A) throw new Error('ISOLATION LEAK: Tenant A can see Tenant B product!');

    const resB = await fetch(`${GATEWAY_BASE}/api/v1/products`, {
      headers: { 'X-Tenant-ID': TENANT_B }
    });
    const listB = await resB.json();
    const hasB_in_B = listB.some(p => p.id === productB_id);
    const hasA_in_B = listB.some(p => p.id === productA_id);
    if (!hasB_in_B) throw new Error('Tenant B cannot find its own product');
    if (hasA_in_B) throw new Error('ISOLATION LEAK: Tenant B can see Tenant A product!');
  });

  // 7. Create Invoice for Tenant A
  await check('Tenant A creates Bill / Tax Invoice', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_A
      },
      body: JSON.stringify({
        invoiceNumber: 'APEX/2026/001',
        type: 'tax-invoice',
        clientName: 'Apex Industrial Corp',
        clientId: clientA_id,
        subtotal: 45000.0,
        cgstAmount: 4050.0,
        sgstAmount: 4050.0,
        igstAmount: 0.0,
        totalAmount: 53100.0,
        status: 'unpaid',
        items: [{
          productId: productA_id,
          name: 'Apex Super Turbine T101',
          quantity: 1,
          price: 45000.0,
          cgstAmount: 4050.0,
          sgstAmount: 4050.0,
          igstAmount: 0.0,
          total: 53100.0
        }]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.id) throw new Error('Invoice ID missing');
    invoiceA_id = data.id;
  });

  // 8. Create Invoice for Tenant B
  await check('Tenant B creates Bill / Tax Invoice', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_B
      },
      body: JSON.stringify({
        invoiceNumber: 'ZEPHYR/2026/001',
        type: 'tax-invoice',
        clientName: 'Zephyr Logistics LLC',
        clientId: clientB_id,
        subtotal: 85000.0,
        cgstAmount: 7650.0,
        sgstAmount: 7650.0,
        igstAmount: 0.0,
        totalAmount: 100300.0,
        status: 'unpaid',
        items: [{
          productId: productB_id,
          name: 'Zephyr Cargo Drone Z202',
          quantity: 1,
          price: 85000.0,
          cgstAmount: 7650.0,
          sgstAmount: 7650.0,
          igstAmount: 0.0,
          total: 100300.0
        }]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.id) throw new Error('Invoice ID missing');
    invoiceB_id = data.id;
  });

  // 9. Verify Bill List Isolation
  await check('Tenant A cannot see Tenant B Bill & vice-versa', async () => {
    const resA = await fetch(`${GATEWAY_BASE}/api/v1/bills`, {
      headers: { 'X-Tenant-ID': TENANT_A }
    });
    const listA = await resA.json();
    const hasA_in_A = listA.some(b => b.id === invoiceA_id);
    const hasB_in_A = listA.some(b => b.id === invoiceB_id);
    if (!hasA_in_A) throw new Error('Tenant A cannot find its own bill');
    if (hasB_in_A) throw new Error('ISOLATION LEAK: Tenant A can see Tenant B bill in bills list!');

    const resB = await fetch(`${GATEWAY_BASE}/api/v1/bills`, {
      headers: { 'X-Tenant-ID': TENANT_B }
    });
    const listB = await resB.json();
    const hasB_in_B = listB.some(b => b.id === invoiceB_id);
    const hasA_in_B = listB.some(b => b.id === invoiceA_id);
    if (!hasB_in_B) throw new Error('Tenant B cannot find its own bill');
    if (hasA_in_B) throw new Error('ISOLATION LEAK: Tenant B can see Tenant A bill in bills list!');
  });

  // 10. Direct ID Access Isolation (Tenant A trying to fetch Tenant B's bill by ID)
  await check('Tenant A direct GET /bills/:id for Tenant B bill is forbidden/hidden', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/bills/${invoiceB_id}`, {
      headers: { 'X-Tenant-ID': TENANT_A }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id === invoiceB_id) {
        throw new Error('ISOLATION LEAK: Tenant A successfully accessed Tenant B bill by direct ID lookup!');
      }
    }
  });

  console.log('\n==================================================');
  console.log(`Tenant Isolation Summary: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  console.log('==================================================');

  if (failed > 0) process.exit(1);
}

runTenantTests().catch(err => {
  console.error('Fatal isolation test error:', err);
  process.exit(1);
});
