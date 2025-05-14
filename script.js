// script.js

// ==================== Firebase Setup (Assuming Firestore and Auth are enabled) ====================
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-analytics.js"; // Optional analytics
import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    runTransaction
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js"; // Import Auth functions

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAowg6qNEJ7L6RkorxrMfUO-tIGq_GpEig", // استخدم مفتاح API الخاص بك
  authDomain: "data-mahmoud-osama.firebaseapp.com", // استخدم نطاق المصادقة الخاص بك
  projectId: "data-mahmoud-osama", // استخدم معرف المشروع الخاص بك
  storageBucket: "data-mahmoud-osama.firebasestorage.app", // استخدم Storage Bucket الخاص بك
  messagingSenderId: "290421372386", // استخدم Messaging Sender ID الخاص بك
  appId: "1:290421372386:web:a42c4565c5dec6384035bb", // استخدم App ID الخاص بك
  measurementId: "G-X8LHNRV75K" // استخدم Measurement ID الخاص بك
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Initialize Analytics if needed

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app); // Get a reference to the Auth service

// Get references to collections
const productsCol = collection(db, 'products');
const customersCol = collection(db, 'customers');
const salesCol = collection(db, 'sales');
const prescriptionsCol = collection(db, 'prescriptions');


// ==================== Global Variables ====================
let products = [];
let customers = []; // يتم تحميلها من قاعدة البيانات
let sales = [];
let prescriptions = [];
let cart = [];
const CURRENCY = 'جنيه'; // تعريف العملة بشكل مركزي
let reportChartInstance = null; // للاحتفاظ بمثيل الرسم البياني وتدميره عند الحاجة
let currentUser = null; // To store the current authenticated user


// ==================== Application Initialization ====================
document.addEventListener('DOMContentLoaded', async function() {
    // Check auth state first when the page loads
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            console.log('User is signed in:', user.email);
            // Enable UI elements that require authentication
            toggleAuthUI(true);
            // Proceed with loading data from Firebase and initializing the app sections
            await loadData();
            updateStats();
            initAppSections(); // Initialize sections after data is loaded and user is authenticated
            showSection('dashboard'); // Show initial section
        } else {
            // User is signed out
            currentUser = null;
            console.log('User is signed out.');
            // Disable UI elements that require authentication
            toggleAuthUI(false);
            // Redirect to login page if the user is not on the login page already
             if (!window.location.href.includes('login.html')) {
                 // Optional: alert user before redirecting
                 // alert('يجب تسجيل الدخول للوصول إلى التطبيق.');
                 window.location.href = 'login.html';
                 return; // Stop further execution on this page until redirected
             }
            // If on login.html, load data but UI will be restricted by toggleAuthUI
             await loadData(); // Load data anyway (e.g., for read-only public sections)
             updateStats();
             initAppSections(); // Initialize sections (UI elements will be disabled)
             showSection('dashboard'); // Show initial section
        }
    });

    // Setup navigation links (should work regardless of auth state for section switching)
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            // showSection handles rendering based on current global data arrays
            // No need to await showSection unless rendering itself is async (which it isn't, but loadData is)
            // However, since showSection calls async render functions, it's safer to await
            await showSection(sectionId);
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Initialize modals (they will be shown/hidden by other functions)
    initModals();

    // Set default date for report and prescription fields
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('prescription-date')) document.getElementById('prescription-date').value = today;
    if(document.getElementById('start-date')) document.getElementById('start-date').value = today;
    if(document.getElementById('end-date')) document.getElementById('end-date').value = today;

    // Initial section is shown inside onAuthStateChanged
});

// New function to initialize sections (called after auth state is known and data is loaded)
function initAppSections() {
    // Ensure these functions only set up event listeners or render based on the *current* data state.
    // They should not attempt to save/delete data directly unless triggered by user action checks.
    initInventorySection();
    initPosSection();
    initCustomersSection();
    initReportsSection();
}

// Function to toggle UI elements based on authentication state
function toggleAuthUI(isAuthenticated) {
    // Select elements that should be hidden/disabled when not authenticated
    // You need to add the class 'auth-required' to these elements in your HTML
    const authRequiredElements = document.querySelectorAll('.auth-required');

    authRequiredElements.forEach(element => {
        if (isAuthenticated) {
            // Show/enable element
            element.style.display = ''; // Revert to default display
            if (element.tagName === 'BUTTON' || element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                 element.disabled = false; // Enable form elements and buttons
            }
             // Add logic for other element types if needed (e.g., entire divs)
        } else {
            // Hide/disable element
            element.style.display = 'none';
            if (element.tagName === 'BUTTON' || element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                 element.disabled = true; // Disable form elements and buttons
            }
        }
    });

     // Add or find the logout button
     let logoutBtn = document.getElementById('logout-btn');
     if (!logoutBtn && document.querySelector('header')) { // Add logout button to header if it doesn't exist
         logoutBtn = document.createElement('button');
         logoutBtn.id = 'logout-btn';
         logoutBtn.textContent = 'تسجيل الخروج';
         logoutBtn.style.marginLeft = 'auto'; // Push to the end of the header
         logoutBtn.style.padding = '5px 10px';
         logoutBtn.style.backgroundColor = '#f0ad4e'; // Orange color
         logoutBtn.style.color = 'white';
         logoutBtn.style.border = 'none';
         logoutBtn.style.borderRadius = '4px';
         logoutBtn.style.cursor = 'pointer';
         logoutBtn.addEventListener('click', handleLogout);
         document.querySelector('header').appendChild(logoutBtn);
     }

     // Show/hide the logout button based on auth state
     if (logoutBtn) {
         logoutBtn.style.display = isAuthenticated ? '' : 'none';
     }

     // Specific handling for modals - disabling the buttons that *open* the modals using '.auth-required' class is preferred.
     // Disabling inputs/buttons *within* modals while they are open when not authenticated might also be needed depending on UI flow.
     // Current setup relies on checking `currentUser` inside the save/delete functions themselves as a secondary layer of security.
}

// Handle user logout
async function handleLogout() {
    try {
        await signOut(auth);
        console.log('User signed out successfully.');
        // The onAuthStateChanged listener will detect the sign-out and redirect to login.html
    } catch (error) {
        console.error('Error signing out:', error);
        alert('حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.');
    }
}


// ==================== Loading and Display Functions ====================
async function loadData() {
    try {
        // Fetch Products
        const productsSnapshot = await getDocs(productsCol);
        products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Customers
        const customersSnapshot = await getDocs(customersCol);
        customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Sales (order by date descending for potentially faster lookup in reports)
        const salesQuery = query(salesCol, orderBy('date', 'desc'));
        const salesSnapshot = await getDocs(salesQuery);
        sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Prescriptions
        const prescriptionsSnapshot = await getDocs(prescriptionsCol);
        prescriptions = prescriptionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log('Data loaded from Firebase.'); // Reduced log detail

    } catch (error) {
        console.error("Error loading data from Firebase:", error);
        // Display a user-friendly error message if loading fails
        alert('فشل في تحميل البيانات من قاعدة البيانات. يرجى التحقق من اتصالك والمحاولة مرة أخرى.');
        // Clear existing data arrays to prevent displaying stale data if load fails
        products = [];
        customers = [];
        sales = [];
        prescriptions = [];
    }
}

async function showSection(sectionId) {
    // Remove active class from all sections
    document.querySelectorAll('main section').forEach(section => section.classList.remove('active-section'));

    // Add active class to the selected section
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.add('active-section');

    // Re-render relevant sections based on the loaded data
    // Wrap render calls in async if the render function itself is async
    // But generally, rendering based on *already loaded* data should be fast and synchronous
    switch(sectionId) {
        case 'inventory': renderInventoryTable(); break;
        case 'pos': renderPosProducts(); renderCustomerSelect(document.getElementById('customer-select')); renderCart(); break;
        case 'prescriptions': renderPrescriptionsTable(); break;
        case 'customers': renderCustomersTable(); break;
        case 'reports':
            populateCustomerReportSelect();
            handleReportTypeChange();
            // generateReport(); // Don't auto-generate report on every section switch
            clearReportArea(); // Clear report area when entering section
            break;
         case 'dashboard':
            updateStats(); // Update stats display
            break;
    }
}

function updateStats() {
    document.getElementById('total-products').textContent = products.length;
    const today = new Date();
    today.setHours(0,0,0,0);
    const expiredCount = products.filter(p => {
        // Handle potential null/undefined expiryDate and ensure it's a Date object
        const expiry = p.expiryDate ? new Date(p.expiryDate) : null;
         return expiry && expiry < today && (p.quantity || 0) > 0; // Consider quantity > 0 for "expired stock"
    }).length;
    document.getElementById('expired-products').textContent = expiredCount;

    const todaySalesTotal = sales.filter(s => {
        // Handle potential null/undefined date and ensure it's a Date object
        const saleDate = s.date ? new Date(s.date) : null;
        // Compare dates only, ignoring time for "today"
        return saleDate && saleDate.getFullYear() === today.getFullYear() &&
               saleDate.getMonth() === today.getMonth() &&
               saleDate.getDate() === today.getDate();
    }).reduce((sum, sale) => sum + (sale.total || 0), 0); // Use 0 if sale.total is null/undefined
    document.getElementById('today-sales').textContent = `${todaySalesTotal.toFixed(2)} ${CURRENCY}`;

    document.getElementById('total-customers').textContent = customers.length;
}

// ==================== Inventory Management Section ====================
function initInventorySection() {
    // Add .auth-required class to the button in your HTML (example)
    // <button id="add-product-btn" class="auth-required">إضافة منتج</button>
    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());

     // Add .auth-required class to these buttons in your HTML
    // <button id="export-inventory" class="auth-required">تصدير</button>
    // <button id="import-inventory" class="auth-required">استيراد</button>
    document.getElementById('export-inventory').addEventListener('click', exportAllData);
    document.getElementById('import-inventory').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importAllData);

    document.getElementById('inventory-search').addEventListener('input', renderInventoryTable);
    document.getElementById('inventory-filter').addEventListener('change', renderInventoryTable);

     renderInventoryTable(); // Initial render when section is initialized
}

