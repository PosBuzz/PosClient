# Part 2 - Products and catalogue

This part explains everything in the **Products** group of the side menu. You use these screens to list what you sell, set prices, group items, print barcode stickers, check how stock moved, and see which items sell best.

## Products, variants and batches in plain words

Three words come up all the time in this part.

- **Product.** The thing you sell, for example "T-shirt" or "Basmati Rice 5kg". A product has a name, an optional code, a category, a brand, tags and a tax rate.
- **Variant.** One version of a product. A T-shirt may have the variants Small, Medium and Large. Each variant has its own price, SKU (your stock code), barcode, units, image and stock. A product with only one version is called a **simple product**. Behind the scenes it still has one variant, which uses the product name.
- **Batch.** One delivery of stock for one variant in one branch. A batch has a quantity, a cost price, and optionally an expiry date, a vendor and a shelf location. You may have many batches of the same variant, bought at different prices or with different expiry dates.

Example: "T-shirt" is the product. "Large" is a variant. 20 pieces of "Large" bought from a vendor on one day for BDT 300 each is a batch.

**Who can see what.** Every screen needs a permission. If your user does not have it, the menu item is hidden. If you open the address by hand, the app sends you back to the Dashboard without a message. Ask your shop owner to change your permissions if you cannot see a screen you need. The Products menu group has these items:

| Menu item | Permission needed |
|---|---|
| Add Product | Add products |
| View Products | View products |
| Sales Stats | Business insights |
| Product Audit | Product audit |
| Categories | Edit products or add products (either one) |
| Brands | Edit products or add products (either one) |
| Tags | Edit products or add products (either one) |
| Units | Edit products or add products (either one) |
| Barcode Printing | Add products |

Hover over **View Products** to see the tip "All Products". Hover over **Sales Stats** to see the tip "Variant Sales Stats".

**Messages.** Short messages appear at the top of the screen. When the server gives a clear reason, the app shows it. Otherwise you see one of these general messages:

| Message | What it means | What to do |
|---|---|---|
| Your session has expired. Please log in again. | You were logged out. | Log in again. |
| You don't have permission to do this. | Your user is not allowed this action. | Ask the owner for the permission. |
| That item could not be found. It may have been deleted. | Someone removed it. | Go back and refresh the list. |
| Too many attempts. Please wait a minute and try again. | You tried too often. | Wait one minute, then try again. |
| Can't reach the server. Check your connection and try again. | No internet. | Check your connection. |
| The request timed out. Please try again. | The server was too slow. | Try again. |

Money is shown as "BDT 1,234.00". Dates on these screens look like "Oct 24, 2026".

---

## Products

### What it is

The list of every product in your shop. You search, filter, view, edit, copy and delete products from here.

### Where to find it

Menu: **Products > View Products**. You need the permission to view products. The buttons at the top right (**Export**, **Add Product**, and the product limit tag) show only if you also have the permission to add products.

![Products](images/consumer/products-d.png)
*The Products list with search, filters and row buttons.*

### What you see

**Top right** (only with the add products permission):

- **Product limit tag.** Shown only if your plan has a product limit. It reads like "48 / 50 products". It is blue normally and turns red when you reach the limit.
- **Export** button. It opens a list with one choice, **Export as PDF**.
- **Add Product** button. If your plan limit is reached, the button is greyed out. Hover over it to read: "Your {plan name} plan allows {max} products. Upgrade your plan to add more." If the plan has no name, it says "Your current plan allows ..." instead.

**Filter row:**

- A search box with the text **Search products...**. It has a small x to clear it. The list updates half a second after you stop typing.
- **Select Categories**. Pick one or more categories.
- **Select Brands**. Pick one or more brands.
- **Select Tags**. Pick one or more tags.
- A counter such as "6 products found".
- **Clear all filters**. This link shows only when a search or filter is active.

**Active filters row.** When a search or filter is on, a line starting "Active filters:" shows small chips: `Search: "text"`, `Category: name`, `Brand: name`, and a blue chip with a tag icon for each tag. Click the x on a chip to remove only that filter. Any filter change takes you back to page 1.

**Table columns:**

| Column | What it shows |
|---|---|
| Product | A small picture (or a gear icon if there is no image), the name in bold, "Code: ..." (or "Code: No code"), the first 60 characters of the description, and up to 3 blue tag chips. If there are more tags, a "+N" chip shows the rest. |
| Category | The category name, or a grey "No category". |
| Brand | The brand name, or a grey "No brand". |
| Tax | The rate, such as "5%", with the tax method under it (Exclusive or Inclusive). |
| Created | The date and time the product was added. |
| Actions | Four small icon buttons, described below. |

**Row buttons.** Hover over an icon to see its name.

| Icon | Name | Who can use it |
|---|---|---|
| Eye | View Details | Everyone who can view products |
| Blue pencil | Edit Product | Edit products permission |
| Copy | Copy Product | Add products permission |
| Red bin | Delete Product | Delete products permission |

**Bottom.** The page shows "1-6 of 6 products", page buttons, a page size choice (10, 20, 50 or 100 per page; the default is 10) and a box to jump to a page.

![Products list with demo data](images/consumer/products-list-data-d.png)
*The Products list for PosBuzz Demo Mart, with tags under product names.*

![Products list after searching](images/consumer/products-search-active-d.png)
*Searching for a word shows only matching products.*

![Category filter open](images/consumer/products-category-dropdown-d.png)
*The Select Categories list, where you tick one or more categories.*

![Products list with filters on](images/consumer/products-filters-active-d.png)
*A category and a tag chosen, shown as chips under Active filters.*

![Export menu](images/consumer/products-export-menu-d.png)
*The Export button opens one choice, Export as PDF.*

![Products list bottom](images/consumer/products-pagination-d.png)
*Page numbers, page size and the Go to box.*

![Page size choices](images/consumer/products-page-size-d.png)
*The page size list: 10, 20, 50 or 100 per page.*

![Products list page 2](images/consumer/products-page-2-d.png)
*Page 2 of the list.*

### How to find a product

1. Type part of the name in **Search products...**, or
2. Open **Select Categories**, **Select Brands** or **Select Tags** and tick what you want.
3. To remove one filter, click the x on its chip. To remove all of them, click **Clear all filters**.

**What happens next:** The list shows only matching products and the counter updates.

### How to see all details of a product

1. Find the product in the list.
2. Click the eye icon (**View Details**).

**What happens next:** The Product Details screen opens (see the next section).

### How to delete a product

1. Click the red bin icon (**Delete Product**).
2. In the small box that opens over the row, titled **Delete Product**, read "Are you sure you want to delete this product? This action cannot be undone."
3. Click **Yes**. Click **No** to keep the product.

![Delete product confirmation](images/consumer/products-delete-confirm-d.png)
*The Delete Product question with No and Yes buttons.*

**What happens next:** You see "Product deleted successfully". The product, all its variants and their stock records are removed, and the lists refresh.

> **Good to know:** A product that has already been sold (or returned or exchanged) cannot be deleted. You will see a message like "This product variant is still used by other records, so it can't be changed or deleted. Remove or reassign those first." The wording of the item name may differ.

### How to export the list as a PDF

1. Click **Export**.
2. Click **Export as PDF**.

**What happens next:** A file named `products.pdf` downloads to your computer. If it fails you see "Failed to export the list".

### How to copy a product

1. Click the copy icon (**Copy Product**) on the row.

**What happens next:** The Copy Product screen opens (see "Add Product, Edit Product and Copy Product" below).

### How to edit a product

1. Click the blue pencil icon (**Edit Product**).

