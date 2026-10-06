const allowedRoles = new Set(['owner', 'manager', 'cashier', 'waiter', 'kitchen']);

export const getEmployeeSession = async (client, user) => {
  const { data: employee, error } = await client
    .from('employees')
    .select('full_name, role, active')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!employee || !employee.active) {
    throw new Error('هذا الحساب غير مفعّل لدى المطعم. تواصل مع المدير.');
  }
  if (!allowedRoles.has(employee.role)) {
    throw new Error('صلاحية الحساب غير معروفة. تواصل مع المدير.');
  }
  return {
    id: user.id,
    name: employee.full_name,
    role: employee.role,
    email: user.email,
  };
};
