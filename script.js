/* ============================================================
   תבליני דור זוארץ – מחירון + סל קניות + איסוף/משלוח + WhatsApp
   ============================================================ */

const STORE = {
  name: "תבליני דור זוארץ",
  address: "היהלום 5, שוק נתניה",
  phone: "053-6000549",
  whatsappPhone: "972536000549",  // E.164 ללא + או -
  minDelivery: 150,                // ₪ מינימום למשלוח
};

const DATA_URL = "data/products.json";
const CART_KEY = "dor-zoaretz-cart-v1";

const STATE = {
  data: null,
  cart: [],
  checkout: { method: null },
  activeCategory: null,    // הקטגוריה המוצגת כרגע
  searchActive: false,     // האם החיפוש פעיל ומציג מכל הקטגוריות
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  STATE.data = await loadData();
  STATE.cart = Cart.load();
  renderCatalog(STATE.data);
  renderCatNav(STATE.data);
  wireSearch();
  wireCart();

  // קביעת קטגוריה התחלתית: hash אם קיים ותקין, אחרת הראשונה
  const fromHash = readCategoryFromHash(STATE.data.categoryOrder);
  setActiveCategory(fromHash || STATE.data.categoryOrder[0], { silent: true });

  window.addEventListener("hashchange", () => {
    const cat = readCategoryFromHash(STATE.data.categoryOrder);
    if (cat && cat !== STATE.activeCategory) setActiveCategory(cat, { silent: true });
  });

  Cart.renderUI();
}

function readCategoryFromHash(order) {
  const raw = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  return order.includes(raw) ? raw : null;
}

// ============================================================
// Data loading
// ============================================================
async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (_) { /* fall through */ }
  if (window.__PRODUCTS_DATA__) return window.__PRODUCTS_DATA__;

  document.getElementById("catalog").innerHTML = `
    <div class="category">
      <div class="category-header">
        <h2 class="category-title">לא ניתן לטעון את המוצרים</h2>
      </div>
      <p>פתחו את הדף דרך שרת מקומי או ודאו שקיים <code>data/products.json</code> או <code>data-inline.js</code>.</p>
    </div>`;
  throw new Error("products.json not loadable");
}

