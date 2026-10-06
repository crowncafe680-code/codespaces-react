import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './RestaurantApp';
import StarterApp from './App';

const loginAsOwner = async () => {
  fireEvent.change(screen.getByLabelText('رمز الدخول'), { target: { value: '6026' } });
  fireEvent.click(screen.getByRole('button', { name: 'دخول' }));
  fireEvent.click(screen.getByRole('button', { name: 'المنيو' }));
  fireEvent.change(screen.getByPlaceholderText('اسم الصنف'), { target: { value: 'Beef Burger' } });
  fireEvent.change(screen.getByPlaceholderText('السعر'), { target: { value: '250' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الصنف' }));
};

const loginAsCashier = async () => {
  fireEvent.change(screen.getByLabelText('رمز الدخول'), { target: { value: '2233' } });
  fireEvent.click(screen.getByRole('button', { name: 'دخول' }));
};

test('rejects an incorrect PIN and requires exactly four digits', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('رمز الدخول'), { target: { value: '0000' } });
  fireEvent.click(screen.getByRole('button', { name: 'دخول' }));
  expect(screen.getByText('الرمز غير صحيح')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'الفريق' })).toBeNull();

  const pinInput = screen.getByLabelText('رمز الدخول');
  expect(pinInput.maxLength).toBe(4);
  expect(pinInput.pattern).toBe('[0-9]{4}');
});

test('shows the original React App screen at the browser root', () => {
  window.history.replaceState({}, '', '/');
  render(<StarterApp />);

  expect(screen.getByText(/GitHub Codespaces/)).toBeDefined();
  expect(screen.getByRole('link', { name: 'تعلّم React' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'فتح نظام المطعم' }).getAttribute('href')).toBe('/restaurant');
});

test('keeps the restaurant app available at its dedicated route', () => {
  window.history.replaceState({}, '', '/restaurant');
  render(<StarterApp />);
  expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeDefined();
  expect(screen.getByLabelText('رمز الدخول')).toBeDefined();
});

test('shows 30 restaurant tables while preserving saved table statuses', async () => {
  window.localStorage.clear();
  window.localStorage.setItem('restaurant-pos-v4-tables', JSON.stringify([
    { id: 'T1', status: 'Available' },
    { id: 'T2', status: 'Occupied', orderId: 42 },
    { id: 'T3', status: 'Ready' },
    { id: 'T4', status: 'Available' },
    { id: 'T5', status: 'Available' },
    { id: 'T6', status: 'Available' },
  ]));
  render(<App />);
  await loginAsOwner();
  fireEvent.click(screen.getByRole('button', { name: 'الطاولات' }));

  expect(screen.getByRole('heading', { name: 'T30' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'T31' })).toBeNull();
  expect(screen.getByText('طلب رقم #42')).toBeDefined();
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-tables'))).toHaveLength(30);
});

test('renders restaurant management dashboard and cashier', async () => {
  render(<App />);
  await loginAsOwner();

  expect(screen.getAllByText(/لوحة التحكم/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/الكاشير/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/المنيو/i).length).toBeGreaterThan(0);
});

test('cashier sessions do not expose manager-only team or invoice controls', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsCashier();

  expect(screen.queryByRole('button', { name: 'الفريق' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'التقارير' })).toBeNull();
});

