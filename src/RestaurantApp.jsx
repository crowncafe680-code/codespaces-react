import './RestaurantApp.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { getEmployeeSession } from './lib/restaurantAuth';

const initialProducts = [];
const initialInventory = [];

const initialTables = Array.from({ length: 30 }, (_, index) => ({
  id: `T${index + 1}`,
  status: 'Available',
}));

const initialOrders = [];

const initialExpenses = [];

const initialPurchases = [];
const initialTeam = [];
const getLocalDate = () => new Date().toISOString().slice(0, 10);
const initialShift = { id: null, status: 'closed', openingCash: 0, openedAt: null, closedAt: null, closingCash: null, date: getLocalDate() };
const pinUsers = [
  { id: 'manager', name: 'M22', role: 'manager', pin: '6026' },
  { id: 'cashier', name: 'crown', role: 'cashier', pin: '2233' },
];

const tabs = ['dashboard', 'cashier', 'tables', 'menu', 'inventory', 'purchases', 'expenses', 'kitchen', 'reports', 'shifts'];
const paymentMethods = ['نقد', 'بطاقة', 'bKash', 'Nagad'];
const kitchenStatuses = ['New', 'Preparing', 'Ready', 'Served'];
const categoryLabels = { Burgers: 'برجر', Main: 'أطباق رئيسية', Sides: 'إضافات', Drinks: 'مشروبات' };
const productLabels = { 'Beef Burger': 'برجر لحم', 'Chicken Burger': 'برجر دجاج', 'Chicken Shawarma': 'شاورما دجاج', Pepsi: 'بيبسي', 'Mango Juice': 'عصير مانجو', 'French Fries': 'بطاطس مقلية' };
const inventoryLabels = { Bread: 'خبز', Beef: 'لحم', Chicken: 'دجاج', Sauce: 'صلصة', Potato: 'بطاطس', Oil: 'زيت', CarbonatedDrink: 'مشروبات غازية', Juice: 'عصير' };
const unitLabels = { KG: 'كجم', Liter: 'لتر', Piece: 'قطعة', Case: 'كرتون' };
const statusLabels = { New: 'جديد', Preparing: 'قيد التحضير', Ready: 'جاهز', Served: 'تم التقديم', Cancelled: 'ملغى' };
const serviceLabels = { 'Dine-in': 'داخل المطعم', Takeaway: 'استلام', Delivery: 'توصيل' };

const formatCurrency = (value) =>
  `৳${new Intl.NumberFormat('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value || 0)}`;

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeText = (value = '') => value.toLocaleLowerCase('ar').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
const translateProduct = (name) => productLabels[name] || name;
const translateCategory = (category) => categoryLabels[category] || category;
const translateInventory = (name) => inventoryLabels[name] || name;
const isDateInRange = (date, start, end) => Boolean(date && date >= start && date <= end);

const loadSavedState = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(`restaurant-pos-v4-${key}`);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const loadSavedList = (key, fallback) => {
  const value = loadSavedState(key, fallback);
  return Array.isArray(value) ? value : fallback;
};

const loadTables = () => {
  const savedTables = loadSavedList('tables', initialTables);
  const savedTablesById = new Map(savedTables.map((table) => [table.id, table]));
  return initialTables.map((table) => savedTablesById.get(table.id) || table);
};

