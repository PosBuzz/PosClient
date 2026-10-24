# Part 4 - Selling: POS, sales, returns, quotations, dues and promotions

This part explains every screen you use to sell goods, take payment, take goods back, give price offers, collect money still owed, and run discounts. All money is in taka (BDT). Dates and times use the Asia/Dhaka time zone.

Sale numbers look like `SAL-20261024-0010`. Return numbers look like `RET-20261024-0001`. Quotation numbers look like `QUO-20261024-0001`.

**Permissions in short.** All screens in this part need the **sales** permission, except the quotation screens, which need the **quotations** permission. If you do not have the permission, the menu item is hidden and the page will not open for you. Ask the shop owner to give you the permission.

**Good to know:** The app has no "hold" or "park" sale. If you start a sale and press **Cancel**, everything is cleared. If you want to keep a price offer for later, save a quotation. If a customer will pay later, complete the sale with no payment and collect the money later in **Due Payments**.

---

## Express Sale (Point of Sale)

### What it is

Express Sale is the fast checkout screen for the counter. You tap or scan products, take payment and finish the sale in a few steps. It is also called "Point of Sale" or POS.

### Where to find it

- Open the **Home** page (Dashboard) and tap the **Express Sale** card ("Sale with our POS interface").
- It is not in the left menu. It opens as a full screen without the menu.
- Permission needed: **sales**. The card only shows if you have it.

### Two layouts: classic and restaurant

The POS has two layouts. Choose one in the left menu under **Settings**, then **POS Layout**. The choice is saved in the browser of that computer only, so each counter computer can have its own layout. The default is **classic**.

- **Classic** is a grid of cards (branch, products, payments) with a cart table. It suits shops.
- **Restaurant** shows a menu of tiles on the left and the current order on the right. It suits food shops.

Both layouts work the same way underneath. Only the buttons differ.

### What you see: classic layout

![Express Sale, classic layout](images/consumer/pos-d.png)

*Express Sale in the classic layout on a computer screen.*

![Express Sale on a phone](images/consumer/pos-m.png)

*On a phone the cards stack one under the other. The Cart Items table and the totals are below the cards.*

**Top bar**

| Item | What it does |
| --- | --- |
| Company logo and **Point of Sale** | Shows which screen you are on. |
| **N items** badge | Appears once the cart has lines. It shows how many. |
| **Promos (N)** (purple) | Opens the list of active promotions. N is the number of active promotions. It is greyed out until you pick a branch. |
| **Back** | Goes back to the Home page. |
| **Fullscreen** / **Exit** | Fills the whole screen. Press **Exit** (or the Esc key) to leave full screen. |

**Card 1: sale details**

| Field | Required | Notes |
| --- | --- | --- |
| **Branch** | Yes | Shows "Select branch" if empty. It starts with your first branch. Changing the branch clears the cart and the promotions. |
| **Customer** | No | You can search by name. Placeholder is "Walk-in customer", which means a customer with no record. Each entry shows "Name • phone". Use the clear option to remove the customer. |
| Green **+** button (tooltip **Add customer**) | No | Opens the **Add New Customer** window. |
| **Served By** | No | Placeholder "Select staff". You can search and clear. It lists staff of the chosen branch. |
| **Pricing** button, **Retail** / **Wholesale** | No | Tap to switch. Wholesale is shown in blue. Switching re-prices every cart line, so one sale never mixes retail and wholesale prices. If a product has no wholesale price, its retail price is used. |

**Card 2: products and discounts**

| Item | Notes |
| --- | --- |
| **Add Products** search box | Placeholder "Search or scan barcode...". It is disabled until you pick a branch. Each result shows the picture, product name, variant, SKU, barcode, shelf locations, **Stock: n unit** and the price. In the live app the second line reads like "Default • SKU-1009 • 8810000333" (variant, SKU, barcode), without the word Code. Tap a result to add 1 to the cart. Tapping the same item again adds one more. |
| **Discounts & Charges** | Holds the discount and shipping boxes below. |
| Green promotion tags | Promotions already applied. You can close each tag to remove it. **Clear All** removes all of them. |
| **Fixed** / **%** toggle | Chooses whether the Avg Discount is an amount in taka or a percent. |
| **Avg Discount** | Minimum 0. One discount for the whole order, spread across the lines in proportion. |
| **Shipping Cost** | Minimum 0. Added to the total. |

**Card 3: payments**

| Item | Notes |
| --- | --- |
| **Add** | Adds another payment row. The new row is filled with the amount still unpaid, or the full total if nothing is left unpaid. |
| **Method** | Cash, Card, Cheque, Transfer (bank transfer), Mobile (mobile money), MFS, Credit, Exchange. |
| **Select bank** | Shown for Card and Transfer. A searchable list of Bangladesh banks. |
| **Select MFS** | Shown for MFS. Choose from bKash, Nagad, Rocket, MyCash, Islami Bank mCash, Trust Axiata Pay (TAP), FirstCash, Upay, OK Wallet, Rupali Bank, Telecash, Islamic Wallet, Meghna Pay. |
| **Amount** | Minimum 0, two decimal places. |
| **Ref#** | Optional reference, for example a transaction number. |
| Red trash button (**Remove**) | Removes this payment row. |

**Cart Items card**

The card has a count badge. When empty it says **No items in cart** and **Search and add products to start**. Each line has these columns:

| Column | Notes |
| --- | --- |
| **Product** | Picture, name, variant and **SKU:**. |
| **Price** | Unit price. |
| **Qty** | A number box, minimum 1, with the unit name below. Setting it to 0 or clearing it removes the line. |
| **Tax** | The tax amount, followed by **(Inc)** if tax is already inside the price, or **(Exc)** if tax is added on top. |
| **Avg Disc** | The share of the order discount on this line. |
| **Special Disc** | A switch **Overall** / **Per qty**, an amount box, a percent text and the total. |
| **Promo Disc** | The promotion amount and a promotion tag you can close. |
| **Total** | Line total. |
| **Action** | Trash button to remove the line. |

**Side panel on the right**

- **TOTAL** in big numbers.
- Rows: **Subtotal**, **Tax**, **Discount** (highlighted if above 0, with its percent of the subtotal), **Promo Disc**, **Avg Disc**, **Special Disc**, **Shipping**.
- A notes box with the placeholder "Sale notes...".
- A red box **Due** showing the amount not yet paid, or a green box **Change** showing the amount paid over the total.
- **Cancel** (greyed out when the cart is empty) and **Complete Sale** (greyed out when the cart is empty or the sale is being saved).

**Available Promotions window** (opened with **Promos**)

- Lists the active promotions. Each one shows a scope tag (BRAND, BUNDLE or SINGLE_PRODUCT), an **Applied** or **Available** tag, the discount ("N% discount" or "amount discount"), a description, and a reason line if the cart does not qualify (for example "Not eligible for current cart").
- Each has an **Apply** or **Remove** button.
- If there are none, it says **No active promotions found**.

**Add New Customer window**

| Field | Required | Notes |
| --- | --- | --- |
| **Customer Name** | Yes | "Please enter customer name" if empty. |
| **Customer Type** | Yes | **Individual** (default) or **Business**. |
| **Phone** | Yes | "Please enter phone number" if empty. |
| **Email** | No | Must be a valid email: "Please enter valid email". |
| **Birthday** | No | Cannot be a future date. |
| **Address** | No | Free text. |

Buttons: **Cancel** and **Add Customer**. The new customer is selected for the sale straight away.

### What you see: restaurant layout

![Restaurant layout menu](images/consumer/pos-restaurant-menu-d.png)

*Restaurant layout with the Beverages category chosen. Each tile shows the stock and the price.*

![Restaurant current order](images/consumer/pos-restaurant-order-d.png)

*The Current order panel with four items. Mango Juice Week was applied by itself and the Discount row shows the saving.*

![Restaurant promotions](images/consumer/pos-restaurant-promos-d.png)

*The Available Promotions window opened from the tag button.*

**Left side**