function renderInventoryTable() {
    const searchTerm = document.getElementById('inventory-search').value.toLowerCase();
    const filter = document.getElementById('inventory-filter').value;
    let filteredProducts = [...products]; // Work on a copy

    if (searchTerm) {
        filteredProducts = filteredProducts.filter(p =>
            (p.name && p.name.toLowerCase().includes(searchTerm)) ||
            (p.barcode && p.barcode.includes(searchTerm)) ||
            (p.category && p.category.toLowerCase().includes(searchTerm))
        );
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    switch(filter) {
        case 'expired':
            filteredProducts = filteredProducts.filter(p => {
                 // Handle potential null/undefined expiryDate and ensure it's a Date object
                 const expiry = p.expiryDate ? new Date(p.expiryDate) : null;
                 return expiry && expiry < today && (p.quantity || 0) > 0; // Show expired with quantity > 0
            });
            break;
        case 'low':
            // Define "low stock" threshold, e.g., quantity < 10 AND quantity > 0
            filteredProducts = filteredProducts.filter(p => (p.quantity || 0) < 10 && (p.quantity || 0) > 0);
            break;
    }

    const tbody = document.getElementById('inventory-list');
    tbody.innerHTML = ''; // Clear current table body
    if (filteredProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">لا توجد منتجات تطابق البحث أو الفلتر.</td></tr>`;
        return;
    }

    filteredProducts.forEach(product => {
        const tr = document.createElement('tr');
         const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
        // Add class for styling expired or low stock items
        if (expiryDate && expiryDate < today && (product.quantity || 0) > 0) tr.classList.add('expired');
        else if ((product.quantity || 0) < 5 && (product.quantity || 0) > 0) tr.classList.add('low-stock'); // Different threshold for visual low stock


        tr.innerHTML = `
            <td>${product.barcode || '-'}</td>
            <td>${product.name || 'بدون اسم'}</td>
              <td>${product ? (product.category || 'بدون فئة') : 'غير معروف'}</td>
            <td>${(product.quantity || 0)}</td>
            <td>${(product.buyPrice || 0).toFixed(2)} ${CURRENCY}</td>
            <td>${(product.sellPrice || 0).toFixed(2)} ${CURRENCY}</td>
            <td>${formatDate(product.expiryDate, 'short')}</td>
            <td class="actions-cell">
                </td>
        `;

        const actionsCell = tr.querySelector('.actions-cell');

        // إنشاء زر التعديل وربط المستمع (Add .auth-required class in HTML)
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn auth-required'; // Ensure class is present in HTML
        editBtn.innerHTML = '<i class="fas fa-edit"></i> تعديل';
        // Call openProductModal directly, it handles auth check for saving
        editBtn.addEventListener('click', () => openProductModal(product.id));
        actionsCell.appendChild(editBtn);

        // إنشاء زر الحذف وربط المستمع (Add .auth-required class in HTML)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn auth-required'; // Ensure class is present in HTML
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> حذف';
        // Call deleteProduct directly, it handles auth check
        deleteBtn.addEventListener('click', () => deleteProduct(product.id));
        actionsCell.appendChild(deleteBtn);


        tbody.appendChild(tr);
    });
     // Re-apply auth UI state after rendering the table content
     toggleAuthUI(!!currentUser);
}

async function openProductModal(id = null) {
     // No need to check currentUser here, the buttons opening the modal should be disabled by toggleAuthUI
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    form.reset(); // Clear form fields
    document.getElementById('product-id').value = ''; // Clear hidden ID field

    if (id) {
        // Find product in the global products array
        const product = products.find(p => p.id === id);
        if (!product) {
            alert('المنتج غير موجود.');
            return;
        }
        document.getElementById('product-modal-title').textContent = 'تعديل المنتج';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-barcode').value = product.barcode || '';
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-category').value = product.category || '';
        document.getElementById('product-quantity').value = product.quantity || 0;
        document.getElementById('product-buy-price').value = product.buyPrice || 0;
        document.getElementById('product-sell-price').value = product.sellPrice || 0;
        // Handle date format for input field (YYYY-MM-DD)
         const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
        document.getElementById('product-expiry').value = expiryDate && !isNaN(expiryDate.getTime()) ? expiryDate.toISOString().split('T')[0] : '';
        document.getElementById('product-notes').value = product.notes || '';
    } else {
        document.getElementById('product-modal-title').textContent = 'إضافة منتج جديد';
         // Optional: Generate a new barcode suggestion for new products
         // document.getElementById('product-barcode').value = Date.now().toString().slice(-10);
    }
    modal.style.display = 'block'; // Show the modal
}

async function saveProductForm(event) {
    event.preventDefault(); // Prevent default form submission

    if (!currentUser) { // Check if user is logged in BEFORE attempting to save
        alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول.');
         document.getElementById('product-modal').style.display = 'none'; // Close modal if not authenticated
        return;
    }

    const id = document.getElementById('product-id').value; // Get product ID from hidden field
    const newProductData = {
        barcode: document.getElementById('product-barcode').value.trim(), // Trim whitespace
        name: document.getElementById('product-name').value.trim(),
        category: document.getElementById('product-category').value.trim(),
        quantity: parseInt(document.getElementById('product-quantity').value) || 0, // Default to 0 if parse fails
        buyPrice: parseFloat(document.getElementById('product-buy-price').value) || 0, // Default to 0
        sellPrice: parseFloat(document.getElementById('product-sell-price').value) || 0, // Default to 0
        expiryDate: document.getElementById('product-expiry').value, // Store date string or ISO string
        notes: document.getElementById('product-notes').value.trim()
    };

    // Basic validation
    if (!newProductData.name) { // Barcode can be optional, but name is important
        alert('الرجاء إدخال اسم المنتج.');
        return;
    }
     if (isNaN(newProductData.quantity) || newProductData.quantity < 0 || isNaN(newProductData.buyPrice) || newProductData.buyPrice < 0 || isNaN(newProductData.sellPrice) || newProductData.sellPrice < 0) {
         alert('الرجاء إدخال قيم رقمية صحيحة وموجبة للكمية والأسعار.');
         return;
     }

    try {
        if (id) { // If ID exists, update the existing document
            const productRef = doc(db, 'products', id);
            await updateDoc(productRef, newProductData);
            alert('تم تحديث المنتج بنجاح.');
        } else { // If no ID, add a new document
            // Optional: Check for duplicate barcode before adding (good practice)
             if (newProductData.barcode) { // Only check if barcode is provided
                 const q = query(productsCol, where("barcode", "==", newProductData.barcode));
                 const querySnapshot = await getDocs(q);
                 if (!querySnapshot.empty) {
                     alert('باركود المنتج موجود بالفعل.');
                     return;
                 }
             }
            const docRef = await addDoc(productsCol, newProductData);
            // newProductData.id = docRef.id; // Store the generated ID locally (optional)
            alert('تم إضافة المنتج بنجاح.');
        }

        document.getElementById('product-modal').style.display = 'none'; // Hide modal
        await loadData(); // Re-load data from Firebase
        renderInventoryTable(); // Update inventory display
        renderPosProducts(); // Update POS product list
        updateStats(); // Update dashboard stats

    } catch (error) {
        console.error("Error saving product:", error);
         if (error.code === 'permission-denied') {
              alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول وقواعد الأمان.');
         } else {
            alert('فشل في حفظ المنتج. يرجى المحاولة مرة أخرى.');
         }
    }
}

// Attach deleteProduct to the window object so it can be called from inline onclick
window.deleteProduct = async function(id) {
     if (!currentUser) { // Check if user is logged in BEFORE attempting to delete
        alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول.');
        return;
    }

    if (confirm('هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.')) {
        try {
            // Optional: Check if product exists in any sales before deleting (more complex)
             // Simple delete for now:
            const productRef = doc(db, 'products', id);
            await deleteDoc(productRef);
            alert('تم حذف المنتج بنجاح.');

            await loadData(); // Re-load data after deleting
            renderInventoryTable(); // Update inventory display
            renderPosProducts(); // Update POS product list
            updateStats(); // Update dashboard stats

        } catch (error) {
            console.error("Error deleting product:", error);
            if (error.code === 'permission-denied') {
              alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول وقواعد الأمان.');
           } else {
              alert('فشل في حذف المنتج. يرجى المحاولة مرة أخرى.');
           }
        }
    }
}


// ==================== Point of Sale Section ====================
function initPosSection() {
    document.getElementById('pos-search').addEventListener('input', renderPosProducts);
     // Add .auth-required class to the button in your HTML
    // <button id="add-new-customer-pos-btn" class="auth-required">عميل جديد</button>
    // Use window.openCustomerModal because it's called directly by event listener
    document.getElementById('add-new-customer-pos-btn').addEventListener('click', () => window.openCustomerModal(null, true));

    // Setup payment method buttons
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
     // Add .auth-required class to the button in your HTML
    // <button id="complete-sale" class="auth-required">إتمام البيع</button>
    document.getElementById('complete-sale').addEventListener('click', completeSale);

    document.getElementById('discount-input').addEventListener('input', renderCart);
    document.getElementById('discount-type').addEventListener('change', renderCart);

    renderPosProducts(); // Initial render when section is initialized
    renderCustomerSelect(document.getElementById('customer-select')); // Initial render
    renderCart(); // Initial render (empty cart)
}

function renderPosProducts() {
    const searchTerm = document.getElementById('pos-search').value.toLowerCase();
    const container = document.getElementById('pos-products');
    container.innerHTML = ''; // Clear previous product cards

    const availableProducts = products.filter(p => {
        const expiry = p.expiryDate ? new Date(p.expiryDate) : null;
        return (p.quantity || 0) > 0 && (!expiry || expiry >= new Date());
    });

    let filteredProducts = availableProducts;
    if (searchTerm) {
        filteredProducts = availableProducts.filter(p =>
            (p.name && p.name.toLowerCase().includes(searchTerm)) || 
            (p.barcode && p.barcode.includes(searchTerm)) ||
            (p.category && p.category.toLowerCase().includes(searchTerm))
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
            <h3>${product.name || 'بدون اسم'}</h3>
            <p>الباركود: ${product.barcode || '-'}</p>
            <p>الفئة: ${product.category || 'بدون فئة'}</p>
            <p class="price">${(product.sellPrice || 0).toFixed(2)} ${CURRENCY}</p>
            <p>المتاح: ${(product.quantity || 0)}</p>
        `;
        card.addEventListener('click', () => addToCart(product.id));
        container.appendChild(card);
    });
}
function renderCustomerSelect(selectElement) {
    selectElement.innerHTML = '<option value="">عميل نقدي</option>';
    // Use the global customers array
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id; // Use Firestore document ID as value
        option.textContent = customer.name || 'بدون اسم';
        selectElement.appendChild(option);
    });
}

function addToCart(productId) {
    // Find product in the global products array
    const product = products.find(p => p.id === productId);
    if (!product) {
        alert('المنتج غير موجود.'); // Should not happen if products list is correct
        return;
    }
    if ((product.quantity || 0) <= 0) {
        alert('المنتج غير متوفر أو الكمية نفذت.');
        return;
    }
     const expiry = product.expiryDate ? new Date(product.expiryDate) : null;
    if (expiry && expiry < new Date()) {
        alert('هذا المنتج منتهي الصلاحية ولا يمكن بيعه.');
        return;
    }

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        // Ensure we don't exceed available stock
        if (existingItem.quantity < (product.quantity || 0)) {
            existingItem.quantity++;
        } else {
            alert('لا يمكن إضافة كمية أكثر من المتاح في المخزون.');
            return;
        }
    } else {
        // Add new item to cart
        cart.push({ productId: product.id, name: product.name, price: product.sellPrice, quantity: 1 });
    }
    renderCart(); // Re-render the cart display
}

// Attach to window for inline onclick in rendered HTML
window.updateCartItemQuantity = function(index, newQuantity) {
    newQuantity = parseInt(newQuantity);
    // Basic validation for quantity
    if (isNaN(newQuantity) || newQuantity < 1) {
        newQuantity = 1;
    }

    const item = cart[index];
     // Find the corresponding product in the global products array to check stock
    const productInStock = products.find(p => p.id === item.productId);
    const maxQuantity = productInStock ? (productInStock.quantity || 0) : 0; // Max quantity is stock level

    if (newQuantity > maxQuantity) {
        alert(`الكمية القصوى المتاحة لهذا المنتج هي ${maxQuantity}.`);
        newQuantity = maxQuantity; // Cap quantity at max available
         // Find the input field in the rendered HTML and update its value to the corrected quantity
        const inputField = document.getElementById('cart-items').rows[index + 1].cells[1].getElementsByTagName('input')[0];
        if(inputField) inputField.value = newQuantity;
    }
     // Update the quantity in the cart array
    cart[index].quantity = newQuantity;
    renderCart(); // Re-render the cart display
}

// Attach to window for inline onblur validation
window.validateCartItemQuantity = function(inputElement, maxQuantity) {
     let value = parseInt(inputElement.value);
     // If value is not a number, less than 1, or greater than maxQuantity, correct it
     if (isNaN(value) || value < 1) {
        inputElement.value = 1;
    } else if (value > maxQuantity) {
        alert(`الكمية القصوى المتاحة لهذا المنتج هي ${maxQuantity}.`);
        inputElement.value = maxQuantity; // Correct input field value
    }
     // Get the row index to find the item in the cart array
    const rowIndex = inputElement.closest('tr').rowIndex -1; // -1 because table row index is 1-based including header
    // Call updateCartItemQuantity with the corrected value to update the cart array and re-render
    window.updateCartItemQuantity(rowIndex, parseInt(inputElement.value));
}

// Attach to window for inline onclick in rendered HTML
window.removeCartItem = function(index) {
    cart.splice(index, 1); // Remove item from cart array
    renderCart(); // Re-render the cart display
}

function renderCart() {
    const tbody = document.getElementById('cart-items');
    tbody.innerHTML = ''; // Clear current cart items
    let subtotal = 0;

    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">السلة فارغة</td></tr>';
    } else {
        cart.forEach((item, index) => {
            // Find the corresponding product in global products to get the current stock level
            const productInStock = products.find(p => p.id === item.productId);
            // Use 0 if product not found or quantity is null/undefined
            const maxQuantity = productInStock ? (productInStock.quantity || 0) : 0;
            const itemTotal = (item.price || 0) * (item.quantity || 0); // Use 0 for price/quantity if null/undefined
            subtotal += itemTotal;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name || 'بدون اسم'}</td>
                <td>
                    <input type="number" min="1" max="${maxQuantity}" value="${item.quantity}"
                           onchange="window.updateCartItemQuantity(${index}, this.value)"
                           onblur="window.validateCartItemQuantity(this, ${maxQuantity})">
                </td>
                <td>${(item.price || 0).toFixed(2)}</td>
                <td>${itemTotal.toFixed(2)}</td>
                <td><button class="delete-btn" onclick="window.removeCartItem(${index})"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    const discountInput = document.getElementById('discount-input').value;
    const discountType = document.getElementById('discount-type').value;
    let discountValue = parseFloat(discountInput) || 0; // Default to 0 if parse fails
    let discountAmount = 0;

    // Calculate discount amount based on type
    if (discountType === 'percent') {
        discountAmount = subtotal * (discountValue / 100);
    } else { // Assume fixed amount
        discountAmount = discountValue;
    }

    // Ensure discount is not negative or greater than subtotal
    if (discountAmount < 0) discountAmount = 0;
    if (discountAmount > subtotal) {
        discountAmount = subtotal;
        // Optional: Update discount input field if it exceeds subtotal (can be annoying)
        // if (discountType === 'fixed') document.getElementById('discount-input').value = subtotal.toFixed(2);
    }

    const total = subtotal - discountAmount;

    // Update the display of totals
    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('discount-amount').textContent = discountAmount.toFixed(2);
    document.getElementById('total').textContent = total.toFixed(2);
}

// ==================== MODIFIED completeSale Function START ====================
async function completeSale() {
    if (!currentUser) {
        alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول.');
        return;
    }

    if (cart.length === 0) {
        alert('السلة فارغة. الرجاء إضافة منتجات أولاً.');
        return;
    }

    // تحميل أحدث البيانات للتحقق من المخزون قبل بدء المعاملة
    // هذا التحميل خارج المعاملة للتحقق المبدئي
    await loadData(); // Ensure we have the absolute latest stock data before checking
    renderPosProducts(); // Re-render POS products with updated stock state
    renderCart(); // Re-render cart which might update quantities or show issues if stock changed

    // التحقق المبدئي من المخزون قبل الدخول في المعاملة لتجنب محاولة معاملة فاشلة قدر الإمكان
    for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
            alert(`المنتج بالمعرف ${item.productId} (${item.name}) غير موجود في المخزون. يرجى تحديث الصفحة.`);
            return; // Stop the sale process
        }
        if ((product.quantity || 0) < item.quantity) {
            alert(`الكمية المطلوبة من ${product.name} (${item.quantity}) غير متوفرة. المتاح: ${(product.quantity || 0)}. يرجى تحديث السلة.`);
            return; // Stop the sale process
        }
        const expiry = product.expiryDate ? new Date(product.expiryDate) : null;
        if (expiry && expiry < new Date()) {
            alert(`منتج ${product.name} منتهي الصلاحية ولا يمكن بيعه.`);
            return; // Stop the sale process
        }
    }

    if (!confirm('هل أنت متأكد من إتمام عملية البيع؟')) {
        return;
    }

    // Get sale details from UI
    const customerId = document.getElementById('customer-select').value || null; // Use null if "عميل نقدي" is selected
    const paymentMethodElement = document.querySelector('.payment-btn.active');
    const paymentMethod = paymentMethodElement ? paymentMethodElement.getAttribute('data-method') : 'cash'; // Default to cash
    const subtotal = parseFloat(document.getElementById('subtotal').textContent) || 0; // Default to 0
    const discount = parseFloat(document.getElementById('discount-amount').textContent) || 0; // Default to 0
    const total = parseFloat(document.getElementById('total').textContent) || 0; // Default to 0


    const newSale = {
        // Firestore will generate the ID when added to the collection
        invoiceNumber: `INV-${String(Date.now()).slice(-6)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`, // More unique invoice ID
        customerId: customerId,
        date: new Date().toISOString(), // Store date as ISO string
        items: cart.map(item => ({
            productId: item.productId,
            name: item.name || 'بدون اسم',
            quantity: item.quantity || 0,
            price: item.price || 0
        })),
        subtotal,
        discount,
        total,
        paymentMethod,
         userId: currentUser.uid, // Store the ID of the user who made the sale (Optional but good for tracking)
         userName: currentUser.email // Store user email (Optional)
    };

    try {
        await runTransaction(db, async (transaction) => {
            // المرحلة 1: عمليات القراءة
            // قم بتجميع مراجع المنتجات والكميات المطلوبة من السلة
            const productReads = [];
            for (const item of cart) { // cart is from the outer scope
                const productRef = doc(db, 'products', item.productId);
                productReads.push({ ref: productRef, cartItem: item });
            }

            // قم بتنفيذ جميع عمليات القراءة للمنتجات
            // Promise.all is used to fetch all product documents in parallel within the transaction's read phase
            const productDocs = await Promise.all(
                productReads.map(pRead => transaction.get(pRead.ref))
            );

            // قم بتخزين بيانات المنتج المقروءة للتحقق والكتابة لاحقًا
            const productsToUpdate = [];

            // المرحلة 2: عمليات التحقق (باستخدام البيانات المقروءة داخل المعاملة)
            for (let i = 0; i < productDocs.length; i++) {
                const productDocInstance = productDocs[i]; // Renamed to avoid conflict with outer scope productDoc if any
                const cartItem = productReads[i].cartItem;
                const productRef = productReads[i].ref;

                if (!productDocInstance.exists()) {
                    // This check helps catch race conditions if product was deleted since load/validation
                    throw `المنتج "${cartItem.name}" لم يعد متوفرًا في المخزون (قد يكون تم حذفه).`;
                }

                const currentData = productDocInstance.data();
                const currentQuantity = currentData.quantity || 0;
                const newQuantity = currentQuantity - cartItem.quantity;

                if (newQuantity < 0) {
                    // This check helps catch race conditions if stock changed since load/validation
                    throw `الكمية المطلوبة من "${currentData.name || 'بدون اسم'}" (${cartItem.quantity}) غير متوفرة. المتاح حالياً (داخل المعاملة): ${currentQuantity}.`;
                }
                // Optional: Re-check expiry date inside transaction if critical
                // const expiry = currentData.expiryDate ? new Date(currentData.expiryDate) : null;
                // if (expiry && expiry < new Date()) {
                //     throw `منتج ${currentData.name} منتهي الصلاحية ولا يمكن بيعه (داخل المعاملة).`;
                // }
                productsToUpdate.push({ ref: productRef, newQuantity: newQuantity });
            }

            // المرحلة 3: عمليات الكتابة
            // 3.1. إضافة مستند البيع الجديد
            const saleCollectionRef = collection(db, 'sales'); // Get the collection reference
            transaction.set(doc(saleCollectionRef), newSale); // Use doc(collectionRef) to add with auto-ID

            // 3.2. تحديث كميات المنتجات
            for (const pUpdate of productsToUpdate) {
                transaction.update(pUpdate.ref, { quantity: pUpdate.newQuantity });
            }
        });

        alert('تم إتمام عملية البيع بنجاح!');
        showInvoice(newSale); // newSale object here doesn't have Firestore generated ID, but invoiceNumber is generated

        // Clear cart and re-render sections
        cart = [];
        document.getElementById('discount-input').value = 0; // Reset discount
        document.getElementById('discount-type').value = 'fixed'; // Reset discount type
        document.getElementById('customer-select').value = ''; // Reset customer select
         if(paymentMethodElement) paymentMethodElement.classList.remove('active'); // Remove active payment method
         // Optionally set a default active payment method
         const defaultPaymentBtn = document.querySelector('.payment-btn[data-method="cash"]');
         if(defaultPaymentBtn) defaultPaymentBtn.classList.add('active');


        await loadData(); // Re-load data after sale to get updated stock
        renderCart(); // Clear cart display
        renderPosProducts(); // Re-render POS products with updated stock
        renderInventoryTable(); // Re-render inventory table
        updateStats(); // Update dashboard stats

    } catch (error) {
        console.error("Error completing sale:", error);
        let errorMessage = 'فشل في إتمام عملية البيع. يرجى المحاولة مرة أخرى.';
         if (typeof error === 'string') { // If error is a custom string from the transaction
             errorMessage = error;
         } else if (error.code === 'permission-denied') {
             errorMessage = 'ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول وقواعد الأمان.';
         } else if (error.message) { // For FirebaseError objects or other Error objects
             errorMessage = 'فشل في إتمام عملية البيع: ' + error.message;
         }
        alert(errorMessage);
        // Note: With transactions, if an error occurs, Firestore automatically rolls back
        // the changes made within the transaction.
         // Re-load data to reflect actual state after potential partial failure/rollback
         await loadData();
         renderPosProducts();
         renderInventoryTable();
         renderCart(); // Refresh cart in case of validation errors
         updateStats();
    }
}
// ==================== MODIFIED completeSale Function END ======================

function showInvoice(sale) {
    const invoiceModal = document.getElementById('invoice-modal');
     // Find customer by Firestore ID in the global customers array
    const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;

    document.getElementById('invoice-number').textContent = `رقم الفاتورة: ${sale.invoiceNumber}`;
    document.getElementById('invoice-date').textContent = `التاريخ: ${formatDate(sale.date)}`;
    document.getElementById('invoice-customer-name').textContent = customer ? (customer.name || 'بدون اسم') : 'عميل نقدي';
    document.getElementById('invoice-customer-phone').textContent = customer && customer.phone ? `الهاتف: ${customer.phone}` : '';

    const tbody = document.getElementById('invoice-items-body');
    tbody.innerHTML = ''; // Clear previous items
    sale.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name || 'بدون اسم'}</td>
            <td>${item.quantity || 0}</td>
            <td>${(item.price || 0).toFixed(2)} ${CURRENCY}</td>
            <td>${((item.price || 0) * (item.quantity || 0)).toFixed(2)} ${CURRENCY}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('invoice-subtotal').textContent = `${(sale.subtotal || 0).toFixed(2)} ${CURRENCY}`;
    document.getElementById('invoice-discount').textContent = `${(sale.discount || 0).toFixed(2)} ${CURRENCY}`;
    document.getElementById('invoice-total').textContent = `${(sale.total || 0).toFixed(2)} ${CURRENCY}`;

    let paymentMethodText = '';
    switch(sale.paymentMethod) {
        case 'cash': paymentMethodText = 'نقدي'; break;
        case 'card': paymentMethodText = 'بطاقة ائتمان'; break;
        case 'transfer': paymentMethodText = 'تحويل بنكي'; break;
        default: paymentMethodText = 'غير محدد';
    }
    document.getElementById('invoice-payment-method').textContent = paymentMethodText;

    invoiceModal.style.display = 'block'; // Show the modal

    // Print and Email buttons - keep as is, they operate on the displayed invoice data.
    // Note: Email functionality is just an alert in this example.
    document.getElementById('print-invoice').onclick = () => window.print();
    document.getElementById('email-invoice').onclick = () => {
        if (customer && customer.email) {
            alert(`تم إرسال الفاتورة (وهمياً) إلى ${customer.email}`);
        } else {
            alert('لا يوجد بريد إلكتروني مسجل لهذا العميل أو هو عميل نقدي.');
        }
    };
}


function initPrescriptionsSection() {
    console.log("قسم الوصفات معطل حالياً");
    return; // لا تنفذ أي كود
}

function savePrescriptionForm() {
    console.log("وظيفة الوصفات معطلة");
    return false; // إرجاع false لإلغاء الحدث
}
// ==================== Customers Section ====================
function initCustomersSection() {
     // Add .auth-required class to the button in your HTML
    // <button id="add-customer-btn2" class="auth-required">إضافة عميل</button>
    // Use window.openCustomerModal because it's attached to window
    document.getElementById('add-customer-btn2').addEventListener('click', () => window.openCustomerModal());

     renderCustomersTable(); // Initial render when section is initialized
}

function renderCustomersTable() {
    const tbody = document.getElementById('customers-list');
    tbody.innerHTML = ''; // Clear previous rows
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا يوجد عملاء مسجلون.</td></tr>';
        return;
    }

    // Sort customers by name
     const sortedCustomers = [...customers].sort((a, b) => {
          const nameA = a.name || ''; // Handle null names
          const nameB = b.name || '';
          return nameA.localeCompare(nameB, 'ar', { sensitivity: 'base' }); // Sort alphabetically in Arabic
     });


    sortedCustomers.forEach(customer => {
        // Find sales by Firestore customer ID in the global sales array
        const customerSales = sales.filter(s => s.customerId === customer.id);
        const totalSpent = customerSales.reduce((sum, sale) => sum + (sale.total || 0), 0); // Sum up total amounts

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${customer.name || 'بدون اسم'}</td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.email || '-'}</td>
            <td>${formatDate(customer.createdAt, 'short')}</td>
            <td>${totalSpent.toFixed(2)} ${CURRENCY}</td>
            <td class="actions-cell">
                </td>
        `;

         const actionsCell = tr.querySelector('.actions-cell');

         // إنشاء زر التعديل وربط المستمع (Add .auth-required class in HTML)
         const editBtn = document.createElement('button');
         editBtn.className = 'edit-btn auth-required'; // Use edit-btn class for styling
         editBtn.innerHTML = '<i class="fas fa-edit"></i> تعديل';
         // Call window.openCustomerModal directly, it handles auth check for saving
         editBtn.addEventListener('click', () => window.openCustomerModal(customer.id));
         actionsCell.appendChild(editBtn);

         // إنشاء زر الحذف وربط المستمع (Add .auth-required class in HTML)
         const deleteBtn = document.createElement('button');
         deleteBtn.className = 'delete-btn auth-required'; // Use delete-btn class for styling
         deleteBtn.innerHTML = '<i class="fas fa-trash"></i> حذف';
         // Call window.deleteCustomer directly because it's attached to window for inline onclick compatibility
         deleteBtn.addEventListener('click', () => window.deleteCustomer(customer.id));
         actionsCell.appendChild(deleteBtn);


        tbody.appendChild(tr);
    });
     // Re-apply auth UI state after rendering the table content
     toggleAuthUI(!!currentUser);
}


// ===== Define functions in the global scope for inline event handlers (onclick etc.) =====

// Attach openCustomerModal to the window object so it can be called from inline onclick/addEventListener
window.openCustomerModal = function(id = null, refreshPosSelect = false) {
    // No need to check currentUser here, the buttons opening the modal should be disabled by toggleAuthUI
    const modal = document.getElementById('customer-modal');
    const form = document.getElementById('customer-form');
    form.reset(); // Clear form fields
    document.getElementById('customer-id').value = ''; // Clear hidden ID field
     // Store the refreshPosSelect state in a data attribute on the form
    form.dataset.refreshPos = refreshPosSelect.toString();

    if (id) { // If ID exists, populate modal for editing
        // FIX: Access customers directly from the module scope, not window.customers
        const customer = customers.find(c => c.id === id);
        if (!customer) {
            alert('العميل غير موجود.');
            return;
        }
        document.getElementById('customer-modal-title').textContent = 'تعديل بيانات العميل';
        document.getElementById('customer-id').value = customer.id; // Store Firestore ID
        document.getElementById('customer-name').value = customer.name || '';
        document.getElementById('customer-phone').value = customer.phone || '';
        document.getElementById('customer-email').value = customer.email || '';
        document.getElementById('customer-address').value = customer.address || '';
        document.getElementById('customer-notes').value = customer.notes || '';
    } else { // If no ID, it's a new customer
        document.getElementById('customer-modal-title').textContent = 'إضافة عميل جديد';
    }
    modal.style.display = 'block'; // Show the modal
}

// saveCustomerForm is called via addEventListener, doesn't strictly need window scope,
// but keeping it for consistency with the caller in initModals.
async function saveCustomerForm(event, refreshPosSelect = false) {
    event.preventDefault(); // Prevent default form submission

    if (!currentUser) { // Check if user is logged in BEFORE saving
        alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول.');
         document.getElementById('customer-modal').style.display = 'none'; // Close modal if not authenticated
        return;
    }

    const id = document.getElementById('customer-id').value; // Get customer ID from hidden field
    const customerData = {
        name: document.getElementById('customer-name').value.trim(),
        phone: document.getElementById('customer-phone').value.trim(),
        email: document.getElementById('customer-email').value.trim(),
        address: document.getElementById('customer-address').value.trim(),
        notes: document.getElementById('customer-notes').value.trim()
    };

    // Basic validation for required fields
    if (!customerData.name) {
        alert('الرجاء إدخال اسم العميل.');
        return;
    }

    try {
        if (id) { // If ID exists, update the existing document
            const customerRef = doc(db, 'customers', id);
            await updateDoc(customerRef, customerData);
            alert('تم تحديث بيانات العميل بنجاح.');
        } else { // If no ID, add a new document
             // Optional: Check for duplicate phone or email
            const qPhone = query(customersCol, where("phone", "==", customerData.phone), where("phone", "!=", ""));
            const qEmail = query(customersCol, where("email", "==", customerData.email), where("email", "!=", ""));

             if (customerData.phone) { // Only check for duplicates if phone is provided
                 const phoneSnapshot = await getDocs(qPhone);
                 if (!phoneSnapshot.empty) {
                     alert('رقم الهاتف مسجل بالفعل لعميل آخر.');
                     return;
                 }
             }
              if (customerData.email) { // Only check for duplicates if email is provided
                 const emailSnapshot = await getDocs(qEmail);
                 if (!emailSnapshot.empty) {
                     alert('البريد الإلكتروني مسجل بالفعل لعميل آخر.');
                     return;
                 }
              }

             // Add new document with creation date and user info
            const docRef = await addDoc(customersCol, { ...customerData, createdAt: new Date().toISOString(), userId: currentUser.uid, userName: currentUser.email });
            customerData.id = docRef.id; // Store the generated ID locally (optional)
            alert('تم إضافة العميل بنجاح.');
        }

        document.getElementById('customer-modal').style.display = 'none'; // Hide modal
        await loadData(); // Re-load data from Firebase
        renderCustomersTable(); // Update customers display
        // Refresh customer selects if needed (e.g., on POS or Prescriptions pages)
        if (refreshPosSelect) {
            renderCustomerSelect(document.getElementById('customer-select'));
            // Select the newly added/updated customer in the POS dropdown
             if(id) document.getElementById('customer-select').value = id; // Select the updated customer
             else document.getElementById('customer-select').value = customerData.id; // Select the new customer
        }
        renderCustomerSelect(document.getElementById('prescription-customer')); // Update Prescriptions dropdown
        populateCustomerReportSelect(); // Update reports dropdown
        updateStats(); // Update dashboard stats

    } catch (error) {
        console.error("Error saving customer:", error);
         if (error.code === 'permission-denied') {
              alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول وقواعد الأمان.');
         } else if (error.message) {
              alert('فشل في حفظ بيانات العميل: ' + error.message);
         } else {
            alert('فشل في حفظ بيانات العميل. يرجى المحاولة مرة أخرى.');
         }
    }
}


// Attach deleteCustomer to the window object so it can be called from inline onclick
window.deleteCustomer = async function(id) {
    if (!currentUser) { // Check if user is logged in BEFORE deleting
        alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول.');
        return;
    }

     // Find the customer in the global customers array
     const customerToDelete = customers.find(c => c.id === id);
      if (!customerToDelete) {
           alert('العميل غير موجود.');
           return;
      }

     // Check if this customer has any sales associated with their Firestore ID
     // Note: This relies on the global sales array being up-to-date.
    const customerSales = sales.filter(s => s.customerId === id);
    if (customerSales.length > 0) {
        if (!confirm('هذا العميل لديه فواتير مسجلة. هل أنت متأكد من حذفه؟ (لن يتم حذف الفواتير من سجل المبيعات ولكن لن تكون مرتبطة بالعميل المحذوف في المستقبل).')) return;
    } else {
        if (!confirm('هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    }

    try {
        const customerRef = doc(db, 'customers', id);
        await deleteDoc(customerRef);
        alert('تم حذف العميل بنجاح.');

        await loadData(); // Re-load data after deleting
        renderCustomersTable(); // Update customers display
        renderCustomerSelect(document.getElementById('customer-select')); // Update POS select
        renderCustomerSelect(document.getElementById('prescription-customer')); // Update Prescriptions select
        populateCustomerReportSelect(); // Update reports select
        updateStats(); // Update dashboard stats

    } catch (error) {
        console.error("Error deleting customer:", error);
         if (error.code === 'permission-denied') {
              alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول وقواعد الأمان.');
         } else {
            alert('فشل في حذف العميل. يرجى المحاولة مرة أخرى.');
         }
    }
}


// ==================== Reports Section ====================
function initReportsSection() {
    document.getElementById('report-type').addEventListener('change', handleReportTypeChange);
    document.getElementById('report-period').addEventListener('change', () => {
        // Show/hide custom dates input based on period selection
        document.getElementById('custom-dates').style.display =
            document.getElementById('report-period').value === 'custom' ? 'flex' : 'none';
    });
    document.getElementById('generate-report').addEventListener('click', generateReport);
    // Add .auth-required class to the button in your HTML
    // <button id="export-report" class="auth-required">تصدير التقرير</button>
    document.getElementById('export-report').addEventListener('click', exportReportToCSV);

    // Initial setup when section is initialized
    populateCustomerReportSelect();
    handleReportTypeChange(); // Set initial display based on default report type
    // Do not generate report automatically on init, wait for user click or default display
    clearReportArea(); // Clear the report area initially
}

function handleReportTypeChange() {
    const reportType = document.getElementById('report-type').value;
    const customerSelectionDiv = document.getElementById('customer-selection-div');
    const chartContainer = document.querySelector('.chart-container');
    const customerSummaryDetails = document.getElementById('customer-report-details-summary');
    const reportTableContainer = document.querySelector('.report-table-container');

    // Show/hide customer selection based on report type
    if (reportType === 'customer_transactions' || reportType === 'customer_summary') {
        customerSelectionDiv.style.display = 'block';
    } else {
        customerSelectionDiv.style.display = 'none';
    }

     // Adjust display of chart and summary div based on report type
    if (reportType === 'customer_transactions') {
        if(chartContainer) chartContainer.style.display = 'none';
        if(customerSummaryDetails) customerSummaryDetails.style.display = 'block'; // Show summary for transactions
        if(reportTableContainer) reportTableContainer.style.marginTop = '10px'; // Less margin if summary is above
    } else if (reportType === 'customer_summary') {
         if(chartContainer) chartContainer.style.display = 'block'; // Show chart for customer summary (e.g., top customers)
         if(customerSummaryDetails) customerSummaryDetails.style.display = 'none'; // No detailed summary div here
         if(reportTableContainer) reportTableContainer.style.marginTop = '20px'; // Default margin
    } else { // Default or other reports (sales, inventory, expired)
        if(chartContainer) chartContainer.style.display = 'block'; // Show chart for sales report
        if(customerSummaryDetails) customerSummaryDetails.style.display = 'none';
        if(reportTableContainer) reportTableContainer.style.marginTop = '20px'; // Default margin
    }
    clearReportArea(); // Clear previous report data when changing type
}

function populateCustomerReportSelect() {
    const select = document.getElementById('report-customer-select');
    select.innerHTML = '<option value="">-- اختر العميل --</option>';
     // Use global customers array to populate the select
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id; // Use Firestore ID as value
        option.textContent = customer.name || 'بدون اسم';
        select.appendChild(option);
    });
}

function clearReportArea() {
    // Clear dynamic content area
    document.getElementById('report-title-area').innerHTML = '';
    document.getElementById('report-table-head').innerHTML = '';
    document.getElementById('report-data').innerHTML = '<tr><td colspan="6" style="text-align:center;">اختر نوع التقرير والفترة ثم اضغط "توليد التقرير".</td></tr>'; // Add colspan up to 6 for customer report

    // Clear and hide customer summary details area
    const customerSummaryDiv = document.getElementById('customer-report-details-summary');
    customerSummaryDiv.innerHTML = '';
     // Only hide if the current report type is NOT customer_transactions
     if (document.getElementById('report-type').value !== 'customer_transactions') {
         customerSummaryDiv.style.display = 'none';
     }


    // Destroy existing chart instance if it exists
    if (reportChartInstance) {
        reportChartInstance.destroy();
        reportChartInstance = null;
    }
     // Clear chart canvas (optional, destroy might be enough)
     const chartCanvas = document.getElementById('report-chart');
     if (chartCanvas) {
         const ctx = chartCanvas.getContext('2d');
         if(ctx) ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
          // Hide chart canvas if the current report type is customer_transactions
         if (document.getElementById('report-type').value === 'customer_transactions') {
              chartCanvas.style.display = 'none';
         } else {
               chartCanvas.style.display = 'block';
         }
     }

    // Remove any Chart.js error message if present
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
        const existingErrorMsg = chartContainer.querySelector('.chart-error-message');
        if (existingErrorMsg) {
            existingErrorMsg.remove();
        }
         // Show/hide chart container based on report type
         if (document.getElementById('report-type').value === 'customer_transactions') {
            chartContainer.style.display = 'none';
        } else {
             chartContainer.style.display = 'block';
        }
    }
     // Ensure the export button is enabled/disabled based on authentication, not just report content presence initially
     toggleAuthUI(!!currentUser);
}


function generateReport() {
    clearReportArea(); // Always clear before generating

    const reportType = document.getElementById('report-type').value;
    const period = document.getElementById('report-period').value;
    let startDate, endDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // End of today


    // Determine date range based on period
    switch(period) {
        case 'today':
            startDate = new Date(today);
            endDate = new Date(endOfToday);
            break;
        case 'week':
            startDate = new Date(today);
            // Adjust to start of the current week (Monday in many locales, Sunday in others)
             // Assuming Monday is the start of the week (getDay() returns 0 for Sunday, 1 for Monday)
             const dayOfWeek = today.getDay();
             const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Difference to get to Monday (1)
             startDate.setDate(today.getDate() - diff);
             startDate.setHours(0,0,0,0); // Start of the start date

            endDate = new Date(endOfToday); // End of today
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of the month
            startDate.setHours(0,0,0,0);
            endDate = new Date(endOfToday); // End of today
            break;
        case 'year':
            startDate = new Date(today.getFullYear(), 0, 1); // First day of the year (January 1st)
            startDate.setHours(0,0,0,0);
            endDate = new Date(endOfToday); // End of today
            break;
        case 'custom':
            const startVal = document.getElementById('start-date').value;
            const endVal = document.getElementById('end-date').value;
            if (!startVal || !endVal) {
                alert('الرجاء اختيار تاريخ بداية ونهاية للفترة المخصصة.');
                document.getElementById('report-data').innerHTML = '<tr><td colspan="6" style="text-align:center;">الرجاء اختيار تاريخ بداية ونهاية للفترة المخصصة.</td></tr>';
                return;
            }
            startDate = new Date(startVal);
            startDate.setHours(0,0,0,0); // Start of the start date
            endDate = new Date(endVal);
            endDate.setHours(23,59,59,999); // End of the end date
             // Validate dates
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
                alert('الرجاء اختيار فترة تاريخ صحيحة.');
                document.getElementById('report-data').innerHTML = '<tr><td colspan="6" style="text-align:center;">الرجاء اختيار فترة تاريخ صحيحة.</td></tr>';
                return;
            }
            break;
        default:
            alert('الرجاء اختيار فترة التقرير.');
             document.getElementById('report-data').innerHTML = '<tr><td colspan="6" style="text-align:center;">الرجاء اختيار فترة التقرير.</td></tr>';
            return;
    }

    const reportTitleArea = document.getElementById('report-title-area');
    const reportTableBody = document.getElementById('report-data');
     const chartContainer = document.querySelector('.chart-container');
     const customerSummaryDiv = document.getElementById('customer-report-details-summary');


     reportTableBody.innerHTML = ''; // Clear previous data before population

     // Set display based on report type BEFORE generating report content
    if (reportType === 'customer_transactions') {
        chartContainer.style.display = 'none';
        customerSummaryDiv.style.display = 'block';
    } else {
        chartContainer.style.display = 'block';
        customerSummaryDiv.style.display = 'none';
    }


    // Generate report based on type
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
                 // Also hide summary and chart if customer not selected
                customerSummaryDiv.style.display = 'none';
                chartContainer.style.display = 'none';
                return;
            }
             // Find customer by Firestore ID in global customers array
            const selectedCustomer = customers.find(c => c.id === customerId);
            if(!selectedCustomer){
                 alert('العميل المختار غير موجود.');
                 reportTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">العميل المختار غير موجود.</td></tr>';
                 customerSummaryDiv.style.display = 'none';
                 chartContainer.style.display = 'none';
                 return;
            }
            reportTitleArea.innerHTML = `<h3>تقرير معاملات العميل: ${selectedCustomer.name || 'بدون اسم'}</h3><p>الفترة: ${formatDate(startDate, 'short')} - ${formatDate(endDate, 'short')}</p>`;
            generateCustomerTransactionsReport(customerId, startDate, endDate); // Pass Firestore ID
            break;
        default:
             reportTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">الرجاء اختيار نوع تقرير صالح.</td></tr>'; // Increased colspan
             chartContainer.style.display = 'none';
             customerSummaryDiv.style.display = 'none';
    }
     // Ensure the export button is enabled/disabled based on authentication AFTER report generation
     toggleAuthUI(!!currentUser);
}