test('shows the sales report immediately after completing a clean order', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الكاشير' }));
  fireEvent.click(screen.getByRole('button', { name: /برجر لحم/ }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ المستلم'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'إتمام ودفع' }));

  expect(screen.getByRole('heading', { name: 'التقارير' })).toBeDefined();
  expect(screen.getByText('إجمالي المبيعات')).toBeDefined();
  expect(screen.getAllByText(/٢٥٠|250/).length).toBeGreaterThan(0);
  expect(screen.queryByText('الضريبة')).toBeNull();
});

test('charges exactly BDT 35 for a BDT 35 product with no tax applied', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'المنيو' }));
  fireEvent.change(screen.getByPlaceholderText('اسم الصنف'), { target: { value: 'Item35' } });
  fireEvent.change(screen.getByPlaceholderText('السعر'), { target: { value: '35' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الصنف' }));
  fireEvent.click(screen.getByRole('button', { name: 'الكاشير' }));
  fireEvent.click(screen.getByRole('button', { name: /Item35/ }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ المستلم'), { target: { value: '35' } });
  fireEvent.click(screen.getByRole('button', { name: 'إتمام ودفع' }));

  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-orders'))[0].total).toBe(35);
  expect(screen.getByText('إجمالي المبيعات').nextSibling.textContent).toBe('৳35');
});

test('cancels an order and removes it from sales immediately', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الكاشير' }));
  fireEvent.click(screen.getByRole('button', { name: /برجر لحم/ }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ المستلم'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'إتمام ودفع' }));
  fireEvent.click(screen.getByRole('button', { name: 'المطبخ' }));
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء الطلب' }));

  expect(screen.getByRole('heading', { name: 'التقارير' })).toBeDefined();
  expect(screen.getByText('الطلبات الملغاة')).toBeDefined();
  expect(screen.getByText(/إجمالي المبيعات/)).toBeDefined();
});

test('closes the order and frees the table after serving', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الكاشير' }));
  fireEvent.click(screen.getByRole('button', { name: /برجر لحم/ }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ المستلم'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'إتمام ودفع' }));
  fireEvent.click(screen.getByRole('button', { name: 'المطبخ' }));
  fireEvent.click(screen.getByRole('button', { name: 'تم التقديم' }));

  expect(screen.getByText(/تم إغلاق الطلب/)).toBeDefined();
  expect(screen.queryByRole('button', { name: 'إلغاء الطلب' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'الطاولات' }));
  expect(screen.getAllByText('فارغة').length).toBeGreaterThan(0);
});

test('provides historical report date controls', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'التقارير' }));
  expect(screen.getByRole('button', { name: 'الأمس' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'هذا الشهر' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'الشهر السابق' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'الأمس' }));
  expect(screen.getByText(/الفترة المحددة:/)).toBeDefined();
});

test('updates the report view immediately after closing a shift', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'فتح الشفت' }));
  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق الشفت وحفظ الفرق' }));

  expect(screen.getByRole('heading', { name: 'التقارير' })).toBeDefined();
  expect(screen.getByText(/الفترة المحددة:/)).toBeDefined();
});

test('starts a fresh shift after closing the previous one', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'فتح الشفت' }));
  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق الشفت وحفظ الفرق' }));
  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '800' } });
  fireEvent.click(screen.getByRole('button', { name: 'فتح الشفت' }));
  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));

  expect(screen.getByText('رصيد بداية الشفت').nextSibling.textContent).toMatch(/800|٨٠٠/);
  expect(screen.getByText('سجل الشفتات السابقة')).toBeDefined();
});

test('keeps an unpaid order pending until payment is collected', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الكاشير' }));
  fireEvent.click(screen.getByRole('button', { name: /برجر لحم/ }));
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الطلب معلقًا' }));
  expect(screen.getByRole('heading', { name: 'شاشة المطبخ' })).toBeDefined();
  expect(screen.getByText('بانتظار الدفع')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'استلام الدفع' }));
  expect(screen.getByRole('heading', { name: 'التقارير' })).toBeDefined();
});

test('refreshes dashboard metrics for the newly opened shift', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'فتح الشفت' }));

  expect(screen.getByRole('heading', { name: 'لوحة التحكم' })).toBeDefined();
  expect(screen.getByText('عدد الطلبات').nextSibling.textContent).toMatch(/0/);
  expect(screen.getByText('مبيعات اليوم').nextSibling.textContent).toMatch(/٠|0/);
});

test('keeps the latest closed shift results visible', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'فتح الشفت' }));
  fireEvent.click(screen.getByRole('button', { name: 'الشفتات وإغلاق اليوم' }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق الشفت وحفظ الفرق' }));

  expect(screen.getByText('آخر شفت مغلق')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'لوحة التحكم' }));
  expect(screen.getByText('نتائج آخر شفت مغلق')).toBeDefined();
});