- Logo, company name and **Restaurant POS**.
- Search box "Search menu or scan barcode...".
- Icon buttons **POS layout settings**, **Enter fullscreen** / **Exit fullscreen**, and **Back to dashboard**.
- Heading **Choose an item** and the line "Welcome back, (your name). Tap a menu item to add it to the current order."
- Category chips: **All** and one chip per product category.
- Product tiles with picture, name, variant, **Stock: n** and price. Tap a tile to add it.
- If nothing shows: **No available items found.** and **Select a branch in order options.**

**Right side: Current order**

- A line "N items • customer name".
- A tag button with the promotion count. It opens **Available Promotions**.
- An **Options** button.
- Three buttons **Dine in**, **Takeaway**, **Delivery**.
- Order lines with picture, name, variant and price, the **-** and **+** buttons, a trash button, a **Disc** box with **Overall** / **Per qty**, and **Total:** with the line total.
- If empty: **Your order is empty** and **Select an item from the menu to begin.**
- Summary: **Subtotal**, **Tax**, **Discount** (only if there is one), **Delivery / shipping** (only if there is one) and **Total**.
- A big **Checkout** button that shows the total.

> **Good to know:** **Dine in**, **Takeaway** and **Delivery** are for display only. Tapping them changes nothing on the sale, and the choice is not saved or printed.

**Order options window** (opened with **Options**)

| Section | What is in it |
| --- | --- |
| **Order details** | **Branch** (required), **Customer** with a plus button, **Served by**, **Pricing** (Retail or Wholesale). |
| **Discounts & charges** | Promotion tags, **Clear all**, **Fixed** or **Percentage**, **Order discount**, **Shipping cost**, **Order notes** (placeholder "Kitchen or sale notes..."). |
| **Payments** | A list of methods: Cash, Card, MFS, Mobile Money, Bank Transfer, Cheque, Credit, Exchange. A provider list (bank or MFS) where needed, an amount box, a **Reference** box, a remove button, and **Add split payment**. |
| **Cancel order** | A red button that clears the order. |

### How to make a sale (both layouts)

![Product search results](images/consumer/pos-search-results-d.png)

*Typing in Add Products shows matching products with SKU, barcode, stock and price.*

![Cart with several items](images/consumer/pos-cart-d.png)

*A cart with four items. Mango Juice Week was applied by itself.*

![Restaurant order options](images/consumer/pos-restaurant-options-d.png)

*Order options window in the restaurant layout: branch, customer, staff and price type.*

![Restaurant order options payments](images/consumer/pos-restaurant-options-payments-d.png)

*The lower part of Order options: discounts, notes, payment and Cancel order.*

![Sale saved, print agent offline](images/consumer/pos-sale-complete-print-warning-d.png)

*After Complete Sale with Auto Print Thermal ON and no print agent: the green success message and the red print message appear together.*

1. Check the **Branch**. In the restaurant layout, open **Options** to see it.
2. If you want to, choose a **Customer** (or leave "Walk-in customer"), choose **Served By**, and choose **Retail** or **Wholesale**.
3. Search or scan products and tap them to add them. Change the **Qty** if needed.
4. If you want to, add discounts (see the next task).
5. Check the payment. The first row is **Cash** and it follows the total automatically while it is the only row. Change the method or amount if the customer pays another way.
6. Tap **Complete Sale** (classic) or **Checkout** (restaurant).

If you use a barcode scanner, point it at the barcode. When no box is selected on the screen, the scanner types the code fast and ends with Enter. The app finds the product in the selected branch and adds it, and you see "Added (product) - (variant) to sale". If the code is unknown you see "Product not found for barcode: (code)".

**What happens next**

- The message **Sale created successfully!** appears.
- The cart, customer, discounts and payments are cleared. The branch stays. The screen stays on the POS, ready for the next customer.
- **Stock** goes down by the quantities sold.
- **Customer due:** if the customer paid less than the total, the sale is saved as **PARTIAL**. If nothing was paid, it is saved as **DUE**. The unpaid amount shows in **Due Payments**.
- **Reward points:** if the sale has a customer, points are earned on the amount paid, not counting the part paid with **Credit**. Whether a part-paid sale also earns points depends on **Earn Points on Fully Paid Sales Only** in **Settings**, then **Rewards**. If it is **Yes**, only fully paid sales earn points. If it is **No**, part-paid sales also earn, on the amount already received. Quotations never earn points. The receipt shows points total, earned and redeemed.
- If **Auto Print Thermal** is **ON**, the receipt prints (see "Receipt printing" below).

### How to add a new customer during a sale

![Customer list](images/consumer/pos-customer-picker-d.png)

*The Customer list shows name and phone.*

![Add New Customer errors](images/consumer/pos-add-customer-errors-d.png)

*Pressing Add Customer with the boxes empty.*

![Invalid email](images/consumer/pos-add-customer-bad-email-d.png)

*An email that is not valid shows Please enter valid email.*

![Customer created](images/consumer/pos-customer-created-d.png)

*After Add Customer the new customer is selected and a success message shows.*

1. Tap the green **+** next to **Customer**.
2. Fill in **Customer Name**, **Customer Type** and **Phone**. Fill in the optional boxes if you want.
3. Tap **Add Customer**.

**What happens next:** "Customer created successfully" appears and the new customer is selected for this sale.

### How to give a discount

![Discounts and shipping](images/consumer/pos-discounts-shipping-d.png)

*Quantity 3 on the first line, a Special Disc of 30 on the second, Avg Discount 20 and Shipping Cost 50. The side panel shows each part.*

![Available Promotions](images/consumer/pos-promos-drawer-d.png)

*Promotions list. The applied one has a Remove button. The others show why they do not apply yet.*

![Wholesale price](images/consumer/pos-wholesale-d.png)

*Pricing switched to Wholesale. Prices in the cart changed.*

There are three kinds. They are applied in this order: promotion first, then special, then average. Each one is limited to what is left of the line, so a line can never go below 0.

**Average discount (whole order)**

1. Choose **Fixed** (taka) or **%** (percent).
2. Type the amount in **Avg Discount**.

The discount is spread over the lines in proportion to their value.

**Special discount (one line)**

1. In the cart, find the line.
2. Type the amount in **Special Disc**.
3. Choose **Overall** (the amount is for the whole line) or **Per qty** (the amount is for each unit, so it grows if you add quantity).

**Promotion**

1. Tap **Promos**.
2. Find a promotion that says **Available** and tap **Apply**.
3. To take it off, tap **Remove** in the window, or close its tag.

Some promotions apply on their own. You then see "(names) auto-applied". If you remove an automatic promotion, it stays off while the cart still qualifies. If you change the cart and a promotion no longer fits, you see "Removed ineligible promotions: (names)". If the cart becomes empty you see "Applied promotions removed: cart is empty".

If you apply a promotion whose products are not in the cart, the app adds the products and quantity needed to meet it. It tries up to five times.

If several promotions cover one line, the one that gives the biggest discount is used.

**What happens next:** the discount lowers the total. It is shown in the side panel and on the receipt. It does not change stock.

### How to take a split payment or an unpaid sale

![Card bank list](images/consumer/pos-bank-list-d.png)

*Choosing Card shows a Select bank list.*

![Split payment with Due](images/consumer/pos-split-payment-due-d.png)

*Card 400 and MFS bKash 200 against a total of 930. The red Due box shows 330.*

1. Tap **Add** to add a payment row.
2. In each row, choose the **Method**. For Card or Transfer choose a bank in **Select bank**. For MFS choose a provider in **Select MFS**.
3. Type the **Amount**. Type a **Ref#** if you have one.
4. To delete a row, tap the red trash button.
5. Tap **Complete Sale**.

Rows with an amount of 0 are dropped when you save.

**What happens next**

- Paid less than the total: the sale is **PARTIAL** and the red **Due** box shows what is left.
- Paid nothing: the sale is **DUE**.
- Paid more than the total: the green **Change** box shows what to give back. The extra is not stored as income.
- **Credit** uses the customer's reward points (see the note below).

