"use client";

import React, { useState } from "react";
import { DEMO_PRODUCTS } from "@/lib/constants";
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Printer, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Tag, 
  Sparkles,
  Search,
  CheckCircle2,
  Percent,
  Coins
} from "lucide-react";

interface CartItem {
  id: number;
  name: string;
  sku: string;
  price: number;
  wholesalePrice: number;
  qty: number;
  tax: number;
  serial?: string | null;
}

export function PosSimulator() {
  const [cart, setCart] = useState<CartItem[]>([
    { id: 1, name: "Premium Slim-Fit Denim Jeans (Blue / 32)", sku: "APP-DNM-32", price: 48.00, wholesalePrice: 38.00, qty: 1, tax: 0.05, serial: "SN-882910" },
    { id: 3, name: "Artisan Caramel Iced Latte (Large)", sku: "FNB-COF-04", price: 4.50, wholesalePrice: 3.50, qty: 2, tax: 0.08, serial: null }
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [priceType, setPriceType] = useState<"retail" | "wholesale">("retail");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [redeemPoints, setRedeemPoints] = useState<boolean>(false);
  const [customerPoints, setCustomerPoints] = useState<number>(150); // e.g. $1.50 value
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mfs">("mfs");
  const [mfsProvider, setMfsProvider] = useState<string>("bKash");
  const [mfsTrxId, setMfsTrxId] = useState<string>("9K3L882A");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printedReceipt, setPrintedReceipt] = useState<{
    id: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    pointsDiscount: number;
    tax: number;
    total: number;
    priceType: string;
    payment: string;
    trxId?: string;
    date: string;
  } | null>(null);

  const categories = ["All", "Apparel", "Food & Beverage", "Beverages", "Grocery", "Electronics", "Supplies"];

  const filteredProducts = DEMO_PRODUCTS.filter((p) => {
    const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const addToCart = (product: typeof DEMO_PRODUCTS[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const getItemPrice = (item: CartItem) => {
    return priceType === "wholesale" ? item.wholesalePrice : item.price;
  };

  const subtotal = cart.reduce((sum, item) => sum + getItemPrice(item) * item.qty, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const pointsDiscountAmount = redeemPoints ? Math.min(customerPoints * 0.01, subtotal - discountAmount) : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount - pointsDiscountAmount);
  const tax = cart.reduce((sum, item) => sum + item.qty * getItemPrice(item) * item.tax, 0) * (taxableAmount / (subtotal || 1));
  const grandTotal = taxableAmount + tax;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsPrinting(true);

    setTimeout(() => {
      setPrintedReceipt({
        id: `PB-${Math.floor(100000 + Math.random() * 900000)}`,
        items: [...cart],
        subtotal,
        discount: discountAmount,
        pointsDiscount: pointsDiscountAmount,
        tax,
        total: grandTotal,
        priceType: priceType.toUpperCase(),
        payment: paymentMethod === "mfs" ? `MFS (${mfsProvider})` : paymentMethod.toUpperCase(),
        trxId: paymentMethod === "mfs" ? mfsTrxId : undefined,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      setIsPrinting(false);
      setCart([]);
      setDiscountPercent(0);
      setRedeemPoints(false);
    }, 700);
  };

  return (
    <div className="relative rounded-3xl border border-slate-700/60 bg-slate-900/90 p-4 sm:p-6 lg:p-8 shadow-2xl backdrop-blur-xl">
      {/* Top Terminal Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-3 w-3 items-center justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">POSBUZZ REGISTER v1.0</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">Branch: Main Flagship • Agent: 127.0.0.1:8080</span>
            </div>
          </div>
        </div>

        {/* Price Type Switcher (Retail vs Wholesale) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Price Type:</span>
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setPriceType("retail")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                priceType === "retail" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Retail Price
            </button>
            <button
              onClick={() => setPriceType("wholesale")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                priceType === "wholesale" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Wholesale Price
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Catalog Grid (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search bar & Category filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Scan barcode or search SKU / name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Items */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const activePrice = priceType === "wholesale" ? product.wholesalePrice : product.price;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-left transition hover:border-emerald-500/50 hover:bg-slate-800/50 active:scale-[0.97]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{product.image}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{product.sku}</span>
                  </div>
                  <div className="mt-3">
                    <h4 className="text-xs font-medium text-slate-200 group-hover:text-white line-clamp-2 leading-tight">
                      {product.name}
                    </h4>
                    {product.serial && (
                      <span className="mt-1 inline-block text-[9px] text-amber-400/80 font-mono">
                        ⚙️ {product.serial}
                      </span>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-400">
                        ${activePrice.toFixed(2)}
                      </span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-800 text-slate-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                        <Plus className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Customer Rewards & Discount Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400" />
                <span>Customer Points (150 pts = $1.50)</span>
              </div>
              <button
                onClick={() => setRedeemPoints(!redeemPoints)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  redeemPoints
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {redeemPoints ? "Applied (-$1.50)" : "Redeem"}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Percent className="h-4 w-4 text-emerald-400" />
                <span>Special Discount:</span>
              </div>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                      discountPercent === pct
                        ? "bg-emerald-500 text-slate-950 font-bold"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Cart & Checkout Register (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Current Order</h3>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                  {cart.reduce((a, b) => a + b.qty, 0)} items
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-400 hover:text-rose-300 transition"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="mt-3 max-h-[160px] overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Cart is empty. Click any product on the left to ring up!
                </div>
              ) : (
                cart.map((item) => {
                  const activePrice = getItemPrice(item);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-slate-900/60 p-2 text-xs border border-slate-800/40"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-medium text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400">
                          ${activePrice.toFixed(2)} {priceType === "wholesale" ? "(Wholesale)" : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-5 text-center font-bold text-white">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-14 text-right font-bold text-emerald-400">
                          ${(activePrice * item.qty).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Payment Method Selector & Totals */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod("mfs")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                  paymentMethod === "mfs"
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                }`}
              >
                <QrCode className="h-3.5 w-3.5" /> MFS / bKash
              </button>
              <button
                onClick={() => setPaymentMethod("card")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                  paymentMethod === "card"
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" /> Card / Bank
              </button>
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                  paymentMethod === "cash"
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Banknote className="h-3.5 w-3.5" /> Cash
              </button>
            </div>

            {paymentMethod === "mfs" && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={mfsProvider}
                  onChange={(e) => setMfsProvider(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white text-xs"
                >
                  <option value="bKash">bKash Merchant</option>
                  <option value="Nagad">Nagad Pay</option>
                  <option value="Rocket">DBBL Rocket</option>
                  <option value="Upay">UCB Upay</option>
                </select>
                <input
                  type="text"
                  placeholder="TrxID (e.g. 9K3L882A)"
                  value={mfsTrxId}
                  onChange={(e) => setMfsTrxId(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white text-xs font-mono"
                />
              </div>
            )}

            {/* Subtotals */}
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal ({priceType}):</span>
                <span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Special Discount ({discountPercent}%):</span>
                  <span className="font-mono">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              {pointsDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Customer Points Redeemed:</span>
                  <span className="font-mono">-${pointsDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estimated Tax / VAT:</span>
                <span className="font-mono text-slate-200">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-400 text-base">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Complete Transaction Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isPrinting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isPrinting ? (
                <>
                  <Printer className="h-4 w-4 animate-spin" />
                  Sending to Local Print Agent...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Print Receipt & Charge ${grandTotal.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pop-up Live Thermal Receipt Preview */}
      {printedReceipt && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-slate-950 p-6 text-slate-900 shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl font-mono text-xs shadow-inner border border-slate-300">
            <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-3">
              <div className="text-base font-black tracking-widest text-slate-900">POSBUZZ STORE</div>
              <div className="text-[10px] text-slate-600">Downtown Flagship Store - Branch #01</div>
              <div className="text-[10px] text-slate-600">Tel: +880 1700-000000 | www.posbuzz.io</div>
              <div className="text-[10px] text-slate-500">Invoice: {printedReceipt.id} | {printedReceipt.date}</div>
            </div>

            <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5">
              {printedReceipt.items.map((item, idx) => {
                const activePrice = printedReceipt.priceType === "WHOLESALE" ? item.wholesalePrice : item.price;
                return (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate pr-2">{item.qty}x {item.name}</span>
                    <span className="font-bold">${(activePrice * item.qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <div className="py-3 border-b border-dashed border-slate-400 space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${printedReceipt.subtotal.toFixed(2)}</span>
              </div>
              {printedReceipt.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount:</span>
                  <span>-${printedReceipt.discount.toFixed(2)}</span>
                </div>
              )}
              {printedReceipt.pointsDiscount > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Points Discount:</span>
                  <span>-${printedReceipt.pointsDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>${printedReceipt.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
                <span>TOTAL:</span>
                <span>${printedReceipt.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] pt-1">
                <span>Method: {printedReceipt.payment}</span>
                {printedReceipt.trxId && <span>Trx: {printedReceipt.trxId}</span>}
              </div>
            </div>

            <div className="pt-3 text-center space-y-2">
              <div className="text-[10px] text-slate-500">Thank you for shopping with PosBuzz!</div>
              <div className="tracking-widest font-bold text-sm">||| | |||| | |||||| || | |||</div>
              <button
                onClick={() => setPrintedReceipt(null)}
                className="mt-2 text-xs font-sans text-emerald-700 hover:text-emerald-900 font-bold underline"
              >
                Close Receipt Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