test('saves and edits employee details and rejects partner shares above 100 percent', async () => {
  window.localStorage.clear();
  const { unmount } = render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الفريق' }));
  fireEvent.change(screen.getByLabelText('اسم الشخص'), { target: { value: 'سارة' } });
  fireEvent.change(screen.getByLabelText('الراتب الشهري'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('المبلغ المستلم'), { target: { value: '300' } });
  fireEvent.change(screen.getByLabelText('السلفة'), { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الشخص' }));

  expect(screen.getByText('سارة')).toBeDefined();
  expect(screen.getByText('৳650')).toBeDefined();
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-team'))[0].name).toBe('سارة');

  unmount();
  render(<App />);
  await loginAsOwner();
  fireEvent.click(screen.getByRole('button', { name: 'الفريق' }));
  expect(screen.getByText('سارة')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
  fireEvent.change(screen.getByLabelText('اسم الشخص'), { target: { value: 'سارة أحمد' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  expect(screen.getByText('سارة أحمد')).toBeDefined();

  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
  expect(screen.queryByText('سارة أحمد')).toBeNull();
  expect(confirm).toHaveBeenCalled();
  confirm.mockRestore();

  fireEvent.change(screen.getByLabelText('نوع الشخص'), { target: { value: 'partner' } });
  fireEvent.change(screen.getByLabelText('اسم الشخص'), { target: { value: 'الشريك الأول' } });
  fireEvent.change(screen.getByLabelText('نسبة الشركة'), { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الشخص' }));
  fireEvent.change(screen.getByLabelText('نوع الشخص'), { target: { value: 'partner' } });
  fireEvent.change(screen.getByLabelText('اسم الشخص'), { target: { value: 'الشريك الثاني' } });
  fireEvent.change(screen.getByLabelText('نسبة الشركة'), { target: { value: '45' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الشخص' }));
  expect(screen.getByRole('alert').textContent).toMatch(/100/);
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-team')).filter((person) => person.type === 'partner')).toHaveLength(1);
});

test('deleting a paid invoice confirms, reverses stock and sales, and records an audit entry', async () => {
  window.localStorage.clear();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'الفريق' }));
  fireEvent.change(screen.getByLabelText('اسم الشخص'), { target: { value: 'شريك الاختبار' } });
  fireEvent.change(screen.getByLabelText('نوع الشخص'), { target: { value: 'partner' } });
  fireEvent.change(screen.getByLabelText('نسبة الشركة'), { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الشخص' }));

  fireEvent.click(screen.getByRole('button', { name: 'المخزون' }));
  fireEvent.change(screen.getByPlaceholderText('اسم المادة'), { target: { value: 'Bread' } });
  fireEvent.change(screen.getByPlaceholderText('الكمية الحالية'), { target: { value: '10' } });
  fireEvent.change(screen.getByPlaceholderText('الحد الأدنى'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المادة' }));

  fireEvent.click(screen.getByRole('button', { name: 'الكاشير' }));
  fireEvent.click(screen.getByRole('button', { name: /برجر لحم/ }));
  fireEvent.change(screen.getByPlaceholderText('المبلغ المستلم'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'إتمام ودفع' }));
  expect(screen.getByRole('button', { name: 'حذف الفاتورة #1' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'لوحة التحكم' }));
  expect(screen.getByText('شريك الاختبار')).toBeDefined();
  expect(screen.getByText('৳125')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'التقارير' }));

  fireEvent.click(screen.getByRole('button', { name: 'حذف الفاتورة #1' }));
  expect(confirm).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'حذف الفاتورة #1' })).toBeNull();
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-orders'))).toHaveLength(0);
  expect(screen.getByText('إجمالي المبيعات').nextSibling.textContent).toBe('৳0');

  fireEvent.click(screen.getByRole('button', { name: 'المخزون' }));
  expect(screen.getByText('خبز').nextSibling.textContent).toBe('10');
  fireEvent.click(screen.getByRole('button', { name: 'لوحة التحكم' }));
  expect(screen.getByText('شريك الاختبار')).toBeDefined();
  expect(screen.getAllByText('৳0').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'سجل العمليات' }));
  expect(screen.getByText('حذف فاتورة')).toBeDefined();
  confirm.mockRestore();
});

test('adds a new purchase ingredient directly to inventory and preserves zero stock inputs', async () => {
  window.localStorage.clear();
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'المخزون' }));
  fireEvent.change(screen.getByPlaceholderText('الكمية الحالية'), { target: { value: '0' } });
  fireEvent.change(screen.getByPlaceholderText('الحد الأدنى'), { target: { value: '0' } });
  fireEvent.change(screen.getByPlaceholderText('اسم المادة'), { target: { value: 'Dairy' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المادة' }));
  expect(screen.getByText('Dairy')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'المشتريات' }));
  fireEvent.change(screen.getByLabelText('مادة الشراء'), { target: { value: 'Rice' } });
  fireEvent.change(screen.getByPlaceholderText('الكمية'), { target: { value: '2' } });
  fireEvent.change(screen.getByPlaceholderText('إجمالي الفاتورة'), { target: { value: '35' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الشراء وزيادة المخزون' }));

  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-inventory')).find((item) => item.name === 'Rice').qty).toBe(2);
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-purchases'))[0].total).toBe(35);
});

test('managers can delete menu items while cashiers can remove items from the cart', async () => {
  window.localStorage.clear();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const { unmount } = render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'حذف برجر لحم من المنيو' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-products'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'سجل العمليات' }));
  expect(screen.getByText('حذف صنف من المنيو')).toBeDefined();
  expect(confirm).toHaveBeenCalled();
  unmount();

  window.localStorage.clear();
  window.localStorage.setItem('restaurant-pos-v4-products', JSON.stringify([{
    id: 'cashier-product',
    name: 'Chicken Burger',
    category: 'Burgers',
    price: 100,
    cost: 25,
    image: '🍔',
    recipe: {},
  }]));
  render(<App />);
  await loginAsCashier();
  expect(screen.queryByRole('button', { name: 'المنيو' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'الكاشير' }));
  fireEvent.click(screen.getByRole('button', { name: /برجر دجاج/ }));
  expect(screen.getByText(/× 1/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'حذف برجر دجاج من السلة' }));
  expect(screen.getByText('لا توجد أصناف في السلة')).toBeDefined();
  confirm.mockRestore();
});

test('inventory edits, purchase and expense cancellations, and waste stock adjustments stay consistent', async () => {
  window.localStorage.clear();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<App />);
  await loginAsOwner();

  fireEvent.click(screen.getByRole('button', { name: 'المخزون' }));
  fireEvent.change(screen.getByPlaceholderText('اسم المادة'), { target: { value: 'Potato' } });
  fireEvent.change(screen.getByPlaceholderText('الكمية الحالية'), { target: { value: '5' } });
  fireEvent.change(screen.getByPlaceholderText('الحد الأدنى'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المادة' }));
  fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
  fireEvent.change(screen.getByPlaceholderText('الكمية الحالية'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-inventory')).find((item) => item.name === 'Potato').qty).toBe(6);

  fireEvent.click(screen.getByRole('button', { name: 'الهالك والتالف' }));
  fireEvent.change(screen.getByLabelText('مادة الهالك'), { target: { value: 'Potato' } });
  fireEvent.change(screen.getByLabelText('كمية الهالك'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ وخصم من المخزون' }));
  expect(screen.getByRole('alert').textContent).toMatch(/لا تتجاوز رصيد المخزون/);
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-waste-logs'))).toHaveLength(0);

  fireEvent.change(screen.getByLabelText('كمية الهالك'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ وخصم من المخزون' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-inventory')).find((item) => item.name === 'Potato').qty).toBe(4);
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-inventory')).find((item) => item.name === 'Potato').qty).toBe(6);

  fireEvent.click(screen.getByRole('button', { name: 'المشتريات' }));
  fireEvent.change(screen.getByLabelText('مادة الشراء'), { target: { value: 'Rice' } });
  fireEvent.change(screen.getByPlaceholderText('الكمية'), { target: { value: '2' } });
  fireEvent.change(screen.getByPlaceholderText('إجمالي الفاتورة'), { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الشراء وزيادة المخزون' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-inventory')).find((item) => item.name === 'Rice').qty).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-inventory')).find((item) => item.name === 'Rice').qty).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'المخزون' }));
  const riceRow = screen.getByRole('row', { name: /Rice/ });
  fireEvent.click(within(riceRow).getByRole('button', { name: 'حذف' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-inventory')).some((item) => item.name === 'Rice')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'المصروفات' }));
  fireEvent.change(screen.getByPlaceholderText('اسم المصروف'), { target: { value: 'إيجار' } });
  fireEvent.change(screen.getByPlaceholderText('المبلغ'), { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المصروف وتحديث الأرباح' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-expenses'))[0].amount).toBe(200);
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
  expect(JSON.parse(window.localStorage.getItem('restaurant-pos-v4-expenses'))[0].cancelled).toBe(true);
  expect(confirm).toHaveBeenCalled();
  confirm.mockRestore();
});