> **Good to know:** The **Credit** payment method is not a shop credit or a "pay later" option. It spends the customer's reward points. It needs a customer on the sale. The points are taken off when the sale is saved. If the customer has too few points, or the amount is below the minimum or above the maximum, or the reward system is switched off, the sale is refused. The messages show amounts in taka, for example "Credit payment validation failed: Minimum credit amount is ৳10.00" and "Credit payment validation failed: Insufficient points. Maximum credit available: ৳93.00". The minimum, maximum and point value are set in **Settings**, then **Rewards** ("Taka Value per Point"). If **Allow Partial Redemption** is **No** in that page, the points must cover the whole sale. Mixing Credit with Cash is then refused with "Partial redemption is turned off: reward points must cover the whole sale". To let a customer pay later, use no payment (DUE) or a part payment (PARTIAL) instead.

![Credit below minimum](images/consumer/pos-credit-below-minimum-d.png)

*Credit of 5 is below the minimum.*

![Credit with too many points](images/consumer/pos-credit-too-many-points-d.png)

*Credit of 500 when the customer has fewer points.*

![Credit with no customer](images/consumer/pos-credit-no-customer-d.png)

*Credit needs a customer.*

![Partial redemption off](images/consumer/pos-credit-partial-refused-d.png)

*With Allow Partial Redemption set to No, Credit mixed with Cash is refused.*

![Whole sale on points](images/consumer/pos-credit-whole-sale-d.png)

*A whole sale paid with Credit only.*

### How to cancel a sale

![Insufficient stock](images/consumer/pos-stock-error-d.png)

*Selling more than the stock shows the Insufficient stock message.*

![Cancel Sale confirmation](images/consumer/pos-cancel-confirm-d.png)

*The Cancel Sale question.*

1. Tap **Cancel** (or **Cancel order** in the restaurant layout).
2. A box asks **Cancel Sale?** "Are you sure you want to cancel? All items, discounts, and customer details will be removed."
3. Tap **Yes, Cancel**. Tap **No** to go back.

**What happens next:** "Sale cancelled and form cleared." Nothing is saved. Stock and customer balances do not change.

### Receipt printing

Receipts print on a thermal printer through a small program called the **print agent**. It must be running on the same computer as the printer.

- On the POS, a receipt prints by itself only if **Auto Print Thermal** is **ON**. You find this switch (ON/OFF) on the **Receipt** settings page. It is saved in that browser only.
- You can print again later from **View Sales** (printer icon) or from the sale page (**Print Receipt**).
- For cash payments the cash drawer opens by itself, if your printer is set up for it.
- Paper width and auto cut are set in the print agent's own settings file, not in the app.
- To get the print agent, go to **Receipt** settings and tap **Download Print Server**. It downloads a zip file. To update it, close it, delete the old folder, unzip the new one, and run it. Your settings are kept.

**Print messages**

| Message | What it means | What to do |
| --- | --- | --- |
| Receipt sent to printer! | The print agent got the receipt. | Nothing. Take the receipt. |
| Printing agent is not running. Please start the printing agent on your computer and try again. | The app cannot reach the print agent on this computer. It appears as a red message right after the green "Sale created successfully!". | Start the print agent program on the computer with the printer, then print again from **View Sales**. The sale itself is already saved. |
| Failed to print receipt. Please check your connection. | The print request did not go through. | Check the printer, the cable and the print agent, then print again. |
| Failed to print receipt: (text) | The printer or agent reported a problem. | Read the text, fix the problem, then print again. |

> **Good to know:** If the print agent is not running, the sale is still saved. Only the paper receipt is missing. Start the agent and reprint from **View Sales**.

### Messages you may see on the POS

| Message | What it means | What to do |
| --- | --- | --- |
| Sale created successfully! | The sale was saved. | Nothing. |
| Please add at least one item to the sale | The cart is empty. | Add a product. |
| Select branch | No branch is chosen. | Choose a branch. |
| (METHOD) payment must have a payment type selected, for example "CARD payment must have a payment type selected" | A Card or Transfer row has no bank, or an MFS row has no provider. | Choose the bank or provider. |
| CREDIT payments require a customer account | Credit was used with no customer. | Choose a customer, or use another method. |
| Credit payment validation failed: (reason) | The reward points cannot cover this. The reason may be too few points, a minimum or maximum amount, or "Rewards system is disabled". | Use another method or a smaller amount. |
| Partial redemption is turned off: reward points must cover the whole sale | **Allow Partial Redemption** is **No** in **Settings**, then **Rewards**, and Credit does not cover the whole sale. | Pay the whole sale with Credit, or pay without Credit. |
| Insufficient stock for variant (number). Available: x, Requested: y | There is less stock than you asked for. | Lower the **Qty**. |
| Stock changed while the sale was being saved; please try again. | Someone else sold the same stock at the same moment. | Tap **Complete Sale** again. |
| Failed to create sale | The sale did not save. There may be no internet. | Check the connection and try again. The POS does not work offline. |
| Product not found for barcode: (code) | No product in this branch has that barcode. | Search by name. |
| Failed to scan barcode | The scan could not be read. | Scan again or search by name. |
| Please select a branch before applying a promotion | You tapped **Apply** with no branch. | Choose a branch first. |
| (name) applied / (name) is already applied | The promotion was applied, or was already on. | Nothing. |
| Promotion conditions not matched | The cart does not meet the promotion rules. | Read the reason line in the promotions window. |
| Customer created successfully / Failed to create customer | The new customer was saved, or not. | If it failed, check the phone and email and try again. |

> **Good to know:** Messages that come from the server, such as the Credit and reward messages, show amounts with the taka sign (৳). They match the amounts on the screen.

### Tax on the sale

Each product has a tax percent and a tax method. With **Exclusive** tax, the tax is added on top of the price. With **Inclusive** tax, the tax is already inside the price. It shows as **(Inc)** and the total does not change. Money is rounded to two decimals on each line.

---

## New Sale

### What it is

New Sale is a full page for entering a sale with more detail than the POS. After you save, the app opens the saved sale.

### Where to find it

Left menu: **Sales**, then **New Sale**. Permission needed: **sales**. It also opens when you convert a quotation to a sale.

### What you see

![New Sale page](images/consumer/sales_new-d.png)

*The New Sale page. The round tag button at the lower right opens the promotions list.*

| Field | Required | Notes |
| --- | --- | --- |
| **Branch** | Yes | "Please select a branch" if empty. |
| **Customer** | No | Placeholder "Select customer". You can search. The **+** button (**Add new customer**) opens the same window as the POS. |
| **Served By** | No | Placeholder "Select Staff". |
| **Price Type** | No | A button that switches **Regular** and **Wholesale**. |
| **Product Selection** | Yes, at least one item | "Search and select products...". Each result shows Code, SKU, Barcode, locations, Stock and price. |
| **Sale Items** table | | Empty text "No items added yet". Columns: **Product**, **Price**, **Quantity**, **Tax**, **Avg Disc**, **Promo Disc**, **Special Disc** (with **Overall** / **Per qty**), **Total**, **Action**. |
| Promotion tags | | Show "Applied: (name)". The link **Remove All Promotions** removes them all. |
| **Average Type** | No | **Fixed** or **Percent**. |
| **Avg Discount** | No | The order discount. |
| **Shipping** | No | Shipping charge. |
| **Payment Methods** | No | Tap **Add Payment Method**. Each row has the method (Cash, Card, Cheque, Bank Transfer, Mobile Money, MFS, Credit, Exchange), a provider list where needed, an amount (shows 0.00), **Reference**, and a delete button. |
| **Notes** | No | Placeholder "Optional notes about this sale". |
| **This is an Online Order** | No | Tick it to make the sale an online order. Its status is PENDING and it appears in **Online Orders**. |
| **Deliver products later (reserve inventory)** | No | Tick it to hold the stock now and deliver later from **Pending Deliveries**. |
| Summary | | **Subtotal**, **Tax**, **Promo Discount**, **Average Discount**, **Special Discount** (only if above 0), **Shipping**, **Total**, **Due** (if unpaid) and **Change**. |
| **Cancel** | | Goes to the **Sales** list without saving. |
| **Create Sale** | | Saves the sale. |
| **Promotions** (round purple tag button with a count) | | Opens **Available Promotions**, the same as on the POS. |

