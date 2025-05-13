// script.js

// ==================== Firebase Setup (Assuming Firestore is enabled in your project) ====================
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-analytics.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js"; // Import Firestore functions

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAowg6qNEJ7L6RkorxrMfUO-tIGq_GpEig",
    authDomain: "data-mahmoud-osama.firebaseapp.com",
    projectId: "data-mahmoud-osama",
    storageBucket: "data-mahmoud-osama.firebasestorage.app",
    messagingSenderId: "290421372386",
    appId: "1:290421372386:web:a42c4565c5dec6384035bb",
    measurementId: "G-X8LHNRV75K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Analytics can be kept or removed based on need

// Initialize Firestore
const db = getFirestore(app); // Get a reference to the Firestore database

// Get references to collections
const productsCol = collection(db, 'products');
const customersCol = collection(db, 'customers');
const salesCol = collection(db, 'sales');
const prescriptionsCol = collection(db, 'prescriptions');


// ==================== Global Variables ====================
let products = []; // Data will be fetched from Firestore
let customers = []; // Data will be fetched from Firestore
let sales = [];     // Data will be fetched from Firestore
let prescriptions = []; // Data will be fetched from Firestore
let cart = [];
const CURRENCY = 'جنيه'; // تعريف العملة بشكل مركزي
let reportChartInstance = null; // للاحتفاظ بمثيل الرسم البياني وتدميره عند الحاجة


// ==================== Application Initialization ====================
document.addEventListener('DOMContentLoaded', async function() { // Added async here
    // Load data from Firebase
    await loadData(); // Await the data loading
    
    // Update stats
    updateStats();
    
    // Show the active section
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', async function(e) { // Added async here
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            await showSection(sectionId); // Await showSection as it might load data
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Initialize different sections
    initInventorySection();
    initPosSection();
    initPrescriptionsSection();
    initCustomersSection();
    initReportsSection();
    initModals();

    // Set default date for report and prescription fields
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('prescription-date')) document.getElementById('prescription-date').value = today;
    if(document.getElementById('start-date')) document.getElementById('start-date').value = today;
    if(document.getElementById('end-date')) document.getElementById('end-date').value = today;

    // Show the first section (Dashboard)
    showSection('dashboard');
});

// ==================== Loading and Display Functions ====================
async function loadData() { // Modified to be async and fetch from Firestore
    try {
        // Fetch Products
        const productsSnapshot = await getDocs(productsCol);
        products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Customers
        const customersSnapshot = await getDocs(customersCol);
        customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Sales
        const salesSnapshot = await getDocs(salesCol);
        sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Prescriptions
        const prescriptionsSnapshot = await getDocs(prescriptionsCol);
        prescriptions = prescriptionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log('Data loaded from Firebase:', { products, customers, sales, prescriptions });

    } catch (error) {
        console.error("Error loading data from Firebase:", error);
        // Optionally, display an error message to the user
        alert('فشل في تحميل البيانات من قاعدة البيانات. يرجى التحقق من اتصالك والمحاولة مرة أخرى.');
        // Load from localStorage as a fallback if needed, but Firestore is the primary source now
        // const sampleProducts = [ ... ]; localStorage.setItem(...); products = sampleProducts;
        // ... similar for other collections ...
    }
}

async function showSection(sectionId) { // Added async here
    document.querySelectorAll('main section').forEach(section => section.classList.remove('active-section'));
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.add('active-section');
    
    // Data might need to be re-fetched or rendered based on the section
    // For simplicity here, we assume loadData is sufficient on initial load
    // More complex apps might fetch specific data per section

    switch(sectionId) {
        case 'inventory': renderInventoryTable(); break;
        case 'pos': 
            await loadData(); // Re-fetch data for POS to ensure latest stock/customers
            renderPosProducts(); 
            renderCustomerSelect(document.getElementById('customer-select')); 
            renderCart(); 
            break;
        case 'prescriptions': 
             await loadData(); // Re-fetch data for prescriptions
             renderPrescriptionsTable(); 
             break;
        case 'customers': 
            await loadData(); // Re-fetch data for customers
            renderCustomersTable(); 
            break;
        case 'reports': 
            await loadData(); // Re-fetch data for reports
            populateCustomerReportSelect(); 
            handleReportTypeChange(); 
            generateReport(); // Generate default report on load
            break;
        case 'dashboard':
            await loadData(); // Re-fetch data for dashboard stats
            updateStats();
            break;
    }
}

function updateStats() {
    document.getElementById('total-products').textContent = products.length;
    const today = new Date();
    const expiredCount = products.filter(p => {
        // Ensure expiryDate is treated as a Date object
        const expiry = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate);
         return expiry < today && p.quantity > 0;
    }).length;
    document.getElementById('expired-products').textContent = expiredCount;
    
    const todaySalesTotal = sales.filter(s => {
        // Ensure sale date is treated as a Date object
        const saleDate = s.date instanceof Date ? s.date : new Date(s.date);
        return saleDate.toDateString() === today.toDateString();
    }).reduce((sum, sale) => sum + sale.total, 0);
    document.getElementById('today-sales').textContent = `${todaySalesTotal.toFixed(2)} ${CURRENCY}`;
    
    document.getElementById('total-customers').textContent = customers.length;
}

// ==================== Inventory Management Section ====================
function initInventorySection() {
    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());
    document.getElementById('export-inventory').addEventListener('click', exportAllData); // Still exports all data
    document.getElementById('import-inventory').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importAllData); // Still imports all data
    document.getElementById('inventory-search').addEventListener('input', renderInventoryTable);
    document.getElementById('inventory-filter').addEventListener('change', renderInventoryTable);
}

// renderInventoryTable function remains largely the same, it just uses the global 'products' array

