import { expect, test, vi } from 'vitest';
import { getEmployeeSession } from './restaurantAuth';

const createClient = (result) => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(result),
      }),
    }),
  }),
});

test('loads the authenticated employee role from the protected profile', async () => {
  const client = createClient({
    data: { full_name: 'Manager', role: 'manager', active: true },
    error: null,
  });

  await expect(getEmployeeSession(client, { id: 'auth-user-id', email: 'manager@example.com' }))
    .resolves.toEqual({
      id: 'auth-user-id',
      name: 'Manager',
      role: 'manager',
      email: 'manager@example.com',
    });
  expect(client.from).toHaveBeenCalledWith('employees');
});

test('rejects missing and disabled employee profiles', async () => {
  for (const data of [null, { full_name: 'Inactive', role: 'cashier', active: false }]) {
    await expect(getEmployeeSession(createClient({ data, error: null }), { id: 'auth-user-id' }))
      .rejects.toThrow('هذا الحساب غير مفعّل');
  }
});

test('rejects unsupported roles and reports profile lookup failures', async () => {
  await expect(getEmployeeSession(
    createClient({ data: { full_name: 'Unknown', role: 'root', active: true }, error: null }),
    { id: 'auth-user-id' },
  )).rejects.toThrow('صلاحية الحساب غير معروفة');

  await expect(getEmployeeSession(
    createClient({ data: null, error: new Error('database unavailable') }),
    { id: 'auth-user-id' },
  )).rejects.toThrow('database unavailable');
});