### How to create a sale

![New Sale filled](images/consumer/sales-new-filled-d.png)

*New Sale with three items and an applied promotion.*

![New Sale empty submit](images/consumer/sales-new-empty-submit-d.png)

*With no items, Create Sale is greyed out.*

![Card with no provider](images/consumer/sales-new-card-no-provider-error-d.png)

*Card payment without a bank shows CARD payment must have a payment type selected.*

![Online order options](images/consumer/sales-new-online-checkboxes-d.png)

*The two checkboxes and the Due line for a part payment.*

1. Choose the **Branch**.
2. Choose the **Customer**, **Served By** and **Price Type** if you want.
3. Search under **Product Selection** and pick each product. Change **Quantity** in the table.
4. Set discounts and **Shipping** if needed.
5. Tap **Add Payment Method**. Choose the method, provider and **Amount**.
6. Tick **This is an Online Order** or **Deliver products later (reserve inventory)** if they apply.
7. Write **Notes** if you want.
8. Tap **Create Sale**.

You can also scan a barcode on this page. Rules for payments, discounts, DUE, PARTIAL and PAID are the same as on the POS.

**What happens next**

- "Sale created successfully!" appears and the **Sale** page opens. This page does not print a receipt by itself.
- **Stock** goes down, unless you ticked **Deliver products later**, in which case it is reserved until delivery.
- **Customer due:** unpaid money shows in **Due Payments**.
- **Reward points:** the same rules as the POS.

### How to turn a quotation into a sale

1. Open **View Quotations** and tap **Convert to Sale** on a pending quotation (see the Quotations section).
2. The New Sale page opens with branch, customer, served by, price type, items, discounts, promotions, shipping and notes already filled.
3. Check the prices. They are read again at the current price, and tax is worked out again, so they may differ from the quotation.
4. Add payment and tap **Create Sale**.

**What happens next:** the quotation is marked **Converted** and linked to the sale. Stock goes down now, using the stock you have today. If the quotation was already converted you see "This quotation has already been converted to a sale" and you are taken back to the quotation.

---

## View Sales

### What it is

A list of all sales with totals, filters and actions for each sale. The page title is **Sales**.

### Where to find it

Left menu: **Sales**, then **View Sales**. Permission needed: **sales**. The **New Sale** button at the top right opens a new sale.

### What you see

![Sales list](images/consumer/sales-d.png)

*The Sales list with summary cards, tabs, filters and the table.*

**Summary cards.** They change with the filters.

| Card | Meaning |
| --- | --- |
| **Total Sales** | Number of sales ("n sales"). |
| **Gross Invoiced** | Total value of the sales. |
| **Total Received** | Money received. |
| **Total Due** | Money still owed. Red if above 0. |
| **Refunds** | Money refunded, with the number of returns in brackets. |
| **Net Sales** | Sales after refunds. |

**Tabs:** **Sales** and **Deleted Sales**.

**Filters**

| Filter | Options |
| --- | --- |
| Search "Search sales..." | Type a sale number or customer. |
| Date range ("Start Date", "End Date") | Presets: Today, Yesterday, This Week, Last Week, This Month, Last Month, Last 30 Days, Last 90 Days. |
| **Payment Status** | Paid, Partial, Due, Cancelled. |
| **Payment Method** | Cash, Card, Bank Transfer, Cheque, Mobile Money, MFS, Credit. |
| **Branch** | Your branches. |
| **Source** | From Quotation, Direct Sale. |
| **Clear** | Removes all filters. |
| **Active Filters:** | A strip of tags showing what is on. |

**Columns**

| Column | Notes |
| --- | --- |
| **Sale #** | A link to the sale. You can sort. |
| **Customer** | Name and phone, or "Walk-in Customer". |
| **Branch** | The branch. |
| **Sale Date** | For example "Oct 24, 2026 19:14". You can sort. |
| **Items** | Number of items. |
| **Total Amount** | You can sort. |
| **Returns** | "—" if none. Otherwise a tag **RETURNED** or **PARTIAL RETURN** and the refund amount. Hover to see "N return(s) · Net after refunds: x". |
| **Payment** | A tag **PAID**, **PARTIAL**, **DUE** or **CANCELLED**, and the method name or "N methods". |
| **Sold By** | The user who made the sale. |
| **Served By** | The staff member who served. |
| **Actions** | See below. |

On the **Deleted Sales** tab you also see **Deleted By**, **Deleted At** and **Reason**.

At the bottom: "a-b of N sales", the page size and a quick page jump.

**Actions on each row**

| Button | What it does |
| --- | --- |
| **View Sale** | Opens the sale page. |
| **Print Receipt** | Prints on the thermal printer. Needs the print agent. |
| **Download PDF Receipt** | Saves a file named with the sale number, ending in .pdf. |
| **Other Documents** menu | **Online Delivery Slip**, **Chalan Slip**, **Money Receipt**, **Delivery Slip / Sticker**. Each downloads as a file. |
| **Delete Sale** (Sales tab) | Deletes the sale. |
| **Restore Sale** (Deleted Sales tab) | Brings a deleted sale back. |

### How to find a sale

![Filtered sales](images/consumer/sales-filtered-partial-d.png)

*Sales filtered with Payment Status Partial. The Active Filters strip shows the filter.*

![Date presets](images/consumer/sales-date-presets-d.png)

*The date range list with Today, Yesterday and the other presets.*

1. Type in the search box, or pick filters (date range, **Payment Status**, **Payment Method**, **Branch**, **Source**).
2. Check the **Active Filters:** strip.
3. Tap **Clear** to start again.

### How to print or download a receipt for a sale

1. Find the sale.
2. Tap **Print Receipt** for the thermal printer, or **Download PDF Receipt** for a PDF, or open **Other Documents** and pick a slip.

**Messages:** "Receipt printed successfully!", "PDF receipt downloaded successfully!", "(slip name) downloaded successfully!", "Failed to download PDF receipt", "Failed to download (slip name)". If the print agent is not running, you see the messages in the table in the POS section above.

### How to delete a sale

![Delete sale](images/consumer/sales-delete-dialog-d.png)

*The Delete sale window with the optional Reason.*

1. Tap **Delete Sale** on the row.
2. A window titled **Delete sale (number)** says the sale is kept under **Deleted Sales** and the stock it sold is put back into the original batches. It also says sales that already have a return cannot be deleted.
3. Type a **Reason (optional)**, up to 500 characters.
4. Tap **Delete Sale**, or **Cancel**.

**What happens next:** "Sale deleted and stock restored". Stock goes back. Reward points earned on that sale are taken back. The sale no longer counts in reports.

| Message | What it means | What to do |
| --- | --- | --- |
| This sale has partial payments collected after it was created. Reverse those payments before deleting. | Money was collected later on this sale. | Reverse those payments first. |
| This sale was created as an exchange for a return and cannot be deleted. | It belongs to a return. | Leave it. |
| A quotation-converted record cannot be deleted from here. | It is the record of a converted quotation. | Leave it. |
| Sale has already been deleted | It was deleted before. | Check the **Deleted Sales** tab. |

### How to restore a deleted sale

![Deleted Sales tab](images/consumer/sales-deleted-tab-d.png)

*The Deleted Sales tab with Deleted By, Deleted At and Reason columns.*

![Restore this sale](images/consumer/sales-restore-dialog-d.png)

*The Restore this sale? question. Restore is the blue button.*

![Sale restored](images/consumer/sales-restored-toast-d.png)

*After Restore the message Sale restored shows and the sale leaves this tab.*

1. Open the **Deleted Sales** tab.
2. Tap **Restore Sale**.
3. A box asks **Restore this sale?** "Stock will be deducted again from the original batches." Tap **Restore** or **Cancel**.

**What happens next:** "Sale restored" and stock goes down again. If the stock is no longer there you see "Cannot restore this sale: the stock it consumed is no longer available in the original batch(es)." You cannot restore it until that stock is back.

---

## Sale page (Sale #number)

### What it is

The full detail of one sale, with printing and a notes box.

### Where to find it