function renderInventoryTable() {
    const searchTerm = document.getElementById('inventory-search').value.toLowerCase();
    const filter = document.getElementById('inventory-filter').value;
    let filteredProducts = [...products];

    if (searchTerm) {
        filteredProducts = filteredProducts.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.barcode.includes(searchTerm) ||
            (p.category && p.category.toLowerCase().includes(searchTerm))
        );
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    switch(filter) {
        case 'expired':
            filteredProducts = filteredProducts.filter(p => {
                 const expiry = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate);
                 return expiry < today && p.quantity > 0;
            });
            break;
        case 'low':
            filteredProducts = filteredProducts.filter(p => p.quantity < 10 && p.quantity > 0);
            break;
    }

    const tbody = document.getElementById('inventory-list');
    tbody.innerHTML = '';
    if (filteredProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">لا توجد منتجات تطابق البحث أو الفلتر.</td></tr>`;
        return;
    }

    filteredProducts.forEach(product => {
        const tr = document.createElement('tr');
        const expiryDate = product.expiryDate instanceof Date ? product.expiryDate : new Date(product.expiryDate);
        if (expiryDate < today && product.quantity > 0) tr.classList.add('expired');
        else if (product.quantity < 5 && product.quantity > 0) tr.classList.add('low-stock');

        tr.innerHTML = `
            <td>${product.barcode}</td>
            <td>${product.name}</td>
            <td>${product.quantity}</td>
            <td>${product.buyPrice.toFixed(2)} ${CURRENCY}</td>
            <td>${product.sellPrice.toFixed(2)} ${CURRENCY}</td>
            <td>${formatDate(product.expiryDate, 'short')}</td>
            <td>
                <button class="edit-btn" onclick="openProductModal('${product.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteProduct('${product.id}')"><i class="fas fa-trash"></i> حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}


async function openProductModal(id = null) { // Added async here
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('product-id').value = '';

    if (id) {
        // Fetch product by ID from the current products array (assumes it's up-to-date)
        const product = products.find(p => p.id === id);
        if (!product) {
            alert('المنتج غير موجود.'); // Or re-fetch from Firestore if array might be stale
            return;
        }
        document.getElementById('product-modal-title').textContent = 'تعديل المنتج';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-barcode').value = product.barcode;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category || '';
        document.getElementById('product-quantity').value = product.quantity;
        document.getElementById('product-buy-price').value = product.buyPrice;
        document.getElementById('product-sell-price').value = product.sellPrice;
        // Handle date format for input field
        document.getElementById('product-expiry').value = product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : '';
        document.getElementById('product-notes').value = product.notes || '';
    } else {
        document.getElementById('product-modal-title').textContent = 'إضافة منتج جديد';
         // Generate a new barcode suggestion? Or leave empty for manual entry.
         // document.getElementById('product-barcode').value = Date.now().toString().slice(-10);
    }
    modal.style.display = 'block';
}

async function saveProductForm(event) { // Modified to be async and save to Firestore
    event.preventDefault();
    const id = document.getElementById('product-id').value;
    const newProductData = {
        barcode: document.getElementById('product-barcode').value,
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        quantity: parseInt(document.getElementById('product-quantity').value),
        buyPrice: parseFloat(document.getElementById('product-buy-price').value),
        sellPrice: parseFloat(document.getElementById('product-sell-price').value),
        // Store date as a string or Timestamp if preferred by Firestore design
        expiryDate: document.getElementById('product-expiry').value, 
        notes: document.getElementById('product-notes').value
    };

    if (!newProductData.barcode || !newProductData.name || isNaN(newProductData.quantity) || isNaN(newProductData.buyPrice) || isNaN(newProductData.sellPrice) || !newProductData.expiryDate) {
        alert('الرجاء ملء جميع الحقول الإلزامية بشكل صحيح.');
        return;
    }
    
    try {
        if (id) {
            // Update existing document in Firestore
            const productRef = doc(db, 'products', id);
            await updateDoc(productRef, newProductData);
            alert('تم تحديث المنتج بنجاح.');
        } else {
            // Add new document to Firestore
            // Firestore automatically generates a unique ID
            const docRef = await addDoc(productsCol, newProductData);
            // The new document's ID is docRef.id
            alert('تم إضافة المنتج بنجاح.');
        }

        document.getElementById('product-modal').style.display = 'none';
        await loadData(); // Re-load data after saving
        renderInventoryTable();
        renderPosProducts();
        updateStats();

    } catch (error) {
        console.error("Error saving product:", error);
        alert('فشل في حفظ المنتج. يرجى المحاولة مرة أخرى.');
    }
}

async function deleteProduct(id) { // Modified to be async and delete from Firestore
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.')) {
        try {
            // Delete document from Firestore
            const productRef = doc(db, 'products', id);
            await deleteDoc(productRef);
            alert('تم حذف المنتج بنجاح.');

            await loadData(); // Re-load data after deleting
            renderInventoryTable();
            renderPosProducts();
            updateStats();

        } catch (error) {
            console.error("Error deleting product:", error);
            alert('فشل في حذف المنتج. يرجى المحاولة مرة أخرى.');
        }
    }
}


// ==================== Point of Sale Section ====================
function initPosSection() {
    document.getElementById('pos-search').addEventListener('input', renderPosProducts);
    document.getElementById('add-new-customer-pos-btn').addEventListener('click', () => openCustomerModal(null, true));
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    document.getElementById('complete-sale').addEventListener('click', completeSale);
    document.getElementById('discount-input').addEventListener('input', renderCart);
    document.getElementById('discount-type').addEventListener('change', renderCart);
}

// renderPosProducts function remains largely the same, uses the global 'products' array

function renderPosProducts() {
    const searchTerm = document.getElementById('pos-search').value.toLowerCase();
    const container = document.getElementById('pos-products');
    container.innerHTML = '';

    const availableProducts = products.filter(p => {
         const expiry = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate);
         return p.quantity > 0 && expiry >= new Date();
    });


    let filteredProducts = availableProducts;
    if (searchTerm) {
        filteredProducts = availableProducts.filter(p =>
            p.name.toLowerCase().includes(searchTerm) || p.barcode.includes(searchTerm)
        );
    }

    if (filteredProducts.length === 0) {
        container.innerHTML = `<p style="grid-column: 1 / -1; text-align: center;">لا توجد منتجات متاحة تطابق البحث.</p>`;
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p>الباركود: ${product.barcode}</p>
            <p class="price">${product.sellPrice.toFixed(2)} ${CURRENCY}</p>
            <p>المتاح: ${product.quantity}</p>
        `;
        card.addEventListener('click', () => addToCart(product.id)); // Use Firestore ID
        container.appendChild(card);
    });
}

// renderCustomerSelect function remains the same, uses the global 'customers' array
function renderCustomerSelect(selectElement) {
    selectElement.innerHTML = '<option value="">عميل نقدي</option>';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id; // Use Firestore ID
        option.textContent = customer.name;
        selectElement.appendChild(option);
    });
}


function addToCart(productId) { // Use Firestore ID
    const product = products.find(p => p.id === productId); // Find by Firestore ID
    if (!product || product.quantity <= 0) {
        alert('المنتج غير متوفر أو الكمية نفذت.');
        return;
    }
     const expiry = product.expiryDate instanceof Date ? product.expiryDate : new Date(product.expiryDate);
    if (expiry < new Date()) {
        alert('هذا المنتج منتهي الصلاحية ولا يمكن بيعه.');
        return;
    }

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        if (existingItem.quantity < product.quantity) {
            existingItem.quantity++;
        } else {
            alert('لا يمكن إضافة كمية أكثر من المتاح في المخزون.');
            return;
        }
    } else {
        // Store product ID (Firestore ID) in the cart
        cart.push({ productId, name: product.name, price: product.sellPrice, quantity: 1 });
    }
    renderCart();
}

// renderCart, updateCartItemQuantity, validateCartItemQuantity, removeCartItem
// functions remain largely the same, they operate on the 'cart' array
// but use the Firestore productId stored within the cart items.

function renderCart() {
    const tbody = document.getElementById('cart-items');
    tbody.innerHTML = '';
    let subtotal = 0;

    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">السلة فارغة</td></tr>';
    } else {
        cart.forEach((item, index) => {
            // Find the product in the current products list by its Firestore ID
            const productInStock = products.find(p => p.id === item.productId);
            const maxQuantity = productInStock ? productInStock.quantity : 0;
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>
                    <input type="number" min="1" max="${maxQuantity}" value="${item.quantity}"
                           onchange="updateCartItemQuantity(${index}, this.value)"
                           onblur="validateCartItemQuantity(this, ${maxQuantity})">
                </td>
                <td>${item.price.toFixed(2)}</td>
                <td>${itemTotal.toFixed(2)}</td>
                <td><button class="delete-btn" onclick="removeCartItem(${index})"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    const discountInput = document.getElementById('discount-input').value;
    const discountType = document.getElementById('discount-type').value;
    let discountValue = parseFloat(discountInput) || 0;
    let discountAmount = 0;

    if (discountType === 'percent') {
        discountAmount = subtotal * (discountValue / 100);
    } else {
        discountAmount = discountValue;
    }

    if (discountAmount > subtotal) {
        discountAmount = subtotal;
        if (discountType === 'fixed') document.getElementById('discount-input').value = subtotal.toFixed(2);
    }

    const total = subtotal - discountAmount;

    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('discount-amount').textContent = discountAmount.toFixed(2);
    document.getElementById('total').textContent = total.toFixed(2);
}

function updateCartItemQuantity(index, newQuantity) {
    newQuantity = parseInt(newQuantity);
    const item = cart[index];
     // Find the product in the current products list by its Firestore ID
    const productInStock = products.find(p => p.id === item.productId);
    const maxQuantity = productInStock ? productInStock.quantity : 0;

    if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
    if (newQuantity > maxQuantity) {
        alert(`الكمية القصوى المتاحة لهذا المنتج هي ${maxQuantity}.`);
        newQuantity = maxQuantity;
        const inputField = document.getElementById('cart-items').rows[index+1].cells[1].getElementsByTagName('input')[0]; // +1 because tbody children doesn't include head
        if(inputField) inputField.value = newQuantity;
    }
    cart[index].quantity = newQuantity;
    renderCart();
}
function validateCartItemQuantity(inputElement, maxQuantity) {
    let value = parseInt(inputElement.value);
     if (isNaN(value) || value < 1) {
        inputElement.value = 1;
    } else if (value > maxQuantity) {
        alert(`الكمية القصوى المتاحة لهذا المنتج هي ${maxQuantity}.`);
        inputElement.value = maxQuantity;
    }
    const rowIndex = inputElement.closest('tr').rowIndex -1;
    updateCartItemQuantity(rowIndex, parseInt(inputElement.value));
}

function removeCartItem(index) {
    cart.splice(index, 1);
    renderCart();
}


async function completeSale() { // Modified to be async and save to Firestore
    if (cart.length === 0) {
        alert('السلة فارغة. الرجاء إضافة منتجات أولاً.');
        return;
    }

    // Validate quantities against current stock before completing sale
    for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product || product.quantity < item.quantity) {
            alert(`الكمية المطلوبة من ${product.name} (${item.quantity}) غير متوفرة. المتاح: ${product ? product.quantity : 0}.`);
             // Optionally, update cart render here if stock changed since load
            renderCart();
            return;
        }
        const expiry = product.expiryDate instanceof Date ? product.expiryDate : new Date(product.expiryDate);
         if (expiry < new Date()) {
             alert(`منتج ${product.name} منتهي الصلاحية ولا يمكن بيعه.`);
             return;
        }
    }

    const customerId = document.getElementById('customer-select').value || null; // Store Firestore customer ID
    const paymentMethod = document.querySelector('.payment-btn.active').getAttribute('data-method');
    const subtotal = parseFloat(document.getElementById('subtotal').textContent);
    const discount = parseFloat(document.getElementById('discount-amount').textContent);
    const total = parseFloat(document.getElementById('total').textContent);

    const newSale = {
        // Firestore will generate the ID
        invoiceNumber: `INV-${String(new Date().getTime()).slice(-6)}`,
        customerId: customerId, // Store Firestore customer ID or null
        date: new Date().toISOString(), // Store date as ISO string
        items: cart.map(item => ({
            productId: item.productId, // Store Firestore product ID
            name: item.name,
            quantity: item.quantity,
            price: item.price
        })),
        subtotal,
        discount,
        total,
        paymentMethod
    };

    try {
        // 1. Add the new sale document to Firestore
        const saleDocRef = await addDoc(salesCol, newSale);
        newSale.id = saleDocRef.id; // Get the generated Firestore ID

        // 2. Update product quantities in Firestore in a transaction for atomicity (optional but recommended)
        // For simplicity here, we'll do individual updates, but transactions are better for multiple related writes
        const updates = cart.map(item => {
            const product = products.find(p => p.id === item.productId);
            const newQuantity = product.quantity - item.quantity;
            const productRef = doc(db, 'products', item.productId); // Reference using Firestore ID
            return updateDoc(productRef, { quantity: newQuantity });
        });
        await Promise.all(updates); // Wait for all product updates to complete

        alert('تم إتمام عملية البيع بنجاح!');
        showInvoice(newSale);

        // Clear cart and re-render sections
        cart = [];
        document.getElementById('discount-input').value = 0;

        await loadData(); // Re-load data after sale
        renderCart();
        renderPosProducts(); // Re-render POS products with updated stock
        renderInventoryTable(); // Re-render inventory table
        updateStats();

    } catch (error) {
        console.error("Error completing sale:", error);
        alert('فشل في إتمام عملية البيع. يرجى المحاولة مرة أخرى.');
        // Optionally, roll back stock quantities if the sale failed after some products were updated.
        // This is complex and highlights the benefit of Firestore transactions.
    }
}