// ============================================================
// Catalog rendering
// ============================================================
function renderCatNav(data) {
  const list = document.getElementById("cat-nav-list");
  list.innerHTML = "";
  for (const cat of data.categoryOrder) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-btn";
    btn.dataset.catBtn = cat;
    btn.setAttribute("aria-current", "false");
    btn.setAttribute("aria-label", `קטגוריה: ${cat}`);
    btn.textContent = cat;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      // ניקוי חיפוש בעת מעבר קטגוריה
      const input = document.getElementById("search-input");
      if (input && input.value) {
        input.value = "";
        STATE.searchActive = false;
      }
      setActiveCategory(cat);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function setActiveCategory(cat, { silent = false } = {}) {
  STATE.activeCategory = cat;

  // עדכון hash בלי קפיצת גלילה
  const newHash = "#" + encodeURIComponent(cat);
  if (location.hash !== newHash) {
    history.replaceState(null, "", newHash);
  }

  // הצגת הקטגוריה הפעילה בלבד
  document.querySelectorAll(".category").forEach((s) => {
    s.hidden = s.dataset.category !== cat;
    // ניקוי הסתרות חיפוש
    s.querySelectorAll(".product-card").forEach((c) => (c.hidden = false));
  });

  // הדגשת הכפתור הנבחר + scroll לתחילת הקטלוג
  document.querySelectorAll("[data-cat-btn]").forEach((b) => {
    const isActive = b.dataset.catBtn === cat;
    b.classList.toggle("is-active", isActive);
    b.setAttribute("aria-current", isActive ? "page" : "false");
    if (isActive && !silent) {
      // גלילה אופקית של הניווט שתביא את הכפתור הפעיל למרכז
      b.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  });

  // הסתרת הודעת "אין תוצאות"
  const noRes = document.getElementById("no-results");
  if (noRes) noRes.hidden = true;

  // עדכון תגי כמות לקטגוריות (כשהחיפוש לא פעיל)
  document.querySelectorAll(".category").forEach((s) => {
    const total = s.querySelectorAll(".product-card").length;
    const badge = s.querySelector(".category-count");
    if (badge) badge.textContent = String(total);
  });

  if (!silent) {
    // גלילה רכה לתחילת הקטלוג, לא חוטף את ה-sticky bar
    const top = document.querySelector(".sticky-nav")?.getBoundingClientRect().bottom || 0;
    const cat = document.getElementById("catalog");
    if (cat) {
      const target = cat.getBoundingClientRect().top + window.scrollY - top - 8;
      window.scrollTo({ top: target, behavior: "smooth" });
    }
  }
}

function renderCatalog(data) {
  const root = document.getElementById("catalog");
  root.innerHTML = "";

  const byCat = new Map();
  for (const cat of data.categoryOrder) byCat.set(cat, []);
  for (const p of data.products) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }
  for (const cat of data.categoryOrder) {
    const items = byCat.get(cat) || [];
    if (!items.length) continue;
    root.appendChild(buildCategorySection(cat, items));
  }
}

function buildCategorySection(cat, items) {
  const section = document.createElement("section");
  section.className = "category";
  section.id = catId(cat);
  section.dataset.category = cat;

  const header = document.createElement("div");
  header.className = "category-header";
  header.innerHTML = `
    <h2 class="category-title">${escapeHtml(cat)}</h2>
    <span class="category-count">${items.length}</span>
  `;
  section.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "product-grid";
  for (const p of items) grid.appendChild(buildProductCard(p));
  section.appendChild(grid);
  return section;
}

// ---------------- Product cards ----------------
function buildProductCard(product) {
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const isMulti  = hasVariants && product.variants.length > 1;
  const isSingle = hasVariants && product.variants.length === 1;
  const noPrice  = !hasVariants;

  const card = document.createElement("article");
  card.className = "product-card";
  card.dataset.productId = product.id;
  card.dataset.name = product.name;

  if (isSingle && !product.isPromotion) card.classList.add("product-card--compact");
  if (noPrice) card.classList.add("product-card--noprice");
  if (isMulti && product.variants.length >= 4) card.classList.add("use-select-mobile");

  if (product.isPromotion) {
    const badge = document.createElement("span");
    badge.className = "promo-badge";
    badge.textContent = "מבצע";
    card.appendChild(badge);
  }

  const title = document.createElement("h3");
  title.className = "product-name";
  title.textContent = product.name;
  card.appendChild(title);

  if (product.description) {
    const desc = document.createElement("p");
    desc.className = "product-desc";
    desc.textContent = product.description;
    card.appendChild(desc);
  }

  // A) "מחיר לפי שקילה" / promo-only — אין כפתור סל ואין WhatsApp לפריט הזה
  if (noPrice) {
    const note = document.createElement("span");
    note.className = "price-note";
    note.textContent = product.priceNote || "מחיר לפי שקילה";
    card.appendChild(note);
    return card;
  }

  // B) Compact: וריאציה אחת
  if (isSingle) {
    const v = product.variants[0];
    card.dataset.selectedVariant = v.label;
    card.dataset.selectedPrice = String(v.price);

    const meta = document.createElement("p");
    meta.className = "product-meta";
    meta.textContent = v.label;
    card.appendChild(meta);

    card.appendChild(buildPriceRow(v.price));
    card.appendChild(buildAddBtn(card));
    return card;
  }

  // C) Regular: כמה וריאציות
  const meta = document.createElement("p");
  meta.className = "product-meta";
  meta.textContent = "בחרו משקל:";
  card.appendChild(meta);

  const chips = document.createElement("div");
  chips.className = "variants";
  chips.setAttribute("role", "radiogroup");
  chips.setAttribute("aria-label", "בחירת משקל");

  const select = document.createElement("select");
  select.className = "variants-select";
  select.setAttribute("aria-label", "בחירת משקל");

  product.variants.forEach((v, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "variant-chip";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    btn.dataset.label = v.label;
    btn.dataset.variantPrice = String(v.price);
    btn.textContent = v.label;
    btn.addEventListener("click", () => selectVariant(card, v.label, v.price));
    chips.appendChild(btn);

    const opt = document.createElement("option");
    opt.value = v.label;
    opt.dataset.variantPrice = String(v.price);
    opt.textContent = `${v.label} — ${formatShekel(v.price)}`;
    if (i === 0) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const opt = select.options[select.selectedIndex];
    selectVariant(card, opt.value, Number(opt.dataset.variantPrice));
  });

  card.appendChild(chips);
  card.appendChild(select);

  const first = product.variants[0];
  card.dataset.selectedVariant = first.label;
  card.dataset.selectedPrice = String(first.price);

  card.appendChild(buildPriceRow(first.price));
  card.appendChild(buildAddBtn(card));
  return card;
}

function buildPriceRow(price) {
  const row = document.createElement("div");
  row.className = "price-row";
  row.innerHTML = `
    <span class="price-label">מחיר</span>
    <span class="price-value">${formatShekel(price)}</span>
  `;
  return row;
}

function buildAddBtn(card) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-add";
  btn.innerHTML = `<span class="btn-add-text">הוספה לסל</span>`;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    Cart.add({
      productId: card.dataset.productId,
      name: card.dataset.name,
      variantLabel: card.dataset.selectedVariant,
      price: Number(card.dataset.selectedPrice),
    });
    flashAdded(btn);
  });
  return btn;
}