From **View Sales**, tap the sale number or **View Sale**. Permission needed: **sales**. Right after **Create Sale** on the New Sale page, this page opens by itself. If it cannot load, you see "Failed to load sale details" and go back to the list.

### What you see

**Buttons**

| Button | What it does |
| --- | --- |
| **Back to Sales** | Goes to the list. |
| **Print Receipt** | Prints on the thermal printer. "Receipt printed successfully!" |
| **A4 Preview** (split button) | Click it for the normal A4 receipt. The arrow opens a menu: **Print as Online Delivery Slip**, **Chalan Slip**, **Money Receipt**, **Delivery Slip / Sticker**. A window **A4 Receipt Preview - (number)** says "Generating preview..." and then shows the page, with **Close** and **Download PDF**. If it fails: "Failed to generate A4 receipt preview". |

**Cards**

- Red banner for a deleted sale: "This sale has been deleted - Deleted by (name) on (date) - (reason). Its stock has been returned to inventory and it is excluded from all reports."
- **Returns against this sale** (only if there are returns): a tag **FULLY RETURNED** or **PARTIALLY RETURNED**, then **Sale Total**, **Refunded**, **Net After Returns**, and a table with **Return #** (link), **Date**, **Refund**, **Exchange**, **Reason**.
- **This sale was converted from a quotation** (only for converted sales): **Original Quotation**, **Quotation Date** and a link **View Original Quotation →**.
- **Sale Information**: **Sale Number**, **Sale Date**, **Customer** (shows "Walking Customer" if none), **Phone**, **Email**, **Branch**, **Created By**, **Served By**, **Promotion Applied**, **Sale Type**, **Payment Methods** (tags), **Payment Status**.
- **Notes:** with **Edit** or **Add note**. This is the only part of a sale you can change.
- **Sale Items** table: **Product**, **Batch** (batch number and **Exp**), **Unit Price**, **Unit Price (Sold)**, **Quantity**, **Returned** (a tag such as "x of y"), **Avg Disc**, **Special Disc**, **Promo Disc** (tag), **Tax** (inc or exc), **Total**.
- **Payment Details**: **Payment Method**, **Amount**, **Reference**, **Notes**, **Date**.
- **Payment Summary** on the right: **Subtotal**, **Promo Discount**, **Average Discount**, **Special Discount**, **Total Discount**, **Shipping**, **Tax**, **Total**, **Total Paid**, **Due** or **Change**, **Payment Status**, and **Payment Breakdown:**.

### How to add or change the note on a sale

![Sale page](images/consumer/sale-detail-d.png)

*A part-paid sale. Payment Summary shows Total Paid, Due and Payment Status.*

![Sale page lower part](images/consumer/sale-detail-bottom-d.png)

*Sale Items with batch numbers, and Payment Details.*

![Edit note](images/consumer/sale-detail-note-edit-d.png)

*The note box with Save and Cancel.*

![Print menu](images/consumer/sale-detail-print-menu-d.png)

*The arrow next to A4 Preview opens the slip menu.*

![Print agent offline](images/consumer/sale-detail-print-agent-offline-d.png)

*Print Receipt with the print agent not running.*

![Sale converted from a quotation](images/consumer/sale-detail-from-quotation-d.png)

*A sale created from a quotation shows a card with a link to the quotation.*

1. Next to **Notes:**, tap **Edit** (or **Add note** if there is none; it says "No note added").
2. Type in the box (placeholder "Add a note for this sale"). The limit is 2000 characters.
3. Tap **Save**, or **Cancel**.

**What happens next:** "Note updated". If it fails you see "Failed to update the note". You cannot edit the note of a deleted sale.

### How to fix a mistake on a sale

A saved sale cannot be edited, except for the note. To fix a mistake, either make a return (see **Create Return**) or delete the sale (see **View Sales**).

---

## View Returns

### What it is

The list of all returns, titled **Returns Management**.

### Where to find it

Left menu: **Sales**, then **View Returns**. Permission needed: **sales**.

### What you see

![Returns Management](images/consumer/returns-d.png)

*The Returns Management list.*

- Cards: **Total Returns**, **Total Refunded**, **Total Exchanged**, **This Month**.
- Filters: a search box "Search by return # or sale #...", a branch list "Select branch", and a date range. **Clear Filters** appears when a filter is on.
- Button **Create Return**.
- Columns: **Return #**, **Original Sale** (a link, with the customer), **Branch**, **Exchange Sale**, **Return Date**, **Items Count**, **Total Refund**, **Total Exchange**, **Reason**, **Processed By**, **Actions**.
- Actions: a PDF icon (tooltip **Preview PDF Receipt**) and a blue eye (opens the return).
- At the bottom: "a-b of N returns".

**PDF window** (titled "Return (number)"): **Close**, **Print** and **Download** (the file is named return- followed by the number, ending in .pdf). If it cannot load: "Failed to load the PDF".

### How to find a return and see its receipt

![Returns list](images/consumer/returns-list-d.png)

*The returns list with refund and exchange amounts.*

1. Type the return or sale number in the search box, or set the branch and dates.
2. Tap the PDF icon to preview the receipt. Tap **Print** or **Download** in the window.
3. Tap the eye to open the full return.

---

## Create Return

### What it is

Use it when a customer brings goods back, or swaps them for other goods.

### Where to find it

Left menu: **Sales**, then **Create Return**. Or tap **Create Return** on the **Returns Management** page. Permission needed: **sales**.

### What you see

![Create Return](images/consumer/returns_new-d.png)

*The Create Return page before a sale is loaded.*

**Sale Information**

| Field | Required | Notes |
| --- | --- | --- |
| **Processing Branch** | Yes | "Please select branch". Help text: the branch where this return will be processed (affects inventory). Returned goods go back into this branch's stock. |
| **Sale Number** | Yes | "Please enter sale number". Example format SAL-20250926-0001. Tap **Search** to load it. |
| **Return Type** | No | **Return Only** (default) or **Exchange**. |
| **Exchange Sale Number** | Yes, for Exchange | "Exchange Sale Number is required when return type is Exchange". Tap **Search Exchange** to load it. When it is loaded you see **✓ Exchange Sale Loaded**. |

For an exchange, first make the exchange sale as a normal separate sale, at the same branch as the return.

**After you load a sale**

- A blue box shows **Sale**, **Customer** and **Date**.
- **Financial Summary (For Manual Calculation)**: **Subtotal**, **Discount**, **VAT**, **Shipping**, **Final Total**, **Available Amount**, **Received (Tendered)** with methods, **Change Given**, **Net Paid (Used in Sale)**.
- **Previous Returns for this Sale**: **Total Returns**, **Already Refunded**, **Already Exchanged**, **Total Returned** and a **Return History** list.
- A green box **Exchange Sale Summary** once the exchange sale is loaded.

**Sale Items** table

| Column | Notes |
| --- | --- |
| **Product** | The item. |
| **Sold Qty** | Quantity sold. |
| **Available** | Sold, minus already returned, minus what you selected now. |
| **Unit Price** | Price per unit. |
| **Tax** | Tax. |
| **Discount** | Shown as A (average), S (special) and P (promo). |
| **Line Total** | The line total. |
| **Add to Return** | **-** and **+** buttons. You cannot go above Available. |

**Items to Return** table: **Product**, **Quantity** (you can edit), **Tax**, **Discount**, **Net Return**, **Actions** (trash). Under it, **Return Calculation Summary**: **Gross**, **Tax**, **Avg Disc**, **Special Disc**, **Promo Disc**, **Net Return**, **Shipping Refund**, **Total Return Value**. The refund for each item is its share of the original line total (with tax, after its discounts) for the quantity you return.

**Return Details**

| Field | Required | Notes |
| --- | --- | --- |
| **Reason for Return** | No | Placeholder "Select reason". Options: Defective, Wrong Item, Customer Request, Quality Issue, Other. |
| **Notes** | No | Placeholder "Additional notes...". |
| **Shipping Refund Amount (Optional)** | No | Help text "Maximum refundable shipping: (amount)". You can return shipping alone. Then you see "No item selected. This return will refund shipping only." |

**Payments & Exchanges** (marked "At least one payment is required")