**What happens next:** The Edit Product screen opens.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Product deleted successfully | The product was removed. | Nothing. |
| Failed to delete product | The product could not be removed and the server gave no reason. | Try again, or ask for help. |
| Failed to export the list | The PDF could not be made. | Try again. |
| Product limit reached: your {plan} plan allows {max} product(s) and you already have {used}. Upgrade your plan to add more products. | You cannot add more products on this plan. | Upgrade your plan or delete products you no longer sell. |
| This product variant is still used by other records, so it can't be changed or deleted. Remove or reassign those first. | The product has sales history. | Keep the product. You cannot delete it. |

---

## Product Details

### What it is

One page that shows everything about a single product: pictures, prices, tags, basic facts, its variants and where its stock is held.

### Where to find it

Open it from **Products > View Products** by clicking the eye icon on a row. You need the permission to view products. The header buttons need the matching edit, add and delete permissions.

### What you see

The browser tab reads "Product Details - {product name}". The path at the top is Dashboard > Products > Details.

**Header buttons (top right):**

- **Edit Product** (blue). Needs the edit products permission.
- **Copy Product**. Needs the add products permission.
- **Delete** (red). Needs the delete products permission.

**Left column, from top to bottom:**

1. **Image card.** The default variant's picture. Click it to enlarge. If there is none, you see a picture icon and "No Image Available".
2. **Pricing Information** card. It uses the default variant (or the first one) and shows:
   - **Regular Price**.
   - **Wholesale Price** (only if set).
   - **Tax Configuration**, such as "5% (EXCLUSIVE)", with "Final price: BDT x" under it. For exclusive tax the final price is the regular price plus the tax. For inclusive tax it is the regular price itself.
   - **Warranty**, such as "12 months" (only if set).
   - **Alert Quantity**, such as "10 units" (only if above 0).
   - If the product has more than one variant: the bold line "Price Range Across Variants:" and "Regular Price Range: BDT min - BDT max".
   - A small table titled **Units** with **Sale Unit** and **Purchase Unit**. Each shows the unit name and, in grey, its code, or "N/A".
   - If the product has no variant: "No pricing information available".
3. **Tags** card. Blue tag chips, or "No tags assigned".

**Right column:**

- **Basic information card.** The product name, then small status badges:
  - "Has Variants (n)" in purple, or "Simple Product" in blue.
  - "n in stock" in green, or "Out of stock" in red. This adds up all variants and all branches.
  - "available/total serials available" (only if the product has serial numbers).
  - "n variant(s) low stock" in red. A variant counts as low when, in any one branch, its stock is at or below its Alert Quantity.
  - "Expiring Stock" in orange. Shown when any batch expires within 30 days or has already expired.
- **Details table:** Product Code (or "N/A"), Category (or "Uncategorized"), Brand (or "No Brand"), Product Type ("Variable Product" or "Simple Product"), Total Variants, Tax Configuration, Price Range (variant products only), Daily Sales Target (such as "20 units/day"; only if above 0; for variant products it is the sum of all variants), Total Stock, Total Serials, Created, Last Updated.
- **Description.** Shown only if the product has a description.

**Tabs at the bottom.**

**Variants (n)** tab (opens first). A table with one row per variant:

| Column | What it shows |
|---|---|
| Image | A small picture or a "No Image" box. |
| Variant Details | Name, "SKU: ...", "Barcode: ...", and a blue chip "Warranty: n months" if set. |
| Pricing | "Regular: BDT x", "Wholesale: BDT y", and a green chip "Updated" when the price has changed before. Hover over it for "Price updated recently". |
| Units | "Sale: ..." and "Purchase: ..." ("N/A" if none). |
| Stock & Inventory | The stock as "n units" (red if any branch is at or below the alert level, green if in stock, grey if zero). A red alert icon with the tip "Low stock alert in one or more branches". "Alert: n". If the stock is in 2 or more branches, a chip such as "2 branches"; hover over it to see each branch and quantity. |
| Serials | A barcode icon with a count and "available/total available" (hover for Available, Sold, Defective and Returned counts), or "No serials". |
| Attributes | A purple chip "n attribute(s)" (hover to see each name and value), or "No attributes". |
| Actions | The button **View Stock**. It opens the stock page for that variant. |

Rows that have stock, attributes or price history show a + at the start. Click it to open extra panels: "Stock by Branch (n)", "Attributes (n)", "Recent Price Changes" (the latest 3 changes, each with a date and regular price) and "Expiring Stock (n)" (branch, quantity, expiry date and batch number). If there are no variants you see "No variants available".

**Inventory (n)** tab. Here n is the number of stock batch records. At the top are summary chips: "Total Stock: n units", "Branches: n", "Low Stock: n branches" (only if any) and "Expiring: n items" (only if any). Below is a table:

| Column | What it shows |
|---|---|
| Variant | The variant name. |
| Branch | The branch name (or "Main Branch"), with a green "Main" tag for the main branch. |
| Quantity | "n units". |
| Batch Number | The batch code, or "-". |
| Expiry Date | The date. Red with an "Expired" tag if past. Orange with an "Expiring Soon" tag if within 30 days. "No expiry" if none. |
| Vendor | The vendor name (hover for contact and phone), or "No vendor". |
| Added Date | The date the batch was added. |

The table shows 10 rows per page. If there are none: "No inventory records available".

**Error state.** If the product cannot be loaded (for example it was deleted), you see a card titled "Error" with "Failed to load product details. Please try again later." and the button **Return to Products**.

> **Good to know:** The "Low Stock" chip on the Inventory tab checks each batch row against the alert quantity, not the branch total. It can show a slightly different number from the "variant(s) low stock" badge, which checks the branch total.

> **Good to know:** The Pricing Information card shows only the default variant's prices. See the Variants tab for the other variants.

![Product Details for a product with variants](images/consumer/product-details-variants-d.png)
*Cotton Polo T-Shirt: image, pricing, tags, basic information and the Variants tab.*

![Expanded variant row](images/consumer/product-details-variant-expanded-d.png)
*A variant row opened to show Stock by Branch, Attributes and Recent Price Changes.*

![Inventory tab](images/consumer/product-details-inventory-tab-d.png)
*The Inventory tab with summary chips and one row per batch.*

![Product Details for a simple product](images/consumer/product-details-simple-d.png)
*Fresh Basmati Rice 5kg shows the Simple Product badge and one variant named Default.*

![Inventory tab of a simple product](images/consumer/product-details-simple-inventory-d.png)
*Three batches in three branches.*

A simple product shows the same cards. It has the badge **Simple Product**, a single variant called Default, and no Price Range lines.

### How to check stock in each branch

1. Open the **Variants** tab.
2. Click the + at the start of the row, or hover over the "n branches" chip.
3. To open the full stock page, click **View Stock**.

**What happens next:** You see the quantity per branch, or the variant stock page opens.

### How to delete a product from this page

1. Click **Delete**.
2. In the **Delete Product** box, read "Are you sure you want to delete this product? This action cannot be undone."
3. Click **Yes** (red). Click **No** to cancel.

**What happens next:** On success you go back to the Products list. No message is shown. If deleting fails, a box titled **Operation Failed** says "Failed to delete. Please try again later." and you stay on the page.

### How to edit or copy from this page

1. Click **Edit Product** or **Copy Product** in the header.

**What happens next:** The matching form opens.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Failed to load product details. Please try again later. | The product could not be opened. | Click **Return to Products**. |
| Operation Failed: Failed to delete. Please try again later. | The delete did not work. | Try again later. Products with sales history cannot be deleted. |

---

## Add Product, Edit Product and Copy Product

### What it is