// showInvoice function remains largely the same, it uses the sale object passed to it.
// It will need to lookup customer by Firestore ID if customer details are needed beyond the stored ID.

function showInvoice(sale) {
    const invoiceModal = document.getElementById('invoice-modal');
     // Find customer by Firestore ID
    const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;

    document.getElementById('invoice-number').textContent = `رقم الفاتورة: ${sale.invoiceNumber}`;
    document.getElementById('invoice-date').textContent = `التاريخ: ${formatDate(sale.date)}`;
    document.getElementById('invoice-customer-name').textContent = customer ? customer.name : 'عميل نقدي';
    document.getElementById('invoice-customer-phone').textContent = customer && customer.phone ? `الهاتف: ${customer.phone}` : '';

    const tbody = document.getElementById('invoice-items-body');
    tbody.innerHTML = '';
    sale.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toFixed(2)} ${CURRENCY}</td>
            <td>${(item.price * item.quantity).toFixed(2)} ${CURRENCY}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('invoice-subtotal').textContent = `${sale.subtotal.toFixed(2)} ${CURRENCY}`;
    document.getElementById('invoice-discount').textContent = `${sale.discount.toFixed(2)} ${CURRENCY}`;
    document.getElementById('invoice-total').textContent = `${sale.total.toFixed(2)} ${CURRENCY}`;

    let paymentMethodText = '';
    switch(sale.paymentMethod) {
        case 'cash': paymentMethodText = 'نقدي'; break;
        case 'card': paymentMethodText = 'بطاقة ائتمان'; break;
        case 'transfer': paymentMethodText = 'تحويل بنكي'; break;
        default: paymentMethodText = 'غير محدد';
    }
    document.getElementById('invoice-payment-method').textContent = paymentMethodText;

    invoiceModal.style.display = 'block';

    document.getElementById('print-invoice').onclick = () => window.print();
    document.getElementById('email-invoice').onclick = () => {
        if (customer && customer.email) {
            alert(`تم إرسال الفاتورة (وهمياً) إلى ${customer.email}`);
        } else {
            alert('لا يوجد بريد إلكتروني مسجل لهذا العميل أو هو عميل نقدي.');
        }
    };
}


// ==================== Prescriptions Section ====================
function initPrescriptionsSection() {
    document.getElementById('add-prescription-btn').addEventListener('click', () => openPrescriptionModal());
}