Tap **Add Payment**. A window **Add Payment** opens:

| Field | Required | Notes |
| --- | --- | --- |
| **Payment Method** | Yes | "Please select payment method". Options: CASH, CARD, CHEQUE, BANK TRANSFER, MOBILE MONEY, MFS, CREDIT, EXCHANGE. |
| Provider | Yes, for Card, Bank Transfer and MFS | "Please select a provider". |
| **Amount** | Yes | "Please enter amount". "Amount must be greater than 0". It starts with the amount still left. |
| **Reference** | No | Placeholder "Transaction reference...". |

Buttons **Cancel** and **Add Payment**. The panel shows **Total Payments**, **Item return value**, **Shipping refund value**, **Selected return value**, **Available sale balance**, and a red line "Payment total must exactly match selected return value." until the amounts match. Use the method **EXCHANGE** for the part that is settled by the exchange sale.

**Checklist and buttons**

The page shows a checklist: "Sale selected and loaded", "At least one item selected or shipping refund entered", "Processing branch selected", "At least one payment method added", "Payment amount matches selected return value (x)" (or "Payment amount must match selected return value. Entered x, expected y"), and for exchanges "Exchange sale loaded (required for Exchange returns)". **Create Return** stays greyed out until every line is ticked. **Cancel** leaves the page.

### How to return goods and refund the customer

![Sale loaded](images/consumer/returns-new-sale-loaded-d.png)

*After Search the sale, the Financial Summary and the Sale Items show.*

![Add Payment errors](images/consumer/returns-add-payment-errors-d.png)

*Add Payment pressed with empty boxes.*

![Payment does not match](images/consumer/returns-new-mismatch-d.png)

*A payment of 50 against a return value of 105 keeps Create Return greyed out.*

![Ready to create](images/consumer/returns-new-ready-d.png)

*Every checklist line is ticked and Create Return is blue.*

1. Choose the **Processing Branch**.
2. Type the **Sale Number** and tap **Search**. You see "Sale (number) loaded successfully!".
3. Leave **Return Type** as **Return Only**.
4. In **Sale Items**, tap **+** under **Add to Return** for each item and quantity coming back.
5. Choose a **Reason for Return** and write **Notes** if you want.
6. If shipping is also refunded, type **Shipping Refund Amount (Optional)**.
7. Tap **Add Payment**. Choose the **Payment Method**, the provider if asked, and the **Amount**. The amounts must add up exactly to the **Selected return value** (a difference of 0.01 is allowed).
8. Check that every line in the checklist is ticked.
9. Tap **Create Return**.

**What happens next**

- "Return created successfully!" appears and the return opens.
- **Stock:** the returned goods go back into stock at the **Processing Branch**.
- The sale stays in the list and gets a **RETURNED** or **PARTIAL RETURN** tag. The sale itself is not changed.
- A return is final. You cannot edit or delete it in the app.
- **Reward points:** this was not checked, so do not count on points being changed by a return.

### How to do an exchange

1. First make the new sale for the goods the customer takes. Use **New Sale** or the POS, at the same branch.
2. Open **Create Return** and choose the **Processing Branch**.
3. Enter the original **Sale Number** and tap **Search**.
4. Set **Return Type** to **Exchange**.
5. Type the **Exchange Sale Number** and tap **Search Exchange**. You see "Exchange Sale (number) loaded successfully!" and **✓ Exchange Sale Loaded**.
6. Pick the returned items, as above.
7. Tap **Add Payment**, choose **EXCHANGE** for the part covered by the exchange sale, and add any other method for a cash refund. The total must match the selected return value.
8. Tap **Create Return**.

**What happens next:** the return shows the exchange sale and the **Total Exchange** value. Stock of returned goods goes back in.

### Messages on Create Return

| Message | What it means | What to do |
| --- | --- | --- |
| Please enter a sale number | The Sale Number box is empty. | Type it. |
| Sale not found. Please check the sale number. | No such sale. | Check the number. |
| Error searching for sale: (text) | The search failed. | Try again. |
| Please enter an exchange sale number | The Exchange Sale Number box is empty. | Type it. |
| Please select a processing branch first | No branch chosen. | Choose a branch. |
| Exchange sale is from a different branch. Please select an exchange sale from the same processing branch. | The exchange sale was made at another branch. | Use an exchange sale from the same branch. |
| Exchange sale not found. Please check the sale number. | No such exchange sale. | Check the number. |
| Please select a sale first | You have not loaded a sale. | Search a sale first. |
| Please select at least one item or add a shipping refund amount | Nothing is selected. | Pick an item or enter a shipping refund. |
| Please add at least one payment method to process the return | No payment row. | Tap **Add Payment**. |
| All payment amounts must be greater than 0 | A payment row is 0. | Remove it or fix the amount. |
| Selected return amount must be greater than zero | The return is worth nothing. | Pick items to return. |
| Total payment amount must exactly match selected return value. Expected x, got y. | The payments do not add up. | Change the amounts. |
| Total payment amount (x) exceeds selected return value (y). Please adjust your payment amounts. | Payments are too high. | Lower them. |
| Selected return value (x) exceeds available amount (y). Reduce return quantities. | You are returning more than the sale allows. | Lower the quantities. |
| Shipping refund amount (x) cannot exceed remaining refundable shipping (y). | Too much shipping refund. | Lower it. |
| Return quantity exceeds available quantity for item N. Available: a, Requested: b | You asked to return more than was sold less earlier returns. | Lower the quantity. |
| Another return was recorded for this sale at the same time. Please reload the sale and try again. | Someone else returned goods on this sale a moment ago. | Reload the sale and try again. |
| Insufficient stock for exchange item (...) | The exchange goods are not in stock. | Check stock of the exchange sale. |
| Return created successfully! | The return was saved. | Nothing. |

A line can only be returned up to the quantity sold minus earlier returns. The total returned cannot be more than the sale amount.

---

## Return page (Return #number)

### What it is

The full detail of one return.

### Where to find it

On **View Returns**, tap the eye. It also opens after you create a return. Permission needed: **sales**. If the return does not exist you see a red **Return not found**.

### What you see

- Buttons: **Back to Returns**, **Preview Return Receipt** (opens the PDF window) and **Print Thermal Receipt** (uses the print agent).
- **Return Information**: **Return Number**, **Return Date**, **Total Refund**, **Total Exchange**, **Original Sale** (link), **Exchange Sale** (link), **Customer**, **Processed By**, **Notes**.
- **Returned Items**: **Product**, **Quantity Returned**.
- **Refund Payments**: **Method**, **Reference**, **Payment Type**, **Amount**, and **Total Refunded**.
- **Exchange Items**: **New Product**, **Quantity**, **Unit Price**, **Total**, and **Total Exchange Value**.

### How to print a return receipt

![Return page](images/consumer/return-detail-d.png)

*A return with its refund payment.*

![Return print agent offline](images/consumer/return-detail-print-offline-d.png)

*Print Thermal Receipt with the print agent not running.*

1. Open the return.
2. Tap **Preview Return Receipt** and then **Print** or **Download** in the window, or tap **Print Thermal Receipt**.

**Messages:** "Return receipt sent to printer!" means it worked. If the print agent is not running you see the "Printing agent is not running" message from the POS section. "Failed to print return receipt. Please check your connection." means the request did not go through.

---

## View Quotations

### What it is

A quotation is a price offer for a customer. Saving one does not touch stock, take payment or give points. The list is titled **Quotations**.

### Where to find it

Left menu: **Sales**, then **View Quotations**. Permission needed: **quotations**. The **New Quotation** button at the top right starts a new one.

### What you see

![Quotations list](images/consumer/quotations-d.png)

*The Quotations list.*

- Cards: **Total Quotations**, **Total Value**, **Average Value**.
- Filters: search "Search by quotation number, customer...", **Filter by branch**, **Filter by status** (Pending, Converted), a date range, and **Clear All Filters**.
- Columns: **Quotation #** (link), **Date**, **Customer** (or "Walk-in"), **Branch**, **Price Type** (Regular or Wholesale), **Total Amount**, **Status** (Pending or Converted), **Created By**, **Served By**, **Actions**.
- Actions: **View Quotation**, **Convert to Sale** (it says **Already Converted** and is greyed out if done), **Copy Quotation**, **Preview PDF Quotation** (a window with **Close**, **Print**, **Download**; the file is named quotation- followed by the number, ending in .pdf).
- Bottom: "Total N quotations".