One form with three uses. **Add Product** creates a new product with its price, units, optional variants and optional opening stock. **Edit Product** changes an existing product. **Copy Product** starts a new product from a copy of an old one.

### Where to find it

- Add: **Products > Add Product** in the menu, or the **Add Product** button on the Products list. Needs the add products permission.
- Copy: the copy icon on the Products list, or **Copy Product** on Product Details. Needs the add products permission.
- Edit: the pencil icon on the Products list, or **Edit Product** on Product Details. Needs the edit products permission.

![Add Product](images/consumer/products_add-d.png)
*The Add Product form, Basic Information tab.*

### What you see

The page title is **Add Product**, **Edit Product** or **Copy Product**. While an existing product loads, a full-page spinner shows.

Top right:

- **Cancel**. Goes back to the Products list without saving. It does not ask you to confirm, so anything you typed is lost.
- **Save Product** (when adding or copying) or **Update Product** (when editing). A spinner shows while it saves.

The form has two tabs:

- **Basic Information**
- **Details** (simple product) or **Variants (n)** (variant product)

#### Basic Information tab

Card **Product Details**:

| Field | Required | Notes |
|---|---|---|
| Product Name * | Yes | Hint "Enter product name". Must not already be used by another product in your shop. For a simple product, the name is copied to its single variant. |
| Product Code | No | Hint "Enter product code". The round arrow button next to it makes a code: the first 3 letters or digits of the name in capitals (padded with X), a dash and 6 random digits, such as "COC-482913". If the name is empty it starts with "PRD". Must not already be used in your shop. |
| Description | No | A text box with a counter. Up to 500 characters. Hint "Enter product description". |

Card **Classification**:

| Field | Required | Notes |
|---|---|---|
| Category | No | A searchable list with the hint "Select category" that you can clear. The gear button next to it (tip "Manage category") opens the category list. |
| Brand | No | Hint "Select brand". Gear button tip "Manage brand". |
| Tags | No | Pick several. Hint "Select tag". Gear button tip "Manage tag". The list closes after each pick. |

Card **Tax & Product Type**:

| Field | Required | Notes |
|---|---|---|
| Tax Method | Yes (always has a value) | **Exclusive** (the default) or **Inclusive**. |
| Tax Rate (%) | No | A whole number from 0 to 100. Empty counts as 0. |
| Product type switch | - | Off (default) reads "Simple product (single variant)". On reads "Variant product". |

Exclusive means the tax is added on top of the price when you sell. Inclusive means the price already contains the tax.

If you try to switch a saved variant product back to simple, the switch does not move and a warning says "Variant product cannot be converted back to simple product."

**The Manage pop-up.** The gear buttons next to Category, Brand, Tags, Sale Unit and Purchase Unit open a pop-up so you can fix the list without leaving the product. Below, {X} stands for Category, Brand, Tag or Unit.

- The pop-up is titled **Manage {X}**. It has a button **Add {X}** and a list of all items, each with a pencil and a bin. An empty list says "No {x} found".
- **Add {X}** opens a small form with one field, **{X} Name** (required, up to 100 characters). If you leave it empty: "Please enter {x} name". Click **OK** to save or **Cancel** to close. You see "{X} created successfully" and the new item is chosen for you (added to your picks for Tags).
- The pencil opens **Edit {X}** with the same field. You see "{X} updated successfully".
- The bin asks **Delete {X}** and "Are you sure you want to delete '{name}'?". Click **OK** (red) to confirm. You see "{X} deleted successfully", and the item is removed from the field if it was chosen.
- Failures show the server's reason or "Failed to create {X}", "Failed to update {X}" or "Failed to delete {X}".

> **Good to know:** This pop-up only manages names. A brand's logo and website can be set only on the **Brands** screen.

![Add Product, Basic Information, empty](images/consumer/add-product-simple-basic-empty-d.png)
*The empty Basic Information tab. The switch is off, so the product is simple.*

![Basic Information with an error](images/consumer/add-product-simple-basic-errors-d.png)
*Pressing Save Product with an empty name shows Product name is required.*

![Basic Information filled in](images/consumer/add-product-simple-basic-filled-d.png)
*Name, description, category, brand, tag and tax rate filled in.*

![Category list](images/consumer/add-product-category-dropdown-d.png)
*The Category list open.*

![Manage Category pop-up](images/consumer/add-product-manage-category-d.png)
*The pop-up opened by the gear button next to Category.*

![Add Category pop-up](images/consumer/add-product-manage-category-add-d.png)
*The small form to add a category without leaving the product.*

![Basic Information with the variant switch on](images/consumer/add-product-variant-basic-empty-d.png)
*With the switch on it reads Variant product and the second tab is called Variants (1).*

![Variant product, Basic Information filled](images/consumer/add-product-variant-basic-filled-d.png)
*The second tab now reads Variants (2).*

**Which tabs you see.** The tabs change with the switch.

| Mode | Tabs on the form |
|---|---|
| Add, simple product (switch off) | Basic Information, Details. Inside Details: one sub-tab called Details, and Add Inventory (n). |
| Add, variant product (switch on) | Basic Information, Variants (n). Inside Variants: Variant 1, Variant 2 and so on, each with its own Add Inventory (n). |
| Edit, simple product | Basic Information, Details. There is no Add Inventory part. |
| Edit, variant product | Basic Information, Variants (n) with Variant 1, Variant 2 and so on. There is no Add Inventory part. |

#### Details tab (simple product) and Variants tab (variant product)

For a variant product the top bar reads "Variants (n)" and has two buttons: **Copy & Add Variant** and **Add Variant**. Each variant has its own sub-tab called "Variant 1", "Variant 2" and so on. For a simple product the one sub-tab is called "Details". When there are two or more variants, each variant sub-tab has a red **Delete** button.

If any field has an error, a yellow box on this tab says **Please resolve validation errors before saving.**

Each variant has these fields:

| Field | Required | Notes |
|---|---|---|
| Variant Name * | Yes | Locked (greyed out) for a simple product, because it follows the product name. |
| SKU | No | Filled in for you. The reload button makes a new one. A simple product gets "PRO-" and 7 digits. A variant product gets 3 letters from the product name, "-SKU-" and 5 digits, such as "TSH-SKU-04721". Must not repeat inside the same product (capital and small letters count as the same). |
| Barcode | No | Filled in for you with a 13-digit number that starts with "123". The barcode button makes a new one. Must not repeat inside the same product. |
| Regular Price * | Yes | Taka sign, hint "0.00", two decimals. Must be above 0. |
| Wholesale Price | No | Taka sign, hint "0.00", two decimals. Cannot be negative. |
| Sale Unit * | Yes | Hint "Select unit". Gear button tip "Manage unit". |
| Purchase Unit * | Yes | Hint "Select unit". Gear button tip "Manage unit". |
| Alert Quantity | No | Bell icon, hint "10". Empty is saved as 0, which means no alert. |
| Daily Target | No | Target icon, hint "0". The number of units you aim to sell each day. It is used by the Daily Target report. |
| Warranty (months) | No | Hint "12". From 0 to 120. |
| Image | No | Click **Click to Upload**. One JPG or PNG file under 10 MB. After upload the file name shows with a way to remove it. |

![Details tab, empty](images/consumer/add-product-simple-details-empty-d.png)
*The Details tab of a simple product. The Variant Name is locked and the SKU and Barcode are filled in.*

![Details tab with errors](images/consumer/add-product-simple-details-errors-d.png)
*The yellow box, the red fields and the general message Failed to create product.*

![Details tab filled in](images/consumer/add-product-simple-details-filled-d.png)
*Prices, units, alert quantity, daily target and warranty filled in.*

