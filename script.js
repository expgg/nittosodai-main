// API credentials and sheet information
// IMPORTANT: Replace these with your actual keys and IDs.
const API_KEY = "AIzaSyANHxkVsDT_nN0BHgyReFrkJYVvF5_Sl-Q";
const HOMEPAGE_SPREADSHEET_ID = "1uKNlnpZsmQbmIPkfEWvWK5qLHpgGOUeneaHM8wXPG3E";
const CATEGORY_SHEET_NAME = "Sheet1";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1427390049783255110/8U3d9RnA3wT8VzeblhfHOtv0Z5RDVLBj6A636ZOA2o7o6DXJlHIK6POhbWKF5OdOQXbo";

// ** NEW SHOP LOCATION COORDINATES (Placeholder: Googleplex) **
const SHOP_LATITUDE = "25.0723411";
const SHOP_LONGITUDE = "91.4106641";

// ** GLOBAL: Timer for managing the toast notification visibility **
let toastTimer = null; 

// ** NEW: Currency Formatting Utility **
function formatPrice(price) {
    // Convert price to an integer (removing .00), and prepend '৳'
    return `৳${Math.round(price)}`;
}

/**
 * NEW FUNCTION: Generates a random 6-character alphanumeric string for the Order ID.
 * Uses a safe and simple method for non-cryptographic unique IDs.
 * @returns {string} The unique order ID (e.g., F2Y48K).
 */
function generateOrderId() {
    // Characters: uppercase letters and digits (A-Z, 0-9)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const length = 6;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * NEW FUNCTION: Formats a Date object into the required DD/MM/YY Time - 12 Hour format.
 * Example: 29/10/25 Time - 08:41 PM
 * @param {Date} dateObj - The Date object to format.
 * @returns {string} The formatted date string.
 */
function formatOrderDate(dateObj) {
    // Date components (DD/MM/YY)
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2); // Get last two digits of the year
    
    // Time components (12 Hour format with AM/PM)
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' should be '12'
    hours = String(hours).padStart(2, '0');
    
    return `${day}/${month}/${year} Time - ${hours}:${minutes} ${ampm}`;
}

/**
 * NEW FUNCTION: Calculates the discount percentage, rounded to the nearest integer.
 * @param {number} originalPrice 
 * @param {number} discountedPrice 
 * @returns {number} Rounded discount percentage, or 0 if not discounted.
 */
function calculateDiscountPercentage(originalPrice, discountedPrice) {
    // Ensure prices are valid numbers
    originalPrice = parseFloat(originalPrice) || 0;
    discountedPrice = parseFloat(discountedPrice) || 0;

    if (originalPrice <= 0 || discountedPrice <= 0 || originalPrice <= discountedPrice) {
        return 0;
    }
    const discount = originalPrice - discountedPrice;
    const percentage = (discount / originalPrice) * 100;
    // Round to the nearest whole number as requested
    return Math.round(percentage);
}

// Utility function to show a custom message modal instead of alert()
function showMessage(message, isOrderComplete = false) {
    const modal = document.getElementById('message-modal');
    const messageText = document.getElementById('message-text');
    messageText.textContent = message;
    modal.style.display = 'block';
    
    // Show or hide the order success styling based on the isOrderComplete flag
    const modalContent = modal.querySelector('.modal-content');
    const homepageButton = modal.querySelector('.primary-btn');
    
    if (isOrderComplete) {
        modalContent.classList.add('order-success');
        if (homepageButton) homepageButton.style.display = 'inline-block';
    } else {
        modalContent.classList.remove('order-success');
        if (homepageButton) homepageButton.style.display = 'none';
    }

    const closeButtons = modal.querySelectorAll('.close-button');
    closeButtons.forEach(button => {
        button.onclick = () => {
            modal.style.display = 'none';
        };
    });
}

/**
 * NEW FUNCTION: Shows a smooth toast notification at the top of the screen.
 * UPDATED: Added logic to clear and reset the timer for rapid updates.
 * @param {string} name - Name of the item added/removed.
 * @param {number} quantity - Quantity added/removed (positive or negative).
 * @param {boolean} isRemoved - Flag to change the message context.
 */
function showToast(name, quantity, isRemoved = false) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    // Clear any existing timer to reset the duration
    if (toastTimer) {
        clearTimeout(toastTimer);
    }

    let message;
    
    if (isRemoved) {
        message = quantity > 1
            ? `${quantity} items of ${name} removed from cart!`
            : `${name} removed from cart.`;
        toast.textContent = message;
    } else {
        message = quantity > 1 
            ? `${quantity} items of ${name} added to cart!` 
            : `${name} added to cart!`;
        toast.textContent = `Item - ${message}`;
    }

    // Ensure the toast is visible (if it was hidden, this makes it visible again)
    toast.classList.add('show');

    // Set a new timer to hide the toast after 3 seconds
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toastTimer = null;
    }, 3000);
}


// Function to fetch data from a specific spreadsheet ID and sheet
async function fetchSheetData(spreadsheetId, sheetName = 'Sheet1') {
    // A to I columns, including tags
    const range = `${sheetName}!A:I`; 
    // FIX: Add cache buster to the URL to force fresh data retrieval every time
    const cacheBuster = Date.now();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}&_=${cacheBuster}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data.values;
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

// Sidebar and menu toggle logic
function setupSidebar() {
    const hamburgerBtn = document.getElementById('hamburger-menu-btn');
    const sideMenu = document.getElementById('side-menu');
    
    // Make sure we have both elements before adding event listeners
    if (!hamburgerBtn || !sideMenu) {
        console.error('Hamburger menu or side menu elements not found');
        return;
    }
    
    // Remove any existing event listeners to prevent duplicates
    const newHamburgerBtn = hamburgerBtn.cloneNode(true);
    hamburgerBtn.parentNode.replaceChild(newHamburgerBtn, hamburgerBtn);
    
    // Add click event listener to hamburger button
    newHamburgerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sideMenu.classList.toggle('open');
        updateCartPreview(); // Update cart preview when menu is opened
        console.log('Hamburger clicked, menu toggled');
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#side-menu') && !e.target.closest('#hamburger-menu-btn') && sideMenu.classList.contains('open')) {
            sideMenu.classList.remove('open');
        }
    });
}