### How to find, preview or copy a quotation

![Quotations list](images/consumer/quotations-list-d.png)

*The quotations list. A converted quotation has its Convert button greyed out.*

1. Use the search box or filters.
2. Tap **Preview PDF Quotation** to see the PDF. Use **Print** or **Download**.
3. Tap **Copy Quotation** to start a new quotation from this one.

---

## New Quotation

### What it is

A page to write a price offer. The same page is used to copy an old quotation. When you copy, the title is **Copy Quotation**.

### Where to find it

Left menu: **Sales**, then **New Quotation**. Permission needed: **quotations**.

### What you see

![New Quotation](images/consumer/add-quotation-d.png)

*The New Quotation page. It looks like New Sale, without payments.*

| Field | Required | Notes |
| --- | --- | --- |
| **Branch** | Yes | The branch. |
| **Customer** | No | With a **+** button to add one. |
| **Served By** | No | Staff. |
| **Price Type** | No | **Regular** or **Wholesale**. |
| **Product Selection** | Yes, at least one item | Search and pick products. |
| **Quotation Items** table | | **Special Disc** here is a plain number box. There is no **Per qty** switch. |
| **Average Type** | No | **Fixed** or **Percent**. |
| **Average Discount** | No | Order discount. |
| **Shipping** | No | Shipping charge. |
| Totals | | **Subtotal**, **Tax**, **Promo Discount**, **Average Discount**, **Special Discount**, **Shipping**, **Total**. |
| **Notes** | No | Placeholder "Optional notes about this quotation". |
| **Cancel** | | Leaves without saving. |
| **Save Quotation** | | Greyed out until there is at least one item. |
| **Promotions** | | The round tag button opens **Available Promotions**. |

### How to create a quotation

![New Quotation filled](images/consumer/add-quotation-filled-d.png)

*A quotation with two items and a customer.*

1. Choose the **Branch**.
2. Choose the **Customer**, **Served By** and **Price Type** if you want.
3. Add products under **Product Selection**.
4. Set discounts and **Shipping** if needed.
5. Write **Notes** if you want.
6. Tap **Save Quotation**.

**What happens next:** "Quotation created successfully!" and the quotation opens. Stock does not change. No payment is taken and no points are earned. It is kept as due with 0 paid. If you forget items you see "Please add at least one item to the quotation". If it fails you see "Failed to create quotation".

### How to copy a quotation

1. On **View Quotations** or on the quotation page, tap **Copy Quotation**.
2. The items and discounts of the old one load, at today's prices and with tax worked out again.
3. Change what you need and tap **Save Quotation**.

---

## Quotation page (Quotation #number)

### What it is

The full detail of one quotation. A quotation cannot be edited. Copy it instead.

### Where to find it

On **View Quotations**, tap the quotation number or **View Quotation**. Permission needed: **quotations**. If it cannot load, you see "Failed to load quotation details".

### What you see

- Buttons: **Back to Quotations**, **Copy Quotation**, **Preview PDF**, **Convert to Sale** (**Already Converted**, greyed out, if done).
- For a converted quotation, a card "This quotation has been converted to a sale" with "Converted on: (date)" and **View Sale →**.
- **Quotation Details**: **Quotation Number**, **Date**, **Branch**, **Created By**, **Customer** (with phone and email), **Served By** ("Self Served" if none), **Price Type**, **Status** (Converted or Pending), **Notes**.
- **Items** table: **Product**, **Unit Price**, **Unit Price (Sold)**, **Quantity**, **Avg Disc**, **Special Disc**, **Promo Disc**, **Tax**, **Line Total**.
- **Summary**: **Subtotal**, **Tax**, the discounts, **Total Discount**, **Shipping**, **Total**.
- **Actions** card with a large **Convert to Sale** button.

### How to convert a quotation to a sale

![Quotation page](images/consumer/quotation-detail-d.png)

*A new quotation with Convert to Sale at the top and in the Actions card.*

1. Tap **Convert to Sale**.
2. The **New Sale** page opens with everything filled in.
3. Take payment and tap **Create Sale**.

**What happens next:** the quotation shows **Converted**. Stock goes down now, using current stock and current prices. See **New Sale** for more.

---

## Due Payments

### What it is

The list of sales that are not fully paid. You collect the rest here.

### Where to find it

Left menu: **Sales**, then **Due Payments**. Permission needed: **sales**. A sale appears here when a POS or New Sale sale was saved with less than the total paid.

### What you see

![Due Payments](images/consumer/partial-payments-d.png)

*The Due Payments list. Each row has a **Pay** button.*

- Cards: **Sales With Due Payments** (count), **Total Received**, **Total Remaining** (in BDT). These add up the rows on the current page only.
- A card titled **Sales With Due Payments** with **Clear Filters**.
- Filters: search "Search by sale number, customer", a date range, **Filter by branch** (only if you have more than one branch), and **Payment Status** with **All (Due & Partial)**, **Due Only**, **Partial Only**.
- Columns: **Sale Number**, **Date**, **Customer**, **Branch**, **Total Amount**, **Received**, **Remaining**, **Status** (**DUE** in red, **PARTIAL** in orange), **Actions**.
- Actions: **View Sale** (eye) and **Make Payment** (a **Pay** button).
- Bottom: "Total N sales" and page sizes 10, 20, 50, 100.

### How to find a sale that owes money

![Due Payments list](images/consumer/due-payments-list-d.png)

*Sales still owing money. DUE sales have nothing received yet.*

1. Type a sale number or customer name, or set dates, branch and **Payment Status**.
2. Tap **Clear Filters** to reset.

---

## Make Payment (Make Payment - Sale #number)

### What it is

The page where you record money received on an unpaid sale.

### Where to find it

On **Due Payments**, tap **Pay**. Permission needed: **sales**. Tap **Back to Due Payments** to leave.

### What you see

**Left**

- **Sale Information**: **Sale Number**, **Sale Date**, **Customer**, **Branch**, a status tag, **Total Amount**, **Received Amount**, **Remaining Amount**.
- **Payment History**: **Date**, **Method**, **Amount**, **Reference**, **Notes**, and a printer icon (tooltip **Download money receipt for this payment**). The file is named money-receipt, the sale number and the payment number, ending in .pdf. If it fails: "Failed to download money receipt".

**Right: Record New Payment**

- **Payment Methods** with **Add Payment Method**.
- Each row: **Method** (Cash, Card, Cheque, Bank Transfer, Mobile Money, MFS, Credit, Exchange), **Amount** (starts at the remaining amount), **Reference**, and a delete button.
- **Total Payment Amount** and **Remaining After Payment**.
- Buttons **Record Payment** and **Cancel**.

> **Good to know:** On this page the status tag always says **PARTIAL**, even when nothing has been paid yet and the list shows **DUE**. Trust the **Received Amount** and **Remaining Amount** numbers. Also, this page has no bank or MFS list. Pick the method and type the **Reference** (for example the transaction number) yourself.

### How to collect a payment on a due sale

![Make Payment](images/consumer/make-payment-d.png)

*The Make Payment page. Amount starts at the remaining amount.*

![Amount too high](images/consumer/sale-due-payment-exceeds-d.png)

*An amount above the remaining amount is refused.*

![Payment recorded](images/consumer/sale-due-payment-success-d.png)

*After Record Payment the list shows again with the success message.*

1. On **Due Payments**, find the sale and tap **Pay**.
2. Check **Remaining Amount**.
3. Tap **Add Payment Method** if there is no row yet.
4. Choose the **Method** and check the **Amount**. Change it if the customer pays only part.
5. Type a **Reference** if you have one.
6. Check **Remaining After Payment**.
7. Tap **Record Payment**.

**What happens next**