function App() {
  const [language, setLanguage] = useState(() => loadSavedState('language', 'ar'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState(() => loadSavedList('products', initialProducts));
  const [inventory, setInventory] = useState(() => loadSavedList('inventory', initialInventory));
  const [orders, setOrders] = useState(() => loadSavedList('orders', initialOrders));
  const [expenses, setExpenses] = useState(() => loadSavedList('expenses', initialExpenses));
  const [purchases, setPurchases] = useState(() => loadSavedList('purchases', initialPurchases));
  const [team, setTeam] = useState(() => loadSavedList('team', initialTeam));
  const [tables, setTables] = useState(loadTables);
  const [shift, setShift] = useState(() => loadSavedState('shift', initialShift));
  const [shiftHistory, setShiftHistory] = useState(() => loadSavedList('shift-history', []));
  const [auditLogs, setAuditLogs] = useState(() => loadSavedList('audit-logs', []));
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const authRequest = useRef(0);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [reportStartDate, setReportStartDate] = useState(getLocalDate());
  const [reportEndDate, setReportEndDate] = useState(getLocalDate());
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [selectedTable, setSelectedTable] = useState('T1');
  const [serviceType, setServiceType] = useState('Dine-in');
  const [paymentMethod, setPaymentMethod] = useState('نقد');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState(0);
  const [orderCounter, setOrderCounter] = useState(() => (
    loadSavedList('orders', initialOrders).reduce((nextId, order) => Math.max(nextId, Number(order.id) + 1), 1)
  ));
  const [teamForm, setTeamForm] = useState({ name: '', type: 'employee', salary: '', received: '', advance: '', invested: '', percentage: '' });
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [teamError, setTeamError] = useState('');
  const [newMenuItem, setNewMenuItem] = useState({ name: '', category: 'Burgers', price: '', cost: '' });
  const [newPurchase, setNewPurchase] = useState({ ingredient: '', quantity: '', unit: 'KG', total: '', supplier: '', date: getLocalDate(), paid: '' });
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'مصاريف تشغيل', date: getLocalDate(), notes: '' });
  const [newInventoryItem, setNewInventoryItem] = useState({ name: '', unit: 'KG', qty: '', min: '', cost: '', supplier: '' });
  const [editingInventoryId, setEditingInventoryId] = useState(null);
  const [wasteLogs, setWasteLogs] = useState(() => loadSavedList('waste-logs', []));
  const [newWaste, setNewWaste] = useState({ ingredient: '', quantity: '', reason: 'تالف' });
  const [shiftCashInput, setShiftCashInput] = useState('');
  const [shiftDate, setShiftDate] = useState(getLocalDate());
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [operationError, setOperationError] = useState('');

  const t = (arabic, english) => language === 'ar' ? arabic : english;

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;
    let active = true;
    let loadRequest = 0;

    const loadEmployeeSession = async (authSession) => {
      const request = ++loadRequest;
      setAuthReady(false);
      setAuthError('');
      try {
        const employeeSession = await getEmployeeSession(supabase, authSession.user);
        if (active && request === loadRequest) {
          setSession(employeeSession);
        }
      } catch (error) {
        let message = error.message || 'تعذر التحقق من صلاحية الحساب.';
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) message += ` تعذر إنهاء الجلسة: ${signOutError.message}`;
        if (active && request === loadRequest) {
          setSession(null);
          setAuthError(message);
        }
      } finally {
        if (active && request === loadRequest) setAuthReady(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (authSession && ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        window.setTimeout(() => {
          if (active) void loadEmployeeSession(authSession);
        }, 0);
      } else if (!authSession) {
        loadRequest += 1;
        setSession(null);
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const savedState = { language, products, inventory, orders, expenses, purchases, team, tables, shift, 'shift-history': shiftHistory, 'audit-logs': auditLogs, 'waste-logs': wasteLogs };
    Object.entries(savedState).forEach(([key, value]) => window.localStorage.setItem(`restaurant-pos-v4-${key}`, JSON.stringify(value)));
  }, [language, products, inventory, orders, expenses, purchases, team, tables, shift, shiftHistory, auditLogs, wasteLogs]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const writeAudit = (action, details = {}) => {
    setAuditLogs((previous) => [{
      id: Date.now(),
      action,
      employee: session?.name || 'غير مسجل',
      role: session?.role || 'unknown',
      timestamp: new Date().toLocaleString('ar-SA'),
      details,
    }, ...previous]);
  };

  const loginWithPin = (event) => {
    event.preventDefault();
    const user = pinUsers.find((candidate) => candidate.pin === pinInput);
    if (!user) {
      setPinError('الرمز غير صحيح');
      setPinInput('');
      return;
    }
    setSession(user);
    setPinInput('');
    setPinError('');
  };

  const loginWithPassword = async (event) => {
    event.preventDefault();
    if (!supabase || authBusy) return;
    setAuthBusy(true);
    setAuthError('');
    const request = ++authRequest.current;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });
      if (error) throw error;
      if (request === authRequest.current) setAuthPassword('');
    } catch (error) {
      if (request === authRequest.current) setAuthError(error.message || 'تعذر تسجيل الدخول.');
    } finally {
      if (request === authRequest.current) setAuthBusy(false);
    }
  };

  const lockScreen = async () => {
    writeAudit('قفل الشاشة');
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setOperationError(`تعذر تسجيل الخروج: ${error.message}`);
        return;
      }
    } else {
      setSession(null);
      setPinInput('');
    }
  };

  const canManage = ['owner', 'manager'].includes(session?.role);
  const visibleTabs = canManage ? [...tabs, 'team', 'waste', 'audit'] : ['dashboard', 'cashier', 'tables', 'kitchen'];
  const tabLabels = {
    dashboard: t('لوحة التحكم', 'Dashboard'), cashier: t('الكاشير', 'Cashier'), tables: t('الطاولات', 'Tables'), menu: t('المنيو', 'Menu'), inventory: t('المخزون', 'Inventory'), purchases: t('المشتريات', 'Purchases'), expenses: t('المصروفات', 'Expenses'), kitchen: t('المطبخ', 'Kitchen'), reports: t('التقارير', 'Reports'), shifts: t('الشفتات وإغلاق اليوم', 'Shifts & Closing'), team: t('الفريق', 'Team'), waste: t('الهالك والتالف', 'Waste'), audit: t('سجل العمليات', 'Audit Log'),
  };
  const latestClosedShift = shiftHistory.length ? shiftHistory[shiftHistory.length - 1] : null;

  const categories = ['الكل', ...new Set(products.map((item) => item.category))];

  const dashboardStats = useMemo(() => {
    const scopedOrders = activeTab === 'reports'
      ? orders.filter((order) => isDateInRange(order.date, reportStartDate, reportEndDate))
      : shift.status === 'open'
        ? orders.filter((order) => order.shiftId === shift.id)
        : orders.filter((order) => !order.shiftId);
    const activeOrders = scopedOrders.filter((order) => order.status !== 'Cancelled');
    const paidOrders = activeOrders.filter((order) => order.paymentStatus !== 'pending');
    const pendingPaymentOrders = activeOrders.filter((order) => order.paymentStatus === 'pending');
    const totalSales = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const servedOrders = activeOrders.filter((order) => order.status === 'Served').length;
    const pendingOrders = activeOrders.filter((order) => order.status !== 'Served').length;
    const cancelledOrders = scopedOrders.filter((order) => order.status === 'Cancelled').length;
    const scopedExpenses = activeTab === 'reports'
      ? expenses.filter((item) => !item.cancelled && isDateInRange(item.date, reportStartDate, reportEndDate))
      : shift.status === 'open'
        ? expenses.filter((item) => !item.cancelled && item.shiftId === shift.id)
        : [];
    const totalExpenses = scopedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const currentShiftOrders = shift?.id ? activeOrders.filter((order) => order.shiftId === shift.id) : activeOrders;
    const cashSales = currentShiftOrders.filter((order) => order.paymentStatus !== 'pending' && order.payment === 'نقد').reduce((sum, order) => sum + order.total, 0);
    const expectedCash = Number(shift?.openingCash || 0) + cashSales - totalExpenses;

    const foodCost = paidOrders.reduce((sum, order) => {
      const itemCost = order.items.reduce((subTotal, item) => {
        const product = products.find((p) => p.name === item.name);
        return subTotal + (Number(item.cost ?? product?.cost ?? 0) * (item.qty || 0));
      }, 0);
      return sum + itemCost;
    }, 0);

    const salesByPayment = paymentMethods.reduce((acc, method) => {
      acc[method] = paidOrders.filter((order) => order.payment === method).reduce((sum, order) => sum + order.total, 0);
      return acc;
    }, {});

    const itemCounts = paidOrders.flatMap((order) => order.items).reduce((acc, item) => {
      acc[item.name] = (acc[item.name] || 0) + item.qty;
      return acc;
    }, {});

    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const lowStock = inventory.filter((item) => item.qty <= item.min);

    return {
      totalSales,
      totalOrders: activeOrders.length,
      paidOrders: paidOrders.length,
      pendingPaymentOrders,
      cancelledOrders,
      servedOrders,
      pendingOrders,
      totalExpenses,
      cashSales,
      expectedCash,
      foodCost,
      netProfit: totalSales - foodCost - totalExpenses,
      salesByPayment,
      topItems,
      lowStock,
      occupiedTables: tables.filter((table) => table.status !== 'Available').length,
      freeTables: tables.filter((table) => table.status === 'Available').length,
    };
  }, [activeTab, orders, expenses, products, inventory, tables, reportStartDate, reportEndDate, shift, dashboardRefresh]);

  const totalProfit = useMemo(() => {
    const paidOrders = orders.filter((order) => order.status !== 'Cancelled' && order.paymentStatus !== 'pending');
    const totalSales = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const foodCost = paidOrders.reduce((sum, order) => sum + order.items.reduce((itemTotal, item) => (
      itemTotal + Number(item.cost ?? products.find((product) => product.name === item.name)?.cost ?? 0) * Number(item.qty || 0)
    ), 0), 0);
    const totalExpenses = expenses.filter((expense) => !expense.cancelled)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    return totalSales - foodCost - totalExpenses;
  }, [orders, expenses, products]);

  const availableProducts = products.filter((item) => item.available !== false);
  const filteredProducts = selectedCategory === 'الكل' ? availableProducts : availableProducts.filter((item) => item.category === selectedCategory);

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const safeDiscount = Math.min(100, Math.max(0, Number(discount) || 0));
  const cartDiscount = roundCurrency(cartSubtotal * (safeDiscount / 100));
  const cartTotal = Math.max(0, roundCurrency(cartSubtotal - cartDiscount));
  const changeDue = Math.max(0, Number(cashReceived || 0) - cartTotal);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { ...product, qty: 1, note: '' }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart((prev) => prev.flatMap((item) => {
      if (item.id !== id) return [item];
      const nextQty = item.qty + delta;
      return nextQty <= 0 ? [] : [{ ...item, qty: nextQty }];
    }));
  };

  const removeFromCart = (id) => {
    setCart((previous) => previous.filter((item) => item.id !== id));
  };

  const completeOrder = () => {
    completeOrderWithPayment(true);
  };

  const completeOrderWithPayment = (isPaid) => {
    if (cart.length === 0) {
      setOperationError('أضف صنفاً واحداً على الأقل قبل إتمام الفاتورة.');
      return;
    }
    if (isPaid && paymentMethod === 'نقد' && Number(cashReceived || 0) < cartTotal) {
      setOperationError('المبلغ المستلم أقل من إجمالي الفاتورة.');
      return;
    }
    setOperationError('');

    const orderId = orderCounter;
    const order = {
      id: orderId,
      table: selectedTable,
      type: serviceType,
      date: getLocalDate(),
      status: 'New',
      payment: paymentMethod,
      paymentStatus: isPaid ? 'paid' : 'pending',
      employee: 'حسن',
      shiftId: shift.id || null,
      items: cart.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
        cost: Number(item.cost || 0),
        recipe: { ...(item.recipe || {}) },
        note: item.note || '',
      })),
      inventoryDeducted: true,
      total: cartTotal,
      createdAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };

    setOrders((prev) => [order, ...prev]);
    setOrderCounter((prev) => prev + 1);
    setTables((prev) => prev.map((table) => (table.id === selectedTable ? { ...table, status: 'Occupied', orderId } : table)));

    setInventory((prev) => {
      const next = prev.map((stock) => ({ ...stock }));
      cart.forEach((item) => {
        const recipe = item.recipe || {};
        Object.entries(recipe).forEach(([ingredient, amount]) => {
          const stockMatch = next.find((stock) => normalizeText(stock.name) === normalizeText(ingredient));
          if (stockMatch) {
            stockMatch.qty = Math.max(0, stockMatch.qty - amount * item.qty);
          }
        });
      });
      return next;
    });

    setCart([]);
    setCashReceived('');
    setActiveTab(isPaid ? 'reports' : 'kitchen');
  };

  const collectPayment = (order) => {
    if (order.status === 'Cancelled' || order.paymentStatus !== 'pending') return;
    setOrders((previous) => previous.map((item) => (
      item.id === order.id ? { ...item, paymentStatus: 'paid', paidAt: new Date().toLocaleString('ar-SA'), payment: paymentMethod } : item
    )));
    writeAudit('استلام دفعة طلب', { orderId: order.id, payment: paymentMethod });
    setActiveTab('reports');
  };

  const updateKitchenStatus = (id, status) => {
    const targetOrder = orders.find((order) => order.id === id);
    setOrders((prev) => prev.map((order) => (
      order.id === id
        ? { ...order, status, closedAt: status === 'Served' ? new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : order.closedAt }
        : order
    )));

    if (status === 'Served' && targetOrder?.table) {
      setTables((prev) => prev.map((table) => (
        table.id === targetOrder.table ? { ...table, status: 'Available', orderId: undefined } : table
      )));
    }
  };

  const cancelOrder = (order) => {
    if (!canManage) {
      setPinError('إلغاء الطلب يحتاج صلاحية المالك');
      return;
    }
    if (order.status === 'Cancelled') return;

    writeAudit('إلغاء طلب', { orderId: order.id, reason: 'إلغاء من شاشة المطبخ' });
    setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: 'Cancelled', inventoryDeducted: false } : item)));
    setInventory((prev) => {
      const next = prev.map((stock) => ({ ...stock }));
      order.items.forEach((item) => {
        const recipe = item.recipe || products.find((entry) => entry.name === item.name)?.recipe || {};
        Object.entries(recipe).forEach(([ingredient, amount]) => {
          const stockMatch = next.find((stock) => normalizeText(stock.name) === normalizeText(ingredient));
          if (stockMatch) stockMatch.qty += amount * item.qty;
        });
      });
      return next;
    });
    setActiveTab('reports');
  };

  const deleteInvoice = (order) => {
    if (!canManage) {
      setPinError('حذف الفاتورة يحتاج صلاحية المدير');
      return;
    }
    if (!window.confirm(`هل تريد حذف الفاتورة رقم #${order.id}؟ سيتم عكس أثرها على المبيعات والمخزون.`)) return;

    const wasCountedAsSale = order.status !== 'Cancelled' && order.paymentStatus !== 'pending';
    const wasCashSale = wasCountedAsSale && order.payment === 'نقد';
    const inventoryWasDeducted = order.status !== 'Cancelled' && order.inventoryDeducted !== false;
    const restoredIngredients = {};

    if (inventoryWasDeducted) {
      order.items.forEach((item) => {
        const recipe = item.recipe || products.find((product) => product.name === item.name)?.recipe || {};
        Object.entries(recipe).forEach(([ingredient, amount]) => {
          restoredIngredients[ingredient] = (restoredIngredients[ingredient] || 0) + Number(amount || 0) * Number(item.qty || 0);
        });
      });
      setInventory((previous) => previous.map((stock) => {
        const restoredQuantity = Object.entries(restoredIngredients)
          .filter(([ingredient]) => normalizeText(ingredient) === normalizeText(stock.name))
          .reduce((sum, [, quantity]) => sum + quantity, 0);
        return restoredQuantity ? { ...stock, qty: stock.qty + restoredQuantity } : stock;
      }));
    }

    setOrders((previous) => previous.filter((item) => item.id !== order.id));
    if (order.table) {
      setTables((previous) => previous.map((table) => table.id === order.table && table.orderId === order.id
        ? { ...table, status: 'Available', orderId: undefined }
        : table));
    }
    if (order.shiftId) {
      setShiftHistory((previous) => previous.map((closedShift) => {
        if (closedShift.id !== order.shiftId) return closedShift;
        const salesTotal = Math.max(0, Number(closedShift.salesTotal || 0) - (wasCountedAsSale ? Number(order.total || 0) : 0));
        const expectedCash = Number(closedShift.expectedCash || 0) - (wasCashSale ? Number(order.total || 0) : 0);
        return {
          ...closedShift,
          invoiceCount: Math.max(0, Number(closedShift.invoiceCount || 0) - (wasCountedAsSale ? 1 : 0)),
          salesTotal,
          expectedCash,
          difference: closedShift.closingCash === null ? closedShift.difference : Number(closedShift.closingCash || 0) - expectedCash,
        };
      }));
    }
    writeAudit('حذف فاتورة', {
      orderId: order.id,
      total: order.total,
      paymentStatus: order.paymentStatus,
      inventoryRestored: restoredIngredients,
      deletedAt: new Date().toLocaleString('ar-SA'),
      relatedPurchaseOrExpense: 'لم توجد سجلات مرتبطة بهذه الفاتورة',
    });
  };

  const resetTeamForm = () => {
    setTeamForm({ name: '', type: 'employee', salary: '', received: '', advance: '', invested: '', percentage: '' });
    setEditingTeamId(null);
    setTeamError('');
  };

  const saveTeamMember = (event) => {
    event.preventDefault();
    if (!canManage) return;
    const name = teamForm.name.trim();
    const percentage = Number(teamForm.percentage || 0);
    if (!name) {
      setTeamError('أدخل اسم الشخص.');
      return;
    }
    if (teamForm.type === 'partner') {
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 || Number(teamForm.invested || 0) < 0) {
        setTeamError('أدخل نسبة ومبلغ استثمار صالحين، ولا يمكن أن تتجاوز النسبة 100٪.');
        return;
      }
      const otherPartnersPercentage = team
        .filter((person) => person.type === 'partner' && person.id !== editingTeamId)
        .reduce((sum, person) => sum + Number(person.percentage || 0), 0);
      if (otherPartnersPercentage + percentage > 100) {
        setTeamError(`نسبة الشركاء الإجمالية لا يمكن أن تتجاوز 100٪. المتبقي: ${Math.max(0, 100 - otherPartnersPercentage)}٪.`);
        return;
      }
    } else if ([teamForm.salary, teamForm.received, teamForm.advance].some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      setTeamError('يجب أن تكون مبالغ الراتب والمستلم والسلفة أرقاماً غير سالبة.');
      return;
    }
    const member = teamForm.type === 'partner'
      ? { id: editingTeamId || `team-${Date.now()}`, name, type: 'partner', invested: Number(teamForm.invested || 0), percentage }
      : {
        id: editingTeamId || `team-${Date.now()}`,
        name,
        type: 'employee',
        salary: Number(teamForm.salary || 0),
        received: Number(teamForm.received || 0),
        advance: Number(teamForm.advance || 0),
      };
    setTeam((previous) => editingTeamId
      ? previous.map((person) => person.id === editingTeamId ? member : person)
      : [...previous, member]);
    writeAudit(editingTeamId ? 'تعديل بيانات عضو الفريق' : 'إضافة عضو للفريق', { name, type: member.type });
    resetTeamForm();
  };

  const editTeamMember = (member) => {
    setEditingTeamId(member.id);
    setTeamForm({
      name: member.name,
      type: member.type,
      salary: member.salary ?? '',
      received: member.received ?? '',
      advance: member.advance ?? '',
      invested: member.invested ?? '',
      percentage: member.percentage ?? '',
    });
    setTeamError('');
  };

  const deleteTeamMember = (member) => {
    if (!canManage || !window.confirm(`هل تريد حذف ${member.name} من الفريق؟`)) return;
    setTeam((previous) => previous.filter((person) => person.id !== member.id));
    writeAudit('حذف عضو من الفريق', { name: member.name, type: member.type });
    if (editingTeamId === member.id) resetTeamForm();
  };

  const updateTableStatus = (tableId, status) => {
    if (!canManage) return;
    setTables((previous) => previous.map((table) => (
      table.id === tableId ? { ...table, status, orderId: status === 'Available' ? undefined : table.orderId } : table
    )));
    writeAudit('تغيير حالة طاولة', { tableId, status });
  };

  const cancelPurchase = (purchase) => {
    if (!canManage || purchase.cancelled
      || !window.confirm(`هل تريد إلغاء شراء ${purchase.ingredient}؟ سيتم خصم كميته من المخزون.`)) return;
    setPurchases((previous) => previous.map((item) => item.id === purchase.id ? { ...item, cancelled: true, cancelledAt: new Date().toLocaleString('ar-SA') } : item));
    setInventory((previous) => previous.map((item) => normalizeText(item.name) === normalizeText(purchase.ingredient)
      ? { ...item, qty: Math.max(0, item.qty - purchase.quantity) }
      : item));
    writeAudit('إلغاء شراء', { purchaseId: purchase.id, ingredient: purchase.ingredient });
  };

  const cancelExpense = (expense) => {
    if (!canManage || expense.cancelled
      || !window.confirm(`هل تريد إلغاء المصروف "${expense.title}"؟`)) return;
    setExpenses((previous) => previous.map((item) => item.id === expense.id ? { ...item, cancelled: true, cancelledAt: new Date().toLocaleString('ar-SA') } : item));
    writeAudit('إلغاء مصروف', { expenseId: expense.id, title: expense.title });
  };

  const cancelWaste = (waste) => {
    if (!canManage || waste.cancelled
      || !window.confirm(`هل تريد إلغاء تسجيل الهالك لمادة ${waste.ingredient}؟`)) return;
    setWasteLogs((previous) => previous.map((item) => item.id === waste.id ? { ...item, cancelled: true, cancelledAt: new Date().toLocaleString('ar-SA') } : item));
    setInventory((previous) => previous.map((item) => normalizeText(item.name) === normalizeText(waste.ingredient)
      ? { ...item, qty: item.qty + waste.quantity }
      : item));
    writeAudit('إلغاء هالك', { wasteId: waste.id, ingredient: waste.ingredient });
  };

  const addMenuItem = (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (!newMenuItem.name || !newMenuItem.price) return;

    setProducts((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newMenuItem.name,
        category: newMenuItem.category,
        price: Number(newMenuItem.price),
        cost: Number(newMenuItem.cost || 0),
        image: '🍽️',
        recipe: { bread: 1 },
      },
    ]);

    setNewMenuItem({ name: '', category: 'Burgers', price: '', cost: '' });
  };

  const deleteMenuItem = (product) => {
    if (!canManage || !window.confirm(`هل تريد حذف الصنف "${translateProduct(product.name)}" من المنيو؟`)) return;
    setProducts((previous) => previous.filter((item) => item.id !== product.id));
    setCart((previous) => previous.filter((item) => item.id !== product.id));
    writeAudit('حذف صنف من المنيو', { productId: product.id, name: product.name });
  };

  const addPurchase = (event) => {
    event.preventDefault();
    if (!canManage) return;
    const quantity = Number(newPurchase.quantity);
    const total = Number(newPurchase.total);
    const paid = Number(newPurchase.paid || 0);
    if (!newPurchase.ingredient.trim() || newPurchase.total === '' || !Number.isFinite(quantity) || quantity <= 0
      || !Number.isFinite(total) || total < 0
      || !Number.isFinite(paid) || paid < 0 || paid > total) {
      setOperationError('تحقق من المادة والكمية والإجمالي والمبلغ المدفوع قبل حفظ الشراء.');
      return;
    }

    const purchase = {
      id: Date.now(),
      ...newPurchase,
      quantity,
      total: roundCurrency(total),
      paid: roundCurrency(paid),
    };

    setPurchases((prev) => [purchase, ...prev]);
    setInventory((prev) => {
      const existing = prev.find((item) => normalizeText(item.name) === normalizeText(purchase.ingredient));
      if (!existing) {
        return [...prev, {
          id: Date.now(),
          name: purchase.ingredient.trim(),
          unit: purchase.unit,
          qty: purchase.quantity,
          min: 0,
          cost: roundCurrency(purchase.total / purchase.quantity),
          supplier: purchase.supplier || 'غير محدد',
        }];
      }
      return prev.map((item) => item.id === existing.id
        ? { ...item, qty: item.qty + purchase.quantity, cost: roundCurrency(purchase.total / purchase.quantity), supplier: purchase.supplier || item.supplier }
        : item);
    });
    writeAudit('تسجيل شراء', {
      purchaseId: purchase.id,
      ingredient: purchase.ingredient,
      quantity,
      total: purchase.total,
    });
    setOperationError('');
    setNewPurchase({ ingredient: '', quantity: '', unit: 'KG', total: '', supplier: '', date: getLocalDate(), paid: '' });
  };

  const addExpense = (event) => {
    event.preventDefault();
    if (!canManage) return;
    const amount = Number(newExpense.amount);
    if (!newExpense.title.trim() || newExpense.amount === '' || !Number.isFinite(amount) || amount <= 0) {
      setOperationError('أدخل بيان المصروف ومبلغاً أكبر من صفر.');
      return;
    }

    const expense = { id: Date.now(), ...newExpense, shiftId: shift.status === 'open' ? shift.id : null, amount: roundCurrency(amount) };
    setExpenses((prev) => [expense, ...prev]);
    writeAudit('تسجيل مصروف', { expenseId: expense.id, title: expense.title, amount: expense.amount });
    setOperationError('');
    setNewExpense({ title: '', amount: '', category: 'مصاريف تشغيل', date: getLocalDate(), notes: '' });
  };

  const addInventoryItem = (event) => {
    event.preventDefault();
    if (!canManage) return;
    const name = newInventoryItem.name.trim();
    const qty = Number(newInventoryItem.qty);
    const min = Number(newInventoryItem.min);
    const cost = Number(newInventoryItem.cost || 0);
    if (!name || newInventoryItem.qty === '' || newInventoryItem.min === ''
      || !Number.isFinite(qty) || qty < 0
      || !Number.isFinite(min) || min < 0
      || !Number.isFinite(cost) || cost < 0) {
      setOperationError('أدخل اسم المادة وكميات وأسعاراً صالحة (يمكن أن تكون صفراً).');
      return;
    }
    if (inventory.some((item) => normalizeText(item.name) === normalizeText(name) && item.id !== editingInventoryId)) {
      setOperationError('المادة موجودة مسبقاً في المخزون.');
      return;
    }

    const savedItem = {
      id: editingInventoryId || Date.now(),
      name,
      unit: newInventoryItem.unit,
      qty,
      min,
      cost: roundCurrency(cost),
      supplier: newInventoryItem.supplier.trim() || 'غير محدد',
    };
    setInventory((previous) => editingInventoryId
      ? previous.map((item) => item.id === editingInventoryId ? savedItem : item)
      : [...previous, savedItem]);
    writeAudit(editingInventoryId ? 'تعديل مادة مخزون' : 'إضافة مادة للمخزون', {
      inventoryId: savedItem.id,
      name,
      quantity: qty,
    });
    setOperationError('');
    setEditingInventoryId(null);
    setNewInventoryItem({ name: '', unit: 'KG', qty: '', min: '', cost: '', supplier: '' });
  };

  const editInventoryItem = (item) => {
    if (!canManage) return;
    setEditingInventoryId(item.id);
    setNewInventoryItem({
      name: item.name,
      unit: item.unit,
      qty: String(item.qty),
      min: String(item.min),
      cost: String(item.cost),
      supplier: item.supplier,
    });
    setOperationError('');
  };

  const resetInventoryForm = () => {
    setEditingInventoryId(null);
    setNewInventoryItem({ name: '', unit: 'KG', qty: '', min: '', cost: '', supplier: '' });
    setOperationError('');
  };

  const deleteInventoryItem = (item) => {
    if (!canManage) return;
    if (Number(item.qty) > 0) {
      setOperationError('لا يمكن حذف مادة لها كمية متبقية. صفّر رصيدها أو استخدمها قبل الحذف.');
      return;
    }
    const usedByRecipe = products.some((product) => Object.keys(product.recipe || {})
      .some((ingredient) => normalizeText(ingredient) === normalizeText(item.name)));
    if (usedByRecipe) {
      setOperationError('لا يمكن حذف مادة مستخدمة في وصفة صنف بالمنيو.');
      return;
    }
    if (!window.confirm(`هل تريد حذف مادة "${translateInventory(item.name)}" من المخزون؟`)) return;
    setInventory((previous) => previous.filter((entry) => entry.id !== item.id));
    writeAudit('حذف مادة من المخزون', { inventoryId: item.id, name: item.name });
    if (editingInventoryId === item.id) resetInventoryForm();
  };

  const addWaste = (event) => {
    event.preventDefault();
    if (!canManage) return;
    const quantity = Number(newWaste.quantity);
    const stock = inventory.find((item) => normalizeText(item.name) === normalizeText(newWaste.ingredient));
    if (!stock || !Number.isFinite(quantity) || quantity <= 0 || quantity > stock.qty) {
      setOperationError('اختر مادة موجودة وأدخل كمية هالك أكبر من صفر ولا تتجاوز رصيد المخزون.');
      return;
    }
    const waste = { id: Date.now(), ...newWaste, quantity, date: getLocalDate(), employee: session.name };
    setWasteLogs((previous) => [waste, ...previous]);
    setInventory((previous) => previous.map((item) => (
      normalizeText(item.name) === normalizeText(newWaste.ingredient) ? { ...item, qty: Math.max(0, item.qty - quantity) } : item
    )));
    writeAudit('تسجيل هالك', { ingredient: newWaste.ingredient, quantity, reason: newWaste.reason });
    setOperationError('');
    setNewWaste((previous) => ({ ...previous, quantity: '' }));
    setNewWaste({ ingredient: 'Chicken', quantity: '', reason: 'تالف' });
  };

  const exportReportCsv = () => {
    const rows = [
      ['الفترة', `${reportStartDate} إلى ${reportEndDate}`],
      ['إجمالي المبيعات', dashboardStats.totalSales],
      ['المصروفات', dashboardStats.totalExpenses],
      ['تكلفة الطعام', dashboardStats.foodCost],
      ['صافي الربح', dashboardStats.netProfit],
      ['الطلبات الملغاة', dashboardStats.cancelledOrders],
    ];
    const csv = `\ufeff${rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `restaurant-report-${reportStartDate}-${reportEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    writeAudit('تصدير تقرير', { start: reportStartDate, end: reportEndDate });
  };

  const openShift = (event) => {
    event.preventDefault();
    if (shiftCashInput === '') return;
    setShift({ id: `shift-${Date.now()}`, status: 'open', openingCash: Number(shiftCashInput), openedAt: new Date().toLocaleString('ar-SA'), closedAt: null, closingCash: null, date: shiftDate });
    setCart([]);
    setTables((previous) => previous.map((table) => ({ ...table, status: 'Available', orderId: undefined })));
    setShiftCashInput('');
    setDashboardRefresh((value) => value + 1);
    setActiveTab('dashboard');
  };

  const closeShift = (event) => {
    event.preventDefault();
    if (shiftCashInput === '') return;
    const closedAt = new Date().toLocaleString('ar-SA');
    const closingCash = Number(shiftCashInput);
    const shiftInvoices = orders.filter((order) => order.shiftId === shift.id && order.status !== 'Cancelled' && order.paymentStatus !== 'pending');
    const shiftSales = shiftInvoices.reduce((sum, order) => sum + Number(order.total || 0), 0);
    setShiftHistory((previous) => [...previous, {
      ...shift,
      status: 'closed',
      closingCash,
      closedAt,
      invoiceCount: shiftInvoices.length,
      salesTotal: shiftSales,
      expectedCash: dashboardStats.expectedCash,
      difference: closingCash - dashboardStats.expectedCash,
    }]);
    setShift((current) => ({ ...current, status: 'closed', closingCash, closedAt }));
    setShiftCashInput('');
    setDashboardRefresh((value) => value + 1);
    setReportStartDate(shift.date || getLocalDate());
    setReportEndDate(shift.date || getLocalDate());
    setActiveTab('reports');
  };

  const selectReportDay = (date) => {
    setReportStartDate(date);
    setReportEndDate(date);
  };

  const selectCurrentMonth = () => {
    const today = new Date();
    setReportStartDate(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
    setReportEndDate(getLocalDate());
  };

  const selectPreviousMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    setReportStartDate(firstDay.toISOString().slice(0, 10));
    setReportEndDate(lastDay.toISOString().slice(0, 10));
  };

  if (!session) {
    return (
      <main className="pin-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <section className="pin-card">
          <div className="brand-mark">R</div>
          <div className="language-switcher" aria-label={t('اختيار اللغة', 'Language selection')}>
            <button type="button" className={language === 'ar' ? 'active' : ''} onClick={() => setLanguage('ar')}>العربية</button>
            <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
          </div>
          <span className="eyebrow">Cown</span>
          <h1>{t('تسجيل الدخول', 'Sign in')}</h1>
          {isSupabaseConfigured ? (
            <>
              <p>{t('سجّل الدخول ببريدك وكلمة المرور', 'Sign in with your email and password')}</p>
              {!authReady ? <p role="status">{t('جارٍ التحقق من الحساب...', 'Checking account...')}</p> : (
                <form onSubmit={loginWithPassword}>
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder={t('البريد الإلكتروني', 'Email address')}
                    aria-label={t('البريد الإلكتروني', 'Email address')}
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder={t('كلمة المرور', 'Password')}
                    aria-label={t('كلمة المرور', 'Password')}
                  />
                  <button className="primary-btn full-width" type="submit" disabled={authBusy}>
                    {authBusy ? t('جارٍ الدخول...', 'Signing in...') : t('دخول', 'Sign in')}
                  </button>
                </form>
              )}
              {authError && <p className="pin-error" role="alert">{authError}</p>}
              <small className="pin-hint">{t('يجب تفعيل حسابك من قبل مدير المطعم.', 'Your account must be enabled by a restaurant manager.')}</small>
            </>
          ) : import.meta.env.PROD ? (
            <p className="pin-error" role="alert">
              {t('تسجيل الدخول غير مُعدّ. أضف إعدادات Supabase إلى بيئة النشر.', 'Authentication is not configured. Add Supabase settings to the deployment environment.')}
            </p>
          ) : (
            <>
              <p>{t('أدخل رمز الدخول المكوّن من أربعة أرقام', 'Enter your four-digit PIN')}</p>
              <form onSubmit={loginWithPin}>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              pattern="[0-9]{4}"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={t('رمز PIN من 4 أرقام', '4-digit PIN')}
              aria-label={t('رمز الدخول', 'Access PIN')}
            />
            <button className="primary-btn full-width" type="submit">{t('دخول', 'Sign in')}</button>
              </form>
              {pinError && <p className="pin-error">{pinError}</p>}
              <small className="pin-hint">{t('الدخول المحلي متاح أثناء التطوير فقط.', 'Local PIN access is only available during development.')}</small>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <div className="brand-mark">R</div>
          <div>
            <h2>Cown</h2>
            <small>إدارة المطعم ونقطة البيع</small>
          </div>
        </div>

        <div className="session-box">
          <strong>{session.name}</strong>
          <small>{canManage ? 'صلاحية كاملة' : 'صلاحية الكاشير'}</small>
          <button type="button" onClick={lockScreen}>قفل الشاشة</button>
        </div>

        <nav className="nav-list">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <p className="storage-warning" role="status">
          {isSupabaseConfigured
            ? 'تم التحقق من هويتك عبر Supabase. بيانات المطعم ما زالت محفوظة محلياً على هذا المتصفح ولم تُفعّل مزامنتها بعد.'
            : 'وضع التطوير: الدخول والبيانات محليان على هذا المتصفح فقط.'}
        </p>
        {operationError && <p className="team-error" role="alert">{operationError}</p>}
        {activeTab === 'dashboard' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">لوحة التحكم</span>
                <h1>لوحة التحكم</h1>
              </div>
              <button className="primary-btn" type="button" onClick={() => setDashboardRefresh((value) => value + 1)}>تحديث البيانات</button>
            </div>

            <div className="stats-grid">
              <div className="stat-card"><span>مبيعات اليوم</span><strong>{formatCurrency(dashboardStats.totalSales)}</strong></div>
              <div className="stat-card"><span>عدد الطلبات</span><strong>{dashboardStats.totalOrders}</strong></div>
              <div className="stat-card"><span>طلبات مكتملة</span><strong>{dashboardStats.servedOrders}</strong></div>
              <div className="stat-card"><span>طلبات معلقة</span><strong>{dashboardStats.pendingOrders}</strong></div>
              <div className="stat-card"><span>بانتظار الدفع</span><strong>{dashboardStats.pendingPaymentOrders.length}</strong></div>
              <div className="stat-card"><span>طلبات مدفوعة</span><strong>{dashboardStats.paidOrders}</strong></div>
              <div className="stat-card"><span>طلبات ملغاة</span><strong>{dashboardStats.cancelledOrders}</strong></div>
              <div className="stat-card"><span>صافي المبيعات</span><strong>{formatCurrency(dashboardStats.netProfit)}</strong></div>
              <div className="stat-card"><span>المصروفات</span><strong>{formatCurrency(dashboardStats.totalExpenses)}</strong></div>
              <div className="stat-card"><span>الأرباح</span><strong>{formatCurrency(dashboardStats.totalSales - dashboardStats.foodCost)}</strong></div>
              <div className="stat-card"><span>الطاولات المشغولة</span><strong>{dashboardStats.occupiedTables}</strong></div>
              <div className="stat-card"><span>حالة الشفت</span><strong>{shift.status === 'open' ? 'مفتوح' : 'مغلق'}</strong></div>
            </div>

            <div className="two-column-grid">
              <div className="panel-box">
                <h3>الطلبات بانتظار الدفع</h3>
                <ul className="list-block">
                  {dashboardStats.pendingPaymentOrders.length ? dashboardStats.pendingPaymentOrders.map((order) => (
                    <li key={order.id}><span>طلب #{order.id}</span><strong>{formatCurrency(order.total)}</strong></li>
                  )) : <li>لا توجد طلبات بانتظار الدفع</li>}
                </ul>
              </div>
              <div className="panel-box">
                <h3>أكثر الأصناف مبيعاً</h3>
                <ul className="list-block">
                  {dashboardStats.topItems.length ? dashboardStats.topItems.map(([name, qty]) => (
                    <li key={name}><span>{translateProduct(name)}</span><strong>{qty} قطعة</strong></li>
                  )) : <li>لا يوجد بيع حتى الآن</li>}
                </ul>
              </div>

              <div className="panel-box">
                <h3>المخزون المنخفض</h3>
                <ul className="list-block">
                  {dashboardStats.lowStock.length ? dashboardStats.lowStock.map((item) => (
                    <li key={item.id}><span>{translateInventory(item.name)}</span><strong>{item.qty} / {item.min}</strong></li>
                  )) : <li>كل المواد في حالة جيدة</li>}
                </ul>
              </div>
            </div>

            <div className="two-column-grid">
              <div className="panel-box">
                <h3>المبيعات حسب طريقة الدفع</h3>
                <ul className="list-block">
                  {paymentMethods.map((method) => (
                    <li key={method}><span>{method}</span><strong>{formatCurrency(dashboardStats.salesByPayment[method] || 0)}</strong></li>
                  ))}
                </ul>
              </div>

              <div className="panel-box">
                <h3>مقارنة المبيعات</h3>
                <div className="mini-bars">
                  <div><span>اليوم</span><i style={{ width: '0%' }}></i><strong>{formatCurrency(0)}</strong></div>
                  <div><span>الأمس</span><i style={{ width: '0%' }}></i><strong>{formatCurrency(0)}</strong></div>
                  <div><span>الأسبوع</span><i style={{ width: '0%' }}></i><strong>{formatCurrency(0)}</strong></div>
                </div>
              </div>
            </div>

            {canManage && <div className="panel-box">
              <h3>توزيع أرباح الشركاء</h3>
              <p className="team-profit-total">إجمالي الربح: <strong>{formatCurrency(totalProfit)}</strong></p>
              {team.filter((person) => person.type === 'partner').length ? (
                <table className="data-table">
                  <thead><tr><th>الشريك</th><th>النسبة</th><th>حصة الربح</th></tr></thead>
                  <tbody>{team.filter((person) => person.type === 'partner').map((partner) => (
                    <tr key={partner.id}>
                      <td>{partner.name}</td>
                      <td>{Number(partner.percentage || 0)}٪</td>
                      <td>{formatCurrency(totalProfit * Number(partner.percentage || 0) / 100)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="empty-state">أضف الشركاء من قسم الفريق لعرض حصة الأرباح.</p>}
            </div>}

            <div className="panel-box latest-shift-box">
              <h3>نتائج آخر شفت مغلق</h3>
              {latestClosedShift ? <div className="latest-shift-grid">
                <div><span>التاريخ</span><strong>{latestClosedShift.date}</strong></div>
                <div><span>عدد الفواتير</span><strong>{latestClosedShift.invoiceCount || 0}</strong></div>
                <div><span>إجمالي المبيعات</span><strong>{formatCurrency(latestClosedShift.salesTotal || 0)}</strong></div>
                <div><span>النقد المتوقع</span><strong>{formatCurrency(latestClosedShift.expectedCash || 0)}</strong></div>
                <div><span>النقد الفعلي</span><strong>{formatCurrency(latestClosedShift.closingCash || 0)}</strong></div>
                <div><span>الفرق</span><strong>{formatCurrency(latestClosedShift.difference || 0)}</strong></div>
              </div> : <p className="empty-state">لا يوجد شفت مغلق حتى الآن</p>}
            </div>
          </section>
        )}

        {activeTab === 'cashier' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">النقطة</span>
                <h1>نقطة البيع والكاشير</h1>
              </div>
            </div>

            <div className="pos-layout">
              <div className="product-panel">
                <div className="filter-bar">
                  {categories.map((category) => (
                    <button
                      key={category}
                      className={selectedCategory === category ? 'chip active' : 'chip'}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {translateCategory(category)}
                    </button>
                  ))}
                </div>

                <div className="product-grid">
                  {filteredProducts.length === 0 && <p className="empty-state">{t('لا توجد أصناف. أضف الأصناف من صفحة المنيو أولاً', 'No menu items yet. Add products from Menu first.')}</p>}
                  {filteredProducts.map((product) => (
                    <button key={product.id} className="product-card" onClick={() => addToCart(product)}>
                      <span className="product-emoji">{product.image}</span>
                      <div>
                        <strong>{translateProduct(product.name)}</strong>
                        <small>{translateCategory(product.category)}</small>
                      </div>
                      <b>{formatCurrency(product.price)}</b>
                    </button>
                  ))}
                </div>
              </div>

              <div className="cart-panel">
                <div className="panel-box">
                  <h3>سلة الطلب</h3>

                  <div className="settings-row">
                    <label>
                      <span>الطاولة</span>
                      <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
                        {tables.map((table) => (
                          <option key={table.id} value={table.id}>{table.id}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>نوع الطلب</span>
                      <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                        <option value="Dine-in">داخل المطعم</option>
                        <option value="Takeaway">استلام</option>
                        <option value="Delivery">توصيل</option>
                      </select>
                    </label>
                  </div>

                  <div className="cart-list">
                    {cart.length === 0 ? <p className="empty-state">لا توجد أصناف في السلة</p> : cart.map((item) => (
                      <div key={item.id} className="cart-item">
                        <div>
                          <strong>{translateProduct(item.name)}</strong>
                          <small>{formatCurrency(item.price)} × {item.qty}</small>
                          <input
                            className="item-note"
                            aria-label={`ملاحظة ${translateProduct(item.name)}`}
                            placeholder="ملاحظة للصنف"
                            value={item.note || ''}
                            onChange={(event) => setCart((prev) => prev.map((cartItem) => (
                              cartItem.id === item.id ? { ...cartItem, note: event.target.value } : cartItem
                            )))}
                          />
                        </div>
                        <div className="qty-control">
                          <button onClick={() => updateCartQty(item.id, -1)}>-</button>
                          <span>{item.qty}</span>
                          <button onClick={() => updateCartQty(item.id, 1)}>+</button>
                          <button type="button" className="cancel-action" aria-label={`حذف ${translateProduct(item.name)} من السلة`} onClick={() => removeFromCart(item.id)}>حذف</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="totals-box">
                    <div><span>المجموع</span><strong>{formatCurrency(cartSubtotal)}</strong></div>
                    <div><span>الخصم</span><strong>{formatCurrency(cartDiscount)}</strong></div>
                    <div className="grand-total"><span>الإجمالي النهائي</span><strong>{formatCurrency(cartTotal)}</strong></div>
                  </div>

                  <div className="settings-row">
                    <label>
                      <span>طريقة الدفع</span>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        {paymentMethods.map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>الخصم %</span>
                      <input type="number" min="0" max="100" step="0.01" value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                    </label>
                  </div>
                  {paymentMethod === 'نقد' && <div className="cash-summary">
                    <label>
                      <span>المبلغ المستلم</span>
                      <input type="number" min="0" step="0.01" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="المبلغ المستلم" />
                    </label>
                    <strong>الباقي: {formatCurrency(changeDue)}</strong>
                  </div>}

                  <div className="checkout-actions">
                    <button className="primary-btn" onClick={() => completeOrderWithPayment(true)}>إتمام ودفع</button>
                    <button className="secondary-action" onClick={() => completeOrderWithPayment(false)}>حفظ الطلب معلقًا</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'tables' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">الطاولات</span>
                <h1>مخطط الطاولات</h1>
              </div>
            </div>

            <div className="table-grid">
              {tables.map((table) => (
                <div key={table.id} className={`table-card ${table.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  <h3>{table.id}</h3>
                  <span>{table.status === 'Available' ? 'فارغة' : table.status === 'Occupied' ? 'مشغولة' : table.status === 'Waiting Payment' ? 'بانتظار الحساب' : 'الطلب جاهز'}</span>
                  <small>{table.orderId ? `طلب رقم #${table.orderId}` : 'طاولة فارغة'}</small>
                  {canManage && <div className="table-actions">
                    <button type="button" onClick={() => updateTableStatus(table.id, 'Available')}>متاحة</button>
                    <button type="button" onClick={() => updateTableStatus(table.id, 'Occupied')}>مشغولة</button>
                    <button type="button" onClick={() => updateTableStatus(table.id, 'Ready')}>جاهز</button>
                  </div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'menu' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">المنيو</span>
                <h1>إدارة المنيو</h1>
              </div>
            </div>

            <div className="menu-layout">
              <form className="panel-box form-box" onSubmit={addMenuItem}>
                <h3>إضافة صنف جديد</h3>
                <div className="form-grid">
                  <input placeholder="اسم الصنف" value={newMenuItem.name} onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })} />
                  <select value={newMenuItem.category} onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}>
                    {['Burgers', 'Main', 'Sides', 'Drinks'].map((category) => (
                      <option key={category} value={category}>{translateCategory(category)}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="السعر" value={newMenuItem.price} onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })} />
                  <input type="number" placeholder="التكلفة" value={newMenuItem.cost} onChange={(e) => setNewMenuItem({ ...newMenuItem, cost: e.target.value })} />
                </div>
                <button className="primary-btn" type="submit">حفظ الصنف</button>
              </form>

              <div className="panel-box">
                <h3>الأصناف الحالية</h3>
                <div className="menu-grid-compact">
                  {products.map((product) => (
                    <div key={product.id} className="mini-menu-item">
                      <span>{product.image}</span>
                      <div>
                        <strong>{translateProduct(product.name)}</strong>
                        <small>{translateCategory(product.category)}</small>
                      </div>
                      <b>{formatCurrency(product.price)}</b>
                      <button type="button" className="availability-button" onClick={() => setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, available: item.available === false } : item))}>
                        {product.available === false ? 'إظهار' : 'إخفاء'}
                      </button>
                      {canManage && <button type="button" className="cancel-action" aria-label={`حذف ${translateProduct(product.name)} من المنيو`} onClick={() => deleteMenuItem(product)}>حذف</button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'team' && canManage && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">إدارة الأشخاص</span>
                <h1>الفريق</h1>
              </div>
            </div>

            <div className="management-layout">
              <form className="panel-box form-box" onSubmit={saveTeamMember}>
                <h3>{editingTeamId ? 'تعديل بيانات الشخص' : 'إضافة شخص جديد'}</h3>
                <div className="form-grid">
                  <input
                    placeholder="اسم الشخص"
                    aria-label="اسم الشخص"
                    value={teamForm.name}
                    onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })}
                  />
                  <select
                    aria-label="نوع الشخص"
                    value={teamForm.type}
                    onChange={(event) => {
                      setTeamForm({ ...teamForm, type: event.target.value });
                      setTeamError('');
                    }}
                  >
                    <option value="employee">موظف</option>
                    <option value="partner">شريك</option>
                  </select>
                  {teamForm.type === 'employee' ? <>
                    <label className="field-label">الراتب الشهري<input aria-label="الراتب الشهري" type="number" min="0" step="0.01" value={teamForm.salary} onChange={(event) => setTeamForm({ ...teamForm, salary: event.target.value })} /></label>
                    <label className="field-label">المبلغ المستلم<input aria-label="المبلغ المستلم" type="number" min="0" step="0.01" value={teamForm.received} onChange={(event) => setTeamForm({ ...teamForm, received: event.target.value })} /></label>
                    <label className="field-label">السلفة<input aria-label="السلفة" type="number" min="0" step="0.01" value={teamForm.advance} onChange={(event) => setTeamForm({ ...teamForm, advance: event.target.value })} /></label>
                    <div className="field-label">المتبقي<strong className="team-remaining">{formatCurrency(Number(teamForm.salary || 0) - Number(teamForm.received || 0) - Number(teamForm.advance || 0))}</strong></div>
                  </> : <>
                    <label className="field-label">المبلغ المدفوع / المستثمر<input aria-label="المبلغ المدفوع / المستثمر" type="number" min="0" step="0.01" value={teamForm.invested} onChange={(event) => setTeamForm({ ...teamForm, invested: event.target.value })} /></label>
                    <label className="field-label">نسبة الشركة %<input aria-label="نسبة الشركة" type="number" min="0" max="100" step="0.01" value={teamForm.percentage} onChange={(event) => setTeamForm({ ...teamForm, percentage: event.target.value })} /></label>
                  </>}
                </div>
                {teamError && <p className="team-error" role="alert">{teamError}</p>}
                <div className="form-actions">
                  <button className="primary-btn" type="submit">{editingTeamId ? 'حفظ التعديلات' : 'حفظ الشخص'}</button>
                  {editingTeamId && <button className="secondary-action" type="button" onClick={resetTeamForm}>إلغاء التعديل</button>}
                </div>
              </form>

              <div className="panel-box team-list-panel">
                <h3>أعضاء الفريق</h3>
                {team.length === 0 ? <p className="empty-state">لا يوجد أشخاص مضافون للفريق بعد.</p> : team.map((person) => (
                  <article className="team-member-card" key={person.id}>
                    <div className="team-member-heading">
                      <strong>{person.name}</strong>
                      <span>{person.type === 'partner' ? 'شريك' : 'موظف'}</span>
                    </div>
                    {person.type === 'partner' ? (
                      <dl>
                        <div><dt>المبلغ المستثمر</dt><dd>{formatCurrency(person.invested)}</dd></div>
                        <div><dt>النسبة</dt><dd>{Number(person.percentage || 0)}٪</dd></div>
                        <div><dt>حصة الربح</dt><dd>{formatCurrency(totalProfit * Number(person.percentage || 0) / 100)}</dd></div>
                      </dl>
                    ) : (
                      <dl>
                        <div><dt>الراتب الشهري</dt><dd>{formatCurrency(person.salary)}</dd></div>
                        <div><dt>المستلم</dt><dd>{formatCurrency(person.received)}</dd></div>
                        <div><dt>السلفة</dt><dd>{formatCurrency(person.advance)}</dd></div>
                        <div><dt>المتبقي</dt><dd>{formatCurrency(Number(person.salary || 0) - Number(person.received || 0) - Number(person.advance || 0))}</dd></div>
                      </dl>
                    )}
                    <div className="form-actions">
                      <button type="button" className="secondary-action" onClick={() => editTeamMember(person)}>تعديل</button>
                      <button type="button" className="cancel-action" onClick={() => deleteTeamMember(person)}>حذف</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'inventory' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">المخزون</span>
                <h1>المخزون</h1>
              </div>
            </div>

            <div className="management-layout inventory-layout">
              <form className="panel-box form-box" onSubmit={addInventoryItem}>
                <h3>{editingInventoryId ? 'تعديل مادة المخزون' : 'إضافة مادة جديدة'}</h3>
                <div className="form-grid">
                  <input placeholder="اسم المادة" value={newInventoryItem.name} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, name: e.target.value })} />
                  <select value={newInventoryItem.unit} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, unit: e.target.value })}>
                    <option value="KG">كجم</option><option value="Liter">لتر</option><option value="Piece">قطعة</option><option value="Case">كرتون</option>
                  </select>
                  <input type="number" min="0" step="0.01" placeholder="الكمية الحالية" value={newInventoryItem.qty} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, qty: e.target.value })} />
                  <input type="number" min="0" step="0.01" placeholder="الحد الأدنى" value={newInventoryItem.min} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, min: e.target.value })} />
                  <input type="number" min="0" step="0.01" placeholder="سعر الشراء" value={newInventoryItem.cost} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, cost: e.target.value })} />
                  <input placeholder="المورد" value={newInventoryItem.supplier} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, supplier: e.target.value })} />
                </div>
                <button className="primary-btn" type="submit">{editingInventoryId ? 'حفظ التعديلات' : 'حفظ المادة'}</button>
                {editingInventoryId && <button className="availability-button" type="button" onClick={resetInventoryForm}>إلغاء التعديل</button>}
              </form>

              <div className="panel-box">
                <table className="data-table">
                <thead>
                  <tr>
                    <th>المادة</th>
                    <th>الكمية</th>
                    <th>الوحدة</th>
                    <th>السعر</th>
                    <th>الحد الأدنى</th>
                    <th>المورد</th>
                    {canManage && <th>الإجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} className={item.qty <= item.min ? 'warning-row' : ''}>
                      <td>{translateInventory(item.name)}</td>
                      <td>{item.qty}</td>
                      <td>{unitLabels[item.unit] || item.unit}</td>
                      <td>{formatCurrency(item.cost)}</td>
                      <td>{item.min}</td>
                      <td>{item.supplier}</td>
                      {canManage && <td className="row-actions">
                        <button type="button" className="availability-button" onClick={() => editInventoryItem(item)}>تعديل</button>
                        <button type="button" className="cancel-action" onClick={() => deleteInventoryItem(item)}>حذف</button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'purchases' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">المشتريات والموردون</span>
                  <h1>المشتريات</h1>
              </div>
            </div>

            <div className="management-layout">
              <form className="panel-box form-box" onSubmit={addPurchase}>
                <h3>إضافة شراء جديد</h3>
                <div className="form-grid">
                  <input
                    list="purchase-ingredients"
                    placeholder="اسم المادة"
                    aria-label="مادة الشراء"
                    value={newPurchase.ingredient}
                    onChange={(e) => setNewPurchase({ ...newPurchase, ingredient: e.target.value })}
                  />
                  <datalist id="purchase-ingredients">
                    {inventory.map((item) => <option key={item.id} value={item.name} />)}
                  </datalist>
                  <input type="number" min="0" step="0.01" placeholder="الكمية" value={newPurchase.quantity} onChange={(e) => setNewPurchase({ ...newPurchase, quantity: e.target.value })} />
                  <select value={newPurchase.unit} onChange={(e) => setNewPurchase({ ...newPurchase, unit: e.target.value })}>
                    <option value="KG">كجم</option><option value="Liter">لتر</option><option value="Piece">قطعة</option><option value="Case">كرتون</option>
                  </select>
                  <input type="number" min="0" step="0.01" placeholder="إجمالي الفاتورة" value={newPurchase.total} onChange={(e) => setNewPurchase({ ...newPurchase, total: e.target.value })} />
                  <input placeholder="اسم المورد" value={newPurchase.supplier} onChange={(e) => setNewPurchase({ ...newPurchase, supplier: e.target.value })} />
                  <input type="date" value={newPurchase.date} onChange={(e) => setNewPurchase({ ...newPurchase, date: e.target.value })} />
                  <input type="number" min="0" placeholder="المبلغ المدفوع" value={newPurchase.paid} onChange={(e) => setNewPurchase({ ...newPurchase, paid: e.target.value })} />
                </div>
                <button className="primary-btn" type="submit">حفظ الشراء وزيادة المخزون</button>
              </form>

              <div className="panel-box">
                <h3>سجل المشتريات</h3>
                <table className="data-table">
                  <thead><tr><th>المادة</th><th>الكمية</th><th>المورد</th><th>الإجمالي</th><th>التاريخ</th><th>الإجراء</th></tr></thead>
                  <tbody>{purchases.map((purchase) => (
                    <tr key={purchase.id} className={purchase.cancelled ? 'cancelled-row' : ''}><td>{translateInventory(purchase.ingredient)}</td><td>{purchase.quantity} {unitLabels[purchase.unit] || purchase.unit}</td><td>{purchase.supplier || '-'}</td><td>{formatCurrency(purchase.total)}</td><td>{purchase.date}</td><td>{purchase.cancelled ? 'ملغى' : canManage && <button type="button" className="cancel-action" onClick={() => cancelPurchase(purchase)}>إلغاء</button>}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'expenses' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">المصروفات</span>
                  <h1>المصروفات</h1>
              </div>
              <div className="header-total">إجمالي المصروفات: <strong>{formatCurrency(dashboardStats.totalExpenses)}</strong></div>
            </div>

            <div className="management-layout">
              <form className="panel-box form-box" onSubmit={addExpense}>
                <h3>تسجيل مصروف</h3>
                <div className="form-grid">
                  <input placeholder="اسم المصروف" value={newExpense.title} onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })} />
                  <input type="number" min="0" step="0.01" placeholder="المبلغ" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
                  <select value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}>
                    <option>إيجار</option><option>رواتب</option><option>كهرباء</option><option>مشتريات</option><option>صيانة</option><option>توصيل</option><option>تسويق</option><option>مصاريف تشغيل</option><option>أخرى</option>
                  </select>
                  <input type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
                  <input className="wide-input" placeholder="ملاحظات" value={newExpense.notes} onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })} />
                </div>
                <button className="primary-btn" type="submit">حفظ المصروف وتحديث الأرباح</button>
              </form>

              <div className="panel-box">
                <h3>سجل المصروفات</h3>
                <table className="data-table">
                  <thead><tr><th>البيان</th><th>التصنيف</th><th>المبلغ</th><th>التاريخ</th><th>الملاحظات</th><th>الإجراء</th></tr></thead>
                  <tbody>{expenses.map((expense) => (
                    <tr key={expense.id} className={expense.cancelled ? 'cancelled-row' : ''}><td>{expense.title}</td><td>{expense.category}</td><td>{formatCurrency(expense.amount)}</td><td>{expense.date}</td><td>{expense.notes || '-'}</td><td>{expense.cancelled ? 'ملغى' : canManage && <button type="button" className="cancel-action" onClick={() => cancelExpense(expense)}>إلغاء</button>}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'kitchen' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">المطبخ</span>
                <h1>شاشة المطبخ</h1>
              </div>
            </div>

            <div className="kitchen-grid">
              {(shift.status === 'open' ? orders.filter((order) => order.shiftId === shift.id) : orders.filter((order) => !order.shiftId)).map((order) => (
                <div key={order.id} className="kitchen-card">
                  <div className="order-top">
                    <strong>طلب رقم #{order.id}</strong>
                    <span>{statusLabels[order.status] || order.status}</span>
                  </div>
                  <small className="order-meta">{serviceLabels[order.type] || order.type} • {order.createdAt} • الموظف: {order.employee}</small>
                  <div className={order.paymentStatus === 'pending' ? 'payment-badge pending' : 'payment-badge'}>
                    {order.paymentStatus === 'pending' ? 'بانتظار الدفع' : 'مدفوع'}
                  </div>
                  <ul>
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.name}`}>
                        <span>{translateProduct(item.name)} × {item.qty}{item.note ? ` (${item.note})` : ''}</span>
                        <b>{formatCurrency(item.price * item.qty)}</b>
                      </li>
                    ))}
                  </ul>
                  {order.status !== 'Cancelled' && order.status !== 'Served' && <div className="status-actions">
                    {kitchenStatuses.map((status) => (
                      <button key={status} onClick={() => updateKitchenStatus(order.id, status)}>{statusLabels[status]}</button>
                    ))}
                    <button className="cancel-action" onClick={() => cancelOrder(order)}>إلغاء الطلب</button>
                  </div>}
                  {order.status === 'Served' && <small className="closed-order">تم إغلاق الطلب في {order.closedAt || 'الآن'}</small>}
                  {order.paymentStatus === 'pending' && order.status !== 'Cancelled' && <button className="primary-btn payment-button" onClick={() => collectPayment(order)}>استلام الدفع</button>}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'reports' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">التقارير</span>
                <h1>التقارير</h1>
              </div>
              <button className="primary-btn" type="button" onClick={exportReportCsv}>تصدير التقرير Excel</button>
            </div>

            <div className="panel-box report-filters">
              <div className="report-filter-row">
                <label>من تاريخ<input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} /></label>
                <label>إلى تاريخ<input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} /></label>
              </div>
              <div className="report-presets">
                <button type="button" onClick={() => selectReportDay(getLocalDate())}>اليوم</button>
                <button type="button" onClick={() => { const date = new Date(); date.setDate(date.getDate() - 1); selectReportDay(date.toISOString().slice(0, 10)); }}>الأمس</button>
                <button type="button" onClick={selectCurrentMonth}>هذا الشهر</button>
                <button type="button" onClick={selectPreviousMonth}>الشهر السابق</button>
              </div>
              <strong className="selected-period">الفترة المحددة: {reportStartDate} إلى {reportEndDate}</strong>
            </div>

            <div className="stats-grid">
              <div className="stat-card"><span>إجمالي المبيعات</span><strong>{formatCurrency(dashboardStats.totalSales)}</strong></div>
              <div className="stat-card"><span>التكلفة</span><strong>{formatCurrency(dashboardStats.foodCost)}</strong></div>
              <div className="stat-card"><span>المصروفات</span><strong>{formatCurrency(dashboardStats.totalExpenses)}</strong></div>
              <div className="stat-card"><span>صافي الربح</span><strong>{formatCurrency(dashboardStats.netProfit)}</strong></div>
              <div className="stat-card"><span>الطلبات الملغاة</span><strong>{dashboardStats.cancelledOrders}</strong></div>
              <div className="stat-card"><span>طلبات بانتظار الدفع</span><strong>{dashboardStats.pendingPaymentOrders.length}</strong></div>
              <div className="stat-card"><span>طلبات مدفوعة</span><strong>{dashboardStats.paidOrders}</strong></div>
            </div>

            <div className="panel-box">
              <h3>حالة الطلبات في الفترة</h3>
              <table className="data-table">
              <thead><tr><th>الطلب</th><th>المبلغ</th><th>حالة الدفع</th><th>حالة التنفيذ</th>{canManage && <th>الإجراء</th>}</tr></thead>
                <tbody>{orders.filter((order) => isDateInRange(order.date, reportStartDate, reportEndDate)).map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{formatCurrency(order.total)}</td>
                  <td>{order.paymentStatus === 'pending' ? 'بانتظار الدفع' : order.status === 'Cancelled' ? 'ملغى' : 'مدفوع'}</td>
                  <td>{statusLabels[order.status] || order.status}</td>
                  {canManage && <td><button type="button" className="cancel-action" aria-label={`حذف الفاتورة #${order.id}`} onClick={() => deleteInvoice(order)}>حذف الفاتورة</button></td>}
                </tr>
              ))}</tbody>
              </table>
            </div>

            <div className="panel-box shift-report-box">
              <h3>ملخص فواتير الشفتات في الفترة</h3>
              <table className="data-table">
                <thead><tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبلغ</th><th>الفرق النقدي</th></tr></thead>
                <tbody>
                  {shiftHistory.filter((item) => isDateInRange(item.date, reportStartDate, reportEndDate)).map((item) => (
                    <tr key={item.id}><td>{item.date}</td><td>{item.invoiceCount || 0}</td><td>{formatCurrency(item.salesTotal || 0)}</td><td>{formatCurrency(item.difference || 0)}</td></tr>
                  ))}
                  {shiftHistory.filter((item) => isDateInRange(item.date, reportStartDate, reportEndDate)).length === 0 && <tr><td colSpan="4">لا توجد شفتات مغلقة في الفترة المحددة</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="panel-box latest-shift-box">
              <h3>آخر شفت مغلق</h3>
              {latestClosedShift ? <div className="latest-shift-grid">
                <div><span>التاريخ</span><strong>{latestClosedShift.date}</strong></div>
                <div><span>الفواتير</span><strong>{latestClosedShift.invoiceCount || 0}</strong></div>
                <div><span>المبيعات</span><strong>{formatCurrency(latestClosedShift.salesTotal || 0)}</strong></div>
                <div><span>الفرق</span><strong>{formatCurrency(latestClosedShift.difference || 0)}</strong></div>
              </div> : <p className="empty-state">لا يوجد شفت مغلق حتى الآن</p>}
            </div>
          </section>
        )}

        {activeTab === 'shifts' && (
          <section>
            <div className="page-header">
              <div>
                <span className="eyebrow">حسابات المالك</span>
                <h1>فتح وإغلاق الشفت</h1>
              </div>
              <div className={shift.status === 'open' ? 'shift-badge open' : 'shift-badge'}>
                {shift.status === 'open' ? 'الشفت مفتوح' : 'لا يوجد شفت مفتوح'}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card"><span>رصيد بداية الشفت</span><strong>{formatCurrency(shift.openingCash)}</strong></div>
              <div className="stat-card"><span>مبيعات النقد</span><strong>{formatCurrency(dashboardStats.cashSales)}</strong></div>
              <div className="stat-card"><span>النقد المتوقع</span><strong>{formatCurrency(dashboardStats.expectedCash)}</strong></div>
              <div className="stat-card"><span>النقد الفعلي عند الإغلاق</span><strong>{shift.closingCash === null ? '-' : formatCurrency(shift.closingCash)}</strong></div>
            </div>

            <div className="management-layout shift-layout">
              <form className="panel-box form-box" onSubmit={shift.status === 'open' ? closeShift : openShift}>
                <h3>{shift.status === 'open' ? 'إغلاق الشفت' : 'فتح شفت جديد'}</h3>
                {shift.status !== 'open' && <label className="field-label">تاريخ الشفت<input type="date" value={shiftDate} onChange={(event) => setShiftDate(event.target.value)} /></label>}
                <label className="field-label">{shift.status === 'open' ? 'النقد الفعلي في الصندوق' : 'النقد الافتتاحي'}</label>
                <input type="number" min="0" step="0.01" placeholder="المبلغ" value={shiftCashInput} onChange={(e) => setShiftCashInput(e.target.value)} />
                <button className="primary-btn" type="submit">{shift.status === 'open' ? 'إغلاق الشفت وحفظ الفرق' : 'فتح الشفت'}</button>
              </form>

              <div className="panel-box">
                <h3>ملخص الشفت</h3>
                <ul className="list-block">
                  <li><span>تاريخ الشفت</span><strong>{shift.date || '-'}</strong></li>
                  <li><span>فواتير الشفت الحالي</span><strong>{dashboardStats.totalOrders}</strong></li>
                  <li><span>مبيعات الشفت الحالي</span><strong>{formatCurrency(dashboardStats.totalSales)}</strong></li>
                  <li><span>وقت البداية</span><strong>{shift.openedAt || '-'}</strong></li>
                  <li><span>وقت الإغلاق</span><strong>{shift.closedAt || '-'}</strong></li>
                  <li><span>الفرق</span><strong>{shift.closingCash === null ? '-' : formatCurrency(shift.closingCash - dashboardStats.expectedCash)}</strong></li>
                </ul>
              </div>
            </div>

            <div className="panel-box shift-history-panel">
              <h3>سجل الشفتات السابقة</h3>
              {shiftHistory.length === 0 ? <p className="empty-state">لا توجد شفتات مغلقة بعد</p> : <table className="data-table">
                <thead><tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبيعات</th><th>بداية الشفت</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th>الإغلاق</th></tr></thead>
                <tbody>{[...shiftHistory].reverse().map((closedShift) => (
                  <tr key={closedShift.id}>
                    <td>{closedShift.date}</td>
                    <td>{closedShift.invoiceCount || 0}</td>
                    <td>{formatCurrency(closedShift.salesTotal || 0)}</td>
                    <td>{formatCurrency(closedShift.openingCash)}</td>
                    <td>{formatCurrency(closedShift.expectedCash)}</td>
                    <td>{formatCurrency(closedShift.closingCash)}</td>
                    <td>{formatCurrency(closedShift.difference)}</td>
                    <td>{closedShift.closedAt}</td>
                  </tr>
                ))}</tbody>
              </table>}
            </div>
          </section>
        )}

        {activeTab === 'waste' && (
          <section>
            <div className="page-header"><div><span className="eyebrow">المخزون</span><h1>الهالك والتالف</h1></div></div>
            <div className="management-layout">
              <form className="panel-box form-box" onSubmit={addWaste}>
                <h3>تسجيل هالك</h3>
                <select aria-label="مادة الهالك" value={newWaste.ingredient} onChange={(event) => setNewWaste({ ...newWaste, ingredient: event.target.value })}>
                  <option value="">اختر المادة</option>
                  {inventory.map((item) => <option key={item.id} value={item.name}>{translateInventory(item.name)}</option>)}
                </select>
                <input aria-label="كمية الهالك" type="number" min="0" step="0.01" placeholder="الكمية التالفة" value={newWaste.quantity} onChange={(event) => setNewWaste({ ...newWaste, quantity: event.target.value })} />
                <select value={newWaste.reason} onChange={(event) => setNewWaste({ ...newWaste, reason: event.target.value })}><option>تالف</option><option>منتهي الصلاحية</option><option>هدر تحضير</option><option>أخرى</option></select>
                <button className="primary-btn" type="submit" disabled={!inventory.length}>حفظ وخصم من المخزون</button>
              </form>
              <div className="panel-box"><h3>سجل الهالك</h3><table className="data-table"><thead><tr><th>المادة</th><th>الكمية</th><th>السبب</th><th>التاريخ</th><th>الموظف</th><th>الإجراء</th></tr></thead><tbody>{wasteLogs.map((waste) => <tr key={waste.id} className={waste.cancelled ? 'cancelled-row' : ''}><td>{translateInventory(waste.ingredient)}</td><td>{waste.quantity}</td><td>{waste.reason}</td><td>{waste.date}</td><td>{waste.employee}</td><td>{waste.cancelled ? 'ملغى' : <button type="button" className="cancel-action" onClick={() => cancelWaste(waste)}>إلغاء</button>}</td></tr>)}</tbody></table></div>
            </div>
          </section>
        )}

        {activeTab === 'audit' && (
          <section>
            <div className="page-header"><div><span className="eyebrow">الأمان</span><h1>سجل العمليات</h1></div></div>
            <div className="panel-box"><table className="data-table"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الصلاحية</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.id}><td>{log.timestamp}</td><td>{log.employee}</td><td>{['owner', 'manager'].includes(log.role) ? 'مدير' : 'كاشير'}</td><td>{log.action}</td><td>{JSON.stringify(log.details)}</td></tr>)}</tbody></table></div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