function flashAdded(btn) {
  const original = btn.querySelector(".btn-add-text").textContent;
  btn.classList.add("is-added");
  btn.querySelector(".btn-add-text").textContent = "נוסף לסל ✓";
  setTimeout(() => {
    btn.classList.remove("is-added");
    btn.querySelector(".btn-add-text").textContent = original;
  }, 1100);
}

function selectVariant(card, label, price) {
  card.dataset.selectedVariant = label;
  card.dataset.selectedPrice = String(price);
  card.querySelectorAll(".variant-chip").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.label === label ? "true" : "false");
  });
  const sel = card.querySelector(".variants-select");
  if (sel && sel.value !== label) sel.value = label;
  const priceEl = card.querySelector(".price-value");
  if (priceEl) priceEl.textContent = formatShekel(price);
}

// ============================================================
// Search
// ============================================================
function wireSearch() {
  const input = document.getElementById("search-input");
  if (!input) return;
  let t = null;
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => applySearch(input.value.trim()), 90);
  });
}

function applySearch(query) {
  const noRes = document.getElementById("no-results");
  const q = normalize(query);

  // חיפוש ריק → חזרה לתצוגת קטגוריה אחת
  if (!q) {
    STATE.searchActive = false;
    document.body.classList.remove("is-searching");
    setActiveCategory(STATE.activeCategory || STATE.data.categoryOrder[0], { silent: true });
    if (noRes) noRes.hidden = true;
    return;
  }

  // חיפוש פעיל → להציג את כל הקטגוריות עם תוצאות
  STATE.searchActive = true;
  document.body.classList.add("is-searching");

  let visibleTotal = 0;
  document.querySelectorAll(".category").forEach((section) => {
    let visibleInCat = 0;
    section.querySelectorAll(".product-card").forEach((card) => {
      const name = normalize(card.dataset.name || "");
      const desc = normalize(card.querySelector(".product-desc")?.textContent || "");
      const cat  = normalize(section.dataset.category || "");
      const match = name.includes(q) || desc.includes(q) || cat.includes(q);
      card.hidden = !match;
      if (match) visibleInCat++;
    });
    section.hidden = visibleInCat === 0;
    visibleTotal += visibleInCat;
    const badge = section.querySelector(".category-count");
    if (badge) {
      const total = section.querySelectorAll(".product-card").length;
      badge.textContent = `${visibleInCat}/${total}`;
    }
  });

  if (noRes) noRes.hidden = visibleTotal !== 0;
}