function generateSalesReport(startDate, endDate) {
    document.getElementById('report-table-head').innerHTML = `
        <tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبيعات (${CURRENCY})</th><th>إجمالي الخصم (${CURRENCY})</th><th>صافي المبيعات (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    // Filter sales by date range using the global sales array
    const filteredSales = sales.filter(s => {
         const saleDate = s.date ? new Date(s.date) : null;
         return saleDate && saleDate >= startDate && saleDate <= endDate;
    });

    // Aggregate sales data by date
    const salesByDate = {};
    filteredSales.forEach(sale => {
        const saleDate = sale.date ? new Date(sale.date) : null;
         if(!saleDate) return; // Skip if date is invalid

        // Format date to 'DD/MM/YYYY' for grouping and display
        const dateStr = formatDate(saleDate, 'short');
        if (!salesByDate[dateStr]) {
            salesByDate[dateStr] = { date: dateStr, count: 0, subtotal: 0, discount: 0, total: 0 };
        }
        salesByDate[dateStr].count++;
        salesByDate[dateStr].subtotal += (sale.subtotal || 0);
        salesByDate[dateStr].discount += (sale.discount || 0);
        salesByDate[dateStr].total += (sale.total || 0);
    });

     // Convert aggregated data to an array and sort by date
    const reportData = Object.values(salesByDate).sort((a,b) => {
        // Parse the 'DD/MM/YYYY' date strings for sorting
        const [dayA, monthA, yearA] = a.date.split('/').map(Number);
        const [dayB, monthB, yearB] = b.date.split('/').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA); // Month is 0-indexed (0=Jan, 11=Dec)
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB; // Ascending date order
    });


    if (reportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد بيانات مبيعات لهذه الفترة.</td></tr>';
    } else {
        // Populate the table body
        reportData.forEach(item => {
            tbody.innerHTML += `<tr><td>${item.date}</td><td>${item.count}</td><td>${item.subtotal.toFixed(2)}</td><td>${item.discount.toFixed(2)}</td><td>${item.total.toFixed(2)}</td></tr>`;
        });
    }

    // Handle chart rendering
    const chartCanvas = document.getElementById('report-chart');
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context for report chart not found.');
         chartCanvas.style.display = 'none'; // Hide canvas if context fails
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
            chartContainer.insertBefore(errorMsg, chartCanvas); // Add error message before canvas
        }
        chartCanvas.style.display = 'none'; // Hide canvas on error
        return;
    } else {
         // If Chart.js is loaded, remove any previous error message and show the canvas
         const chartContainer = chartCanvas.parentNode;
        const existingErrorMsg = chartContainer ? chartContainer.querySelector('.chart-error-message') : null;
        if (existingErrorMsg) {
            existingErrorMsg.remove();
        }
         chartCanvas.style.display = 'block';
    }


    // Destroy existing chart instance before creating a new one
    if (reportChartInstance) { reportChartInstance.destroy(); }

    // Create new chart if there is data
    if(reportData.length > 0) {
         reportChartInstance = new Chart(ctx, {
            type: 'bar', // Bar chart for sales values
            data: {
                labels: reportData.map(item => item.date), // Dates as labels
                datasets: [
                    // Dataset for Net Sales
                    { label: `صافي المبيعات (${CURRENCY})`, data: reportData.map(item => item.total), backgroundColor: 'rgba(75, 192, 192, 0.7)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, yAxisID: 'y_sales' },
                    // Dataset for Invoice Count (optional, as a line on a secondary axis)
                    { label: 'عدد الفواتير', data: reportData.map(item => item.count), backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1, type: 'line', fill: false, yAxisID: 'y_invoices' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: {
                // Define two Y-axes
                y_sales: { type: 'linear', display: true, position: 'left', title: { display: true, text: `المبيعات (${CURRENCY})` }, beginAtZero: true },
                y_invoices: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'عدد الفواتير' }, grid: { drawOnChartArea: false }, beginAtZero: true, ticks: { precision: 0 } } // Ensure integer ticks for count
            }, plugins: { tooltip: { callbacks: { title: context => `التاريخ: ${context[0].label}` } } } }
        });
    } else {
         chartCanvas.style.display = 'none'; // Hide chart if no data
    }
}

function generateInventorySummaryReport() {
    document.getElementById('report-table-head').innerHTML = `
        <tr><th>اسم المنتج</th><th>الباركود</th><th>الفئة</th><th>الكمية الحالية</th><th>سعر البيع (${CURRENCY})</th><th>القيمة الإجمالية للمخزون (${CURRENCY})</th></tr>
    `;
    
    // ... باقي الكود الحالي ...

const tbody = document.getElementById('report-data');
    // Use the global products array
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد منتجات في المخزون.</td></tr>';
    } else {
        let totalInventoryValue = 0;
         // Sort products by name for better readability
         const sortedProducts = [...products].sort((a, b) => {
              const nameA = a.name || '';
              const nameB = b.name || '';
              return nameA.localeCompare(nameB, 'ar', { sensitivity: 'base' });
         });

        sortedProducts.forEach(p => {
            const itemValue = (p.quantity || 0) * (p.sellPrice || 0);
            totalInventoryValue += itemValue;
            tbody.innerHTML += `<tr><td>${p.name || 'بدون اسم'}</td><td>${p.barcode || '-'}</td><td>${p.category || '-'}</td><td>${(p.quantity || 0)}</td><td>${(p.sellPrice || 0).toFixed(2)}</td><td>${itemValue.toFixed(2)}</td></tr>`;
        });
        // Add a summary row
        tbody.innerHTML += `<tr><td colspan="5" style="text-align:left; font-weight:bold;">الإجمالي العام لقيمة المخزون:</td><td style="font-weight:bold;">${totalInventoryValue.toFixed(2)} ${CURRENCY}</td></tr>`;
    }
     // Ensure chart is hidden for this report type
    const chartContainer = document.querySelector('.chart-container');
     if(chartContainer) chartContainer.style.display = 'none';
}

function generateExpiredProductsReport() {
    document.getElementById('report-table-head').innerHTML = `
        <tr><th>اسم المنتج</th><th>الباركود</th><th>الكمية</th><th>تاريخ الانتهاء</th><th>أيام متبقية</th><th>قيمة الشراء (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    const today = new Date(); today.setHours(0,0,0,0); // Start of today
    const thirtyDaysFromNow = new Date(today); thirtyDaysFromNow.setDate(today.getDate() + 30); // 30 days from start of today

    // Filter products that are expired or expiring within 30 days and have quantity > 0
    const relevantProducts = products.filter(p => {
        const expiryDate = p.expiryDate ? new Date(p.expiryDate) : null;
         // Product is relevant if it has an expiry date, quantity > 0, and expires before or on 30 days from now
        return expiryDate && (p.quantity || 0) > 0 && expiryDate <= thirtyDaysFromNow;
    }).sort((a,b) => {
        // Sort by expiry date ascending (earliest first)
        const expiryA = a.expiryDate ? new Date(a.expiryDate) : new Date(8640000000000000); // Treat missing as very far future
        const expiryB = b.expiryDate ? new Date(b.expiryDate) : new Date(8640000000000000);
        return expiryA - expiryB;
    });


    if (relevantProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد منتجات منتهية الصلاحية أو ستنتهي خلال 30 يومًا.</td></tr>';
    } else {
        let totalLostValue = 0; // Sum of buy price for actually expired products
        relevantProducts.forEach(p => {
            const expiryDate = p.expiryDate ? new Date(p.expiryDate) : null;
             // Calculate days remaining from the start of today to the expiry date
             const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : NaN;
            const itemLostValue = (p.quantity || 0) * (p.buyPrice || 0); // Buy price * current quantity
            // If expired (days remaining <= 0), add to total lost value
            if (daysRemaining <=0 && !isNaN(daysRemaining)) totalLostValue += itemLostValue;

            // Add classes for styling expired or nearly expired rows
            const rowClass = daysRemaining <= 0 && !isNaN(daysRemaining) ? 'expired' : (daysRemaining > 0 && daysRemaining <= 7 ? 'low-stock' : ''); // Use 'low-stock' for expiring soon


            tbody.innerHTML += `<tr class="${rowClass}"><td>${p.name || 'بدون اسم'}</td><td>${p.barcode || '-'}</td><td>${(p.quantity || 0)}</td><td>${formatDate(p.expiryDate, 'short')}</td><td>${!isNaN(daysRemaining) ? (daysRemaining > 0 ? daysRemaining : 'منتهي') : '-'}</td><td>${itemLostValue.toFixed(2)}</td></tr>`;
        });
         // Add a summary row for total lost value
         tbody.innerHTML += `<tr><td colspan="5" style="text-align:left; font-weight:bold;">إجمالي قيمة الشراء للمنتجات المنتهية فعلياً:</td><td style="font-weight:bold;">${totalLostValue.toFixed(2)} ${CURRENCY}</td></tr>`;

    }
     // Ensure chart is hidden for this report type
    const chartContainer = document.querySelector('.chart-container');
     if(chartContainer) chartContainer.style.display = 'none';
}

function generateCustomerSummaryReport(startDate, endDate) {
     document.getElementById('report-table-head').innerHTML = `
        <tr><th>اسم العميل</th><th>الهاتف</th><th>إجمالي عدد الفواتير</th><th>إجمالي المشتريات (${CURRENCY})</th><th>متوسط قيمة الفاتورة (${CURRENCY})</th></tr>
    `;
    const tbody = document.getElementById('report-data');
    // Process all customers and filter/sort their sales by date range using global sales array
    const customerReportData = customers.map(customer => {
        // Filter sales by Firestore customer ID and date range
        const custSales = sales.filter(s => {
             const saleDate = s.date ? new Date(s.date) : null;
             return s.customerId === customer.id && saleDate && saleDate >= startDate && saleDate <= endDate;
            });
        const totalSpent = custSales.reduce((sum, sale) => sum + (sale.total || 0), 0); // Sum up total amounts
        const invoiceCount = custSales.length;
        return {
            id: customer.id, // Include customer ID for potential linking/detail
            name: customer.name || 'بدون اسم',
            phone: customer.phone || '-',
            invoiceCount: invoiceCount,
            totalSpent: totalSpent,
            avgInvoiceValue: invoiceCount > 0 ? totalSpent / invoiceCount : 0
        };
    })
    // Filter out customers with no sales in the period
    .filter(c => c.invoiceCount > 0)
    // Sort descending by total spent
    .sort((a,b) => b.totalSpent - a.totalSpent);

    if (customerReportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا يوجد عملاء لديهم مشتريات في هذه الفترة.</td></tr>';
    } else {
        // Populate the table body
        customerReportData.forEach(c => {
            tbody.innerHTML += `<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.invoiceCount}</td><td>${c.totalSpent.toFixed(2)}</td><td>${c.avgInvoiceValue.toFixed(2)}</td></tr>`;
        });
    }

    // Prepare data for chart (e.g., Top 10 customers)
    const topCustomersChartData = customerReportData.slice(0, 10); // Get top 10 for chart
    const chartCanvas = document.getElementById('report-chart');
    const ctx = chartCanvas.getContext('2d');

     // Check if canvas context or Chart.js is available
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


    // Destroy existing chart instance
    if (reportChartInstance) { reportChartInstance.destroy(); }

     // Create new chart if there's data for the top customers
     if(topCustomersChartData.length > 0) {
         reportChartInstance = new Chart(ctx, {
            type: 'bar', // Bar chart
            data: {
                labels: topCustomersChartData.map(c => c.name), // Customer names as labels
                datasets: [{ label: `إجمالي المشتريات (${CURRENCY})`, data: topCustomersChartData.map(c => c.totalSpent), backgroundColor: 'rgba(153, 102, 255, 0.7)', borderColor: 'rgba(153, 102, 255, 1)', borderWidth: 1 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: {display: true, text: `المشتريات (${CURRENCY})`} } }, plugins: { tooltip: { callbacks: { title: context => `العميل: ${context[0].label}` } } } }
        });
     } else {
         chartCanvas.style.display = 'none'; // Hide chart if no data
     }
}

// generateCustomerTransactionsReport accepts Firestore customer ID
function generateCustomerTransactionsReport(customerId, startDate, endDate) {
    // Find customer by Firestore ID in global customers array
    const customer = customers.find(c => c.id === customerId);
    const tbody = document.getElementById('report-data');
    const summaryDiv = document.getElementById('customer-report-details-summary');

    if (!customer) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لم يتم العثور على العميل.</td></tr>';
         summaryDiv.innerHTML = `<p>لم يتم العثور على العميل.</p>`;
         // Ensure chart is hidden for this report type when no customer is found
         const chartContainer = document.querySelector('.chart-container');
         if(chartContainer) chartContainer.style.display = 'none';
        return;
    }

    document.getElementById('report-table-head').innerHTML = `
        <tr><th>اليوم والساعة</th><th>رقم الفاتورة</th><th>اسم المنتج</th><th>السعر (${CURRENCY})</th><th>الكمية</th><th>الإجمالي (${CURRENCY})</th></tr>
    `;

     // Filter sales by Firestore customer ID and date range using global sales array
    const customerSales = sales.filter(s => {
         const saleDate = s.date ? new Date(s.date) : null;
         return s.customerId === customerId && saleDate && saleDate >= startDate && saleDate <= endDate;
        })
                              .sort((a,b) => {
                                   const dateA = a.date ? new Date(a.date) : new Date(0);
                                   const dateB = b.date ? new Date(b.date) : new Date(0);
                                  return dateB - dateA; // Sort descending by date
                                });

    let reportContent = '';
    let totalFinancialValue = 0;
    let totalDiscountGiven = 0;
    const productsPurchasedList = new Set();
    const paymentMethodsCount = {};
    const salesByDayOfWeek = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 }; // Sunday to Saturday
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];


    if (customerSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد معاملات لهذا العميل في الفترة المحددة.</td></tr>';
        summaryDiv.innerHTML = `<p>لا توجد معاملات لهذا العميل (${customer.name || 'بدون اسم'}) في الفترة المحددة.</p>`;
         // Ensure chart is hidden if no sales data
         const chartContainer = document.querySelector('.chart-container');
         if(chartContainer) chartContainer.style.display = 'none';
        return;
    }

    // Populate table rows and calculate summary statistics
    customerSales.forEach(sale => {
        totalFinancialValue += (sale.total || 0);
        totalDiscountGiven += (sale.discount || 0);

        const saleDate = sale.date ? new Date(sale.date) : null;
         if(saleDate) salesByDayOfWeek[saleDate.getDay()]++; // Increment count for day of the week


        if(sale.paymentMethod){
             if(paymentMethodsCount[sale.paymentMethod]){
                paymentMethodsCount[sale.paymentMethod]++;
            } else {
                paymentMethodsCount[sale.paymentMethod] = 1;
            }
        }


        sale.items.forEach(item => {
            reportContent += `
                <tr>
                    <td>${formatDate(sale.date)}</td>
                    <td>${sale.invoiceNumber || '-'}</td>
                    <td>${item.name || 'بدون اسم'}</td>
                    <td>${(item.price || 0).toFixed(2)}</td>
                    <td>${item.quantity || 0}</td>
                    <td>${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                </tr>
            `;
            if(item.name) productsPurchasedList.add(item.name); // Add product name to set
        });
    });
    tbody.innerHTML = reportContent; // Populate the table body

    // Calculate summary values
    const numberOfInvoices = customerSales.length;
    const avgTransactionValue = numberOfInvoices > 0 ? totalFinancialValue / numberOfInvoices : 0;

    // Find the most frequent purchase day
    let mostFrequentDayNum = -1;
    let maxSalesOnDay = -1;
    for(const dayNum in salesByDayOfWeek){
        if(salesByDayOfWeek[dayNum] > maxSalesOnDay){
            maxSalesOnDay = salesByDayOfWeek[dayNum];
            mostFrequentDayNum = parseInt(dayNum);
        }
    }
    const mostFrequentPurchaseDay = maxSalesOnDay > 0 ? dayNames[mostFrequentDayNum] : "لا يوجد يوم مفضل واضح";

    // Find the preferred payment method
    let preferredPaymentMethod = "غير محدد";
    let maxPaymentCount = -1;
    for(const method in paymentMethodsCount){
        if(paymentMethodsCount[method] > maxPaymentCount){
            maxPaymentCount = paymentMethodsCount[method];
            switch(method) {
                case 'cash': preferredPaymentMethod = 'نقدي'; break;
                case 'card': preferredPaymentMethod = 'بطاقة ائتمان'; break;
                case 'transfer': preferredPaymentMethod = 'تحويل بنكي'; break;
                default: preferredPaymentMethod = method; // Use method name if not one of the common ones
            }
        }
    }
     if (maxPaymentCount <= 0 && numberOfInvoices > 0) preferredPaymentMethod = "متنوع"; // If no clear preferred method but sales exist
     if (numberOfInvoices === 0) preferredPaymentMethod = "-"; // No sales, no preferred method


    // Example loyalty points calculation (can be adjusted)
    const loyaltyPointsEarned = Math.floor(totalFinancialValue / 20); // 1 point per 20 currency units


    // Populate the customer summary details div
    summaryDiv.innerHTML = `
        <h3>ملخص معاملات العميل: ${customer.name || 'بدون اسم'}</h3>
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

     // Ensure chart is hidden for this report type
     const chartContainer = document.querySelector('.chart-container');
     if(chartContainer) chartContainer.style.display = 'none';
}


// exportReportToCSV operates on the currently rendered table data and summary div.
function exportReportToCSV() {
    const reportType = document.getElementById('report-type').value;
    const table = document.getElementById('report-table');
    const head = document.getElementById('report-table-head');
    const body = document.getElementById('report-data');

     // Check if there's actual data in the table body (more robust check)
    const hasDataRows = body.rows.length > 0 && !(body.rows.length === 1 && body.rows[0].cells.length === 1 && (body.rows[0].cells[0].textContent.includes("لا توجد بيانات") || body.rows[0].cells[0].textContent.includes("الرجاء اختيار")));


    if (!head.rows.length || !hasDataRows) {
        alert('لا توجد بيانات لتصديرها في التقرير الحالي.');
        return;
    }


    let csv = [];
    // Add report title
    const reportTitleContent = document.getElementById('report-title-area').innerText;
    if(reportTitleContent) csv.push('"' + reportTitleContent.replace(/\n/g, " - ").replace(/"/g, '""') + '"'); // Replace newlines and escape quotes

    // Add table headers
    const headerRow = [];
    // Iterate through header cells to get column titles
    for (let i = 0; i < head.rows[0].cells.length; i++) {
        headerRow.push('"' + head.rows[0].cells[i].innerText.replace(/"/g, '""') + '"');
    }
    csv.push(headerRow.join(',')); // Join header cells with comma

    // Add table body rows
    for (let i = 0; i < body.rows.length; i++) {
        const row = [], cols = body.rows[i].querySelectorAll("td, th"); // Select td or th
        // Iterate through cells in the current row
        for (let j = 0; j < cols.length; j++) {
            // Use textContent instead of innerText to get content including potentially hidden elements (though less likely in this table context)
            // Escape quotes within cell content
            row.push('"' + cols[j].textContent.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(",")); // Join cell values with comma
    }

    // Add customer transaction summary to CSV if applicable
    if (reportType === 'customer_transactions') {
        const summaryDiv = document.getElementById('customer-report-details-summary');
        // Check if the summary div is visible and has content
        if (summaryDiv && summaryDiv.style.display !== 'none' && summaryDiv.innerText.trim() !== '') {
            csv.push(''); // Add an empty line for separation
            const summaryTitle = summaryDiv.querySelector('h3');
            if(summaryTitle) csv.push('"' + summaryTitle.innerText.replace(/"/g, '""') + '"');

            // Get all paragraph texts from the summary div and add them as rows
            summaryDiv.querySelectorAll('p').forEach(p => {
                // Replace newlines within paragraph text and escape quotes
                let pText = p.innerText.replace(/\n/g, " ").replace(/"/g, '""');
                csv.push('"' + pText + '"');
            });
             // Optionally add content from H4
             const h4 = summaryDiv.querySelector('h4');
             if(h4) csv.push('"' + h4.innerText.replace(/"/g, '""') + '"');
        }
    }

     // Add BOM (Byte Order Mark) for correct display of Arabic characters in programs like Excel
    const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const downloadLink = document.createElement("a");
    // Create a descriptive filename including report type and date
    downloadLink.download = `تقرير_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none"; // Hide the link
    document.body.appendChild(downloadLink); // Add to DOM temporarily
    downloadLink.click(); // Simulate click to trigger download
    document.body.removeChild(downloadLink); // Remove from DOM
    window.URL.revokeObjectURL(downloadLink.href); // Clean up the object URL
    // Optional: provide feedback to the user
    // alert('تم تصدير التقرير بنجاح!');
}