![Variants tab, empty](images/consumer/add-product-variant-variants-empty-d.png)
*The Variants tab with Copy & Add Variant and Add Variant.*

![Second variant added](images/consumer/add-product-variant-second-added-d.png)
*After Add Variant there are two sub-tabs and a red Delete button.*

![Variants tab with errors](images/consumer/add-product-variant-errors-d.png)
*Required fields of a variant marked in red.*

![Delete variant question](images/consumer/add-product-variant-delete-confirm-d.png)
*The Delete variant question with Cancel and OK.*

#### Add Inventory sub-tab (opening stock)

This sub-tab is named **Add Inventory (n)**. It shows only when you add or copy a product, never when you edit. Use it to record the stock you already have.

- The heading is "Inventory" with a button **Add Inventory**.
- With no batches you see "No batches added. Add if you want initial stock."
- Each batch is a card with these fields:

| Field | Required | Notes |
|---|---|---|
| Branch * | Yes | Hint "Select branch". |
| Batch No * | Yes | Hint "Generate batch". The reload button fills in the last 6 digits of the current time. |
| Quantity * | Yes | A whole number, at least 1. Starts at 1. If you clear it, it goes back to 1. |
| Cost Price * | Effectively optional | Taka sign, two decimals. The price you paid for one unit. Starts at 0. Cannot be negative. |
| Profit % (Regular) | No | Greyed out until the cost price is above 0. Shows how much the Regular Price is above cost. Typing a percentage changes the variant's Regular Price. |
| Profit % (Wholesale) | No | The same, linked to the Wholesale Price. |
| Vendor | No | Hint "Select vendor". Searchable and clearable. Gear button tip "Manage vendors". |
| Product Location (optional) | No | Hint "e.g. Aisle A, Shelf 3". |
| Expiry | No | A date picker. |

- A red minus button removes the batch row. It does not ask you to confirm.
- Under each batch is a **Payment Methods** section that records how you paid for this purchase:
  - Click **Add Payment Method** to add a row. A new row is filled with the amount still unpaid.
  - Each row has a method list (**Cash**, **Card**, **Cheque**, **Bank Transfer**, **Mobile Money**, **MFS**), and for Card and Bank Transfer a second list "Select bank". For MFS a list "Select MFS" is required. Then an amount (two decimals), a "Reference" box and a red delete button. The delete button is greyed out when only one row is left.
  - The first row starts as Cash. While there is only one Cash row, its amount follows quantity times cost by itself.
  - When the total is above 0, a summary shows **Total Cost**, **Paying** (green) and **Remaining** (red if above 0).
  - Rows with amount 0 are ignored when you save.
  - Any part of the cost not covered by the payment rows stays as money you owe the vendor.

![Add Inventory batch card](images/consumer/add-product-simple-batch-added-d.png)
*A new batch card with branch, batch number, quantity, cost price, profit, vendor, location, expiry and payment methods.*

![Batch errors](images/consumer/add-product-simple-batch-errors-d.png)
*Batch branch is required and Batch reference is required.*

![Batch with cost price](images/consumer/add-product-simple-batch-cost-d.png)
*Quantity 20 and cost price 80. The payment total follows quantity times cost.*

![Profit percent helper](images/consumer/add-product-simple-batch-profit-d.png)
*Profit % (Regular) 50 and Profit % (Wholesale) 25 are worked out from the prices and the cost.*

![Payment rows](images/consumer/add-product-simple-payment-rows-d.png)
*Two payment rows with Total Cost, Paying and Remaining.*

![Bank list for Card](images/consumer/add-product-simple-payment-bank-dropdown-d.png)
*Choosing Card shows a Select bank list.*

![Payments exceed total cost](images/consumer/add-product-simple-payment-exceed-d.png)
*The red message Payments exceed total cost under the amount.*

**Manage Vendors pop-up** (gear next to Vendor). It is titled **Manage Vendors** and has a button **Add Vendor**. Each vendor row shows contact, phone, email and address, or "No additional info". Each row has a pencil and a bin. An empty list says "No vendors found".

**Add Vendor** and **Edit Vendor** fields:

| Field | Required | Notes |
|---|---|---|
| Vendor Name | Yes | Up to 100 characters. Error: "Please enter vendor name". |
| Contact Person | No | Up to 100 characters. Hint "Enter contact person". |
| Phone | No | Up to 30 characters. Hint "Enter phone number". |
| Email | No | Up to 120 characters. Hint "Enter email address". Must be a valid email: "Please enter a valid email". |
| Address | No | A 3-line box, up to 300 characters. Hint "Enter address". |

![Manage Vendors pop-up](images/consumer/add-product-manage-vendors-d.png)
*The list of vendors with contact, phone, email and address.*

![Add Vendor with error](images/consumer/add-product-add-vendor-error-d.png)
*Please enter vendor name when the name is empty.*

The delete question reads **Delete Vendor** and "Are you sure you want to delete {name}?".

### How to add a simple product

A simple product has one price and no sizes or colours.

1. Click **Products > Add Product** in the menu.
2. On **Basic Information**, type the **Product Name**.
3. If you want a code, click the round arrow button next to **Product Code**, or type your own.
4. Add a **Description** if you like. Choose a **Category**, **Brand** and **Tags** if you like.
5. Set the **Tax Method** and the **Tax Rate (%)**. Leave the product type switch off.
6. Open the **Details** tab. The **SKU** and **Barcode** are already filled in.
7. Type the **Regular Price**. Choose the **Sale Unit** and **Purchase Unit**. If the lists are empty, click the gear button and add a unit first.
8. Fill in **Wholesale Price**, **Alert Quantity**, **Daily Target**, **Warranty (months)** and **Image** if you want.
9. If you want to record opening stock, open **Add Inventory (0)** and follow "How to add opening stock" below.
10. Click **Save Product**.

**What happens next:** You see "Product created successfully" and go to the Products list. Any opening stock is added to the chosen branches at once.

![Product created](images/consumer/add-product-simple-saved-toast-d.png)
*The new product at the top of the list with the success message.*

### How to add a product with variants

1. On **Basic Information**, turn the product type switch on. It now reads "Variant product" and the second tab becomes **Variants (1)**.
2. Fill in **Variant 1**: name, prices, units and the rest.
3. Click **Add Variant** for a blank variant with a new SKU and barcode. You see "New variant added". Or click **Copy & Add Variant** to duplicate the variant you are looking at. This copies prices, units, alert, target, warranty, image and opening stock rows, but leaves the name empty and gives a new SKU and barcode. You are moved to the new sub-tab.
4. Type a name in each variant, for example Small, Medium and Large.
5. To remove a variant, open its sub-tab, click **Delete**, and confirm **Delete variant** ("Are you sure you want to remove this variant?"). If you remove the first (default) variant, the next one becomes the default.
6. Click **Save Product**.

**What happens next:** You see "Product created successfully" and go to the Products list.

> **Good to know:** If you click **Add Variant** while the product is still simple, the product becomes a variant product automatically. Once a variant product is saved, it cannot be changed back to a simple product.

### How to add opening stock