// ============================================================
// Cart store
// ============================================================
const Cart = {
  load() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      // אסור לשמור פרטי לקוח – נטען רק רכיבי סל
      return Array.isArray(arr)
        ? arr.filter(i => i && i.productId && i.variantLabel).map(i => ({
            productId: i.productId,
            name: i.name,
            variantLabel: i.variantLabel,
            price: Number(i.price),
            quantity: Number(i.quantity) || 1,
          }))
        : [];
    } catch { return []; }
  },

  save() {
    try {
      // שמירת סל בלבד, ללא checkout או פרטי לקוח
      localStorage.setItem(CART_KEY, JSON.stringify(STATE.cart));
    } catch (e) { console.warn("[cart] save failed", e); }
  },

  findIndex(productId, variantLabel) {
    return STATE.cart.findIndex(i => i.productId === productId && i.variantLabel === variantLabel);
  },

  add({ productId, name, variantLabel, price }) {
    const i = Cart.findIndex(productId, variantLabel);
    if (i >= 0) STATE.cart[i].quantity += 1;
    else STATE.cart.push({ productId, name, variantLabel, price: Number(price), quantity: 1 });
    Cart.save();
    Cart.renderUI();
  },

  setQuantity(productId, variantLabel, qty) {
    const i = Cart.findIndex(productId, variantLabel);
    if (i < 0) return;
    if (qty <= 0) STATE.cart.splice(i, 1);
    else STATE.cart[i].quantity = qty;
    Cart.save();
    Cart.renderUI();
  },

  remove(productId, variantLabel) {
    const i = Cart.findIndex(productId, variantLabel);
    if (i >= 0) STATE.cart.splice(i, 1);
    Cart.save();
    Cart.renderUI();
  },

  clear() {
    STATE.cart = [];
    Cart.save();
    Cart.renderUI();
  },

  count() { return STATE.cart.reduce((s, i) => s + i.quantity, 0); },
  total() { return STATE.cart.reduce((s, i) => s + i.price * i.quantity, 0); },

  renderUI() {
    const count = Cart.count();
    const total = Cart.total();

    const badge = document.querySelector("[data-cart-count]");
    if (badge) {
      badge.textContent = String(count);
      badge.dataset.empty = count === 0 ? "1" : "0";
    }

    // Items
    const body = document.querySelector("[data-cart-body]");
    if (body) {
      if (STATE.cart.length === 0) {
        body.innerHTML = `
          <div class="cart-empty">
            <p class="cart-empty-emoji" aria-hidden="true">🛒</p>
            <p class="cart-empty-title">הסל ריק</p>
            <p class="cart-empty-sub">בחרו מוצרים מהקטלוג והם יופיעו כאן.</p>
          </div>`;
      } else {
        body.innerHTML = "";
        for (const item of STATE.cart) body.appendChild(Cart.renderItem(item));
      }
    }

    // Totals
    const totalEl = document.querySelector("[data-cart-total]");
    if (totalEl) totalEl.textContent = formatShekel(total);
    const totalCountEl = document.querySelector("[data-cart-total-count]");
    if (totalCountEl) totalCountEl.textContent = `${count} פריטים`;

    // Empty state — toggle via data attribute on drawer
    const drawer = document.getElementById("cart-drawer");
    if (drawer) drawer.dataset.empty = STATE.cart.length === 0 ? "1" : "0";

    Checkout.renderUI();
  },

  renderItem(item) {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.dataset.productId = item.productId;
    row.dataset.variantLabel = item.variantLabel;
    const subtotal = item.price * item.quantity;

    // Flat grid: info / qty / subtotal / remove (mapped via grid-template-areas)
    row.innerHTML = `
      <div class="cart-item-info">
        <p class="cart-item-name">${escapeHtml(item.name)}</p>
        <p class="cart-item-meta">משקל/יחידה: ${escapeHtml(item.variantLabel)}</p>
      </div>
      <div class="qty">
        <button type="button" class="qty-btn" data-qty-dec aria-label="הפחתת כמות">−</button>
        <span class="qty-num" data-qty-num>${item.quantity}</span>
        <button type="button" class="qty-btn" data-qty-inc aria-label="הגדלת כמות">+</button>
      </div>
      <div class="cart-item-subtotal">${formatShekel(subtotal)}</div>
      <button type="button" class="cart-item-remove" data-cart-remove aria-label="הסרת פריט">✕</button>
    `;
    row.querySelector("[data-qty-dec]").addEventListener("click", () =>
      Cart.setQuantity(item.productId, item.variantLabel, item.quantity - 1));
    row.querySelector("[data-qty-inc]").addEventListener("click", () =>
      Cart.setQuantity(item.productId, item.variantLabel, item.quantity + 1));
    row.querySelector("[data-cart-remove]").addEventListener("click", () =>
      Cart.remove(item.productId, item.variantLabel));
    return row;
  },
};