// renderPrescriptionsTable function remains largely the same, uses global arrays
function renderPrescriptionsTable() {
    const tbody = document.getElementById('prescriptions-list');
    tbody.innerHTML = '';
    if (prescriptions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد وصفات طبية مسجلة.</td></tr>';
        return;
    }

    prescriptions.forEach(prescription => {
        // Find customer by Firestore ID
        const customer = customers.find(c => c.id === prescription.customerId);
        const tr = document.createElement('tr');
        let statusText = '', statusClass = '';
        switch(prescription.status) {
            case 'pending': statusText = 'قيد التنفيذ'; statusClass = 'status-pending'; break;
            case 'completed': statusText = 'مكتملة'; statusClass = 'status-completed'; break;
            case 'cancelled': statusText = 'ملغاة'; statusClass = 'status-cancelled'; break;
            default: statusText = 'غير معروف';
        }

        tr.innerHTML = `
            <td>PR-${String(prescription.id).padStart(4, '0')}</td>
            <td>${customer ? customer.name : 'عميل محذوف'}</td>
            <td>${prescription.doctorName}</td>
            <td>${formatDate(prescription.date, 'short')}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>
                <button class="edit-btn" onclick="openPrescriptionModal('${prescription.id}')"><i class="fas fa-eye"></i> عرض/تعديل</button>
                <button class="delete-btn" onclick="deletePrescription('${prescription.id}')"><i class="fas fa-trash"></i> حذف</button>
                ${prescription.status === 'pending' ? `<button onclick="dispensePrescription('${prescription.id}')"><i class="fas fa-check-double"></i> صرف الوصفة</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}


async function dispensePrescription(prescriptionId) { // Modified to be async and interact with Firestore
    // Find prescription by Firestore ID
    const prescription = prescriptions.find(p => p.id === prescriptionId);
    if (!prescription || prescription.status !== 'pending') {
        alert('لا يمكن صرف هذه الوصفة.');
        return;
    }

    // Validate quantities against current stock before dispensing
    for (const item of prescription.items) {
         // Find product by Firestore ID
        const product = products.find(p => p.id === item.productId);
        if (!product || product.quantity < item.quantity) {
            alert(`المنتج ${product ? product.name : 'غير معروف'} غير متوفر بالكمية المطلوبة (${item.quantity}). المتاح: ${product ? product.quantity : 0}.`);
             await loadData(); // Re-load data to show correct stock
             renderInventoryTable();
            return;
        }
         const expiry = product.expiryDate instanceof Date ? product.expiryDate : new Date(product.expiryDate);
         if (expiry < new Date()) {
             alert(`منتج ${product.name} منتهي الصلاحية.`);
             return;
         }
    }

    if (confirm('هل أنت متأكد من صرف هذه الوصفة؟ سيتم تحديث المخزون وإنشاء فاتورة بيع.')) {
        const saleItems = [];
        let subtotal = 0;
        prescription.items.forEach(item => {
             // Find product by Firestore ID
            const product = products.find(p => p.id === item.productId);
            if(product){ // Ensure product exists
                 saleItems.push({
                    productId: product.id, // Store Firestore product ID
                    name: product.name,
                    quantity: item.quantity,
                    price: product.sellPrice
                });
                subtotal += product.sellPrice * item.quantity;
            }
        });

        const newSale = {
            // Firestore will generate the ID
            invoiceNumber: `INV-PR-${String(new Date().getTime()).slice(-5)}`,
            customerId: prescription.customerId, // Store Firestore customer ID
            date: new Date().toISOString(), // Store date as ISO string
            items: saleItems,
            subtotal: subtotal,
            discount: 0,
            total: subtotal,
            paymentMethod: 'cash' // Default payment method for dispensed prescriptions
        };

        try {
            // 1. Add the new sale document to Firestore
            const saleDocRef = await addDoc(salesCol, newSale);
            newSale.id = saleDocRef.id; // Get the generated Firestore ID

            // 2. Update product quantities in Firestore
            const updates = prescription.items.map(item => {
                const product = products.find(p => p.id === item.productId);
                const newQuantity = product.quantity - item.quantity;
                const productRef = doc(db, 'products', item.productId); // Reference using Firestore ID
                return updateDoc(productRef, { quantity: newQuantity });
            });
            await Promise.all(updates);

            // 3. Update prescription status to 'completed' in Firestore
            const prescriptionRef = doc(db, 'prescriptions', prescriptionId); // Reference using Firestore ID
            await updateDoc(prescriptionRef, { status: 'completed' });

            alert('تم صرف الوصفة وتحديث المخزون بنجاح.');
            showInvoice(newSale);

            await loadData(); // Re-load data after dispensing
            renderPrescriptionsTable(); // Re-render prescriptions table
            renderInventoryTable(); // Re-render inventory table
            updateStats();

        } catch (error) {
            console.error("Error dispensing prescription:", error);
            alert('فشل في صرف الوصفة. يرجى المحاولة مرة أخرى.');
             // Rollback logic would be needed here in a robust system
        }
    }
}


async function openPrescriptionModal(id = null) { // Added async here
    const modal = document.getElementById('prescription-modal');
    const form = document.getElementById('prescription-form');
    form.reset();
    document.getElementById('prescription-id').value = '';
    document.getElementById('prescription-items-container').innerHTML = '';

    const customerSelect = document.getElementById('prescription-customer');
    renderCustomerSelect(customerSelect); // Uses global 'customers' array

    if (id) {
        // Find prescription by Firestore ID
        const prescription = prescriptions.find(p => p.id === id);
        if (!prescription) {
             alert('الوصفة غير موجودة.'); // Or re-fetch from Firestore
             return;
        }
        document.getElementById('prescription-modal-title').textContent = `تفاصيل الوصفة PR-${String(id).padStart(4,'0')}`;
        document.getElementById('prescription-id').value = prescription.id; // Store Firestore ID
        customerSelect.value = prescription.customerId; // Use Firestore customer ID
        document.getElementById('prescription-doctor').value = prescription.doctorName;
        document.getElementById('prescription-date').value = prescription.date ? new Date(prescription.date).toISOString().split('T')[0] : '';
        document.getElementById('prescription-diagnosis').value = prescription.diagnosis || '';
        document.getElementById('prescription-notes').value = prescription.notes || '';

        // Populate items - need products list for select options
        // We can re-use renderCustomerSelect logic for product select
        prescription.items.forEach(item => addPrescriptionItem(item));
    } else {
        document.getElementById('prescription-modal-title').textContent = 'وصفة طبية جديدة';
        addPrescriptionItem(); // Add a blank item row
        document.getElementById('prescription-date').value = new Date().toISOString().split('T')[0];
    }
    modal.style.display = 'block';
}

function addPrescriptionItem(itemData = null) {
    const container = document.getElementById('prescription-items-container');
    const template = document.getElementById('prescription-item-template');
    const newItem = template.cloneNode(true);
    newItem.removeAttribute('id');
    newItem.style.display = 'flex';

    const productSelect = newItem.querySelector('.prescription-product');
    productSelect.innerHTML = '<option value="">اختر الدواء...</option>';
    // Use global 'products' array (assumes it's up-to-date)
    products.filter(p => {
        const expiry = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate);
        return p.quantity > 0 && expiry >= new Date();
    }).forEach(product => {
        const option = document.createElement('option');
        option.value = product.id; // Use Firestore ID
        option.textContent = `${product.name} (المتاح: ${product.quantity})`;
        productSelect.appendChild(option);
    });

    if (itemData) {
        productSelect.value = itemData.productId; // Use Firestore product ID
        newItem.querySelector('.prescription-quantity').value = itemData.quantity;
        newItem.querySelector('.prescription-dosage').value = itemData.dosage;
    }

    newItem.querySelector('.remove-prescription-item').addEventListener('click', function() {
         // Check if this is the only item before removing
        if (container.children.length > 1) {
             container.removeChild(newItem);
        } else {
            alert('يجب أن تحتوي الوصفة على دواء واحد على الأقل.');
        }
    });
    container.appendChild(newItem);
}


async function savePrescriptionForm(event) { // Modified to be async and save to Firestore
    event.preventDefault();
    const id = document.getElementById('prescription-id').value;
    const prescriptionData = {
        customerId: document.getElementById('prescription-customer').value || null, // Store Firestore customer ID or null
        doctorName: document.getElementById('prescription-doctor').value,
        date: document.getElementById('prescription-date').value, // Store date as string
        diagnosis: document.getElementById('prescription-diagnosis').value,
        notes: document.getElementById('prescription-notes').value,
        items: []
    };

    if (!prescriptionData.customerId || !prescriptionData.doctorName || !prescriptionData.date) {
        alert('الرجاء ملء حقول العميل، الطبيب، وتاريخ الوصفة.');
        return;
    }

    const itemElements = document.getElementById('prescription-items-container').children;
    for (let i = 0; i < itemElements.length; i++) {
        const itemEl = itemElements[i];
        const productId = itemEl.querySelector('.prescription-product').value;
        const quantity = parseInt(itemEl.querySelector('.prescription-quantity').value);
        const dosage = itemEl.querySelector('.prescription-dosage').value;
        if (!productId || isNaN(quantity) || quantity < 1) {
            alert('الرجاء التأكد من اختيار دواء وكمية صحيحة لكل عنصر في الوصفة.');
            return;
        }
        // Store Firestore product ID in item
        prescriptionData.items.push({ productId: productId, quantity, dosage });
    }
    if (prescriptionData.items.length === 0) {
        alert('يجب إضافة دواء واحد على الأقل للوصفة.');
        return;
    }

    try {
        if (id) {
            // Update existing document in Firestore
            const prescriptionRef = doc(db, 'prescriptions', id);
            await updateDoc(prescriptionRef, prescriptionData);
            alert('تم تحديث الوصفة بنجاح.');
        } else {
            // Add new document to Firestore
             // Firestore automatically generates a unique ID
            const docRef = await addDoc(prescriptionsCol, { ...prescriptionData, status: 'pending' }); // Add initial status
             prescriptionData.id = docRef.id; // Store the generated ID if needed immediately
            alert('تم إضافة الوصفة بنجاح.');
        }

        document.getElementById('prescription-modal').style.display = 'none';
        await loadData(); // Re-load data after saving
        renderPrescriptionsTable();

    } catch (error) {
        console.error("Error saving prescription:", error);
        alert('فشل في حفظ الوصفة. يرجى المحاولة مرة أخرى.');
    }
}

async function deletePrescription(id) { // Modified to be async and delete from Firestore
    if (confirm('هل أنت متأكد من حذف هذه الوصفة؟ لا يمكن التراجع عن هذا الإجراء.')) {
        try {
            // Delete document from Firestore
            const prescriptionRef = doc(db, 'prescriptions', id);
            await deleteDoc(prescriptionRef);
             alert('تم حذف الوصفة بنجاح.');

            await loadData(); // Re-load data after deleting
            renderPrescriptionsTable();

        } catch (error) {
            console.error("Error deleting prescription:", error);
            alert('فشل في حذف الوصفة. يرجى المحاولة مرة أخرى.');
        }
    }
}


// ==================== Customers Section ====================
function initCustomersSection() {
    document.getElementById('add-customer-btn2').addEventListener('click', () => openCustomerModal());
}

// renderCustomersTable function remains largely the same, uses global arrays
function renderCustomersTable() {
    const tbody = document.getElementById('customers-list');
    tbody.innerHTML = '';
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا يوجد عملاء مسجلون.</td></tr>';
        return;
    }

    customers.forEach(customer => {
        // Find sales by Firestore customer ID
        const customerSales = sales.filter(s => s.customerId === customer.id);
        const totalSpent = customerSales.reduce((sum, sale) => sum + sale.total, 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.email || '-'}</td>
            <td>${formatDate(customer.createdAt, 'short')}</td>
            <td>${totalSpent.toFixed(2)} ${CURRENCY}</td>
            <td>
                <button class="edit-btn" onclick="openCustomerModal('${customer.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCustomer('${customer.id}')"><i class="fas fa-trash"></i> حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}


async function openCustomerModal(id = null, refreshPosSelect = false) { // Added async here
    const modal = document.getElementById('customer-modal');
    const form = document.getElementById('customer-form');
    form.reset();
    document.getElementById('customer-id').value = '';
    form.onsubmit = (event) => saveCustomerForm(event, refreshPosSelect); // Pass refresh flag

    if (id) {
         // Find customer by Firestore ID
        const customer = customers.find(c => c.id === id);
        if (!customer) {
             alert('العميل غير موجود.'); // Or re-fetch from Firestore
             return;
        }
        document.getElementById('customer-modal-title').textContent = 'تعديل بيانات العميل';
        document.getElementById('customer-id').value = customer.id; // Store Firestore ID
        document.getElementById('customer-name').value = customer.name;
        document.getElementById('customer-phone').value = customer.phone || '';
        document.getElementById('customer-email').value = customer.email || '';
        document.getElementById('customer-address').value = customer.address || '';
        document.getElementById('customer-notes').value = customer.notes || '';
    } else {
        document.getElementById('customer-modal-title').textContent = 'إضافة عميل جديد';
    }
    modal.style.display = 'block';
}

async function saveCustomerForm(event, refreshPosSelect = false) { // Modified to be async and save to Firestore
    event.preventDefault();
    const id = document.getElementById('customer-id').value; // Firestore ID if editing
    const customerData = {
        name: document.getElementById('customer-name').value,
        phone: document.getElementById('customer-phone').value,
        email: document.getElementById('customer-email').value,
        address: document.getElementById('customer-address').value,
        notes: document.getElementById('customer-notes').value
    };

    if (!customerData.name) {
        alert('الرجاء إدخال اسم العميل.');
        return;
    }

    try {
        if (id) {
            // Update existing document in Firestore
            const customerRef = doc(db, 'customers', id);
            await updateDoc(customerRef, customerData);
            alert('تم تحديث بيانات العميل بنجاح.');
        } else {
            // Add new document to Firestore
            // Firestore automatically generates a unique ID
            const docRef = await addDoc(customersCol, { ...customerData, createdAt: new Date().toISOString() }); // Add creation date
            customerData.id = docRef.id; // Store the generated ID
            alert('تم إضافة العميل بنجاح.');
        }

        document.getElementById('customer-modal').style.display = 'none';
        await loadData(); // Re-load data after saving
        renderCustomersTable();
        if (refreshPosSelect) {
            renderCustomerSelect(document.getElementById('customer-select'));
            // Select the newly added customer in the POS dropdown
            document.getElementById('customer-select').value = customerData.id || id;
        }
        renderCustomerSelect(document.getElementById('prescription-customer'));
        populateCustomerReportSelect();
        updateStats();

    } catch (error) {
        console.error("Error saving customer:", error);
        alert('فشل في حفظ بيانات العميل. يرجى المحاولة مرة أخرى.');
    }
}


async function deleteCustomer(id) { // Modified to be async and delete from Firestore
     // Check if this customer has any sales associated with their Firestore ID
    const customerSales = sales.filter(s => s.customerId === id);
    if (customerSales.length > 0) {
        if (!confirm('هذا العميل لديه فواتير مسجلة. هل أنت متأكد من حذفه؟ (لن يتم حذف الفواتير من سجل المبيعات ولكن لن تكون مرتبطة بالعميل المحذوف في المستقبل).')) return;
    } else {
        if (!confirm('هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    }

    try {
        // Delete document from Firestore
        const customerRef = doc(db, 'customers', id);
        await deleteDoc(customerRef);
        alert('تم حذف العميل بنجاح.');

        await loadData(); // Re-load data after deleting
        renderCustomersTable();
        renderCustomerSelect(document.getElementById('customer-select')); // Update POS dropdown
        renderCustomerSelect(document.getElementById('prescription-customer')); // Update Prescriptions dropdown
        populateCustomerReportSelect(); // Update reports dropdown
        updateStats();

    } catch (error) {
        console.error("Error deleting customer:", error);
        alert('فشل في حذف العميل. يرجى المحاولة مرة أخرى.');
    }
}


// ==================== Reports Section ====================
function initReportsSection() {
    document.getElementById('report-type').addEventListener('change', handleReportTypeChange);
    document.getElementById('report-period').addEventListener('change', () => {
        document.getElementById('custom-dates').style.display =
            document.getElementById('report-period').value === 'custom' ? 'flex' : 'none';
    });
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('export-report').addEventListener('click', exportReportToCSV);

    handleReportTypeChange();
    populateCustomerReportSelect();
}

// handleReportTypeChange, populateCustomerReportSelect, clearReportArea
// remain largely the same, they operate on the UI and global arrays.

function handleReportTypeChange() {
    const reportType = document.getElementById('report-type').value;
    const customerSelectionDiv = document.getElementById('customer-selection-div');
    if (reportType === 'customer_transactions' || reportType === 'customer_summary') { // Also show for customer summary
        customerSelectionDiv.style.display = 'block';
    } else {
        customerSelectionDiv.style.display = 'none';
    }
     const chartContainer = document.querySelector('.chart-container');
    const customerSummaryDetails = document.getElementById('customer-report-details-summary');
    const reportTableContainer = document.querySelector('.report-table-container');

    if (reportType === 'customer_transactions') {
        if(chartContainer) chartContainer.style.display = 'none';
        if(customerSummaryDetails) customerSummaryDetails.style.display = 'block';
        if(reportTableContainer) reportTableContainer.style.marginTop = '10px';
    } else if (reportType === 'customer_summary') {
         if(chartContainer) chartContainer.style.display = 'block'; // Show chart for summary
         if(customerSummaryDetails) customerSummaryDetails.style.display = 'none'; // No detailed summary div
         if(reportTableContainer) reportTableContainer.style.marginTop = '20px';
    } else {
        if(chartContainer) chartContainer.style.display = 'block';
        if(customerSummaryDetails) customerSummaryDetails.style.display = 'none';
        if(reportTableContainer) reportTableContainer.style.marginTop = '20px';
    }
    clearReportArea();
}

function populateCustomerReportSelect() {
    const select = document.getElementById('report-customer-select');
    select.innerHTML = '<option value="">-- اختر العميل --</option>';
    // Use global 'customers' array
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id; // Use Firestore ID
        option.textContent = customer.name;
        select.appendChild(option);
    });
}

function clearReportArea() {
    document.getElementById('report-title-area').innerHTML = '';
    document.getElementById('report-table-head').innerHTML = '';
    document.getElementById('report-data').innerHTML = '<tr><td colspan="5" style="text-align:center;">اختر نوع التقرير والفترة ثم اضغط "توليد التقرير".</td></tr>';

    const customerSummaryDiv = document.getElementById('customer-report-details-summary');
    customerSummaryDiv.innerHTML = '';
    // Keep display state based on report type after clearing
    const reportType = document.getElementById('report-type').value;
     if (reportType !== 'customer_transactions') {
        customerSummaryDiv.style.display = 'none';
    }


    if (reportChartInstance) {
        reportChartInstance.destroy();
        reportChartInstance = null;
    }
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
        const existingErrorMsg = chartContainer.querySelector('.chart-error-message');
        if (existingErrorMsg) {
            existingErrorMsg.remove();
        }
        const chartCanvas = document.getElementById('report-chart');
        if (chartCanvas) {
            chartCanvas.style.display = 'block';
        }
        // Keep display state based on report type after clearing
         if (reportType === 'customer_transactions') {
            chartContainer.style.display = 'none';
        } else {
             chartContainer.style.display = 'block';
        }
    }
}


function generateReport() {
    clearReportArea();

    const reportType = document.getElementById('report-type').value;
    const period = document.getElementById('report-period').value;
    let startDate, endDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    switch(period) {
        case 'today':
            startDate = new Date(today);
            endDate = new Date(endOfToday);
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1) );
            endDate = new Date(endOfToday);
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(endOfToday);
            break;
        case 'year':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(endOfToday);
            break;
        case 'custom':
            const startVal = document.getElementById('start-date').value;
            const endVal = document.getElementById('end-date').value;
            if (!startVal || !endVal) {
                alert('الرجاء اختيار تاريخ بداية ونهاية للفترة المخصصة.');
                document.getElementById('report-data').innerHTML = '<tr><td colspan="5" style="text-align:center;">الرجاء اختيار تاريخ بداية ونهاية للفترة المخصصة.</td></tr>';
                return;
            }
            startDate = new Date(startVal);
            startDate.setHours(0,0,0,0);
            endDate = new Date(endVal);
            endDate.setHours(23,59,59,999);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
                alert('الرجاء اختيار فترة تاريخ صحيحة.');
                document.getElementById('report-data').innerHTML = '<tr><td colspan="5" style="text-align:center;">الرجاء اختيار فترة تاريخ صحيحة.</td></tr>';
                return;
            }
            break;
        default:
            alert('الرجاء اختيار فترة التقرير.');
             document.getElementById('report-data').innerHTML = '<tr><td colspan="5" style="text-align:center;">الرجاء اختيار فترة التقرير.</td></tr>';
            return;
    }

    const reportTitleArea = document.getElementById('report-title-area');
    const reportTableBody = document.getElementById('report-data');
    const chartContainer = document.querySelector('.chart-container');
    const customerSummaryDiv = document.getElementById('customer-report-details-summary');


     reportTableBody.innerHTML = ''; // Clear previous report data
     // Set display based on report type
    if (reportType === 'customer_transactions') {
        chartContainer.style.display = 'none';
        customerSummaryDiv.style.display = 'block';
    } else {
        chartContainer.style.display = 'block';
        customerSummaryDiv.style.display = 'none';
    }


    switch(reportType) {
        case 'sales':
            reportTitleArea.innerHTML = `<h3>تقرير المبيعات للفترة: ${formatDate(startDate, 'short')} - ${formatDate(endDate, 'short')}</h3>`;
            generateSalesReport(startDate, endDate);
            break;
        case 'inventory_summary':
            reportTitleArea.innerHTML = `<h3>ملخص المخزون الحالي</h3>`;
            generateInventorySummaryReport();
            break;
        case 'expired_products':
            reportTitleArea.innerHTML = `<h3>تقرير المنتجات منتهية الصلاحية أو التي ستنتهي خلال 30 يومًا</h3>`;
            generateExpiredProductsReport();
            break;
        case 'customer_summary':
            reportTitleArea.innerHTML = `<h3>ملخص العملاء للفترة: ${formatDate(startDate, 'short')} - ${formatDate(endDate, 'short')}</h3>`;
            generateCustomerSummaryReport(startDate, endDate);
            break;
        case 'customer_transactions':
            const customerId = document.getElementById('report-customer-select').value;
            if (!customerId) {
                alert('الرجاء اختيار عميل لعرض تقرير معاملاته.');
                reportTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">الرجاء اختيار عميل.</td></tr>';
                // Also hide summary and chart
                customerSummaryDiv.style.display = 'none';
                chartContainer.style.display = 'none';
                return;
            }
             // Find customer by Firestore ID
            const selectedCustomer = customers.find(c => c.id === customerId);
            if(!selectedCustomer){
                 alert('العميل المختار غير موجود.');
                 reportTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">العميل المختار غير موجود.</td></tr>';
                 customerSummaryDiv.style.display = 'none';
                 chartContainer.style.display = 'none';
                 return;
            }
            reportTitleArea.innerHTML = `<h3>تقرير معاملات العميل: ${selectedCustomer.name}</h3><p>الفترة: ${formatDate(startDate, 'short')} - ${formatDate(endDate, 'short')}</p>`;
            generateCustomerTransactionsReport(customerId, startDate, endDate); // Pass Firestore ID
            break;
        default:
             reportTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">الرجاء اختيار نوع تقرير صالح.</td></tr>';
             chartContainer.style.display = 'none';
             customerSummaryDiv.style.display = 'none';
    }
}