// ==================== Modals ====================
function initModals() {
    // Setup closing behavior for all modals using the close button
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Close modal if user clicks outside of it (on the modal overlay)
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Set form submit handlers (authentication checks are inside the save functions)
    document.getElementById('product-form').addEventListener('submit', saveProductForm);
    // Pass event and refreshPosSelect flag based on the data attribute set in openCustomerModal
    document.getElementById('customer-form').addEventListener('submit', (event) => {
         const form = event.target;
         const refreshPos = form.dataset.refreshPos === 'true';
         saveCustomerForm(event, refreshPos);
    });
    document.getElementById('prescription-form').addEventListener('submit', savePrescriptionForm);

    // Add item button for prescriptions modal
    document.getElementById('add-prescription-item').addEventListener('click', () => addPrescriptionItem());
}

// ==================== Helper Functions ====================

// exportAllData uses the current state of the global arrays (assumed to be from Firestore)
function exportAllData() {
     if (!currentUser) { // Check if user is logged in BEFORE exporting
        alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول.');
        return;
    }

    const dataToExport = {
        products,
        customers,
        sales,
        prescriptions,
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser ? currentUser.email : 'Unknown User' // Add user info
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `بيانات_الصيدلية_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Clean up the object URL
    alert('تم تصدير جميع البيانات بنجاح!');
}

// ==================== MODIFIED importAllData Function START ====================
async function importAllData(event) {
    if (!currentUser) {
        alert('ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول.');
        event.target.value = ''; 
        return;
    }

    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('تحذير: هل أنت متأكد من استيراد البيانات؟ سيتم حذف جميع البيانات الحالية في قاعدة البيانات واستبدالها بالبيانات المستوردة! يُنصح بأخذ نسخة احتياطية أولاً عبر خاصية التصدير.')) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (!importedData.products || !importedData.customers || !importedData.sales || !importedData.prescriptions) {
                throw new Error("الملف المستورد لا يحتوي على جميع الأقسام المتوقعة (products, customers, sales, prescriptions).");
            }

            // --- WARNING: This is a destructive import! ---
            // Delete existing data from all collections
            console.log('Starting deletion of existing data...');
            await runTransaction(db, async (transaction) => {
                const collectionsToDeleteFrom = [productsCol, customersCol, salesCol, prescriptionsCol]; // Define collections
                const docsToDeleteReferences = [];

                // Phase 1: READS - Collect all document references to be deleted
                for (const collectionRef of collectionsToDeleteFrom) {
                    const snapshot = await transaction.get(collectionRef); // READ
                    snapshot.docs.forEach(doc => {
                        docsToDeleteReferences.push(doc.ref);
                    });
                }
                console.log(`Found ${docsToDeleteReferences.length} documents to delete across collections.`);

                // Phase 2: WRITES - Delete all collected document references
                if (docsToDeleteReferences.length > 0) {
                    docsToDeleteReferences.forEach(docRef => {
                        transaction.delete(docRef); // WRITE
                    });
                }
            });
            console.log('Existing data deleted successfully.');

            // Add imported data to Firestore
            console.log('Starting import of new data...');
            await runTransaction(db, async (transaction) => {
                const collectionsToAdd = [
                    { ref: productsCol, data: importedData.products, name: "products" },
                    { ref: customersCol, data: importedData.customers, name: "customers" },
                    { ref: salesCol, data: importedData.sales, name: "sales" },
                    { ref: prescriptionsCol, data: importedData.prescriptions, name: "prescriptions" }
                ];

                for (const collectionItem of collectionsToAdd) {
                    const collectionRef = collectionItem.ref;
                    const dataArray = collectionItem.data;
                    let count = 0;
                    if (Array.isArray(dataArray)) {
                        dataArray.forEach(item => {
                            const itemToSave = { ...item };
                            delete itemToSave.id; 

                            if (currentUser) {
                                itemToSave.importedByUserId = currentUser.uid;
                                itemToSave.importedByUserName = currentUser.email;
                                itemToSave.importedAt = new Date().toISOString();
                            }
                            // Use doc(collectionRef) to add with auto-ID
                            transaction.set(doc(collectionRef), itemToSave); // WRITE
                            count++;
                        });
                    }
                    console.log(`Added ${count} items to ${collectionItem.name} collection.`);
                }
            });
            console.log('Imported data added successfully.');

            await loadData();
            updateStats();
            const activeSection = document.querySelector('main section.active-section');
            if (activeSection) {
                await showSection(activeSection.id);
            } else {
                await showSection('dashboard');
            }
            alert('تم استيراد البيانات بنجاح.');

        } catch (error) {
            console.error("Error importing data:", error);
            let errorMessage = 'فشل استيراد البيانات. الملف غير صالح أو تالف أو حدث خطأ أثناء الكتابة إلى قاعدة البيانات.';
            if (error.code === 'permission-denied') {
                errorMessage = 'ليس لديك صلاحية لإجراء هذا الإجراء. يرجى التأكد من تسجيل الدخول وقواعد الأمان.';
            } else if (error.message) {
                errorMessage += '\n' + error.message;
            }
            alert(errorMessage);
            
            await loadData();
            updateStats();
            const activeSection = document.querySelector('main section.active-section');
            if (activeSection) {
                await showSection(activeSection.id);
            } else {
                await showSection('dashboard');
            }
        } finally {
            event.target.value = ''; 
        }
    };
    reader.onerror = function() {
        console.error("Error reading file:", reader.error);
        alert('فشل في قراءة الملف.');
        event.target.value = '';
    };
    reader.readAsText(file);
}
// ==================== MODIFIED importAllData Function END ======================


function formatDate(dateString, format = 'long') {
     if (!dateString) return 'غير محدد';

     // Attempt to parse the date string. Firestore might store dates as ISO strings, numbers, or Timestamps.
     // Handle Firestore Timestamp objects specifically if they are used (get Date from it)
     let date;
      if (dateString && typeof dateString.toDate === 'function') { // Check if it's a Firestore Timestamp object
         date = dateString.toDate();
     } else if (typeof dateString === 'string' || typeof dateString === 'number') {
         date = new Date(dateString);
     } else if (dateString instanceof Date) {
         date = dateString;
     } else {
          // Handle other potential formats if necessary, or return invalid
          return 'تاريخ غير صالح';
     }


    if (isNaN(date.getTime())) return 'تاريخ غير صالح'; // Check if date is valid

    // Define date formatting options for Arabic locale
    const optionsShort = { year: 'numeric', month: '2-digit', day: '2-digit' }; // DD/MM/YYYY
    const optionsLong = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    const optionsDateTime = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };


    try {
        if (format === 'short') {
            // Use 'ar-EG' for DD/MM/YYYY format which is common in Arabic regions.
            return date.toLocaleDateString('ar-EG', optionsShort);
        }
        if (format === 'long') {
             return date.toLocaleString('ar-EG', optionsLong); // Using toLocaleString for time part
        }
         if (format === 'datetime') {
             return date.toLocaleString('ar-EG', optionsDateTime);
        }
         // Default to long format if format is unknown
        return date.toLocaleString('ar-EG', optionsLong);

    } catch (e) {
        console.error("Error formatting date:", e, dateString);
        return 'تاريخ غير صالح'; // Return fallback on error
    }
}

// Ensure Chart.js is loaded in your HTML for reports section.
// Example: <script src="https://cdn.jsdelivr.net/npm/chart.js@^3.0.0/dist/chart.min.js"></script>
// Ensure Font Awesome is loaded for icons.
// Example: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">

// Ensure your HTML has elements with appropriate IDs and classes as referenced in this script.
// Specifically:
// - Sections with IDs: dashboard, inventory, pos, prescriptions, customers, reports
// - Nav links with data-section attributes matching section IDs
// - Tables with IDs: inventory-list, cart-items, prescriptions-list, customers-list, report-table
// - Table head/body IDs: report-table-head, report-data
// - Form elements with IDs: product-form, customer-form, prescription-form, etc. as used in modals
// - Modal divs with IDs: product-modal, customer-modal, prescription-modal, invoice-modal
// - Specific elements in modals and report sections with IDs as used (e.g., subtotal, total, report-type, etc.)
// - Elements that require authentication should have the class 'auth-required' in HTML
// - An element with id="prescription-item-template" (display: none) for adding prescription items.
// - An element with id="logout-btn" (will be created by script if not present in header)
// - Elements for dashboard stats with IDs: total-products, expired-products, today-sales, total-customers
// - Elements for POS section: pos-search, pos-products, customer-select, payment-buttons (.payment-btn), discount-input, discount-type, complete-sale, subtotal, discount-amount, total
// - Elements for Prescriptions section: add-prescription-btn, prescriptions-list, prescription-modal, prescription-form, prescription-id, prescription-customer, prescription-doctor, prescription-date, prescription-diagnosis, prescription-notes, prescription-items-container, add-prescription-item
// - Elements for Customers section: add-customer-btn2, customers-list, customer-modal, customer-form, customer-id, customer-name, customer-phone, customer-email, customer-address, customer-notes
// - Elements for Reports section: report-type, report-period, custom-dates, start-date, end-date, generate-report, export-report, report-title-area, customer-selection-div, report-customer-select, chart-container, report-chart, customer-report-details-summary