// Function to update cart preview in the side menu
function updateCartPreview() {
    const sideMenu = document.getElementById('side-menu');
    let cartPreviewContainer = document.getElementById('cart-preview-container');
    
    // Remove existing cart preview if it exists
    if (cartPreviewContainer) {
        cartPreviewContainer.remove();
    }
    
    // Create new cart preview container
    cartPreviewContainer = document.createElement('div');
    cartPreviewContainer.id = 'cart-preview-container';
    cartPreviewContainer.classList.add('cart-preview-container');
    
    // Get cart items
    const cart = getCart();
    
    // Add header
    const previewHeader = document.createElement('h3');
    previewHeader.textContent = 'Cart Items';
    cartPreviewContainer.appendChild(previewHeader);
    
    // Add items or empty message
    if (Object.keys(cart).length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'Your cart is empty';
        cartPreviewContainer.appendChild(emptyMessage);
    } else {
        // Create items list
        const itemsList = document.createElement('div');
        itemsList.classList.add('cart-preview-items');
        
        // Add each item
        for (const itemId in cart) {
            const item = cart[itemId];
            const itemElement = document.createElement('div');
            itemElement.classList.add('cart-preview-item');
            
            // Item image
            const itemImg = document.createElement('img');
            itemImg.src = item.image;
            itemImg.alt = item.name;
            itemElement.appendChild(itemImg);
            
            // Item details
            const itemDetails = document.createElement('div');
            itemDetails.classList.add('cart-preview-item-details');
            
            const itemName = document.createElement('p');
            itemName.classList.add('cart-preview-item-name');
            itemName.textContent = item.name;
            itemDetails.appendChild(itemName);
            
            const itemPrice = document.createElement('p');
            itemPrice.classList.add('cart-preview-item-price');
            // UPDATED: Use formatPrice utility
            itemPrice.textContent = formatPrice(item.price);
            itemDetails.appendChild(itemPrice);
            
            itemElement.appendChild(itemDetails);
            
            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.classList.add('cart-preview-remove-btn');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.dataset.id = itemId;
            removeBtn.dataset.name = item.name; // Added for toast
            removeBtn.dataset.quantity = item.quantity; // Added for toast
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const itemToRemoveId = e.target.closest('button').dataset.id;
                const itemToRemoveName = e.target.closest('button').dataset.name;
                const itemToRemoveQty = parseInt(e.target.closest('button').dataset.quantity, 10);
                
                const cart = getCart();
                delete cart[itemToRemoveId];
                saveCart(cart);
                updateCartPreview();
                
                // NEW: Show toast notification for removal
                showToast(itemToRemoveName, itemToRemoveQty, true);
            });
            
            itemElement.appendChild(removeBtn);
            itemsList.appendChild(itemElement);
        }
        
        cartPreviewContainer.appendChild(itemsList);
    }
    
    // Find the call button if it exists and insert the preview before it, otherwise append to the end
    const callNowBtn = sideMenu.querySelector('.side-menu-call-btn');
    if (callNowBtn) {
        sideMenu.insertBefore(cartPreviewContainer, callNowBtn);
    } else {
        // Add the cart preview after the last link in the side menu
        sideMenu.appendChild(cartPreviewContainer);
    }
}

// Cart logic (using localStorage for a simple demo)
function getCart() {
    try {
        return JSON.parse(localStorage.getItem('cart')) || {};
    } catch (e) {
        console.error("Error parsing cart data from localStorage:", e);
        return {};
    }
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

// ** NEW: Helper function to get past orders **
function getPastOrders() {
    try {
        return JSON.parse(localStorage.getItem('pastOrders')) || [];
    } catch (e) {
        console.error("Error parsing past orders from localStorage:", e);
        return [];
    }
}

// ** NEW: Helper function to save past orders **
function savePastOrders(orders) {
    localStorage.setItem('pastOrders', JSON.stringify(orders));
}


function addToCart(item, quantity = 1) {
    try {
        // Ensure quantity is a positive integer
        quantity = Math.max(1, Math.floor(quantity)); 
        
        const cart = getCart();
        if (cart[item.id]) {
            cart[item.id].quantity += quantity;
        } else {
            cart[item.id] = { ...item, quantity };
        }
        saveCart(cart);
        
        // NEW: Show toast notification for addition
        showToast(item.name, quantity, false);
        
        console.log('Item added to cart:', item, 'Quantity:', quantity);
    } catch (error) {
        console.error('Error adding item to cart:', error);
        showMessage('Failed to add item to cart. Please try again.'); // Using showMessage instead of alert
    }
}

function updateCartCount() {
    const cart = getCart();
    const count = Object.values(cart).reduce((total, item) => total + item.quantity, 0);
    // Target the new counter element in the bottom navigation bar
    const cartCountElements = document.querySelectorAll('#cart-count');
    cartCountElements.forEach(el => {
        el.textContent = count;
        // Show/hide the badge based on cart count
        el.style.display = count > 0 ? 'flex' : 'none';
    });
}

/**
 * NEW FUNCTION: Setup logic for the fixed bottom navigation bar
 */
function setupBottomNav() {
    const homeBtn = document.getElementById('nav-home-btn');
    const backBtn = document.getElementById('nav-back-btn');
    const cartBtn = document.getElementById('nav-cart-btn');
    const historyBtn = document.getElementById('nav-history-btn'); // UPDATED
    const filename = window.location.pathname.split('/').pop() || 'index.html';

    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            window.location.href = 'cart.html';
        });
    }
    
    // UPDATED: Added history button listener
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            window.location.href = 'oh.html';
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Check if on the homepage, if so, refresh as requested by the user
            if (filename === 'index.html' || filename === '') {
                window.location.reload();
            } else {
                // Go back one page in history for all other pages
                history.back();
            }
        });
    }
}

/**
 * NEW FUNCTION: Setup logic for the new image gallery slideshow
 * NOTE: Click-to-enlarge logic removed as requested by the user.
 */