// ============================================================
// Checkout (pickup / delivery)
// ============================================================
const Checkout = {
  setMethod(method) {
    STATE.checkout.method = method;
    Checkout.renderUI();
  },

  renderUI() {
    const total = Cart.total();
    const method = STATE.checkout.method;
    const isEmpty = STATE.cart.length === 0;

    // Method radios
    document.querySelectorAll('[data-method]').forEach((label) => {
      const input = label.querySelector('input[type="radio"]');
      if (!input) return;
      input.checked = (input.value === method);
      label.classList.toggle("is-selected", input.checked);
    });

    // Show only the right field group
    const pickupFields = document.querySelector('[data-method-fields="pickup"]');
    const deliveryFields = document.querySelector('[data-method-fields="delivery"]');
    if (pickupFields) pickupFields.hidden = method !== "pickup";
    if (deliveryFields) deliveryFields.hidden = method !== "delivery";

    // Section 3: empty-method hint hidden once method picked
    const hint = document.querySelector("[data-empty-method-hint]");
    if (hint) hint.hidden = !!method;

    // Min-delivery warning (only when delivery selected)
    const minWarn = document.querySelector("[data-min-warning]");
    const minHelp = document.querySelector("[data-delivery-help]");
    if (method === "delivery") {
      const missing = STORE.minDelivery - total;
      if (missing > 0) {
        if (minWarn) {
          minWarn.hidden = false;
          minWarn.textContent =
            `מינימום הזמנה למשלוח הוא ${formatShekel(STORE.minDelivery)}. ` +
            `חסרים לך עוד ${formatShekel(missing)} כדי לבצע משלוח.`;
        }
        if (minHelp) minHelp.hidden = true;
      } else {
        if (minWarn) minWarn.hidden = true;
        if (minHelp) minHelp.hidden = false;
      }
    } else {
      if (minWarn) minWarn.hidden = true;
      if (minHelp) minHelp.hidden = true;
    }

    // Submit button label + state
    const submit = document.querySelector("[data-cart-submit]");
    if (submit) {
      let label = "שליחת הזמנה בווצאפ";
      if (method === "pickup") label = "שליחת הזמנה לאיסוף בווצאפ";
      if (method === "delivery") label = "שליחת הזמנה למשלוח בווצאפ";
      submit.querySelector("[data-submit-text]").textContent = label;
      // נטרול רק כשהסל ריק או שמשלוח מתחת למינימום
      const blockMin = method === "delivery" && total < STORE.minDelivery;
      submit.disabled = isEmpty || blockMin;
    }

    // Clear button
    const clear = document.querySelector("[data-cart-clear]");
    if (clear) clear.disabled = isEmpty;
  },

  validate() {
    const method = STATE.checkout.method;
    const errors = {};

    if (STATE.cart.length === 0) {
      errors.__form = "הסל ריק. הוסיפו מוצרים לפני שליחת הזמנה.";
      return errors;
    }
    if (!method) {
      errors.__form = "בחרו אופן קבלה: איסוף עצמי או משלוח.";
      return errors;
    }

    const fields = method === "pickup"
      ? document.querySelector('[data-method-fields="pickup"]')
      : document.querySelector('[data-method-fields="delivery"]');

    const v = (sel) => fields.querySelector(`[data-field="${sel}"]`)?.value.trim() || "";
    const name  = v("name");
    const phone = v("phone");

    if (!name)  errors.name  = "נא למלא שם מלא.";
    if (!phone) errors.phone = "נא למלא מספר טלפון.";
    else if (!isValidPhone(phone)) errors.phone = "מספר טלפון לא תקין.";

    if (method === "delivery") {
      if (Cart.total() < STORE.minDelivery) {
        errors.__form =
          `מינימום הזמנה למשלוח הוא ${formatShekel(STORE.minDelivery)}. ` +
          `חסרים לך עוד ${formatShekel(STORE.minDelivery - Cart.total())}.`;
      }
      if (!v("city"))   errors.city   = "נא למלא עיר.";
      if (!v("street")) errors.street = "נא למלא רחוב.";
      if (!v("house"))  errors.house  = "נא למלא מספר בית.";
      // notes — אופציונלי

      // אמצעי תשלום — שדה חובה למשלוח
      const paid = fields.querySelector('input[name="payment-method"]:checked');
      if (!paid) errors.payment = "יש לבחור אמצעי תשלום למשלוח.";
    }

    return errors;
  },

  paymentLabel(value) {
    if (value === "credit-phone") return "אשראי – טלפוני";
    if (value === "cash-courier") return "מזומן לשליח";
    return "";
  },

  showErrors(errors) {
    // נקה הצגות שגיאה קודמות
    document.querySelectorAll("[data-error-for]").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    document.querySelectorAll(".field-input.has-error").forEach((el) =>
      el.classList.remove("has-error"));

    // הצג שגיאות שדה
    let firstField = null;
    for (const [field, msg] of Object.entries(errors)) {
      if (field === "__form") continue;
      const errEl = document.querySelector(`[data-error-for="${field}"]`);
      const inputEl = document.querySelector(`[data-field="${field}"]`);
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
      if (inputEl) {
        inputEl.classList.add("has-error");
        if (!firstField) firstField = inputEl;
      }
    }

    // הודעת שגיאה כללית
    const formErr = document.querySelector("[data-form-error]");
    if (formErr) {
      if (errors.__form) {
        formErr.hidden = false;
        formErr.textContent = errors.__form;
      } else {
        formErr.hidden = true;
        formErr.textContent = "";
      }
    }

    if (firstField) firstField.focus();
  },

  collectCustomer() {
    const method = STATE.checkout.method;
    const fields = method === "pickup"
      ? document.querySelector('[data-method-fields="pickup"]')
      : document.querySelector('[data-method-fields="delivery"]');
    const v = (sel) => fields.querySelector(`[data-field="${sel}"]`)?.value.trim() || "";
    const paid = fields.querySelector('input[name="payment-method"]:checked');
    return {
      method,
      name:   v("name"),
      phone:  v("phone"),
      city:   v("city"),
      street: v("street"),
      house:  v("house"),
      notes:  v("notes"),
      payment: paid?.value || "",
    };
  },

  submit() {
    const errors = Checkout.validate();
    if (Object.keys(errors).length > 0) {
      Checkout.showErrors(errors);
      return;
    }
    Checkout.showErrors({}); // ניקוי

    const customer = Checkout.collectCustomer();
    const text = customer.method === "pickup"
      ? buildPickupMessage(customer)
      : buildDeliveryMessage(customer);
    const url = `https://wa.me/${STORE.whatsappPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");

    // הודעה רכה ללקוח – לא לרוקן את הסל אוטומטית
    showToast("ההודעה נפתחה בווצאפ. לאחר השליחה תוכלו לנקות את הסל.");
  },
};

// ---------------- WhatsApp message templates ----------------
function buildItemsBlock() {
  const lines = ["פרטי ההזמנה:"];
  STATE.cart.forEach((it, i) => {
    const subtotal = it.price * it.quantity;
    lines.push(`${i + 1}. ${it.name}`);
    lines.push(`משקל/יחידה: ${it.variantLabel}`);
    lines.push(`כמות: ${it.quantity}`);
    lines.push(`סה״כ לפריט: ${formatShekel(subtotal)}`);
    lines.push("");
  });
  lines.push(`סה״כ להזמנה: ${formatShekel(Cart.total())}`);
  return lines.join("\n");
}

function buildPickupMessage(c) {
  return [
    "היי! ביצעתי הזמנה באתר!",
    "לקוח יקר, שים לב לשלוח את ההודעה לשליחת ההזמנה.",
    "",
    "סוג הזמנה: איסוף עצמי משוק נתניה",
    "",
    "פרטי לקוח:",
    `שם מלא: ${c.name}`,
    `נייד: ${c.phone}`,
    "",
    buildItemsBlock(),
    "",
    "כתובת לאיסוף:",
    STORE.address,
    "",
    "נא לאשר ללקוח את זמינות ההזמנה ומועד האיסוף.",
  ].join("\n");
}

function buildDeliveryMessage(c) {
  return [
    "היי! ביצעתי הזמנה באתר!",
    "לקוח יקר, שים לב לשלוח את ההודעה לשליחת ההזמנה.",
    "",
    "סוג הזמנה: משלוח",
    "",
    "פרטי לקוח:",
    `שם מלא: ${c.name}`,
    `נייד: ${c.phone}`,
    "",
    "כתובת למשלוח:",
    `עיר: ${c.city}`,
    `רחוב: ${c.street}`,
    `מספר בית: ${c.house}`,
    `הערות לשליח: ${c.notes || "—"}`,
    "",
    "אמצעי תשלום:",
    Checkout.paymentLabel(c.payment),
    "",
    buildItemsBlock(),
    "",
    "הערה:",
    `מינימום הזמנה למשלוח: ${formatShekel(STORE.minDelivery)}.`,
    "נא ליצור קשר עם הלקוח לאישור ההזמנה, זמינות המוצרים ותיאום המשלוח.",
  ].join("\n");
}

// ============================================================
// Cart UI wiring (drawer, FAB, radios, fields, submit, clear)
// ============================================================
function wireCart() {
  const fab     = document.querySelector("[data-cart-fab]");
  const drawer  = document.getElementById("cart-drawer");
  const backdrop= document.querySelector("[data-cart-backdrop]");
  const closeBtn= document.querySelector("[data-cart-close]");
  const clearBtn= document.querySelector("[data-cart-clear]");
  const submit  = document.querySelector("[data-cart-submit]");

  function open() {
    drawer.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.add("is-open");
      backdrop.classList.add("is-open");
    });
    document.body.classList.add("cart-open");
    drawer.setAttribute("aria-hidden", "false");
    closeBtn?.focus();
  }
  function close() {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("cart-open");
    drawer.setAttribute("aria-hidden", "true");
    setTimeout(() => { drawer.hidden = true; backdrop.hidden = true; }, 260);
  }

  fab?.addEventListener("click", () => drawer.hidden ? open() : close());
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) close();
  });

  // Method radios
  document.querySelectorAll('input[name="checkout-method"]').forEach((r) => {
    r.addEventListener("change", () => Checkout.setMethod(r.value));
  });

  // Payment radios — סנכרון מצב נבחר + ניקוי שגיאה
  document.querySelectorAll('input[name="payment-method"]').forEach((r) => {
    r.addEventListener("change", () => {
      document.querySelectorAll('[data-payment]').forEach((label) => {
        const inp = label.querySelector('input[type="radio"]');
        label.classList.toggle("is-selected", inp?.checked);
      });
      const errEl = document.querySelector('[data-error-for="payment"]');
      if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
    });
  });

  // Real-time field validation cleanup
  document.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener("input", () => {
      input.classList.remove("has-error");
      const errEl = document.querySelector(`[data-error-for="${input.dataset.field}"]`);
      if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
    });
  });

  clearBtn?.addEventListener("click", () => {
    if (STATE.cart.length === 0) return;
    if (confirm("לרוקן את כל הסל?")) Cart.clear();
  });

  submit?.addEventListener("click", () => Checkout.submit());
}

// ============================================================
// Toast (לאחר פתיחת WhatsApp)
// ============================================================
function showToast(text) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 4500);
}

// ============================================================
// Helpers
// ============================================================
function catId(name) { return "cat-" + encodeURIComponent(name).replace(/%/g, ""); }

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatShekel(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  const s = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return `₪${s}`;
}

function normalize(s) {
  return String(s).toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[״"׳']/g, "")
    .replace(/\s+/g, " ").trim();
}

function isValidPhone(s) {
  // אישראלי בסיסי: לפחות 9 ספרות, לא יותר מ-15
  const digits = String(s).replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}