// generateSalesReport, generateInventorySummaryReport, generateExpiredProductsReport,
// generateCustomerSummaryReport, generateCustomerTransactionsReport
// remain largely the same, they filter and process the global arrays.
// They will need to handle Firestore IDs when filtering or looking up related data (like customer ID in sales).

function generateSalesReport(startDate, endDate) {
    document.getElementById('report-table-head').innerHTML = `
        <tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبيعات (${CURRENCY})</th><th>إجمالي الخصم (${CURRENCY})</th><th>صافي المبيعات (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    const filteredSales = sales.filter(s => {
         // Ensure sale date is treated as a Date object for comparison
        const saleDate = s.date instanceof Date ? s.date : new Date(s.date);
        return saleDate >= startDate && saleDate <= endDate;
    });

    const salesByDate = {};
    filteredSales.forEach(sale => {
        // Ensure date is treated as a Date object before formatting
        const saleDate = sale.date instanceof Date ? sale.date : new Date(sale.date);
        const dateStr = formatDate(saleDate, 'short');
        if (!salesByDate[dateStr]) {
            salesByDate[dateStr] = { date: dateStr, count: 0, subtotal: 0, discount: 0, total: 0 };
        }
        salesByDate[dateStr].count++;
        salesByDate[dateStr].subtotal += sale.subtotal;
        salesByDate[dateStr].discount += sale.discount;
        salesByDate[dateStr].total += sale.total;
    });

     // Sort by date strings in 'DD/MM/YYYY' format (requires parsing)
    const reportData = Object.values(salesByDate).sort((a,b) => {
        const [dayA, monthA, yearA] = a.date.split('/').map(Number);
        const [dayB, monthB, yearB] = b.date.split('/').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA); // Month is 0-indexed
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
    });


    if (reportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد بيانات مبيعات لهذه الفترة.</td></tr>';
    } else {
        reportData.forEach(item => {
            tbody.innerHTML += `<tr><td>${item.date}</td><td>${item.count}</td><td>${item.subtotal.toFixed(2)}</td><td>${item.discount.toFixed(2)}</td><td>${item.total.toFixed(2)}</td></tr>`;
        });
    }

    const chartCanvas = document.getElementById('report-chart');
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context for report chart not found.');
         chartCanvas.style.display = 'none'; // Hide canvas if context is not available
        return;
    }

     // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded or initialized yet.');
        const chartContainer = chartCanvas.parentNode;
        if (chartContainer && !chartContainer.querySelector('.chart-error-message')) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'عفواً، لا يمكن عرض الرسم البياني حالياً. يرجى التأكد من اتصالك بالإنترنت أو المحاولة مرة أخرى.';
            errorMsg.style.color = 'red';
            errorMsg.style.textAlign = 'center';
            errorMsg.className = 'chart-error-message';
            chartContainer.insertBefore(errorMsg, chartCanvas);
        }
        chartCanvas.style.display = 'none';
        return;
    } else {
         // Remove any previous error message if Chart.js is now loaded
        const chartContainer = chartCanvas.parentNode;
        const existingErrorMsg = chartContainer ? chartContainer.querySelector('.chart-error-message') : null;
        if (existingErrorMsg) {
            existingErrorMsg.remove();
        }
         chartCanvas.style.display = 'block'; // Show canvas if Chart.js is loaded
    }


    if (reportChartInstance) {
        reportChartInstance.destroy();
        reportChartInstance = null;
    }

    if(reportData.length > 0) { // Only create chart if there is data
         reportChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: reportData.map(item => item.date),
                datasets: [
                    { label: `صافي المبيعات (${CURRENCY})`, data: reportData.map(item => item.total), backgroundColor: 'rgba(75, 192, 192, 0.7)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, yAxisID: 'y_sales' },
                    { label: 'عدد الفواتير', data: reportData.map(item => item.count), backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1, type: 'line', yAxisID: 'y_invoices' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: {
                y_sales: { type: 'linear', display: true, position: 'left', title: { display: true, text: `المبيعات (${CURRENCY})` }, beginAtZero: true },
                y_invoices: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'عدد الفواتير' }, grid: { drawOnChartArea: false }, beginAtZero: true }
            }, plugins: { tooltip: { callbacks: { title: context => `التاريخ: ${context[0].label}` } } } } // Added tooltip customization
        });
    } else {
         chartCanvas.style.display = 'none'; // Hide chart if no data
    }
}

function generateInventorySummaryReport() {
    document.getElementById('report-table-head').innerHTML = `
        <tr><th>اسم المنتج</th><th>الباركود</th><th>الفئة</th><th>الكمية الحالية</th><th>سعر البيع (${CURRENCY})</th><th>القيمة الإجمالية للمخزون (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد منتجات في المخزون.</td></tr>';
    } else {
        let totalInventoryValue = 0;
        products.forEach(p => {
            const itemValue = p.quantity * p.sellPrice;
            totalInventoryValue += itemValue;
            tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.barcode}</td><td>${p.category || '-'}</td><td>${p.quantity}</td><td>${p.sellPrice.toFixed(2)}</td><td>${itemValue.toFixed(2)}</td></tr>`;
        });
        tbody.innerHTML += `<tr><td colspan="5" style="text-align:left; font-weight:bold;">الإجمالي العام لقيمة المخزون:</td><td style="font-weight:bold;">${totalInventoryValue.toFixed(2)} ${CURRENCY}</td></tr>`;
    }
    document.querySelector('.chart-container').style.display = 'none';
}

function generateExpiredProductsReport() {
    document.getElementById('report-table-head').innerHTML = `
        <tr><th>اسم المنتج</th><th>الباركود</th><th>الكمية</th><th>تاريخ الانتهاء</th><th>أيام متبقية</th><th>قيمة الشراء (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    const today = new Date(); today.setHours(0,0,0,0);
    const thirtyDaysFromNow = new Date(today); thirtyDaysFromNow.setDate(today.getDate() + 30);

    const relevantProducts = products.filter(p => {
        const expiryDate = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate);
        return p.quantity > 0 && expiryDate < thirtyDaysFromNow;
    }).sort((a,b) => {
        const expiryA = a.expiryDate instanceof Date ? a.expiryDate : new Date(a.expiryDate);
        const expiryB = b.expiryDate instanceof Date ? b.expiryDate : new Date(b.expiryDate);
        return expiryA - expiryB;
    });


    if (relevantProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد منتجات منتهية الصلاحية أو ستنتهي خلال 30 يومًا.</td></tr>';
    } else {
        let totalLostValue = 0;
        relevantProducts.forEach(p => {
            const expiryDate = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate);
            const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            const itemLostValue = p.quantity * p.buyPrice;
            if (daysRemaining <=0) totalLostValue += itemLostValue;

            const rowClass = daysRemaining <= 0 ? 'expired' : (daysRemaining <= 7 ? 'low-stock' : '');
            tbody.innerHTML += `<tr class="${rowClass}"><td>${p.name}</td><td>${p.barcode}</td><td>${p.quantity}</td><td>${formatDate(p.expiryDate, 'short')}</td><td>${daysRemaining > 0 ? daysRemaining : 'منتهي'}</td><td>${itemLostValue.toFixed(2)}</td></tr>`;
        });
         tbody.innerHTML += `<tr><td colspan="5" style="text-align:left; font-weight:bold;">إجمالي قيمة الشراء للمنتجات المنتهية فعلياً:</td><td style="font-weight:bold;">${totalLostValue.toFixed(2)} ${CURRENCY}</td></tr>`;

    }
    document.querySelector('.chart-container').style.display = 'none';
}

function generateCustomerSummaryReport(startDate, endDate) {
     document.getElementById('report-table-head').innerHTML = `
        <tr><th>اسم العميل</th><th>الهاتف</th><th>إجمالي عدد الفواتير</th><th>إجمالي المشتريات (${CURRENCY})</th><th>متوسط قيمة الفاتورة (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    // Process all customers and filter/sort their sales by date range
    const customerReportData = customers.map(customer => {
        // Filter sales by Firestore customer ID and date range
        const custSales = sales.filter(s => {
             const saleDate = s.date instanceof Date ? s.date : new Date(s.date);
             return s.customerId === customer.id && saleDate >= startDate && saleDate <= endDate;
            });
        const totalSpent = custSales.reduce((sum, sale) => sum + sale.total, 0);
        const invoiceCount = custSales.length;
        return {
            name: customer.name,
            phone: customer.phone || '-',
            invoiceCount: invoiceCount,
            totalSpent: totalSpent,
            avgInvoiceValue: invoiceCount > 0 ? totalSpent / invoiceCount : 0
        };
    }).filter(c => c.invoiceCount > 0).sort((a,b) => b.totalSpent - a.totalSpent); // Sort by total spent

    if (customerReportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا يوجد عملاء لديهم مشتريات في هذه الفترة.</td></tr>';
    } else {
        customerReportData.forEach(c => {
            tbody.innerHTML += `<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.invoiceCount}</td><td>${c.totalSpent.toFixed(2)}</td><td>${c.avgInvoiceValue.toFixed(2)}</td></tr>`;
        });
    }

    const topCustomersChartData = customerReportData.slice(0, 10); // Get top 10 for chart
    const chartCanvas = document.getElementById('report-chart');
    const ctx = chartCanvas.getContext('2d');

     if (!ctx) {
        console.error('Canvas context for report chart not found.');
         chartCanvas.style.display = 'none';
        return;
    }

     if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded or initialized yet.');
        const chartContainer = chartCanvas.parentNode;
        if (chartContainer && !chartContainer.querySelector('.chart-error-message')) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'عفواً، لا يمكن عرض الرسم البياني حالياً. يرجى التأكد من اتصالك بالإنترنت أو المحاولة مرة أخرى.';
            errorMsg.style.color = 'red';
            errorMsg.style.textAlign = 'center';
            errorMsg.className = 'chart-error-message';
            chartContainer.insertBefore(errorMsg, chartCanvas);
        }
        chartCanvas.style.display = 'none';
        return;
    } else {
         const chartContainer = chartCanvas.parentNode;
        const existingErrorMsg = chartContainer ? chartContainer.querySelector('.chart-error-message') : null;
        if (existingErrorMsg) {
            existingErrorMsg.remove();
        }
         chartCanvas.style.display = 'block';
    }

    if (reportChartInstance) {
        reportChartInstance.destroy();
        reportChartInstance = null;
    }

     if(topCustomersChartData.length > 0) { // Only create chart if there is data
         reportChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topCustomersChartData.map(c => c.name),
                datasets: [{ label: `إجمالي المشتريات (${CURRENCY})`, data: topCustomersChartData.map(c => c.totalSpent), backgroundColor: 'rgba(153, 102, 255, 0.7)', borderColor: 'rgba(153, 102, 255, 1)', borderWidth: 1 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: {display: true, text: `المشتريات (${CURRENCY})`} } } }
        });
     } else {
         chartCanvas.style.display = 'none'; // Hide chart if no data
     }
}

function generateCustomerTransactionsReport(customerId, startDate, endDate) { // Accepts Firestore ID
    const customer = customers.find(c => c.id === customerId); // Find by Firestore ID
    if (!customer) {
        document.getElementById('report-data').innerHTML = '<tr><td colspan="6" style="text-align:center;">لم يتم العثور على العميل.</td></tr>';
         document.getElementById('customer-report-details-summary').innerHTML = `<p>لم يتم العثور على العميل.</p>`;
        return;
    }

    document.getElementById('report-table-head').innerHTML = `
        <tr><th>اليوم والساعة</th><th>رقم الفاتورة</th><th>اسم المنتج</th><th>السعر (${CURRENCY})</th><th>الكمية</th><th>الإجمالي (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    const summaryDiv = document.getElementById('customer-report-details-summary');

     // Filter sales by Firestore customer ID and date range
    const customerSales = sales.filter(s => {
         const saleDate = s.date instanceof Date ? s.date : new Date(s.date);
         return s.customerId === customerId && saleDate >= startDate && saleDate <= endDate;
        })
                              .sort((a,b) => {
                                   const dateA = a.date instanceof Date ? a.date : new Date(a.date);
                                   const dateB = b.date instanceof Date ? b.date : new Date(b.date);
                                  return dateB - dateA; // Sort descending by date
                                });

    let reportContent = '';
    let totalFinancialValue = 0;
    let totalDiscountGiven = 0;
    const productsPurchasedList = new Set();
    const paymentMethodsCount = {};
    const salesByDayOfWeek = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];


    if (customerSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد معاملات لهذا العميل في الفترة المحددة.</td></tr>';
        summaryDiv.innerHTML = `<p>لا توجد معاملات لهذا العميل (${customer.name}) في الفترة المحددة.</p>`;
        return;
    }

    customerSales.forEach(sale => {
        totalFinancialValue += sale.total;
        totalDiscountGiven += sale.discount;

        const saleDate = sale.date instanceof Date ? sale.date : new Date(sale.date);
        salesByDayOfWeek[saleDate.getDay()]++;

        if(paymentMethodsCount[sale.paymentMethod]){
            paymentMethodsCount[sale.paymentMethod]++;
        } else {
            paymentMethodsCount[sale.paymentMethod] = 1;
        }

        sale.items.forEach(item => {
            reportContent += `
                <tr>
                    <td>${formatDate(sale.date)}</td>
                    <td>${sale.invoiceNumber}</td>
                    <td>${item.name}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>${item.quantity}</td>
                    <td>${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
            `;
            productsPurchasedList.add(item.name);
        });
    });
    tbody.innerHTML = reportContent;

    const numberOfInvoices = customerSales.length;
    const avgTransactionValue = numberOfInvoices > 0 ? totalFinancialValue / numberOfInvoices : 0;

    let mostFrequentDayNum = 0;
    let maxSalesOnDay = 0;
    for(const dayNum in salesByDayOfWeek){
        if(salesByDayOfWeek[dayNum] > maxSalesOnDay){
            maxSalesOnDay = salesByDayOfWeek[dayNum];
            mostFrequentDayNum = parseInt(dayNum); // Ensure it's a number
        }
    }
    const mostFrequentPurchaseDay = maxSalesOnDay > 0 ? dayNames[mostFrequentDayNum] : "لا يوجد يوم مفضل واضح";

    let preferredPaymentMethod = "غير محدد";
    let maxPaymentCount = 0;
    for(const method in paymentMethodsCount){
        if(paymentMethodsCount[method] > maxPaymentCount){
            maxPaymentCount = paymentMethodsCount[method];
            switch(method) {
                case 'cash': preferredPaymentMethod = 'نقدي'; break;
                case 'card': preferredPaymentMethod = 'بطاقة ائتمان'; break;
                case 'transfer': preferredPaymentMethod = 'تحويل بنكي'; break;
                default: preferredPaymentMethod = method;
            }
        }
    }
     // If there are invoices but no clear preferred method (e.g., counts are equal), say diverse
    if (maxPaymentCount === 0 && numberOfInvoices > 0) preferredPaymentMethod = "متنوع";
     // If no invoices, it's not applicable
    if (numberOfInvoices === 0) preferredPaymentMethod = "-";


    const loyaltyPointsEarned = Math.floor(totalFinancialValue / 20); // Example calculation

    summaryDiv.innerHTML = `
        <h3>ملخص معاملات العميل: ${customer.name}</h3>
        <p><strong>إجمالي عدد الفواتير في الفترة:</strong> ${numberOfInvoices} فاتورة</p>
        <p><strong>إجمالي قيمة المشتريات (المالية):</strong> ${totalFinancialValue.toFixed(2)} ${CURRENCY}</p>
        <p><strong>إجمالي الخصومات المستفاد منها:</strong> ${totalDiscountGiven.toFixed(2)} ${CURRENCY}</p>
        <p><strong>قائمة المنتجات المشتراة (عينة):</strong> ${Array.from(productsPurchasedList).slice(0,5).join(', ')} ${productsPurchasedList.size > 5 ? ' وغيرها...' : ''}</p>
        <p><strong>حالة السداد للمنتجات/الفواتير المعروضة:</strong> <span style="color: green;">تم السداد بالكامل</span> (بناءً على نظام الفواتير الحالي)</p>
        <p><strong>المبلغ المتبقي من الفواتير المعروضة:</strong> 0.00 ${CURRENCY}</p>
        <hr>
        <h4><i class="fas fa-star"></i> ميزات إضافية للعميل:</h4>
        <p><strong>1. متوسط قيمة الفاتورة الواحدة:</strong> ${avgTransactionValue.toFixed(2)} ${CURRENCY}</p>
        <p><strong>2. اليوم الأكثر شراءً:</strong> ${mostFrequentPurchaseDay} (بناءً على عدد الفواتير)</p>
        <p><strong>3. وسيلة الدفع المفضلة:</strong> ${preferredPaymentMethod}</p>
        <p><strong>4. نقاط الولاء المكتسبة (تقديرية):</strong> ${loyaltyPointsEarned} نقطة</p>
        <p><small>ملاحظة: نظام تتبع الأرصدة المستحقة للعملاء بشكل مفصل يتطلب تحديثات إضافية على نظام نقاط البيع والفواتير.</small></p>
    `;
}