function setupGallerySlideshow() {
    const gallery = document.getElementById('gallery-slideshow');
    const slides = gallery ? gallery.querySelectorAll('.gallery-slide') : [];
    
    if (slides.length === 0) return;

    let slideIndex = 0;
    const scrollSlide = () => {
        slideIndex++;
        if (slideIndex >= slides.length) {
            slideIndex = 0; // Loop back to the first slide
        }
        // Calculate the scroll position based on the slide width
        gallery.scrollLeft = slides[0].offsetWidth * slideIndex;
    };

    // Auto-scroll every 3 seconds
    setInterval(scrollSlide, 3000); 

    // ** REMOVED: Setup click-to-enlarge modal logic (as requested) **
    
    // Retain click listener but prevent default action just in case
    slides.forEach(slide => {
        slide.addEventListener('click', (e) => {
            e.preventDefault();
            // Photo will not open in a bigger window
        });
    });
}

/**
 * NEW FUNCTION: Setup map navigation button using deep links.
 */
function setupMapNavigation() {
    const visitShopBtn = document.getElementById('visit-shop-btn');
    
    if (visitShopBtn) {
        visitShopBtn.addEventListener('click', () => {
            // d: driving mode, start: current location (saddr), destination: shop coordinates (daddr)
            const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${SHOP_LATITUDE},${SHOP_LONGITUDE}&travelmode=driving`;
            
            // Attempt to open the map URL. This will typically open the Google Maps app 
            // on mobile or the web version on desktop/browser.
            window.open(mapUrl, '_blank');
        });
    }
}


// Homepage Functions
async function loadHomepage() {
    setupSidebar();
    updateCartCount();
    setupGallerySlideshow(); // Initialize the gallery slideshow
    setupMapNavigation(); // NEW: Initialize map navigation logic

    const categoriesData = await fetchSheetData(HOMEPAGE_SPREADSHEET_ID, CATEGORY_SHEET_NAME);
    const categoriesContainer = document.getElementById('categories-container');
    
    if (!categoriesData) {
        categoriesContainer.innerHTML = "<p>Couldn't load categories, my bad.</p>";
        return;
    }
    
    // Skip header row
    const categories = categoriesData.slice(1);
    
    categories.forEach(row => {
        const categoryName = row[0];
        const categorySheetId = row[1];
        const categoryImage = row[2]; // Get category image from C2 in the sheet
        
        if (categoryName && categorySheetId) {
            const link = document.createElement('a');
            link.href = `category.html?cat=${encodeURIComponent(categoryName)}&id=${encodeURIComponent(categorySheetId)}`;
            link.classList.add('category-link');
            
            // Add category image if available
            if (categoryImage) {
                const img = document.createElement('img');
                img.src = categoryImage;
                img.alt = categoryName;
                img.onerror = function() {
                    this.onerror = null;
                    this.src = 'https://placehold.co/150x150/8C7047/ffffff?text=Category';
                };
                link.appendChild(img);
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = categoryName;
            link.appendChild(nameSpan);
            
            categoriesContainer.appendChild(link);
        }
    });

    // Slideshow logic (Main Sales Slideshow)
    let slideIndex = 0;
    const slides = document.querySelectorAll('.slideshow .slide');
    const showSlides = () => {
        for (let i = 0; i < slides.length; i++) {
            slides[i].style.display = 'none';
        }
        slideIndex++;
        if (slideIndex > slides.length) { slideIndex = 1; }
        slides[slideIndex - 1].style.display = 'block';
        setTimeout(showSlides, 3000); // Change image every 3 seconds
    };
    if (slides.length > 0) {
        showSlides();
    }
    // REMOVED: Setup floating cart button listener
}

// Category Page Functions
async function loadCategoryPage() {
    setupSidebar();
    updateCartCount();

    const urlParams = new URLSearchParams(window.location.search);
    const categoryName = urlParams.get('cat');
    const categorySheetId = urlParams.get('id');

    const categoryHeader = document.getElementById('category-name-header');
    const productsContainer = document.getElementById('products-container');
    
    if (!categoryName || !categorySheetId) {
        productsContainer.innerHTML = "<p>No category selected, my bad.</p>";
        return;
    }

    categoryHeader.textContent = categoryName;
    document.getElementById('category-page-title').textContent = categoryName;
    
    const productsData = await fetchSheetData(categorySheetId);
    
    if (!productsData) {
        productsContainer.innerHTML = "<p>No products found in this category, fam.</p>";
        return;
    }

    // Skip header row
    const products = productsData.slice(1);
    
    products.forEach(row => {
        const itemName = row[0];
        const brandName = row[1];
        const weight = row[2];
        const imageLink = row[5];
        const productId = row[6];
        const tags = row[7];
        
        // --- NEW STOCK CHECK ---
        const mainPriceStr = row[3];
        const discountedPriceStr = row[4];
        // Product is out of stock if both price fields are empty
        let isStockedOut = (!mainPriceStr || mainPriceStr.trim() === '') && (!discountedPriceStr || discountedPriceStr.trim() === '');
        
        let mainPrice = 0;
        let discountedPrice = 0;
        let finalPrice = 0;
        let priceHtml = '';
        let buttonHtml = '';
        let discountBadge = '';
        let discountPercent = 0;

        if (isStockedOut) {
            priceHtml = `<p class="price">Out of Stock</p>`;
            buttonHtml = `<button class="add-to-cart-btn out-of-stock-btn" disabled>Out of Stock</button>`;
        } else {
            mainPrice = parseFloat(mainPriceStr) || 0;
            discountedPrice = parseFloat(discountedPriceStr) || 0;
            finalPrice = (discountedPrice > 0 && discountedPrice < mainPrice) ? discountedPrice : mainPrice;

            // Calculate Discount Percentage
            discountPercent = calculateDiscountPercentage(mainPrice, finalPrice);
            if (discountPercent > 0) {
                discountBadge = `<div class="discount-badge discount-badge-right">${discountPercent}% DISCOUNT</div>`;
            }

            if (discountedPrice > 0 && discountedPrice < mainPrice) {
                priceHtml = `<p class="price discounted"><span class="main-price-strikethrough">${formatPrice(mainPrice)}</span>${formatPrice(discountedPrice)}</p>`;
            } else {
                priceHtml = `<p class="price">${formatPrice(mainPrice)}</p>`;
            }
            
            buttonHtml = `<button class="add-to-cart-btn" data-id="${productId}" data-name="${itemName}" data-price="${finalPrice}" data-image="${imageLink}">Add to Cart</button>`;
        }
        // --- END STOCK CHECK ---

        const productCard = document.createElement('div');
        productCard.classList.add('product-card');
        
        productCard.innerHTML = `
            ${discountBadge}
            <img src="${imageLink}" alt="${itemName}" onerror="this.onerror=null; this.src='https://placehold.co/150x150/8C7047/ffffff?text=Image+Not+Found'">
            <h3>${itemName}</h3>
            ${priceHtml}
            ${buttonHtml}
        `;
        productsContainer.appendChild(productCard);

        // Add event listener for item popup
        productCard.addEventListener('click', (e) => {
            if (!e.target.classList.contains('add-to-cart-btn')) {
                showItemModal({
                    id: productId,
                    name: itemName,
                    brand: brandName,
                    weight: weight,
                    mainPrice: mainPrice,
                    discountedPrice: discountedPrice,
                    image: imageLink,
                    tags: tags,
                    discountPercent: discountPercent,
                    isStockedOut: isStockedOut // Pass the stock status to the modal
                });
            }
        });
    });

    // Cart functionality is now handled by the global event listener in window.onload
}

function showItemModal(item) {
    const modal = document.getElementById('item-modal');
    const modalInner = document.getElementById('modal-content-inner');
    
    let priceHtml = '';
    let finalPrice = 0; // Need this for the button data-price

    if (item.isStockedOut) {
        priceHtml = `<p class="price">Out of Stock</p>`;
    } else {
        const originalPrice = item.mainPrice;
        finalPrice = (item.discountedPrice > 0 && item.discountedPrice < item.mainPrice) ? item.discountedPrice : item.mainPrice;
        const discountPercent = item.discountPercent || calculateDiscountPercentage(originalPrice, finalPrice);

        if (item.discountedPrice > 0 && item.discountedPrice < item.mainPrice) {
            const priceFormatted = formatPrice(item.discountedPrice);
            const strikethroughPrice = `<span class="main-price-strikethrough">${formatPrice(item.mainPrice)}</span>`;
            
            priceHtml = `
                <div class="price-and-savings">
                    <p class="price discounted">${strikethroughPrice}${priceFormatted}</p>
                    <p class="discount-percent-popup flash-save">You will save: <strong>${discountPercent}%!!</strong></p>
                </div>
            `;
        } else {
            priceHtml = `<p class="price">${formatPrice(item.mainPrice)}</p>`;
        }
    }

    modalInner.innerHTML = `
        <div class="item-modal-content">
            <img src="${item.image}" alt="${item.name}">
            <h3>${item.name}</h3>
            <p><strong>Brand:</strong> ${item.brand}</p>
            <p><strong>Weight:</strong> ${item.weight}</p>
            ${priceHtml}
            <p><strong>Product ID:</strong> ${item.id}</p>
            <p><strong>Tags:</strong> ${item.tags}</p>
            
            <div class="item-actions-container">
                <div class="quantity-control" id="modal-quantity-control">
                    <button id="qty-minus" aria-label="Decrease quantity">-</button>
                    <span id="qty-display">1</span>
                    <button id="qty-plus" aria-label="Increase quantity">+</button>
                </div>
                <button class="add-to-cart-btn" id="modal-add-to-cart-btn" 
                        data-id="${item.id}" 
                        data-name="${item.name}" 
                        data-price="${finalPrice}" 
                        data-image="${item.image}">
                    Add to Cart
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'block';

    // --- MODAL QUANTITY LOGIC ---
    let quantity = 1;
    const qtyDisplay = document.getElementById('qty-display');
    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');
    const addToCartBtn = document.getElementById('modal-add-to-cart-btn');

    // --- NEW STOCKED OUT LOGIC ---
    if (item.isStockedOut) {
        qtyMinus.disabled = true;
        qtyPlus.disabled = true;
        addToCartBtn.textContent = 'Out of Stock';
        addToCartBtn.classList.add('out-of-stock-btn');
        addToCartBtn.disabled = true;
    } else {
        // --- EXISTING IN-STOCK LOGIC ---
        const updateQuantityDisplay = () => {
            qtyDisplay.textContent = quantity;
        };

        qtyMinus.onclick = () => {
            if (quantity > 1) {
                quantity--;
                updateQuantityDisplay();
            }
        };

        qtyPlus.onclick = () => {
            quantity++;
            updateQuantityDisplay();
        };

        addToCartBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();

            const itemData = {
                id: this.dataset.id,
                name: this.dataset.name,
                price: parseFloat(this.dataset.price),
                image: this.dataset.image
            };

            // Call addToCart with the selected quantity
            addToCart(itemData, quantity);
            
            // Reset quantity for next open
            quantity = 1;

            // Close modal
            modal.style.display = 'none';
            return false;
        };
    }
    // --- END STOCKED OUT LOGIC ---

    // Close button functionality
    const closeButton = modal.querySelector('.close-button');
    closeButton.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Cart Page Functions
function loadCartPage() {
    setupSidebar();
    updateCartCount();

    const cart = getCart();
    let cartItemsContainer = document.getElementById('cart-items-container');
    const totalPriceContainer = document.getElementById('total-price-container');
    let totalPrice = 0;

    cartItemsContainer.innerHTML = '';
    if (Object.keys(cart).length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty, go get some items!</p>
                <a href="index.html" class="primary-btn">Start Shopping</a>
            </div>
        `;
    } else {
        for (const itemId in cart) {
            const item = cart[itemId];
            const itemTotal = item.price * item.quantity;
            totalPrice += itemTotal;

            const itemCard = document.createElement('div');
            itemCard.classList.add('cart-item-card');
            
            // UPDATED: Use formatPrice utility in the cart item info
            itemCard.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <p>Price: ${formatPrice(item.price)} x ${item.quantity}</p>
                        <p>Total: ${formatPrice(itemTotal)}</p>
                    </div>
                    <div class="cart-item-actions">
                        <button class="quantity-btn decrease" data-id="${itemId}" data-name="${item.name}">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn increase" data-id="${itemId}" data-name="${item.name}">+</button>
                        <button class="delete-btn" data-id="${itemId}" data-name="${item.name}" data-quantity="${item.quantity}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            cartItemsContainer.appendChild(itemCard);
        }

        // Remove existing event listener to prevent multiple handlers
        const oldCartContainer = cartItemsContainer.cloneNode(true);
        cartItemsContainer.parentNode.replaceChild(oldCartContainer, cartItemsContainer);
        cartItemsContainer = oldCartContainer;
        
        // Add event listener for cart actions
        cartItemsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const itemId = btn.dataset.id;
            const itemName = btn.dataset.name;
            const cart = getCart();
            let newQuantity;
            let actionType = '';
            
            if (btn.classList.contains('increase')) {
                actionType = 'increase';
                newQuantity = parseInt(cart[itemId].quantity) + 1;
                cart[itemId].quantity = newQuantity;
            } else if (btn.classList.contains('decrease')) {
                actionType = 'decrease';
                if (cart[itemId].quantity > 1) {
                    newQuantity = parseInt(cart[itemId].quantity) - 1;
                    cart[itemId].quantity = newQuantity;
                } else {
                    // Item cannot be decreased below 1, so no action/toast
                    return;
                }
            } else if (btn.classList.contains('delete-btn')) {
                actionType = 'delete';
                const quantityToDelete = cart[itemId].quantity;
                delete cart[itemId];
                
                // NEW: Show toast for full removal
                showToast(itemName, quantityToDelete, true);
                saveCart(cart); // Save immediately after deletion
                loadCartPage(); // Reload the cart page to reflect changes
                return; // Exit as cart is reloaded
            }
            
            saveCart(cart);
            loadCartPage(); // Reload the cart page to reflect changes

            // Show toast for single item addition/removal on the cart page
            if (actionType === 'increase') {
                showToast(itemName, 1, false);
            } else if (actionType === 'decrease') {
                showToast(itemName, 1, true);
            }
        });
    }

    // Create total price text element
    const totalPriceText = document.createElement('div');
    totalPriceText.className = 'total-price-text';
    // UPDATED: Use formatPrice utility for total price
    totalPriceText.textContent = `Total: ${formatPrice(totalPrice)}`;
    
    // Clear and add elements in the right order
    totalPriceContainer.innerHTML = '';
    
    // Only add Continue Shopping button when cart is empty
    if (Object.keys(cart).length === 0) {
        // Skip adding Continue Shopping button here if cart is empty, as it's handled by the empty-state
    } else {
        const shopButton = document.createElement('a');
        shopButton.href = 'index.html';
        shopButton.className = 'primary-btn';
        shopButton.textContent = 'Continue Shopping';
        totalPriceContainer.appendChild(shopButton);
    }
    
    totalPriceContainer.appendChild(totalPriceText);

    const orderForm = document.getElementById('order-form');
    // Hide form and history button if cart is empty
    const historyBtn = document.getElementById('view-history-btn');
    if (Object.keys(cart).length === 0) {
        if (orderForm) orderForm.style.display = 'none';
        if (historyBtn) historyBtn.style.display = 'none';
    } else {
        if (orderForm) orderForm.style.display = 'flex';
        if (historyBtn) historyBtn.style.display = 'block';
    }


    if (orderForm) {
        // Add event listener for phone validation checks as user types
        const phoneInput = document.getElementById('customer-phone');
        phoneInput.addEventListener('input', validatePhoneNumber);
        
        orderForm.addEventListener('submit', handleOrderSubmit);
    }
}

/**
 * NEW FUNCTION: Cleans and validates the phone number for the Bangladesh format.
 * Fixes the issue where +880 and other symbols were being incorrectly stripped.
 * @returns {string | null} The clean 11-digit number (e.g., '01773185817') or null if invalid.
 */
function cleanAndValidatePhone(rawNumber) {
    const raw = rawNumber.trim();
    // 1. Strip all non-digit characters and plus signs
    let cleaned = raw.replace(/[^\d+]/g, '');
    
    // 2. Check for common country codes and strip them to get the local 11 digits
    if (cleaned.startsWith('+880')) {
        // If it starts with +880, remove it. Result should be 10 digits (e.g., 1773185817).
        cleaned = cleaned.substring(4); 
    } else if (cleaned.startsWith('880')) {
        // If it starts with 880 (without plus), remove it. Result should be 10 digits.
        cleaned = cleaned.substring(3);
    }
    
    // 3. Final Validation: Must be exactly 11 digits (e.g., 01773185817)
    // If the cleaned number has 10 digits, we assume the leading '0' was omitted (common with country code entry)
    if (cleaned.length === 10 && cleaned.startsWith('1')) {
        // Add the mandatory leading '0' for the standard 11-digit Bangladesh format (01xxxxxxxxx)
        cleaned = '0' + cleaned;
    }

    // Final check for 11 digits starting with '01'
    if (cleaned.length === 11 && cleaned.startsWith('01')) {
        return cleaned; // Return the valid 11-digit number
    }

    return null; // Invalid
}

/**
 * NEW FUNCTION: Handles visual feedback for phone number validation.
 * Triggers the red glow and custom error message.
 * @returns {boolean} True if the number is valid, False otherwise.
 */
function validatePhoneNumber() {
    const phoneInput = document.getElementById('customer-phone');
    const phoneMsg = document.getElementById('phone-validation-msg');
    const validNumber = cleanAndValidatePhone(phoneInput.value);
    
    const isValid = validNumber !== null;

    if (isValid) {
        // Valid: Remove error styles and hide message
        phoneInput.classList.remove('phone-error');
        phoneMsg.classList.remove('show');
    } else {
        // Invalid: Add error styles and show message (only if user has typed something)
        phoneInput.classList.add('phone-error');
        if (phoneInput.value.length > 0) {
            phoneMsg.classList.add('show');
        } else {
            phoneMsg.classList.remove('show');
        }
    }
    return isValid;
}


// --- NEW DELIMITER FOR BOT DATA EXTRACTION ---
const RAW_DATA_DELIMITER = "---ORDER_DATA_JSON---";

async function handleOrderSubmit(e) {
    e.preventDefault();
    const cart = getCart();
    const customerName = document.getElementById('customer-name').value;
    const customerPhoneInput = document.getElementById('customer-phone');
    const customerAddress = document.getElementById('customer-address').value;
    
    if (Object.keys(cart).length === 0) {
        showMessage("Your cart is empty, add some items to order!");
        return;
    }
    
    // --- CRITICAL PHONE VALIDATION GATE ---
    const cleanedCustomerPhone = cleanAndValidatePhone(customerPhoneInput.value);
    if (!cleanedCustomerPhone) {
        // Validation failed (red glow and message already active via validatePhoneNumber event listener)
        customerPhoneInput.focus(); // Focus on the input to highlight the error
        document.getElementById('phone-validation-msg').classList.add('show');
        return; 
    }
    
    if (!customerName) {
        showMessage("Please fill in your name to complete the order.");
        return;
    }
    
    // --- NEW ORDER ID AND DATE GENERATION ---
    const orderId = generateOrderId();
    const orderDateObj = new Date();
    const formattedDate = formatOrderDate(orderDateObj);
    // ---------------------------------------

    const itemsTotal = Object.values(cart).reduce((total, item) => total + (item.price * item.quantity), 0);
    
    const orderDetails = {
        orderId: orderId, 
        formattedDate: formattedDate, 
        customerName,
        // Send the fully cleaned 11-digit number to storage/printer
        customerPhone: cleanedCustomerPhone, 
        customerAddress,
        items: Object.values(cart),
        totalPrice: itemsTotal, // This is the items subtotal (before delivery fee)
        orderDate: orderDateObj.toISOString() 
    };

    // New machine-readable data payload for the bot (includes new ID/Date)
    const rawOrderData = {
        orderId: orderId, 
        formattedDate: formattedDate, 
        customer: {
            name: customerName,
            // Send the fully cleaned 11-digit number to the printer
            phone: cleanedCustomerPhone, 
            address: customerAddress || null
        },
        items: Object.values(cart).map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price
        })),
        totalPrice: itemsTotal // This is the items subtotal
    };

    // --- CRITICAL CHANGE: Embed the raw JSON string in the content field ---
    const rawDataJsonString = JSON.stringify(rawOrderData);

    const webhookData = {
        // Content contains the machine-readable JSON string which the bot will extract
        "content": `${RAW_DATA_DELIMITER}${rawDataJsonString}`,
        "embeds": [{
            "title": "Order Receipt",
            "color": 6737517, // Brown in decimal
            "fields": [
                // --- NEW FIELD FOR ORDER ID AND DATE (COPYABLE) ---
                {
                    "name": "Order Info",
                    // Use inline code for copyable Order ID
                    "value": `Order Number - \`${orderId}\`\nOrder Date - ${formattedDate}`, 
                    "inline": false
                },
                // --------------------------------------------------
                {
                    "name": "Customer Info",
                    "value": `Name: ${orderDetails.customerName}\nPhone: ${orderDetails.customerPhone}\nAddress: ${orderDetails.customerAddress || 'N/A'}`,
                    "inline": false
                },
                {
                    "name": "Items",
                    "value": orderDetails.items.map(item => `- ${item.name} x${item.quantity} (${formatPrice(item.price)})`).join('\n'),
                    "inline": false
                },
                {
                    "name": "Items Subtotal",
                    "value": formatPrice(itemsTotal),
                    "inline": false
                }
            ],
            "footer": {
                "text": "Order received from Nitto Sodai"
            },
            "timestamp": new Date().toISOString()
        }],
    };
    
    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData),
        });
        
        if (response.ok) {
            // --- NEW: SAVE TO ORDER HISTORY (includes ID/Date) ---
            const pastOrders = getPastOrders();
            pastOrders.push(orderDetails); // Add the full order details
            savePastOrders(pastOrders);
            // --- END NEW LOGIC ---

            showMessage("Order placed successfully! Thank you!", true);
            localStorage.removeItem('cart');
            loadCartPage();
        } else {
            throw new Error(`Discord Webhook failed with status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error sending webhook:', error);
        showMessage("Error placing order. Please try again.");
    }
}

// Global variable to store all products from all categories
let allProducts = [];

// REMOVED: const CACHED_PRODUCT_VERSION = Date.now(); 

// Function to store the categories and products data to local storage
function saveProductsToCache(data) {
    const cacheData = {
        data: data,
        timestamp: Date.now() // Store the time it was saved
    };
    try {
        // Store the product list and the new timestamp
        localStorage.setItem('cachedProducts', JSON.stringify(cacheData));
    } catch (e) {
        console.warn("Could not save products to local storage. Searching will only work once per session.");
    }
}

// Function to load the cached product data, checking for 20-minute expiration
function loadProductsFromCache() {
    const CACHE_DURATION_MS = 20 * 60 * 1000; // 20 minutes in milliseconds
    try {
        const cached = localStorage.getItem('cachedProducts');
        if (cached) {
            const cacheObj = JSON.parse(cached);
            
            // 1. Check if both data and timestamp exist
            if (cacheObj.data && cacheObj.timestamp) {
                const age = Date.now() - cacheObj.timestamp;
                
                // 2. Check for cache expiration
                if (age < CACHE_DURATION_MS) {
                    console.log(`Loading products from cache. Cache age: ${Math.round(age / 1000)}s`);
                    return cacheObj.data; // Cache is fresh!
                } else {
                    console.log(`Cache expired (${Math.round(age / 60000)} minutes old). Forcing API fetch.`);
                    // Optionally clear old cache, but just returning null is enough to trigger a fetch
                    localStorage.removeItem('cachedProducts');
                }
            }
        }
    } catch (e) {
        console.error("Error loading products from cache:", e);
        localStorage.removeItem('cachedProducts'); // Clear corrupt cache
    }
    return null; // Force API fetch
}

/**
 * NEW FUNCTION: Shows the loading overlay with a spinner.
 */
function showLoader() {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;
    
    // Clear old content
    productsContainer.innerHTML = ''; 

    // Create and append loader HTML (use the same container for simplicity)
    const loaderHtml = `
        <div class="loader-overlay" id="search-loader">
            <i class="fas fa-sync-alt loader-spinner"></i>
            <p class="loader-text">আপনার প্রোডাক্ট খোঁজা হচ্ছে.....</p>
        </div>
    `;
    
    // We append directly to the product container which is centered and handles the layout
    productsContainer.innerHTML = loaderHtml;
}

/**
 * NEW FUNCTION: Hides the loading overlay.
 */
function hideLoader() {
    const loader = document.getElementById('search-loader');
    if (loader) {
        // Find the parent container and remove the loader element
        loader.remove(); 
    }
}

/**
 * UPDATED FUNCTION: Shows a custom 'No Results' message with action buttons.
 * Removed English text and 'Search Again' button.
 * @param {string} query - The search query entered by the user.
 */
function showNoResults(query) {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;
    
    // Clear old content
    productsContainer.innerHTML = '';
    
    const whatsappNumber = "8801300226699"; // Existing contact number from side-menu/about.html
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hi, I couldn't find '${query}' on the website. Could you please help me?`)}`;

    // --- UPDATED HTML STRUCTURE ---
    const noResultsHtml = `
        <div class="no-results-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>দুঃখিত! এই নামে কিছু খুঁজে পাইনি।</h3>
            <p>আপনার আইটেম খুঁজে পাচ্ছেন না? আমাদের মেসেজ করুন!</p>

            <div class="no-results-actions">
                <a href="${whatsappLink}" target="_blank" class="whatsapp-btn">
                    <i class="fab fa-whatsapp"></i> WhatsApp-এ মেসেজ করুন
                </a>
            </div>
        </div>
    `;
    
    productsContainer.innerHTML = noResultsHtml;

    // NOTE: Removed 'Search Again' button logic as requested.
}


// Function to search products across all categories (UPDATED with Loader)
async function searchProducts(query) {
    // 1. SHOW LOADER
    showLoader(); 

    // 1. Try to load products from cache, which now includes the 20-minute time check.
    let cachedData = loadProductsFromCache();

    if (cachedData) {
        // Cache is fresh (under 20 mins), use it.
        allProducts = cachedData;
    }

    // 2. If allProducts is empty (meaning cache was null/expired/missing), perform the full fetch
    if (allProducts.length === 0) {
        
        // First, fetch all categories
        const categoriesData = await fetchSheetData(HOMEPAGE_SPREADSHEET_ID, CATEGORY_SHEET_NAME);
        if (!categoriesData) {
             // 2. HIDE LOADER on error
            hideLoader(); 
            return [];
        }
        
        // Skip header row
        const categories = categoriesData.slice(1);
        
        // Temporary array to hold fresh products before caching
        const freshProducts = [];

        // Fetch products from each category
        for (const row of categories) {
            const categoryName = row[0];
            const categorySheetId = row[1];
            if (categoryName && categorySheetId) {
                // IMPORTANT: We need to force a fresh fetch to get the latest price/name 
                // data for the full search capability.
                const productsData = await fetchSheetData(categorySheetId); 
                
                if (productsData) {
                    // Skip header row
                    const products = productsData.slice(1);
                    products.forEach(row => {
                        // --- STOCK CHECK ---
                        const mainPriceStr = row[3];
                        const discountedPriceStr = row[4];
                        const isStockedOut = (!mainPriceStr || mainPriceStr.trim() === '') && (!discountedPriceStr || discountedPriceStr.trim() === '');
                        
                        freshProducts.push({
                            name: row[0],
                            brand: row[1],
                            weight: row[2],
                            mainPrice: parseFloat(mainPriceStr) || 0,
                            discountedPrice: parseFloat(discountedPriceStr) || 0,
                            image: row[5],
                            id: row[6],
                            tags: row[7], // <-- Tags are here
                            category: categoryName,
                            isStockedOut: isStockedOut 
                        });
                    });
                }
            }
        }
        
        // 3. Update the global array and save the fresh data to cache
        allProducts = freshProducts;
        saveProductsToCache(freshProducts);
    }
    
    // 4. Filter products based on search query
    query = query.toLowerCase().trim();
    
    // Split the query into individual terms for more accurate searching
    const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
    
    const filteredResults = allProducts.filter(product => {
        // Check if product exists and has required properties
        if (!product) return false;
        
        const productName = product.name ? product.name.toLowerCase() : '';
        const productBrand = product.brand ? product.brand.toLowerCase() : '';
        const productTags = product.tags ? product.tags.toLowerCase() : '';
        
        // If no search terms, return false
        if (searchTerms.length === 0) return false;
        
        // --- NEW: Optimized Tag/Name/Brand Search Logic ---
        // Check if ALL search terms are found in at least one of the fields.
        
        return searchTerms.every(term => 
            productName.includes(term) || 
            productBrand.includes(term) || 
            productTags.includes(term)
        );
        // NOTE on Tags: The `productTags.includes(term)` check handles partial matches within a tag (e.g.,
        // searching "thir" finds "thir chini"), which covers your requirement!
    });
    
    // 5. HIDE LOADER before returning results
    hideLoader();

    return filteredResults;
}

// Function to display search results (UPDATED to handle NO RESULTS)
function displaySearchResults(results, searchQuery) { // Added searchQuery parameter
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;
    
    productsContainer.innerHTML = '';
    
    if (results.length === 0) {
        // *** NEW: Call custom no results handler ***
        showNoResults(searchQuery); 
        return;
    }
    
    results.forEach(item => {
        const productCard = document.createElement('div');
        productCard.classList.add('product-card');

        // --- STOCK CHECK ---
        let finalPrice = 0;
        let priceHtml = '';
        let buttonHtml = '';
        let discountBadge = '';
        let discountPercent = 0;

        if (item.isStockedOut) {
            priceHtml = `<p class="price">Out of Stock</p>`;
            buttonHtml = `<button class="add-to-cart-btn out-of-stock-btn" disabled>Out of Stock</button>`;
        } else {
            finalPrice = (item.discountedPrice > 0 && item.discountedPrice < item.mainPrice) ? item.discountedPrice : item.mainPrice;
            
            discountPercent = calculateDiscountPercentage(item.mainPrice, finalPrice);
            if (discountPercent > 0) {
                discountBadge = `<div class="discount-badge discount-badge-right">${discountPercent}% DISCOUNT</div>`;
            }

            if (item.discountedPrice > 0 && item.discountedPrice < item.mainPrice) {
                priceHtml = `<p class="price discounted"><span class="main-price-strikethrough">${formatPrice(item.mainPrice)}</span>${formatPrice(item.discountedPrice)}</p>`;
            } else {
                priceHtml = `<p class="price">${formatPrice(item.mainPrice)}</p>`;
            }
            
            buttonHtml = `<button class="add-to-cart-btn" data-id="${item.id}" data-name="${item.name}" data-price="${finalPrice}" data-image="${item.image}">Add to Cart</button>`;
        }
        // --- END STOCK CHECK ---
        
        productCard.innerHTML = `
            ${discountBadge}
            <img src="${item.image}" alt="${item.name}" onerror="this.onerror=null; this.src='https://placehold.co/150x150/8C7047/ffffff?text=Image+Not+Found'">
            <h3>${item.name}</h3>
            <p class="category-tag">${item.category}</p>
            ${priceHtml}
            ${buttonHtml}
        `;
        productsContainer.appendChild(productCard);

        // Add event listener for item popup
        productCard.addEventListener('click', (e) => {
            if (!e.target.classList.contains('add-to-cart-btn')) {
                showItemModal({
                    ...item,
                    discountPercent: discountPercent // Pass discount percent to modal
                    // isStockedOut is already part of the 'item' object
                });
            }
        });
    });
}

// Setup search functionality (UPDATED with loader integration)
function setupSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchContainer = document.getElementById('search-container');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    
    if (!searchBtn || !searchContainer || !searchForm) return;
    
    // Toggle search bar when search button is clicked
    searchBtn.addEventListener('click', () => {
        // If the search container is currently hidden and we click search
        if (!searchContainer.classList.contains('open')) {
             // Wait for animation to complete before focusing
             setTimeout(() => {
                searchInput.focus();
             }, 300);
        }
        searchContainer.classList.toggle('open');
    });
    
    // Close search bar when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#search-container') && !e.target.closest('#search-btn') && searchContainer.classList.contains('open')) {
            searchContainer.classList.remove('open');
        }
    });
    
    // Handle search form submission (UPDATED)
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const searchQuery = searchInput.value.trim();
        if (!searchQuery) return;
        
        // Close the search container immediately
        searchContainer.classList.remove('open');
        
        // If we're not on the category page, navigate to it with the query
        if (!window.location.pathname.includes('category.html')) {
            window.location.href = `category.html?search=${encodeURIComponent(searchQuery)}`;
            return;
        }
        
        // --- NEW: Handle search on the category page asynchronously ---
        
        // 1. Update page title and header
        document.getElementById('category-page-title').textContent = `Search: ${searchQuery}`;
        document.getElementById('category-name-header').textContent = `Search Results: ${searchQuery}`;
        
        // 2. Perform search and display results (showLoader/hideLoader handled inside searchProducts)
        const results = await searchProducts(searchQuery);
        
        // 3. Display results (pass query for the no-results handler)
        displaySearchResults(results, searchQuery);
    });
}

// ** NEW: Function to load the Order History page **
function loadOrderHistoryPage() {
    setupSidebar();
    updateCartCount();

    const container = document.getElementById('order-history-container');
    if (!container) {
        console.error('Order history container not found');
        return;
    }

    const orders = getPastOrders();
    
    // Display newest orders first
    orders.reverse(); 

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>You have no past orders.</p>
                <a href="index.html" class="primary-btn">Start Shopping</a>
            </div>
        `;
        return;
    }

    container.innerHTML = ''; // Clear container
    orders.forEach(order => {
        // Use the custom formatted date if available, otherwise fall back
        const orderDateDisplay = order.formattedDate || new Date(order.orderDate).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const itemsHtml = order.items.map(item => `
            <li>
                <span class="item-name">${item.name}</span>
                <span class="item-details">(x${item.quantity}) - ${formatPrice(item.price * item.quantity)}</span>
            </li>
        `).join('');

        // Use the new orderId
        const orderIdDisplay = order.orderId ? ` (#${order.orderId})` : '';

        const orderCard = document.createElement('div'); // Define orderCard here
        orderCard.classList.add('order-card');

        orderCard.innerHTML = `
            <div class="order-card-header">
                <h4>Order from: ${orderDateDisplay} ${orderIdDisplay}</h4>
                <span class="price">Total: ${formatPrice(order.totalPrice)}</span>
            </div>
            <div class="order-card-body">
                <h5>Items (${order.items.length})</h5>
                <ul class="order-item-list">
                    ${itemsHtml}
                </ul>
            </div>
        `;
        container.appendChild(orderCard);
    });
}