1. On the **Details** tab (or on a variant's sub-tab), open **Add Inventory (n)**.
2. Click **Add Inventory**.
3. Choose the **Branch**.
4. Click the reload button in **Batch No**, or type a batch number.
5. Enter the **Quantity** and the **Cost Price**.
6. Optionally set **Profit % (Regular)**, **Vendor**, **Product Location (optional)** and **Expiry**.
7. Under **Payment Methods**, click **Add Payment Method** if you paid in more than one way. Choose the method and amount, and add a bank or MFS provider where asked.
8. Check **Total Cost**, **Paying** and **Remaining**.
9. Click **Save Product**.

**What happens next:** The stock is added to the branch as a batch when the product is saved.

> **Good to know:** If two batch rows of the same variant use the same batch number, they must have the same expiry date (or both have none).

### How to use Profit % to set the price

1. In a batch, enter the **Cost Price**, for example 100.
2. Type 25 in **Profit % (Regular)**. The variant's Regular Price becomes 125.00.
3. Or do it the other way: type the Regular Price and the Profit % shows 25.
4. Do the same with **Profit % (Wholesale)** for the Wholesale Price.

**What happens next:** The price and the profit stay linked. Profit is worked out as (price minus cost) divided by cost, times 100, rounded to two decimals. It can go down to minus 100. If you clear the Profit % box, the price is cleared too.

> **Good to know:** The Profit % box shows exactly what you type until you click out of it. Then it shows the recalculated figure.

### How to edit a product

1. Click the pencil icon on the Products list, or click **Edit Product** on Product Details.
2. Change what you need on either tab.
3. To add a variant, click **Add Variant**. To remove one, use its **Delete** button. Removed variants are deleted only when you click **Update Product**.
4. Click **Update Product**.

**What happens next:** You see "Product updated successfully" and go back to the Products list. If it fails you see the server's reason or "Failed to update product".

> **Good to know:** The **Add Inventory** sub-tab is not there when you edit. To change stock later, use the Inventory screens. Serial numbers and attributes that a variant already has are kept when you save, but this form has no fields to add or change them.

![Edit Product, simple](images/consumer/edit-product-simple-basic-d.png)
*Edit Product has Basic Information and Details only, with no Add Inventory part.*

![Edit Product, Details tab](images/consumer/edit-product-simple-details-d.png)
*Details of a simple product when editing.*

![Edit Product, variants](images/consumer/edit-product-variants-tab-d.png)
*A variant product has Variants (4) with Variant 1 to Variant 4 and no inventory part.*

### How to copy a product

1. Click the copy icon on the Products list, or **Copy Product** on Product Details.
2. The form opens titled **Copy Product**. It has the description, category, brand, tags, tax, and each variant's prices, units, alert, target, warranty and image.
3. The **Product Name** is empty. Type the new name.
4. A new Product Code (starting "PRD-" and 6 digits) is made for you. Each variant gets a new SKU and barcode.
5. Change what you need. Add opening stock if you want.
6. Click **Save Product**.

**What happens next:** The new product is created. Attributes, serial numbers and stock of the old product are not copied.

![Copy Product](images/consumer/copy-product-basic-d.png)
*Copy Product: the name is empty, a new code PRD-661590 is made and the tags, category and variants are copied.*

### Checking errors before you save

When you click **Save Product** or **Update Product**, the form checks your entries. Errors show in red under the field, and the field gets a red border. An error clears as soon as you change that field.

> **Good to know:** When the form has errors, the message at the top reads only "Failed to create product" (or "Failed to update product"). The real reasons are the red texts under the fields. Errors on the Details or Variants tab cannot be seen while you are on Basic Information, so switch tabs to find them. The yellow box "Please resolve validation errors before saving." appears on that tab.

| Message | What it means | What to do |
|---|---|---|
| Product name is required | The name is empty. | Type a name. |
| Tax rate must be a whole number between 0 and 100 | The rate is not a whole number or is out of range. | Use 0 to 100 without decimals. |
| At least one variant is required | No variant exists. | Keep at least one variant. |
| Simple product can only have one variant | A simple product has two or more variants. | Turn on **Variant product** or remove extra variants. |
| Variant product cannot be converted back to simple product. | You tried to change a saved variant product to simple. | Keep it as a variant product. |
| Name is required | A variant has no name. | Type the variant name. |
| Regular price is required | The Regular Price is empty or 0. | Enter a price above 0. |
| Sale unit is required | No Sale Unit chosen. | Choose one. Add a unit first if the list is empty. |
| Purchase unit is required | No Purchase Unit chosen. | Choose one. |
| Wholesale price cannot be negative | A Wholesale Price below 0. | Enter 0 or more. |
| SKU must be unique | Two variants of this product share a SKU. | Change one, or use the reload button. |
| Barcode must be unique | Two variants of this product share a barcode. | Change one, or use the barcode button. |
| Batch branch is required | A stock batch has no branch. | Choose a branch. |
| Batch reference is required | A batch has no batch number. | Type one or click the reload button. |
| Batch quantity is required | A batch has no quantity. | Enter 1 or more. |
| Batch cost cannot be negative | Cost price is below 0. | Enter 0 or more. |
| Provider is required | You chose MFS but no provider. | Choose a provider under **Select MFS**. |
| Payments exceed total cost | Payment rows add up to more than quantity times cost. | Lower the amounts. |
| Same batch number must use the same expiry date | Two rows share a batch number but have different expiry dates. | Make the dates match. |
| You can only upload JPG/PNG file! | The image is another file type. | Use a JPG or PNG. |
| Image must be smaller than 10MB! | The image is too big. | Use a smaller image. |
| {file} upload failed. | The upload did not work. | Try again. |
| A product with this name already exists. | The name is taken. | Use another name. |
| A product with this code already exists. | The code is taken. | Use another code. |
| Product limit reached: ... | Your plan limit is reached. | Upgrade your plan. |
| Simple products can only have one variant | The server found two or more variants on a simple product. | Use a variant product. |
| New variants require all required fields | A new variant is missing something required. | Fill in the name, price and units. |
| Variant n: batch number "..." has different expiry dates in row a and row b. Same batch number must use the same expiry date. | Same as the batch rule above. | Make the dates match. |
| Product created successfully | The new product was saved. | Nothing. |
| Product updated successfully | The change was saved. | Nothing. |
| Failed to update product | The change could not be saved. | Check the red texts, then try again. |
| New variant added | A blank variant was added. | Fill it in. |

---

## Categories

### What it is

The list of groups (for example Beverages, Snacks, Dairy) that you use to sort products and to filter the Products list.

### Where to find it

Menu: **Products > Categories**. You need the permission to edit products or to add products.

![Categories](images/consumer/categories-d.png)
*The Categories list.*

### What you see

- A blue button **Add New Category** at the top right.
- A table with two columns: **Name** (in bold) and **Actions** (a pencil to edit and a red bin to delete).
- At the bottom: "1-3 of 3 categories", page buttons, a page size choice and a jump box. The default is 10 per page.
- If the list cannot load, you see "Failed to load categories".

**The side form.** Adding or editing opens a panel on the right. Its title is **Add Category** or **Update Category**. Close it with the x.

| Field | Required | Notes |
|---|---|---|
| Category Name | Yes | Hint "Enter category name". Must be unique in your shop. |

The button at the bottom reads **Create Category** (new) or **Update Category** (edit).

![Add category panel](images/consumer/categories-drawer-empty-d.png)
*The side panel for a new category.*

![Add category with error](images/consumer/categories-drawer-error-d.png)
*Leaving the name empty shows the required message in red.*

### How to add a category

1. Click **Add New Category**.
2. Type the **Category Name**.
3. Click **Create Category**.

**What happens next:** You see "Category created successfully". The panel closes and the list refreshes.

### How to edit a category

1. Click the pencil on the row.
2. Change the **Category Name**.
3. Click **Update Category**.

**What happens next:** You see "Category updated successfully".

![Update category panel](images/consumer/categories-drawer-edit-d.png)
*The same panel when editing, with the name filled in.*

### How to delete a category

1. Click the red bin on the row.
2. Read the question **Delete this category?** and "This action cannot be undone. Products in this category will no longer be categorized."
3. Click **Yes**. Click **No** to cancel.

![Delete category question](images/consumer/categories-delete-confirm-d.png)
*The Delete this category? question with No and Yes.*

**What happens next:** You see "Category deleted successfully". The products are not deleted. They show "No category" instead.

> **Good to know:** You can also add, edit and delete categories from the gear button on the product form.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Category name is required | The name is empty. | Type a name. |
| Category created successfully | Saved. | Nothing. |
| Category updated successfully | Saved. | Nothing. |
| Category deleted successfully | Removed. | Nothing. |
| A category with this name already exists. | The name is taken. | Use another name. |
| Failed to create category / Failed to update category / Failed to delete category | The action failed and the server gave no reason. | Try again. |
| Failed to load categories | The list could not load. | Refresh the page. |

---

## Brands

### What it is

The list of brands you sell, each with an optional logo and website.

### Where to find it

Menu: **Products > Brands**. You need the permission to edit products or to add products.

![Brands](images/consumer/brands-d.png)
*The Brands list with logo and website columns.*

### What you see

- The path at the top reads Dashboard > Settings > Brands.
- A blue button **Add New Brand**.
- A table with these columns: **Name** (bold), **Logo** (a small picture; click it to enlarge), **Website** (a clickable link that opens in a new tab, or a grey "No website") and **Actions** (a pencil and a red bin).
- At the bottom: "1-3 of 3 brands" with page controls.
- If the list cannot load: "Failed to load brands".

> **Good to know:** The word "Settings" in the path at the top is a link that does not lead to a real page. Use the side menu instead. If a brand has no logo, the Logo column may show a broken picture box with the brand name in text, as in the screenshot.

**The side form.** Title **Add Brand** or **Update Brand**.

| Field | Required | Notes |
|---|---|---|
| Brand Name | Yes | Hint "Enter brand name". Must be unique in your shop. |
| Website | No | Hint "Enter website URL (optional)". Must be a valid address. Start with https://. |
| Logo | No | An "Upload" box. One JPG or PNG under 10 MB. |

The button reads **Create Brand** or **Update Brand**.

![Add brand panel](images/consumer/brands-drawer-empty-d.png)
*The side panel for a new brand.*

![Add brand with error](images/consumer/brands-drawer-error-d.png)
*Leaving the name empty shows the required message in red.*

### How to add a brand

1. Click **Add New Brand**.
2. Type the **Brand Name**.
3. Type the **Website** if you want (include https://).
4. Click the **Upload** box and choose a logo if you want.
5. Click **Create Brand**.

**What happens next:** You see "Brand created successfully" and the list refreshes.

### How to edit a brand

1. Click the pencil on the row.
2. Change the name, website or logo.
3. Click **Update Brand**.

**What happens next:** You see "Brand updated successfully".

![Update brand panel](images/consumer/brands-drawer-edit-d.png)
*The same panel when editing, with the name filled in.*

### How to delete a brand

1. Click the red bin on the row.
2. Read **Delete this brand?** and "This action cannot be undone. Products with this brand will no longer be associated with it."
3. Click **Yes**, or **No** to cancel.

![Delete brand question](images/consumer/brands-delete-confirm-d.png)
*The Delete this brand? question with No and Yes.*

**What happens next:** You see "Brand deleted successfully". Products stay, and show "No brand".

> **Good to know:** The gear button on the product form changes only the brand name. Set logos and websites here.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Brand name is required | The name is empty. | Type a name. |
| Please enter a valid website URL | The website is not a proper address. | Type it like https://example.com. |
| You can only upload JPG/PNG file! | Wrong file type. | Use a JPG or PNG. |
| Image must be smaller than 10MB! | Logo is too big. | Use a smaller file. |
| {file} upload failed. | The upload did not work. | Try again. |
| Brand created successfully / Brand updated successfully / Brand deleted successfully | The action worked. | Nothing. |
| A brand with this name already exists. | The name is taken. | Use another name. |
| Failed to create brand / Failed to update brand / Failed to delete brand | The action failed with no reason given. | Try again. |
| Failed to load brands | The list could not load. | Refresh the page. |

---

## Tags

### What it is

Short labels such as "New Arrival", "Halal" or "Best Seller" that you can put on many products. You can filter the Products list by tag.

### Where to find it

Menu: **Products > Tags**. You need the permission to edit products or to add products.

![Tags](images/consumer/tags-d.png)
*The Tags list.*

### What you see

- A blue button **Add New Tag**.
- A table with **Name** and **Actions** (a pencil and a red bin).
- At the bottom: "1-1 of 1 tags" with page controls.
- If the list cannot load: "Failed to load tags".

**The side form.** Title **Add Tag** or **Update Tag**.

| Field | Required | Notes |
|---|---|---|
| Tag Name | Yes | Hint "Enter tag name". Must be unique in your shop. |

The button reads **Create Tag** or **Update Tag**.

![Add tag panel](images/consumer/tags-drawer-empty-d.png)
*The side panel for a new tag.*

![Add tag with error](images/consumer/tags-drawer-error-d.png)
*Leaving the name empty shows the required message in red.*

### How to add a tag

1. Click **Add New Tag**.
2. Type the **Tag Name**.
3. Click **Create Tag**.

**What happens next:** You see "Tag created successfully".

### How to edit a tag

1. Click the pencil on the row.
2. Change the **Tag Name**.
3. Click **Update Tag**.

**What happens next:** You see "Tag updated successfully".

![Update tag panel](images/consumer/tags-drawer-edit-d.png)
*The same panel when editing, with the name filled in.*

### How to delete a tag

1. Click the red bin on the row.
2. Read **Delete this tag?** and "This action cannot be undone. Products using this tag will no longer be tagged."
3. Click **Yes**, or **No** to cancel.

![Delete tag question](images/consumer/tags-delete-confirm-d.png)
*The Delete this tag? question with No and Yes.*

**What happens next:** You see "Tag deleted successfully". The tag is taken off every product that had it. The products stay.

A product can have many tags. To put a tag on a product, use the **Tags** field on the product form.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Tag name is required | The name is empty. | Type a name. |
| Tag created successfully / Tag updated successfully / Tag deleted successfully | The action worked. | Nothing. |
| Failed to create tag / Failed to update tag / Failed to delete tag | The action failed. | Try again. |
| Failed to load tags | The list could not load. | Refresh the page. |

---

## Units

### What it is

The units you measure and sell by, such as Piece, Kilogram, Liter or Box. Each variant needs a Sale Unit and a Purchase Unit chosen from this list.

### Where to find it

Menu: **Products > Units**. You need the permission to edit products or to add products.

![Units](images/consumer/units-d.png)
*The Units list.*

### What you see

- A blue button **Add New Unit**.
- A table with **Name** and **Actions** (a pencil and a red bin).
- At the bottom: "1-3 of 3 units" with page controls.
- If the list cannot load: "Failed to load units".

**The side form.** Title **Add Unit** or **Update Unit**.

| Field | Required | Notes |
|---|---|---|
| Unit Name | Yes | Hint "Enter unit name (e.g. Kilogram, Liter)". |

The button reads **Create Unit** or **Update Unit**. Only a name is stored. There is no field for a unit code on this page.

> **Good to know:** You need at least one unit before you can save any product, because Sale Unit and Purchase Unit are required.

![Add unit panel](images/consumer/units-drawer-empty-d.png)
*The side panel for a new unit.*

![Add unit with error](images/consumer/units-drawer-error-d.png)
*Leaving the name empty shows the required message in red.*

### How to add a unit

1. Click **Add New Unit**.
2. Type the **Unit Name**, for example "Kilogram".
3. Click **Create Unit**.

**What happens next:** You see "Unit created successfully".

### How to edit a unit

1. Click the pencil on the row.
2. Change the **Unit Name**.
3. Click **Update Unit**.

**What happens next:** You see "Unit updated successfully".

![Update unit panel](images/consumer/units-drawer-edit-d.png)
*The same panel when editing, with the name filled in.*

### How to delete a unit

1. Click the red bin on the row.
2. Read **Delete this unit?** and "This action cannot be undone. Products using this unit will no longer have a unit."
3. Click **Yes**, or **No** to cancel.

![Delete unit question](images/consumer/units-delete-confirm-d.png)
*The Delete this unit? question with No and Yes.*

**What happens next:** An unused unit is removed and you see "Unit deleted successfully".

> **Good to know:** The question above says products will lose their unit. In practice, a unit that any product variant uses cannot be deleted. You will see a message like "This unit is still used by other records, so it can't be changed or deleted. Remove or reassign those first." To delete such a unit, first change the units on those products.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Unit name is required | The name is empty. | Type a name. |
| Unit created successfully / Unit updated successfully / Unit deleted successfully | The action worked. | Nothing. |
| Unit with name "{name}" already exists | The name is taken. | Use another name. |
| This unit is still used by other records, so it can't be changed or deleted. Remove or reassign those first. | Products use this unit. | Change those products to another unit first. |
| Failed to create unit / Failed to update unit / Failed to delete unit | The action failed. | Try again. |
| Failed to load units | The list could not load. | Refresh the page. |

---

## Barcode Printing

### What it is

A screen to design and print barcode stickers (labels) for your products on a label printer connected to this computer.

### Where to find it

Menu: **Products > Barcode Printing**. You need the permission to add products.

![Barcode Printing](images/consumer/barcode-printing-d.png)
*The Label Configuration form.*

### What you see

One card titled **Label Configuration** with the form below. Three buttons sit in the middle at the bottom: **Preview**, **Print Label** (blue) and **Clear**.

| Field | Required | Notes |
|---|---|---|
| Shop Name | No | Filled in with your company name. Hint "Enter shop name (optional)". Help text: "Shop name will be prefilled from your account". |
| Select Branch | No | Searchable list, hint "Select a branch...". Each option shows the branch and its address. Choosing one fills Branch Name and Location. Clearing it empties them. Help text: "Choose a branch to auto-fill branch name and location". |
| Branch Name | No | Hint "Enter branch name (optional)". Help text: "Leave empty to hide branch name on label". |
| Location | No | Hint "Enter location (optional)". Help text: "Leave empty to hide location on label". |
| Select Product | No | Searchable list, hint "Search and select a product...". Each option shows the product and variant with its code, SKU, barcode and price. Help text: "Choose from existing products or enter barcode manually". See the notes below. |
| Barcode Value | Yes | Hint "Enter barcode number (e.g., 1234567890123)". |
| Product Name | No | Hint "Enter product name (optional)". Help text: "Leave empty to hide product name on label". |
| Price | No | Taka sign, two decimals, 0 or more. Help text: "Leave empty to hide price on label". |
| VAT Included | No | A switch. On by default. On means the product's tax method is Inclusive. |
| VAT Percentage | No | 0 to 100, with a "%" sign. Starts at 21. |
| Quantity | Yes | From 1 to 100. Starts at 1. This is the number of labels. |
| Print Barcode Only | No | A switch. Off by default. When on, only the barcode bars print, with no name, price, VAT or number under the bars. |

Notes on **Select Product**:

- Only variants that have a barcode are listed. It searches the first 50 matching products.
- Choosing a variant fills **Barcode Value**, **Product Name** (as "product - variant"), **Price**, **VAT Included** and **VAT Percentage**. Clearing the choice resets those fields.

**The preview pop-up.** It is titled **Barcode Label Preview**. It shows the shop name and branch, the location, the barcode bars with the number under them, the product name and the price with "(inc. VAT x%)" or "(exc. VAT x%)". It has two buttons, **Print This Label** and **Close**.

> **Good to know:** The price and VAT show on the label only when Price is above 0. VAT shows only when VAT Percentage is above 0.

> **Good to know:** If you choose a product with 0% tax, **VAT Percentage** is filled with 21, not 0. Check it, and change it to 0 before you print.

> **Good to know:** A preview with no **Barcode Value** shows an empty or invalid barcode. Enter a value first.

> **Good to know:** Printing does not use your browser's print window. It sends the label to the PosBuzz printing agent installed on this same computer. The agent must be running for printing to work.

![Select Product list](images/consumer/barcode-printing-product-dropdown-d.png)
*Searching the product list for a name.*

![Barcode Label Preview](images/consumer/barcode-printing-preview-d.png)
*The preview pop-up with Close and Print This Label.*

### How to print labels for a product

1. Make sure the PosBuzz printing agent is running on this computer.
2. Optional: choose a branch in **Select Branch** to fill the branch name and location. Edit **Shop Name** if needed.
3. In **Select Product**, type part of the name and choose the variant. The barcode, name, price and VAT fields fill in.
4. Set **Quantity** to the number of stickers you need. Set the switches.
5. Click **Preview** to check the label. In the pop-up click **Print This Label**, or **Close** to go back.
6. Click **Print Label**.

**What happens next:** You see "Barcode label printed successfully!" and the labels print.

### How to print a custom barcode

1. Leave **Select Product** empty.
2. Type the **Barcode Value**. Add a **Product Name** and **Price** if you want them on the label.
3. Set **Quantity**.
4. Click **Print Label**.

**What happens next:** The label prints as above.

### How to clear the form

1. Click **Clear**.

**What happens next:** All fields go back to their starting values.

> **Good to know:** If a product does not appear in **Select Product**, its variants have no barcode. Open **Edit Product** and give the variant a barcode first.

![Printing agent warning](images/consumer/barcode-printing-agent-offline-d.png)
*With no printing agent running, a red message appears at the top.*

![Barcode validation](images/consumer/barcode-printing-validation-error-d.png)
*After Clear, Print Label shows the red field messages.*

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Please enter barcode value | Barcode Value is empty. | Type or choose a barcode. |
| Please enter quantity | Quantity is empty. | Enter 1 to 100. |
| Failed to print barcode label. Please check your input. | Barcode Value or Quantity is missing. | Fix the red fields. |
| Printing agent is not running. Please start the printing agent and try again. | The app cannot reach the printing agent on this computer. | Start the printing agent, then try again. |
| Failed to print barcode label: {message} | The agent refused the job and gave a reason. | Read the reason and fix it, for example check the printer. |
| Barcode label printed successfully! | The label was sent to the printer. | Nothing. |

---

## Product Audit

### What it is

A history of every stock movement of one variant over a period, batch by batch. It covers purchases, sales, returns, transfers and manual changes, so you can see how the stock went from the opening figure to today's figure and who made each change. This screen only shows information. It does not change anything.

### Where to find it

Menu: **Products > Product Audit**. You need the product audit permission.

![Product Audit](images/consumer/product-audit-d.png)
*The Product Audit filters before an audit is run.*

### What you see

A card titled **Select Product Variant & Period** with these fields:

| Field | Required | Notes |
|---|---|---|
| Product | Yes | Searchable list, hint "Search and select product...". Options read "name (code)". It searches up to 60 products. |
| Variant | Yes | Hint "Select variant...". Options read "variant - SKU". Greyed out until you choose a product. Choosing another product clears it. |
| Date Range | Yes | A from and to picker, shown like "24 Oct 2026". It starts as the last 30 days up to today. It cannot be cleared. |
| Branch (optional) | No | Shows "All Branches". You can clear your choice. |

The button **Run Audit** is greyed out until a variant is chosen.

Before you run an audit, a message says "Select a product variant and date range, then click Run Audit". While it loads, a spinner shows.

**After you run the audit:**

- A header card with "Product: {product} - {variant}" and "Period: {start} to {end}". It has two buttons: **Refresh** and **Download PDF**.
- Four summary cards: **Est. Opening Stock**, **Current Stock** (blue), **Net Change** (green with a plus if up, red if down) and **Total Movements**.
- **Branch Breakdown** table, only when more than one branch is involved. Columns: Branch, Opening, Current, Net Change and Events.
- Tabs:
  - **Product Info**: Product, Product Code, Variant, SKU, Barcode, Category, Brand, Sale Unit, Regular Price, Wholesale Price (a dash if missing) and Attributes (only if any).
  - **Batch Timeline (n Batches)** (opens first): one card per batch. The card title is the batch number with a branch tag (or "Unknown Branch") and an orange-red vendor tag if there is a vendor. On the right: "Period Start: qty" and "Current: qty". The table has these columns: **Date/Time**, **Event**, **Qty Change** (green plus or red minus), **Stock After**, **Details / Reference** (notes, or a dash) and **User** (a name, or "System").

**Event labels:**

| Event | Colour | Meaning |
|---|---|---|
| Purchase In | Green | Stock came in from a purchase. |
| Sale Out | Red | Stock went out by a sale. |
| Return Restock | Cyan | A returned item went back to stock. |
| Transfer Out | Orange | Stock left for another branch. |
| Transfer In | Blue | Stock arrived from another branch. |
| Manual Adjust | Purple | Someone changed the stock by hand. |
| Exchange Out | Magenta | Stock went out in an exchange. |

Empty messages: "No batches or movements found in this period." (no batches at all) and "No movements in this period" (inside one batch card).

If loading fails, a red box says **Failed to load audit data** with the detail.

![Product Audit filters filled](images/consumer/product-audit-filled-d.png)
*Product and variant chosen, ready to click Run Audit.*

![Product Audit results](images/consumer/product-audit-results-d.png)
*Summary cards, Branch Breakdown and the Batch Timeline.*

![Product Info tab](images/consumer/product-audit-product-info-d.png)
*The Product Info tab of the audit.*

### How to run an audit

1. Choose the **Product**.
2. Choose the **Variant**.
3. Change the **Date Range** if you need to. Choose a **Branch** if you want only one.
4. Click **Run Audit**.
5. Read the four summary cards.
6. Open **Batch Timeline** to read each movement.

**What happens next:** The audit appears below the filters. If you change any filter afterwards, it reloads by itself.

> **Good to know:** **Est. Opening Stock** is an estimate. It is worked back from today's stock and the movements in the period.

### How to download the audit as a PDF

1. Run the audit.
2. Click **Download PDF**.

**What happens next:** A PDF is saved to your computer. The file name comes from the server, otherwise it is `product-audit.pdf`.

> **Good to know:** If the PDF cannot be made, no message appears and nothing downloads. Try again.

### How to reload the audit

1. Click **Refresh**.

**What happens next:** The audit loads again with the same settings.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Select a product variant and date range, then click Run Audit | No audit has been run yet. | Choose a variant and click **Run Audit**. |
| Failed to load audit data | The audit could not load. | Click **Refresh** or run it again. |
| No batches or movements found in this period. | This variant has no batches. | Check the product and dates. |
| No movements in this period | This batch had no movement in the dates chosen. | Widen the date range if needed. |

---

## Sales Stats

### What it is

Shows how much of each product variant was sold in a period: number of sales, quantity, money, returns and net money. Best sellers come first. Each variant also has its own detail page with a daily trend and every sale it appeared in.

### Where to find it

Menu: **Products > Sales Stats**. You need the business insights permission. The page title is **Product Variant Sales Statistics**.

![Product Variant Sales Statistics](images/consumer/product-variant-sales-stats-d.png)
*Variant sales for one week, with returns and a View link on each row.*

### What you see

The path at the top reads Dashboard > Products > Variant Sales Stats.

**Filter card:**

| Field | Notes |
|---|---|
| Date Range | A from and to picker shown like 2026-10-18. Starts at the beginning of this week and ends today. Future dates cannot be chosen. It cannot be cleared. |
| Branch | Shows "All Branches". You can clear your choice. |

**Table.** Rows are ordered by net amount, highest first. You cannot sort by clicking the headings.

| Column | What it shows |
|---|---|
| Product | The product name in bold, the variant name in grey, and "SKU: ...". |
| Total Sales | The number of sales, in a tag (green if above 0). |
| Total Qty | The quantity sold. |
| Total Amount | The money earned, in green. |
| Returned | The returned quantity and its amount in red, or a dash. |
| Net Amount | Total Amount minus the returned amount, in bold. |
| Actions | A **View** link with an eye icon. |

At the bottom: "1-6 of 6 variants", page controls and a page size choice (20 per page by default).

Only variants that had sales in the chosen period are listed.

![Sales Stats branch list](images/consumer/sales-stats-branch-dropdown-d.png)
*The Branch list of the filter card.*

### How to see sales for a period

1. Choose the **Date Range**.
2. Optional: choose a **Branch**.

**What happens next:** The table reloads by itself and goes back to page 1.

### How to open one variant's detail

1. Click **View** on the row.

**What happens next:** The variant's detail page opens, with the same date range and branch.

### Variant detail page (from View)

**What it is.** The daily sales trend of one variant and every sale it appeared in.

**What you see.**

- The page title is "product - variant" (it reads "Variant #id" until loaded). The path reads Dashboard > Products > Variant Sales Stats > the variant.
- A **Back** button (arrow) at the top right.
- A filter card with **Date Range:** (no future dates, cannot be cleared) and **Branch:** ("All Branches"). They start with the choices from the list page, or this week and all branches if you opened the page directly.
- Summary cards: **Total Sales**, **Total Qty Sold**, **Avg Qty / Sale**, **Total Amount**, **Returned** (red when above 0, with its amount in brackets), **Net Amount** and **Avg Amount / Sale**. The average figures are per sale.
- Two charts with one point for each day of the range (days with no sales show zero): **Daily Revenue Trend** (blue bars; hover to see "Amount: BDT x") and **Daily Quantity Sold** (a green line, "Qty Sold"). If there is nothing to draw: "No sales data available for selected range".
- The table **Individual Sale Records**:

| Column | What it shows |
|---|---|
| Sale # | A blue link that opens that sale. |
| Date | The date and time, such as "24 Oct 2026, 02:15 PM". |
| Customer | The customer name, or a grey "Walk-in". |
| Branch | The branch, or a dash. Hidden on small screens. |
| Qty | The quantity sold. |
| Total Amount | The money, in green. |
| Returned | The returned quantity in red, or a dash. |
| Status | PAID (green), PARTIAL (orange), DUE (red) or CANCELLED (grey). |

At the bottom: "1-20 of n records" with page controls. 20 per page by default.

![Variant sales detail](images/consumer/sales-stats-variant-detail-d.png)
*Cards and charts for Cotton Panjabi, Maroon / L.*

**How to read one variant's sales.**

1. Click **View** on the Sales Stats list.
2. Change **Date Range** or **Branch** if you want a different view. The page reloads.
3. Read the summary cards and the two charts.
4. Scroll to **Individual Sale Records**. Click a **Sale #** to open that sale.
5. Click **Back** to return to the list.

**What happens next:** Clicking **Back** takes you to the Sales Stats list.

> **Good to know:** When you return with **Back**, the list's filters start again from this week and all branches.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| No sales data available for selected range | No sales to draw a chart for. | Widen the date range. |