- "Payment recorded successfully!" appears and you go back to the list.
- **Customer due:** the **Remaining** amount goes down. When it reaches 0, the sale becomes **PAID** and leaves the list.
- The collected figures on the dashboard and end of day update.
- You can download a money receipt for each payment from **Payment History**.
- Overpaying is not allowed.

| Message | What it means | What to do |
| --- | --- | --- |
| Please add at least one payment method | No payment row. | Tap **Add Payment Method**. |
| Total payment amount must be greater than 0 | The amount is 0. | Type an amount. |
| Total payment amount (x) exceeds remaining amount (y) | More than is owed. | Lower the amount. |
| Sale is already fully paid | Someone already paid it all. | Go back to the list. |
| Cannot make payment on cancelled sale | The sale is cancelled. | Nothing can be paid. |
| Failed to record payment | The payment did not save. | Check the connection and try again. |
| Failed to load sale details | The sale could not load. | Go back and open it again. |
| Payment recorded successfully! | It worked. | Nothing. |

---

## Disc. & Promo

### What it is

The screen where you create and manage promotions (discount offers). Its page title is **Discount & Promo**. Cashiers then apply them on the POS or New Sale.

### Where to find it

Left menu: **Sales**, then **Disc. & Promo** (hover to see "Discount & Promotions"). Permission needed: **sales**.

### What you see

![Discount & Promo](images/consumer/promotions-d.png)

*The promotions list.*

- Button **Add Promotion**.
- Table columns: **Name**, **Description**, **Type** (SINGLE_PRODUCT in blue, BUNDLE in purple, BRAND in gold), **Discount** (a percent or an amount), **Valid** (start date to end date, or "No End"), **Status** (ACTIVE or INACTIVE), **Used Sales**, **Total Discount**, **Actions**.
- Actions: a pencil to edit and a trash button to delete.
- Bottom: "a-b of N promotions". If it cannot load: "Failed to load promotions".

### The promotion form

![Promotions list](images/consumer/promotions-list-d.png)

*The promotion list with active, inactive and expired promotions.*

![Add Promotion errors](images/consumer/promotion-add-errors-d.png)

*Create Promotion pressed with empty required boxes.*

![Brand scope](images/consumer/promotion-scope-brand-d.png)

*Scope Brand shows a Brand list instead of Variant.*

![Bundle scope](images/consumer/promotion-scope-bundle-d.png)

*Scope Bundle shows Bundle Variants.*

![Fixed Amount](images/consumer/promotion-fixed-amount-d.png)

*Discount Type Fixed Amount. The automatic description says BDT off per eligible item.*

Tap **Add Promotion** (or the pencil, which shows **Update Promotion**). A side window opens.

| Field | Required | Notes |
| --- | --- | --- |
| **Promotion Name** | Yes | "Name is required". Example: "Weekend Combo Offer". |
| **Description (Auto)** | No | Read-only. The app writes a sentence that sums up your rules. |
| **Scope** | Yes | **Single Product** (default), **Bundle**, **Brand**. |
| **Discount Type** | Yes | **Percentage** (default) or **Fixed Amount**. A fixed amount is taken off each eligible item. |
| **Discount Value** | Yes | Minimum 0.01. "Discount value is required". |
| **Min Purchase** | No | The cart value needed. |
| **Usage Limit** | No | How many times in total the promotion can be used. |
| **Cap Quantity** | No | The most units in one sale that get the discount ("Per-sale qty cap"). |
| **Closing Discount Amount** | No | "Global close amount". The promotion closes once the total discount given reaches it. |
| **Cap Discount Amount** | No | "Per-sale cap". |
| **Member Promo Only** | No | A switch. Only registered customers get it. |
| **Limit Per Customer** | No | A switch. |
| **Customer Usage Limit** | Yes, if **Limit Per Customer** is on | "Usage limit is required". |
| **Daily Reset** | No | A switch. Needs **Limit Per Customer**. |
| **Start Date** | Yes | The first day. |
| **End Date** | No | Leave empty for no end. |
| **Brand** | Yes, for Brand scope | "Select a brand". |
| **Variant** | Yes, for Single Product scope | "Select a variant". |
| **Bundle Variants** | Yes, for Bundle scope | "Select bundle variants". You can pick many. |
| **Min Quantity** | No | Starts at 1. |
| **Auto Apply** | No | A switch. The promotion is applied by itself when the cart qualifies. |
| **Active** | No | A switch, on by default. |
| **Branch Specific** | No | A switch. |
| **Branches** | Yes, if **Branch Specific** is on | "Select at least one branch". |

Button: **Create Promotion** or **Update Promotion**.

### How to create a promotion

1. Tap **Add Promotion**.
2. Type the **Promotion Name**.
3. Choose the **Scope**, **Discount Type** and **Discount Value**.
4. Pick the **Brand**, **Variant** or **Bundle Variants** that match the scope.
5. Set the **Start Date** and, if you want, the **End Date**.
6. Set any limits and switches you need.
7. Tap **Create Promotion**.

**What happens next:** "Promotion created successfully" and it shows in the list. Cashiers can then see it under **Promos** on the POS and New Sale. If **Auto Apply** is on, it is applied by itself when the cart qualifies. Stock and customer balances do not change.

### How to edit a promotion

1. Tap the pencil on the row.
2. Change the fields.
3. Tap **Update Promotion**. You see "Promotion updated successfully".

### How to delete a promotion

1. Tap the trash button.
2. A box asks **Delete this promotion?** "This action cannot be undone." Tap **Yes** or **No**.
3. You see "Promotion deleted successfully".

### How the discount is worked out

- A percentage is taken from the product base price, which does not include tax.
- A fixed amount is taken off each eligible item.
- A discount never goes above the value of the line.
- When there is a quantity cap, it applies to the highest priced units first.

### Messages on promotions

| Message | What it means | What to do |
| --- | --- | --- |
| Promotion created successfully / Promotion updated successfully / Promotion deleted successfully | It worked. | Nothing. |
| Failed to create promotion / Failed to update promotion / Failed to delete promotion | It did not save. | Check the fields and the connection, then try again. |
| Please select product variant(s) | No variant chosen. | Pick a variant or bundle variants. |
| Please select a brand | No brand chosen. | Pick a brand. |
| The end date must be after the start date. | Dates are wrong. | Fix the dates. |
| The cap quantity must be at least the minimum quantity. | Cap is below the minimum. | Raise the cap or lower the minimum. |
| The cap discount amount cannot be greater than the maximum discount amount. | Per-sale cap is too high. | Lower it. |
| A customer usage limit is required when the promotion is limited per customer. | **Limit Per Customer** is on with no limit. | Type a **Customer Usage Limit**. |
| Daily reset of customer usage requires the promotion to be limited per customer. | **Daily Reset** is on without **Limit Per Customer**. | Turn on **Limit Per Customer** or turn off **Daily Reset**. |
| Select at least one product for a single-product or bundle promotion. | No product chosen. | Pick products. |
| Select a brand for a brand promotion. | No brand. | Pick a brand. |
| Brand promotions apply to a whole brand; remove the selected products. | Products are chosen on a brand promotion. | Remove the products. |

**Reasons a cashier may see when a promotion will not apply**

| Message | What it means |
| --- | --- |
| Promotion is inactive | **Active** is off. |
| Promotion has not started yet | Before the **Start Date**. |
| Promotion has already expired | After the **End Date**. |
| Promotion is not available for selected branch | The promotion is limited to other branches. |
| Promotion usage limit reached and promo closed | The **Usage Limit** is used up. |
| Promotion max discount reached and promo closed | The **Closing Discount Amount** is reached. |
| This promotion is for registered customers only | **Member Promo Only** is on. |
| Select a registered customer to apply this promotion | The sale has no customer. Choose one. |
| Cart is empty | Add products first. |
| Minimum purchase amount condition not met | The cart is below **Min Purchase**. |
| Minimum quantity N not met | The quantity is below **Min Quantity**. |
| No matching brand products found in cart | No product of that brand in the cart. |
| Required product is not present in cart | The promoted product is not in the cart. |
| Bundle conditions are not matched in cart | Not all bundle products are in the cart. |