// Route the script based on the current page
window.onload = () => {
    // Initialize cart from localStorage
    updateCartCount();
    
    // Determine which page we're on
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    
    // Setup new bottom navigation bar
    setupBottomNav();

    // Setup search functionality
    setupSearch();
    
    // Setup sidebar and menu toggle - ensure it's called on every page
    setupSidebar();

    // Setup global event listener for all Add to Cart buttons (This handles cards, not the modal)
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('add-to-cart-btn') && e.target.id !== 'modal-add-to-cart-btn') {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target;
            const item = {
                id: btn.dataset.id,
                name: btn.dataset.name,
                price: parseFloat(btn.dataset.price),
                image: btn.dataset.image
            };
            // Default quantity is 1 when clicking the button on the product card directly
            addToCart(item, 1); 
            return false;
        }
    }, true);

    // Load appropriate page content
    if (filename.includes('category.html')) {
        // Check if we have a search query in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');
        
        if (searchQuery) {
            // Update page title and header
            document.getElementById('category-page-title').textContent = `Search: ${searchQuery}`;
            document.getElementById('category-name-header').textContent = `Search Results: ${searchQuery}`;
            
            // Perform search and display results (showLoader/hideLoader handled inside searchProducts)
            searchProducts(searchQuery).then(results => {
                // Display results (pass query for the no-results handler)
                displaySearchResults(results, searchQuery); 
            });
        } else {
            loadCategoryPage();
        }
    } else if (filename.includes('cart.html')) {
        loadCartPage();
    } else if (filename.includes('about.html')) {
        // No specific JS needed for about.html yet, but setupSidebar and updateCartCount ran
        // The content is static for now.
    } else if (filename.includes('oh.html')) { // UPDATED: Added router case
        loadOrderHistoryPage();
    } else {
        loadHomepage();
    }
};