// exportReportToCSV remains the same, operates on the rendered table data.
function exportReportToCSV() {
    const reportType = document.getElementById('report-type').value;
    const table = document.getElementById('report-table');
    const head = document.getElementById('report-table-head');
    const body = document.getElementById('report-data');

    if (!head.rows.length || !body.rows.length || (body.rows[0].cells.length === 1 && (body.rows[0].cells[0].textContent.includes("لا توجد بيانات") || body.rows[0].cells[0].textContent.includes("الرجاء اختيار")))) {
        alert('لا توجد بيانات لتصديرها في التقرير الحالي.');
        return;
    }


    let csv = [];
    const reportTitleContent = document.getElementById('report-title-area').innerText;
    if(reportTitleContent) csv.push('"' + reportTitleContent.replace(/\n/g, " - ").replace(/"/g, '""') + '"');

    const headerRow = [];
    for (let i = 0; i < head.rows[0].cells.length; i++) {
        headerRow.push('"' + head.rows[0].cells[i].innerText.replace(/"/g, '""') + '"');
    }
    csv.push(headerRow.join(','));

    for (let i = 0; i < body.rows.length; i++) {
        const row = [], cols = body.rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(","));
    }

    if (reportType === 'customer_transactions') {
        const summaryDiv = document.getElementById('customer-report-details-summary');
        if (summaryDiv && summaryDiv.style.display !== 'none' && summaryDiv.innerText.trim() !== '') {
            csv.push(''); // Add an empty line for separation
            const summaryTitle = summaryDiv.querySelector('h3');
            if(summaryTitle) csv.push('"' + summaryTitle.innerText.replace(/"/g, '""') + '"');

            summaryDiv.querySelectorAll('p').forEach(p => {
                let pText = p.innerText.replace(/\n/g, " ").replace(/"/g, '""');
                csv.push('"' + pText + '"');
            });
        }
    }

     // Add BOM for correct Arabic display in Excel
    const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const downloadLink = document.createElement("a");
    downloadLink.download = `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
}


// ==================== Modals ====================
function initModals() {
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Forms now have async submit handlers
    document.getElementById('product-form').addEventListener('submit', saveProductForm);
    document.getElementById('customer-form').addEventListener('submit', (event) => saveCustomerForm(event));
    document.getElementById('prescription-form').addEventListener('submit', savePrescriptionForm);
    document.getElementById('add-prescription-item').addEventListener('click', () => addPrescriptionItem());
}

// ==================== Helper Functions ====================
// These save functions are no longer used for individual saves, data is saved directly in the async functions
/*
function saveProducts() { localStorage.setItem('pharmacy-products', JSON.stringify(products)); }
function saveCustomers() { localStorage.setItem('pharmacy-customers', JSON.stringify(customers)); }
function saveSales() { localStorage.setItem('pharmacy-sales', JSON.stringify(sales)); }
function savePrescriptions() { localStorage.setItem('pharmacy-prescriptions', JSON.stringify(prescriptions)); }
*/

// saveAllData is also primarily for export/import now, not for regular data changes
/*
function saveAllData() {
    saveProducts();
    saveCustomers();
    saveSales();
    savePrescriptions();
}
*/

// exportAllData now exports the current state from the global arrays (which should reflect Firestore)
function exportAllData() {
    const dataToExport = {
        products,
        customers,
        sales,
        prescriptions,
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `بيانات_الصيدلية_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('تم تصدير جميع البيانات بنجاح!');
}

// importAllData needs significant modification to write to Firestore
async function importAllData(event) { // Made async
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('هل أنت متأكد من استيراد البيانات؟ سيتم حذف جميع البيانات الحالية في قاعدة البيانات واستبدالها بالبيانات المستوردة! يُنصح بأخذ نسخة احتياطية أولاً عبر خاصية التصدير.')) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) { // Made onload function async
        try {
            const importedData = JSON.parse(e.target.result);

            if (!importedData.products || !importedData.customers || !importedData.sales || !importedData.prescriptions) {
                 throw new Error("الملف المستورد لا يحتوي على جميع الأقسام المتوقعة (products, customers, sales, prescriptions).");
            }

            // --- WARNING: This is a destructive import! ---
            // This approach deletes ALL existing documents in each collection
            // and then adds the documents from the imported file.
            // For large datasets, this can be slow and costly.
            // A more sophisticated import would involve comparing and updating.

            // Delete existing data
            const deleteCollection = async (collectionRef) => {
                const snapshot = await getDocs(collectionRef);
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
            };

            await deleteCollection(productsCol);
            await deleteCollection(customersCol);
            await deleteCollection(salesCol);
            await deleteCollection(prescriptionsCol);

            // Add imported data
            const addData = async (collectionRef, dataArray) => {
                 // Retain original IDs if possible or let Firestore generate new ones?
                 // Letting Firestore generate new IDs is safer and simpler here.
                 // We will remove the old 'id' and let Firestore add its own.
                const addPromises = dataArray.map(item => {
                     const itemToSave = { ...item };
                     delete itemToSave.id; // Remove old ID
                     return addDoc(collectionRef, itemToSave);
                });
                await Promise.all(addPromises);
            };

            // Adding data without preserving original IDs.
            // If preserving IDs is critical, you would use setDoc with the desired ID,
            // but ensure IDs are unique and handle potential conflicts.
            await addData(productsCol, importedData.products);
            await addData(customersCol, importedData.customers);
            await addData(salesCol, importedData.sales);
            await addData(prescriptionsCol, importedData.prescriptions);


            await loadData(); // Re-load data from Firestore after import
            updateStats();
            // Re-render the current section
             const activeSection = document.querySelector('main section.active-section');
             if (activeSection) {
                 await showSection(activeSection.id);
             } else {
                 await showSection('dashboard');
             }

            alert('تم استيراد البيانات بنجاح.');

        } catch (error) {
            console.error("Error importing data:", error);
            alert('فشل استيراد البيانات. الملف غير صالح أو تالف أو حدث خطأ أثناء الكتابة إلى قاعدة البيانات.\n' + error.message);
        } finally {
            event.target.value = ''; // Clear file input
        }
    };
    reader.readAsText(file);
}


function formatDate(dateString, format = 'long') {
    if (!dateString) return 'غير محدد';
     // Try parsing as ISO string first, then try Date object
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'تاريخ غير صالح';

    const optionsShort = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const optionsLong = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };

    try {
        if (format === 'short') {
            return date.toLocaleDateString('ar-EG', optionsShort);
        }
        return date.toLocaleDateString('ar-EG', optionsLong);
    } catch (e) {
        console.error("Error formatting date:", e, dateString);
        return 'تاريخ غير صالح';
    }
}

// Ensure Chart.js library is included in your HTML before this script runs.
// Example: <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.0/dist/chart.min.js"></script>

