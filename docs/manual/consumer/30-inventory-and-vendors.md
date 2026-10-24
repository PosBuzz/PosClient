# Part 3 - Inventory, vendors and purchase payments

This part explains how to receive stock, move it between branches, correct it, check it, and keep track of what you owe your suppliers. All of these screens are under **Inventory** in the left menu.

Things that work the same on many screens:

- **Reset** (or **Reset Filters**) clears the search box and all filters on that screen.
- Search boxes wait a moment (about half a second) after you stop typing before they show results.
- Lists show a count at the bottom, such as "1-10 of 25 batches". You can change the page size to 10, 20, 50 or 100.
- Money is in taka (BDT). Most screens show a small taka sign before the amount. Purchase Payments and Make Payment show "BDT" as text.
- **Export** button: on the View Inventory screen it opens a small menu with **Export as PDF**. The file is saved as inventory.pdf. If it fails you see "Failed to export the list" (or a message from the server).
- An **Import Excel** button exists on View Inventory but is normally switched off and not shown. See "Import from Excel" under View Inventory if your shop has it.

## Payment Methods rows (used when adding stock and when paying a supplier)

Two screens (Add Inventory and Make Payment) let you record how you paid. The same rows appear on both.

| Item | Notes |
| --- | --- |
| **Payment Methods** heading and **Add Payment Method** button | Adds another payment row. A new row starts as Cash and is filled with the amount still unpaid. |
| Method | Choose one: Cash, Card, Cheque, Bank Transfer, Mobile Money or MFS. The box says "Method" until you choose. |
| Provider | Appears only for Card, Bank Transfer and MFS. For Card and Bank Transfer the box says "Select bank" and lists banks in Bangladesh. For MFS it says "Select MFS" and lists bKash, Nagad, Rocket, MyCash, Islami Bank mCash, Trust Axiata Pay (TAP), FirstCash, Upay, OK Wallet, Rupali Bank, Telecash, Islamic Wallet and Meghna Pay. |
| Amount | Shows "0.00" until you type. Cannot be below 0. Two decimal places. |
| **Reference** | Optional text, for example a cheque number or a transaction number. |
| Red delete button | Removes the row. It is switched off when only one row is left. |
| Footer | Shows **Total Cost**, **Paying** and **Remaining**. Remaining turns green when it reaches 0. |

| Message | What it means | What to do |
| --- | --- | --- |
| CARD payment must have a provider selected (the same for BANK TRANSFER and MFS) | A Card, Bank Transfer or MFS row has an amount but no bank or MFS chosen. | Pick the bank or MFS in that row, then try again. |

## Vendor picker and quick vendor forms (used on Add Inventory and Edit Inventory)

On the stock form, the **Supplier/Vendor** box says "Select supplier/vendor". You can type to search by name, contact person, phone or email. Each choice shows the vendor name and "Contact: ...". When you point at a choice, small Edit and Delete icons appear. At the bottom of the list is the **Add new vendor** button.

### How to add a vendor from the stock form

1. Open the **Supplier/Vendor** box.
2. Press **Add new vendor**.
3. Fill in the **Add New Vendor** window (fields below).
4. Press **Create**.

| Field | Required | Notes |
| --- | --- | --- |
| Vendor Name | Yes | At least 2 characters, at most 100. |
| Contact Person | No | At most 100 characters. |
| Phone Number | No | At most 20 characters. |
| Email | No | At most 100 characters. Must look like an email address. |
| Address | No | At most 255 characters. Three-line box. |

**What happens next:** You see "Vendor created successfully" and the new vendor is chosen for you on the stock form.

### How to edit or delete a vendor from the stock form

1. Open the **Supplier/Vendor** box and point at the vendor.
2. To change it, press the Edit icon, change the fields in the **Edit Vendor** window and press **Update**. You see "Vendor updated successfully".
3. To remove it, press the Delete icon. The **Delete Vendor** window asks "Are you sure you want to delete this vendor? This action cannot be undone." Press **Yes** to delete or **No** to stop. You see "Vendor deleted successfully".

| Message | What it means | What to do |
| --- | --- | --- |
| Please enter vendor name | The name box is empty. | Type the vendor name. |
| Vendor name must be at least 2 characters | The name is too short. | Type a longer name. |
| Please enter a valid email | The email is not in a proper format. | Correct it or leave it empty. |
| Operation Failed: Failed to delete. Please try again later. (or a message from the server) | The vendor was not deleted. | Read the message. See the Vendors section for why a vendor may not be deleted. |

---

## View Inventory

![View Inventory](images/consumer/inventory_batches-d.png)
*The View Inventory screen with summary cards, filters, alerts and the batch table.*

### What it is
A list of every stock batch. A batch is one purchase of one product variant into one branch. It shows quantity, cost and expiry date.

### Where to find it
Left menu, **Inventory**, then **View Inventory**. You need the Inventory Batches permission. If you cannot see it, ask the owner.

### What you see
The page title is **Inventory Management**. The path at the top is Dashboard > Inventory.

**Buttons at the top right**

- **Export**: see the start of this part.
- **Add Inventory**: opens the Add New Inventory form.
- **Import Excel**: normally hidden (see below).

**Summary cards.** They follow the branch you choose in the filter.

| Card | Meaning |
| --- | --- |
| Total Batches | Number of batches. |
| Total Units | Units on hand minus units waiting for delivery. |
| Low Stock Items | Number of branch and variant pairs at or below their alert quantity. |
| Expiring Soon | Batches that expire in the next 30 days. |

**Alerts**

- A yellow alert **Items Expiring Soon** appears when there is at least one such batch. It says "You have N batches that will expire within the next 30 days. Please review and take necessary action." **View Details** opens the Expiring Items screen.
- A red alert **Branch-Based Low Stock Alert** appears when stock is low. It says "You have N branch-variant combinations below their alert thresholds. This includes stock levels across individual branches. Consider restocking these items." **View Details** opens the Low Stock screen.

**Filters**

| Filter | Notes |
| --- | --- |
| Search box ("Search by product name, variant, or batch number...") | Also finds the storage location. |
| **All Branches** | Shows one branch only. |
| **All Categories** | Shows one product category. You can type to search it. |
| "N batches found" | The number of batches that match. |
| **Clear all filters** link and **Reset Filters** button | Remove all filters. |
| **Active filters:** chips | Appear when a search or branch filter is on, for example Search: "rice" or Branch: Main Store. Press the x on a chip to remove it. |

**Table columns**

| Column | Meaning |
| --- | --- |
| Product | Product name (a link to the product page) with the variant below. |
| Batch No | The batch number. |
| Location | Storage location in a blue tag, or a dash if none. |
| Available | Units on hand minus units pending delivery, shown as "N units". |
| Pending Delivery | Units promised on orders not yet delivered. An orange tag shows when above 0. |
| Cost Price | Cost of one unit. |
| Total Value | Cost price times quantity on hand. |
| Branch | The branch that holds the batch. |
| Expiry | "No expiry", or the date with a tag. The tag says "Expired", or "Nd left" (for example "5d left"). The tag is red when 7 days or fewer are left and orange when 8 to 30 days are left. |
| Created | The date the batch was added. |
| Actions | Eye icon (View Details) and pencil icon (Edit). |

At the bottom you see "x-y of N batches", page numbers, the page size and a box to jump to a page.

> **Good to know:** The "Expired" tag exists on this list, but the Expiring Items screen only lists batches that have not yet expired. Do not rely on Expiring Items to show batches already past their date.

![View Inventory with the summary cards and alerts](images/consumer/inventory-batches-list-d.png)
*View Inventory with the summary cards and alerts.*

![A search for "rice" with the active filter chip](images/consumer/inventory-batches-search-d.png)
*A search for "rice" with the active filter chip.*

![The All Branches list](images/consumer/inventory-batches-branch-dropdown-d.png)
*The All Branches list.*

![The All Categories list](images/consumer/inventory-batches-category-dropdown-d.png)
*The All Categories list.*

### How to see the details of a batch
1. Open **Inventory**, then **View Inventory**.
2. Find the batch. Use the search box or filters if needed.
3. Press the eye icon (**View Details**) in the **Actions** column.

**What happens next:** The **Batch Details** window opens. It shows Product, Batch No, Location ("Not set" if empty), Available, Pending Delivery, Cost Price ("per unit"), Total Value, Branch, Vendor, Expiry Date (with an **Expiring Soon** tag if within 30 days) and Created.

![The Batch Details window](images/consumer/inventory-batches-details-d.png)
*The Batch Details window.*

### How to filter the batch list
1. Type in the search box, or choose a branch or a category.
2. Check the "N batches found" text and the chips under **Active filters:**.
3. To start again, press **Reset Filters** or **Clear all filters**.

**What happens next:** The table and the summary cards change to match the branch you chose.

### How to edit a batch
1. Press the pencil icon in the **Actions** column.
2. Change what you need (see the Edit Inventory notes in the next section).
3. Press **Update Inventory**.

**What happens next:** You return to View Inventory. See the next section for details.

> **Good to know:** There is no working Delete button on this list. The system does not allow a batch that still has stock to be deleted.

### How to export the list
1. Press **Export**.
2. Choose **Export as PDF**.

**What happens next:** A file called inventory.pdf is saved to your device. If it fails you see "Failed to export the list".

### Import from Excel (only if your shop has it switched on)
This button is normally not shown. If it is, **Import Excel** opens the window **Import Stock Intake from Excel**. It has a link **Download Stock Intake template**, a line "Required columns: ...", and a box "Click or drag the filled .xlsx file here" (maximum 5 MB, only the first sheet is read). The buttons are **Cancel** (or **Done** after finishing) and **Import** (or **Import N row(s)**). Nothing is saved unless every row is correct.

---

## Add Inventory (and Edit Inventory)

![Add New Inventory](images/consumer/inventory_batches_add-d.png)
*The Add New Inventory form before any product is chosen.*

### What it is
The form you use when stock arrives from a supplier. It records the new batch, its cost, selling prices, expiry date, storage place and what you have paid.

### Where to find it
Left menu, **Inventory**, then **Add Inventory**. You can also press **Add Inventory** on View Inventory. To change an existing batch, press the pencil icon on View Inventory (the page is then called **Edit Inventory**). You need the Inventory Batches permission.

### What you see
The page title is **Add New Inventory** (or **Edit Inventory**). The main card is **Inventory Details**.

| Field | Required | Notes |
| --- | --- | --- |
| Product | Yes | You can type to search. Cannot be changed when editing. |
| Variant | Yes | Available after you choose a product. Shows "Please select a product first" or "No variants found" when there is nothing to pick. Cannot be changed when editing. Choosing a variant fills the Regular Price and Wholesale Price and, when adding, a batch number. |
| Branch | Yes | The branch that receives the stock. Shows "Select branch". |
| Batch No # | Yes | Placeholder "Enter batch number". Hint: "Unique identifier for this stock entry". The refresh icon (**Generate batch number**) makes a new 6-digit number. Cannot be changed when editing. Must be new for this variant. |
| Regular Price | No | Selling price. Two decimals, not below 0. Switched off until Cost Price is above 0. |
| Profit % (Regular) | No | Linked to Regular Price. Type a percent and the price is worked out from the cost. The percent also updates when you change the price. Switched off until cost is above 0. Cannot go below -100. |
| Wholesale Price | No | Same rules as Regular Price. |
| Profit % (Wholesale) | No | Same rules as Profit % (Regular). |
| Cost Price | Yes | Placeholder "Enter cost price". Hint: "Cost per unit". Must be above 0. |
| Quantity | Yes | Placeholder "Enter quantity to add", with "units" beside it. Whole numbers, at least 1. Cannot be changed when editing. |
| Expiry Date | No | Placeholder "Select expiry date". Hint: "Leave empty if doesn't expire". Format YYYY-MM-DD. Dates in the past cannot be picked. |
| Supplier/Vendor | No | Hint: "Who did you purchase this from?". See the vendor picker above. |
| Storage Location | No | Hint: "Where this stock is kept - shown in product search". Example: A-3-2, Cold Room Rack 4. At most 100 characters. |

After you choose a variant, a blue box shows "Selected: Product - Variant".

After you choose a variant, a **Payment** card appears. It has the Payment Methods rows described earlier. **Total Cost** is cost price times quantity.

A **Summary** card shows the Product, **Quantity Adding** (N units), **Total Cost** and **Payment Status**:

| Payment Status | When |
| --- | --- |
| Paid (green) | Payments are equal to or above the total cost. |
| Partial | Some payment is entered, but less than the total. |
| Due (red) | No payment is entered. |

Buttons at the bottom: **Cancel** (back to the list) and **Add to Inventory** (or **Update Inventory** when editing).

> **Good to know:** Saving new Regular and Wholesale prices changes the selling prices of that variant. The old prices are kept in the price history.

> **Good to know:** If you leave the payment amount at 0 (or empty), the batch is saved as Due, meaning you owe the full cost to the supplier. The Summary shows "Due" in red while you fill the form. A batch with a cost price of 0 (free stock) is saved as Paid. A smaller payment than the total is saved as Partial. Due and Partial batches appear on Purchase Payments.

![The empty form](images/consumer/inventory-add-empty-d.png)
*The empty form.*

![Messages shown when you press Add to Inventory with the form empty](images/consumer/inventory-add-validation-d.png)
*Messages shown when you press Add to Inventory with the form empty.*

![After choosing product, variant and branch, the payment card and summary appear](images/consumer/inventory-add-product-chosen-d.png)
*After choosing product, variant and branch, the payment card and summary appear.*

![The vendor list with the Add new vendor button](images/consumer/inventory-add-vendor-dropdown-d.png)
*The vendor list with the Add new vendor button.*

![The expiry date picker (past dates are greyed out)](images/consumer/inventory-add-expiry-picker-d.png)
*The expiry date picker (past dates are greyed out).*

![Filled form with no payment: Remaining equals Total Cost and Payment Status is Due](images/consumer/inventory-add-filled-no-payment-d.png)
*Filled form with no payment: Remaining equals Total Cost and Payment Status is Due.*

![The payment method list](images/consumer/inventory-add-method-dropdown-d.png)
*The payment method list.*

![The bank list shown for a Card payment](images/consumer/inventory-add-bank-dropdown-d.png)
*The bank list shown for a Card payment.*

![A Card payment with no bank chosen is refused](images/consumer/inventory-add-provider-error-d.png)
*A Card payment with no bank chosen is refused.*

![A part payment: Payment Status shows Partial](images/consumer/inventory-add-partial-payment-d.png)
*A part payment: Payment Status shows Partial.*

![The two new batches in View Inventory](images/consumer/inventory-batches-new-batches-d.png)
*The two new batches in View Inventory.*

### How to add new stock
1. Open **Inventory**, then **Add Inventory**.
2. Choose the **Product**.
3. Choose the **Variant**.
4. Choose the **Branch**.
5. Check the **Batch No #**. Press the refresh icon if you want a different number, or type your own.
6. Type the **Cost Price** and the **Quantity**.
7. If you want, change **Regular Price**, **Wholesale Price** or the profit percent boxes.
8. If the goods expire, pick the **Expiry Date**.
9. Choose the **Supplier/Vendor** if you know it.
10. Type the **Storage Location** if you want to find the stock by place.
11. In the **Payment** card, choose the **Method**, type the **Amount** and add a **Reference** if you have one. Press **Add Payment Method** for more rows.
12. Read the **Summary** card.
13. Press **Add to Inventory**.

**What happens next:** You see "Inventory added successfully" and go back to View Inventory. The stock is added to the branch you chose, and a "purchase in" record is kept.

![Edit Inventory: product, variant, batch number and quantity are greyed out](images/consumer/inventory-edit-d.png)
*Edit Inventory: product, variant, batch number and quantity are greyed out.*

### How to edit a batch
1. On View Inventory, press the pencil icon of the batch.
2. Change the fields you need.
3. Press **Update Inventory**.

**What happens next:** You see "Inventory updated successfully" and go back to the list.

> **Good to know:** When editing, only these can change: Cost Price, Branch, Vendor, Storage Location, Expiry Date and the selling prices. Product, Variant, Batch No # and Quantity are locked. To change the quantity use an Inventory Adjustment (see below). If you save with the Expiry Date empty, the expiry date is removed. The form shows payments already recorded. If there are none, it shows a Cash payment equal to the full cost.

| Message | What it means | What to do |
| --- | --- | --- |
| Please select a product | No product chosen. | Choose a product. |
| Please select a product variant | No variant chosen. | Choose a variant. |
| Please select branch | No branch chosen. | Choose a branch. |
| Please enter batch number | Batch number is empty. | Type one or press the refresh icon. |
| Please enter cost price / Cost price must be positive | Cost is empty or not above 0. | Type a cost above 0. |
| Please enter quantity / Quantity must be at least 1 | Quantity is empty or below 1. | Type a whole number of 1 or more. |
| Location is too long | Storage Location is over 100 characters. | Shorten it. |
| CARD (or BANK TRANSFER, MFS) payment must have a provider selected | A payment row needs a bank or MFS. | Choose it. |
| Batch number "X" already exists for this variant with the same expiry date. | That batch number is already used. | Use a different batch number. |
| Batch number "X" already exists ... but the expiry date does not match the existing record. | The number is used and the expiry date is different. | Use a different batch number, or match the old expiry date. |
| Payments exceed total purchase cost | You entered more than the total cost. | Lower the payment amounts. |
| Payment amounts must be greater than zero | A payment row has 0. | Remove the row or type an amount. |
| Product variant not found / Branch not found / Vendor not found | The chosen item no longer exists. | Reload the page and choose again. |
| Failed to add inventory / Failed to update inventory (or a message from the server) | The save did not work. | Read the message, correct it and try again. |

---

## Inventory Transfer

![Inventory Transfers](images/consumer/inventory_transfers-d.png)
*The Inventory Transfers list with two pending transfers.*

### What it is
The list of transfers of stock between branches. A transfer is first Pending. It is then either completed (stock moves) or cancelled.

### Where to find it
Left menu, **Inventory**, then **Inventory Transfer**. You need the Inventory Transfer permission.

### What you see
The page title is **Inventory Transfers**. The path is Dashboard > Inventory > Transfers. The button **Create Transfer** is at the top right.

| Filter | Notes |
| --- | --- |
| Search box ("Search transfers...") | See the note below. |
| **All Statuses** | Pending, Completed or Cancelled. |
| **All Branches** | Matches transfers where the branch is the source or the destination. |
| **Reset** | Clears everything. |

> **Good to know:** The search box finds transfers by transfer number, notes, branch name, who created it, product, variant, SKU or batch number. It works together with the status and branch filters.

| Column | Meaning |
| --- | --- |
| Transfer ID | The number, such as #2. |
| From -> To | The source branch in bold and "to" the destination below it. "Warehouse" is shown if a branch name is blank. |
| Items | Number of different items. |
| Total Units | Total quantity moved. |
| Status | PENDING (orange), COMPLETED (green) or CANCELLED (red). |
| Created By | Who made the transfer. |
| Created Date | When it was made. |
| Actions | Icons described below. |

Actions on each row:

- Printer icon (**Print Slip**): a menu with **Transfer Slip** and **Chalan Slip**.
- Eye icon (**View Details**).
- Green check (**Complete Transfer**) and red cross (**Cancel Transfer**). These show only on PENDING rows.

At the bottom you see "x-y of N transfers".

![The transfers list with all three statuses](images/consumer/transfers-list-d.png)
*The transfers list with all three statuses.*

![The status filter](images/consumer/transfers-status-dropdown-d.png)
*The status filter.*

![Filtered to Cancelled](images/consumer/transfers-filter-cancelled-d.png)
*Filtered to Cancelled.*

![The branch filter](images/consumer/transfers-branch-dropdown-d.png)
*The branch filter.*

![Searching for "Gulshan"](images/consumer/transfers-search-d.png)
*Searching for "Gulshan".*

![A search with no match shows No data](images/consumer/transfers-search-empty-d.png)
*A search with no match shows No data.*

### How to see transfer details
1. Press the eye icon on the row.

**What happens next:** The **Transfer Details** window shows Transfer ID, Status, From, To, Created By, Created Date, Completed Date, Notes and a table of items (Product with variant and batch number, Quantity, Cost Price, Total Value).

![The Transfer Details window](images/consumer/transfers-details-d.png)
*The Transfer Details window.*

### How to print a transfer slip or chalan slip
1. Press the printer icon on the row.
2. Choose **Transfer Slip** or **Chalan Slip**.
3. In the preview window (titled "Transfer Slip #id" or "Chalan Slip #id", with "A4" and the file name), press **Print** or **Download**. Press **Close** to leave.

**What happens next:** The slip prints, or a PDF is saved with a name like transfer_slip-TR-5.pdf. If the slip cannot be shown you see "Failed to load the PDF".

![The print menu](images/consumer/transfers-print-menu-d.png)
*The print menu.*

### How to complete a pending transfer
1. Press the green check (**Complete Transfer**).
2. Read "Are you sure you want to complete this transfer? This will move the inventory."
3. Press **Yes, Complete** (or **Cancel** to stop).

**What happens next:** You see "Transfer completed successfully". The stock leaves the source batch and arrives at the destination. If the destination already has a batch with the same batch number, cost, expiry date and vendor, the units are added to it. Otherwise a new batch with those same details is made there, without a storage location. The move shows in Movement History as Transfer Out and Transfer In.

![The complete confirmation](images/consumer/transfers-complete-confirm-d.png)
*The complete confirmation.*

![Filtered to Completed](images/consumer/transfers-filter-completed-d.png)
*Filtered to Completed.*

![Transfer completed successfully](images/consumer/transfers-completed-toast-d.png)
*Transfer completed successfully.*

### How to cancel a pending transfer
1. Press the red cross (**Cancel Transfer**).
2. Read "Are you sure you want to cancel this transfer?"
3. Press **Yes, Cancel** (or **No** to stop).

**What happens next:** You see "Transfer cancelled successfully". Stock stays where it was.

![The cancel confirmation](images/consumer/transfers-cancel-confirm-d.png)
*The cancel confirmation.*

![After completing a transfer of 3 units, the batch has 3 units in Gulshan Outlet and 7 left in Main Store](images/consumer/inventory-batches-after-transfer-d.png)
*After completing a transfer of 3 units, the batch has 3 units in Gulshan Outlet and 7 left in Main Store.*

![Transfer cancelled successfully](images/consumer/transfers-cancelled-toast-d.png)
*Transfer cancelled successfully.*

![The list after completing and cancelling](images/consumer/transfers-list-after-d.png)
*The list after completing and cancelling.*

> **Good to know:** Creating a transfer does not take stock out of the source branch. Stock moves only when you complete it. Because of this, stock may be sold in the meantime, and completing the transfer can then fail with "Insufficient stock in source batch ...".

| Message | What it means | What to do |
| --- | --- | --- |
| Transfer completed successfully | Done. | Nothing. |
| Transfer cancelled successfully | Done. | Nothing. |
| Failed to complete transfer / Failed to cancel transfer (or a server message) | The action did not work. | Read the message and try again. |
| Transfer is not in pending status | The transfer was already completed or cancelled. | Reload the list. |
| Insufficient stock in source batch <number> to complete this transfer | The source batch has less stock than the transfer needs. | Cancel the transfer and create a smaller one, or add stock to the source. |
| Failed to load the PDF | The slip could not be shown. | Close and try again. |

---

## Add Transfer

![Create Inventory Transfer](images/consumer/inventory_transfers_add-d.png)
*The Create Inventory Transfer form before a source branch is chosen.*

### What it is
The form to start a transfer of chosen batches from one branch to another.

### Where to find it
Left menu, **Inventory**, then **Add Transfer** (or press **Create Transfer** on Inventory Transfer). You need the Inventory Transfer permission.

### What you see
The page title is **Create Inventory Transfer**. **Back to Transfers** is at the top right.

**Transfer Details card**

| Field | Required | Notes |
| --- | --- | --- |
| Source Branch | Yes | Placeholder "Select source branch". Changing it clears the items you chose. |
| Destination Branch | Yes | Placeholder "Select destination branch". The source branch is not offered. A swap icon sits between the two boxes. |
| Transfer Notes | No | Hint: "Optional notes about this transfer". Placeholder "Enter any additional notes about this transfer...". |

**Available Inventory card.** Its title includes the source branch name. It has a search box ("Search products...") and a table with Product, Batch No, Available (units on hand in that batch), Cost Price and an **Add** button. With nothing to show it says "No inventory found in this branch" (or "No inventory found in warehouse"). In the picture, before a source is chosen, the title shows "Unknown".

**Items to Transfer card.** It appears after you add a batch. Columns: Product (name, variant and batch number), Available, **Transfer Quantity** (at least 1, at most the batch quantity, "units" beside it, starts at 1), Total Value and a delete icon. Totals show **Total Items:**, **Total Units:** and **Total Value:**.

Buttons at the bottom: **Cancel** and **Create Transfer** (switched off until you add at least one item).

> **Good to know:** You choose the exact batch to move. The system does not pick a batch for you. The Available number in this list is the quantity on hand, but when you save, the system checks the quantity on hand minus units pending delivery. A transfer can be refused even if the list showed enough.

![The empty form](images/consumer/transfer-add-empty-d.png)
*The empty form.*

![Choosing the source branch](images/consumer/transfer-add-source-dropdown-d.png)
*Choosing the source branch.*

![Available Inventory for the source branch](images/consumer/transfer-add-source-chosen-d.png)
*Available Inventory for the source branch.*

![The destination list leaves out the source branch](images/consumer/transfer-add-destination-dropdown-d.png)
*The destination list leaves out the source branch.*

![Searching the available batches](images/consumer/transfer-add-search-batches-d.png)
*Searching the available batches.*

![The chosen item in Items to Transfer; the Add button is greyed for a batch already added](images/consumer/transfer-add-items-added-d.png)
*The chosen item in Items to Transfer; the Add button is greyed for a batch already added.*

![Quantity set to 3 with the totals shown](images/consumer/transfer-add-quantity-set-d.png)
*Quantity set to 3 with the totals shown.*

### How to create a transfer
1. Open **Inventory**, then **Add Transfer**.
2. Choose the **Source Branch**.
3. Choose the **Destination Branch**.
4. Type **Transfer Notes** if you want.
5. In **Available Inventory**, search if needed and press **Add** next to each batch you want to move.
6. In **Items to Transfer**, set the **Transfer Quantity** for each item. Press the delete icon to remove an item.
7. Check **Total Items**, **Total Units** and **Total Value**.
8. Press **Create Transfer**.

**What happens next:** You see "Transfer created successfully" and go to the Inventory Transfers list. The new transfer is Pending. Stock does not move until you complete it from that list.

| Message | What it means | What to do |
| --- | --- | --- |
| This batch is already added | You pressed Add on a batch already in the list. | Change its quantity in Items to Transfer. |
| Please select both source and destination branches | One branch is missing. | Choose both. |
| Source and destination branches cannot be the same | Both are the same branch. | Choose different branches. |
| Please add at least one item to transfer | The list of items is empty. | Add a batch. |
| Please check the quantities for all items | A quantity is not valid. | Fix quantities (at least 1 and not above Available). |
| Transfer created successfully | Done. | Complete it from the list. |
| Failed to create transfer (or a server message) | The save did not work. | Read the message and try again. |
| Insufficient available quantity in batch N. Available: A, Requested: R | You asked for more than is available. | Lower the quantity. |
| Batch with ID N not found in <branch> | The batch is no longer in that branch. | Reload and choose again. |

---

## Inventory Adjustment

![Inventory Adjustments](images/consumer/inventory_adjustments-d.png)
*The Inventory Adjustments list.*

### What it is
The history of manual stock corrections, such as damaged or lost goods.

### Where to find it
Left menu, **Inventory**, then **Inventory Adjustment**. You need the Inventory Adjustment permission.

> **Good to know:** The list may also need the Inventory Batches permission to load its data. If the list is empty or refused even though you have the Inventory Adjustment permission, ask the owner to check your permissions. We have not confirmed this.

### What you see
The page title is **Inventory Adjustments**. The button **Create Adjustment** is at the top right.

| Filter | Notes |
| --- | --- |
| Search box ("Search adjustments...") | See the note below. |
| **All Locations** | Shows one branch only. |
| **Reset** | Clears the filters. |

> **Good to know:** The search box finds adjustments by reason, notes, branch, who created it, batch, variant, SKU or product. It works together with the **All Locations** filter.

| Column | Meaning |
| --- | --- |
| ID | The number, such as #3. |
| Product | A link to the product, with the variant below. |
| Location | The branch in a blue tag ("Warehouse" if none). |
| Adjustment | "Quantity Added" (green) or "Quantity Removed" (red). |
| Inventory Change | For example "+5 units" or "-3 units". |
| Reason | The reason, shortened. Point at it to see the whole text. |
| Created By | Who made it. |
| Date | When it was made. |
| Actions | Eye icon (View Details). |

At the bottom you see "x-y of N adjustments".

![The adjustments list](images/consumer/adjustments-list-d.png)
*The adjustments list.*

![Searching for "Damaged"](images/consumer/adjustments-search-d.png)
*Searching for "Damaged".*

![No match](images/consumer/adjustments-search-empty-d.png)
*No match.*

![The All Locations list](images/consumer/adjustments-location-dropdown-d.png)
*The All Locations list.*

### How to see adjustment details
1. Press the eye icon on the row.

**What happens next:** The **Adjustment Details** window shows Adjustment ID, Product, Variant, Location, Inventory Change, Reason, Created By, Date, Notes and Batch Information (Batch Number and Cost Price).

---

![The Adjustment Details window](images/consumer/adjustments-details-d.png)
*The Adjustment Details window.*

## Add Adjustment

![Create Inventory Adjustment](images/consumer/inventory_adjustments_add-d.png)
*The Create Inventory Adjustment form before a product is chosen.*

### What it is
The form to add to or remove from the stock of one batch, for example after a stock count or when goods are damaged.

### Where to find it
Left menu, **Inventory**, then **Add Adjustment** (or press **Create Adjustment** on the Inventory Adjustments list). You need the Inventory Adjustment permission.

### What you see
The page title is **Create Inventory Adjustment**. **Back to Adjustments** is at the top right.

**Product Information card**

| Field | Required | Notes |
| --- | --- | --- |
| Product | Yes | Placeholder "Select product". |
| Variant | Yes | Placeholder "Select variant". Available after you choose a product. |
| Location | Yes | Placeholder "Select location". This is the branch. Available after you choose a variant. |
| Batch | Yes | Placeholder "Select batch". Appears after variant and location are chosen. Each choice shows the batch number and "N units - cost". |

After a batch is chosen, a small card shows **Stock:** N units, **Cost:** and **Batch:**. If there is no batch you see "No batches available" and "No inventory batches found for this variant in <location>".

**Adjustment Details card** (appears after you choose a batch)

| Field | Required | Notes |
| --- | --- | --- |
| Inventory Action | Yes | **Add to Inventory** (chosen at first) or **Remove from Inventory**. |
| Quantity | Yes | Starts at 1. Must be above 0. Shows "u" beside it. When removing it cannot be more than the units in the batch. |
| Reason | Yes | Placeholder "Select reason for adjustment". Choices: Stock Count Correction, Damaged Goods, Expired Items, Lost/Stolen, Supplier Return, Quality Control, System Error Correction, Other. |
| Notes | No | Placeholder "Additional notes (optional)". |

**Inventory Summary:** shows Current (N u), Adding or Removing (+N u or -N u) and New (N u). If the new number would be below zero it turns red and you see "Warning: This will result in negative stock!".

Buttons: **Cancel** and **Create Adjustment** (switched off until a batch is chosen).

![The empty form](images/consumer/adjustments-add-empty-d.png)
*The empty form.*

![The location list](images/consumer/adjustments-add-location-dropdown-d.png)
*The location list.*

![The batch list shows units and cost](images/consumer/adjustments-add-batch-dropdown-d.png)
*The batch list shows units and cost.*

![Batch chosen, with the Adjustment Details card](images/consumer/adjustments-add-batch-chosen-d.png)
*Batch chosen, with the Adjustment Details card.*

![Please select a reason](images/consumer/adjustments-add-validation-d.png)
*Please select a reason.*

![Removing the whole batch shows New: 0u](images/consumer/adjustments-add-too-many-d.png)
*Removing the whole batch shows New: 0u.*

![The reason list](images/consumer/adjustments-add-reason-dropdown-d.png)
*The reason list.*

![Remove 2 units for Damaged Goods](images/consumer/adjustments-add-remove-filled-d.png)
*Remove 2 units for Damaged Goods.*

![Adjustment created successfully](images/consumer/adjustments-add-success-d.png)
*Adjustment created successfully.*

### How to adjust stock
1. Open **Inventory**, then **Add Adjustment**.
2. Choose the **Product**, then the **Variant**, then the **Location**.
3. Choose the **Batch**. Check the Stock, Cost and Batch shown.
4. Under **Inventory Action**, choose **Add to Inventory** or **Remove from Inventory**.
5. Type the **Quantity**.
6. Choose the **Reason**.
7. Type **Notes** if you want.
8. Read the **Inventory Summary**.
9. Press **Create Adjustment**.

**What happens next:** You see "Adjustment created successfully" and go to the Inventory Adjustments list. The batch changes at once. There is no approval step. The change shows in Movement History.

| Message | What it means | What to do |
| --- | --- | --- |
| Please select a product / variant / location | A choice is missing. | Make the choice. |
| Please select a batch | No batch chosen. | Choose a batch. |
| Please enter quantity | Quantity is empty. | Type a number. |
| Quantity must be greater than 0 | Quantity is 0 or less. | Type a number above 0. |
| Please select a reason | No reason chosen. | Choose one. |
| Cannot remove more than the available N units | The quantity is above the batch stock. | Lower it. |
| Cannot remove N units. Only M units available. | Same as above, shown when you save. | Lower it. |
| Warning: This will result in negative stock! | The new stock would be below zero. | Check the quantity. |
| No batches available | There is no stock for that variant at that location. | Choose another location or variant. |
| Failed to create adjustment (or a server message) | The save did not work. | Read the message and try again. |

---

## Stock Overview

![Stock Overview](images/consumer/inventory_stock-by-variant-d.png)
*The Stock Overview list, one row per product variant.*

### What it is
One row per product variant, showing stock in each branch.

### Where to find it
Left menu, **Inventory**, then **Stock Overview**. You need the Inventory Batches permission.

### What you see

| Filter | Notes |
| --- | --- |
| Search box ("Search products or variants...") | Also finds product code, SKU, barcode and location. |
| **All Branches** | Shows one branch. |
| **Low Stock Only:** switch (Yes or No) | Shows only low stock variants. |
| **Reset** | Clears the filters. |
| **Active filters:** chips | Show what is on. |

| Column | Meaning |
| --- | --- |
| Product | Link to the product, the variant and "SKU: x". |
| Available Stock | Number with "units". A red warning icon ("Low stock alert") shows if low. |
| Pending Delivery | Units waiting for delivery. |
| Alert Threshold | The alert quantity, or "Not set". |
| Branches | Tags such as "Main Store: 3". |
| Location | Storage locations. |
| Status | Low Stock (red), In Stock (green) or Out of Stock (grey). |
| Actions | Eye icon, **View Stock** and **History**. |

At the bottom you see "x-y of N variants". Available stock is the quantity on hand minus units pending delivery. A variant is Low Stock when an alert quantity above 0 is set and any one branch is at or below it (or the branch you chose in the filter).

> **Good to know:** The **Low Stock Only:** switch is applied after the page is loaded. A page may therefore show fewer rows than the page size, and some low stock items may be on other pages.

![The Stock Overview list](images/consumer/stock-overview-list-d.png)
*The Stock Overview list.*

![Low Stock Only switched on](images/consumer/stock-overview-low-only-d.png)
*Low Stock Only switched on.*

![Search](images/consumer/stock-overview-search-d.png)
*Search.*

### How to see stock details of a variant
1. Press the eye icon (**View Details**).

**What happens next:** The **Variant Stock Details** window shows Product, Variant, SKU, Available Stock, Pending Delivery, Alert Threshold and a **Stock by Branch** table.

![The Variant Stock Details window](images/consumer/stock-overview-details-d.png)
*The Variant Stock Details window.*

### How to open the full stock page or history
1. Press **View Stock** (tooltip "View Variant Stock") to open Variant Stock Details.
2. Press **History** (tooltip "Movement History") to open Movement History.

### How to find low stock items
1. Turn **Low Stock Only:** to **Yes**.
2. Optionally choose a branch.

**What happens next:** The list shows only variants that are low.

---

## Variant Stock Details

### What it is
A full page about the stock of one variant, with its branches and batches.

### Where to find it
From **Stock Overview** press **View Stock**, or from **Low Stock** press **View Stock**. You need the Inventory Batches permission. It has no menu entry of its own.

### What you see
The title is the product name and variant. Buttons: **Movement History** and **Back to Stock Overview**. If nothing is found you see "Variant stock data not found".

- **Variant Information** card: Product, Variant, SKU and Alert Threshold ("Not set" if none).
- Four cards: **Total Stock** (units, with a bar compared to the alert threshold), **Total Value**, **Branches** (branches with stock out of all branches) and **Status** (Low Stock, In Stock or Out of Stock).
- **Stock by Branch** card: one tile per branch with "N units" and "Value:". Value turns red when stock is at or below the alert threshold.
- **Inventory Batches** card: an **All Branches** filter and a table with Batch Reference, Branch, Location, Quantity, Cost Price, Total Value, Vendor, Expiry Date and Created. A **Total** row at the bottom shows units and value. You see "x-y of N batches".

![The Variant Stock Details page](images/consumer/variant-stock-details-d.png)
*The Variant Stock Details page.*

### How to read the stock of a variant
1. On Stock Overview, find the variant and press **View Stock**.
2. Look at the cards at the top, then the branch tiles.
3. Use **All Branches** to show the batches of one branch.
4. Press **Movement History** to see changes, or **Back to Stock Overview** to leave.

**What happens next:** Nothing is changed. This page is for viewing only.

---

## Movement History

### What it is
A list of stock changes for one variant: adjustments and transfers.

### Where to find it
From **Stock Overview** press **History**, or from **Variant Stock Details** press **Movement History**. You need the Inventory Batches permission. The path is Inventory > Stock Overview > the variant.

### What you see
The title is "Movement History" followed by the variant. The top shows Product, Variant, SKU and Current Stock. If an alert quantity is set you also see **Alert Quantity (Per Branch)** with the text "Low stock alerts are triggered when any branch falls below this threshold".

Controls: a **Select branch** box, **Refresh** and **Back to Stock Details**.

| Column | Meaning |
| --- | --- |
| Date | When it happened. |
| Type | Adjustment (blue), Transfer In (green) or Transfer Out (red). You can filter this column. |
| Quantity Change | Plus in green, minus in red. |
| Batch | The batch number. |
| Location | The branch. |
| Reason | The reason. For transfers it says "Transfer to X" or "Transfer from X". |
| Notes | Notes entered. |
| User | Who did it. |

You can choose 10, 20, 50 or 100 rows per page. The count reads "x-y of N movements".

> **Good to know:** Only adjustments and transfers are listed. Purchases and sales do not appear here. Transfers are listed for every status, including Pending and Cancelled ones (a cancelled transfer appears as a Transfer Out and a Transfer In with a note starting "Cancelled"), and use the date the transfer was created. In our check, the Product, Variant and SKU lines at the top of the page were empty or showed N/A. The page count is based on adjustments only. Treat page numbers and totals as approximate.

![Movement History for a variant](images/consumer/movement-history-d.png)
*Movement History for a variant.*

### How to see what changed for a variant
1. On Stock Overview press **History** on the variant's row.
2. Choose a branch in **Select branch** if you want one branch only.
3. Use the filter on the **Type** column to show one kind of movement.
4. Press **Refresh** to load again, or **Back to Stock Details** to leave.

**What happens next:** Nothing is changed.

| Message | What it means | What to do |
| --- | --- | --- |
| Failed to load variant information. Please try again. | The page could not load the variant. | Press **Go Back** and try again. |
| Failed to load movement history. Please try again. | The list could not load. | Press **Refresh**. |

---

## Expiring Items

![Expiring Inventory](images/consumer/inventory_expiring-d.png)
*The Expiring Inventory screen with one batch that expires within 30 days.*

### What it is
A list of batches with stock that will expire in the next few days. The default is 30 days.

### Where to find it
Left menu, **Inventory**, then **Expiring Items**. You need the Inventory Batches permission.

### What you see
The page title is **Expiring Inventory**.

| Filter | Notes |
| --- | --- |
| Search box ("Search products, variants, or batch numbers...") | Searches the rows already loaded on this page. |
| **All Branches** | Shows one branch. |
| **Expiring within** [days] | A number from 1 to 365. The default is 30. |
| Quick filters | **This Week** (7 days), **This Month** (30 days), **3 Months** (90 days). |
| **Reset** | Clears the filters. |
| Chip "Expiring within: N days" | Shows the days now chosen. |

**Summary numbers**

| Card | Meaning |
| --- | --- |
| Expired/Today | Batches already expired or expiring today. |
| This Week | Batches with 7 days or fewer left. |
| This Month | Batches with 8 to 30 days left. |
| Total Items | All batches listed. |

| Column | Meaning |
| --- | --- |
| Product | Product with variant. |
| Batch Reference | The batch number. |
| Quantity | Units in the batch. |
| Total Value | Cost value of the batch. |
| Branch | The branch. |
| Expiry Date | The date with a tag: "Expires Today" or "Nd left". The tag is orange for 7 days or fewer, yellow up to 30 days and green beyond. You can sort by this column. The soonest date comes first. |
| Actions | Eye icon (View Details). |

Urgent rows are tinted red or orange. At the bottom you see "x-y of N expiring batches".

> **Good to know:** This list covers batches that expire from now until the number of days you chose. Batches whose date has already passed are not listed, so the Expired/Today number will usually be 0 or show only today's items. The Home page counts "Expiring Soon" using 30 days. This page uses the days you pick.

![Expiring Items at 30 days; urgent rows are tinted](images/consumer/expiring-list-d.png)
*Expiring Items at 30 days; urgent rows are tinted.*

### How to find batches that expire soon
1. Open **Inventory**, then **Expiring Items**.
2. Press **This Week**, **This Month** or **3 Months**, or type a number in **Expiring within**.
3. Choose a branch if needed.
4. Look at the summary and the table.

**What happens next:** The list and the summary change to match the days you chose.

![The This Week quick filter](images/consumer/expiring-this-week-d.png)
*The This Week quick filter.*

![The 3 Months quick filter](images/consumer/expiring-3-months-d.png)
*The 3 Months quick filter.*

![The Expiring Batch Details window with a "4d left" tag](images/consumer/expiring-details-d.png)
*The Expiring Batch Details window with a "4d left" tag.*

![A search with no match](images/consumer/expiring-empty-search-d.png)
*A search with no match.*

### How to see details of an expiring batch
1. Press the eye icon on the row.

**What happens next:** The **Expiring Batch Details** window shows Product, Batch Reference, Quantity, Cost Price, Total Value, Branch, Expiry Date, Vendor and Created.

---

## Low Stock

![Low Stock Items](images/consumer/inventory_low-stock-d.png)
*The Low Stock Items screen with one item at warning level.*

### What it is
A list of variants whose stock in a branch is at or below the alert quantity set on the product. Each affected branch is its own row.

### Where to find it
Left menu, **Inventory**, then **Low Stock**. You need the Inventory Batches permission. A variant only appears here if an alert quantity above 0 has been set on the product variant.

### What you see
The page title is **Low Stock Items**.

- A top alert **Low Stock Alert**: "You have N items below their alert thresholds. X critical, Y warning level." with the button **View All Stock** (opens Stock Overview).
- Four cards: **Critical**, **Warning**, **Attention** and **Total Items**.

| Filter | Notes |
| --- | --- |
| Search box ("Search products, variants, or SKU...") | Searches by name, variant or SKU. |
| **All Branches** | Shows one branch. |
| **Reset** | Clears the filters. |

How urgency is worked out (stock compared with the alert quantity):

| Urgency | When |
| --- | --- |
| Out of Stock (critical) | Stock is 0. |
| Critical | 25 percent or less. |
| Warning | Above 25 and up to 50 percent. |
| Low (attention) | Above 50 percent. |

| Column | Meaning |
| --- | --- |
| Product | Link to the product with a warning icon, the variant and SKU. |
| Current Stock | Units with a bar. |
| Alert Threshold | The alert quantity. |
| Stock Ratio | Percent tag. You can sort by it. |
| Urgency | The level above. You can sort by it. |
| Affected Branch | The low branch in a red tag. |
| All Branches | Tags for all branches. |
| Actions | Eye icon and **View Stock**. |

At the bottom you see "x-y of N low stock items". Stock counted is the quantity on hand minus units pending delivery.

![Low Stock Items with urgency levels](images/consumer/low-stock-list-d.png)
*Low Stock Items with urgency levels.*

![The Low Stock Item Details window](images/consumer/low-stock-details-d.png)
*The Low Stock Item Details window.*

![Searching for "Denim"](images/consumer/low-stock-search-d.png)
*Searching for "Denim".*

### How to see details of a low stock item
1. Press the eye icon on the row.

**What happens next:** The **Low Stock Item Details** window shows the Stock Level and a table of Branch, Stock and Status ("Available" or "Out of Stock"). It has a **View Stock** button.

### How to open the stock page of a low item
1. Press **View Stock** on the row.

**What happens next:** The Variant Stock Details page opens.

---

## Vendors

![Vendors](images/consumer/vendors-d.png)
*The Vendors list.*

### What it is
The list of suppliers you buy from. You can add, view, change and delete them.

### Where to find it
Left menu, **Inventory**, then **Vendors**. You need the Vendors permission. The system may also need the Inventory Batches permission to load the list. If you cannot see the menu or the list is refused, ask the owner.

### What you see
The page title is **Vendors**. The button **Add New Vendor** is at the top right.

| Column | Meaning |
| --- | --- |
| Name | A link to the vendor page, with "Contact: x" below if a contact person is saved. |
| Phone | The phone number, or "No phone". |
| Email | The email, or "No email". |
| Address | Shortened address, or "No address". |
| Created Date | When it was added. |
| Actions | Eye icon (view), pencil icon (edit) and red bin icon (delete). |

At the bottom you see "x-y of N vendors". If the list cannot load you see "Failed to load vendors".

**Add Vendor drawer.** It opens from the right. Its title is **Add Vendor** (or **Update Vendor** when editing).

| Field | Required | Notes |
| --- | --- | --- |
| Vendor Name | Yes | Placeholder "Enter vendor name". |
| Contact Person | No | Placeholder "Enter contact person name". |
| Phone | No | Placeholder "Enter phone number". Only digits, spaces and the signs - + ( ) are allowed. |
| Email | No | Placeholder "Enter email address". |
| Address | No | Three-line box. Placeholder "Enter vendor address (optional)". |

The button at the bottom is **Create Vendor** (or **Update Vendor**).

![The Vendors list](images/consumer/vendors-list-d.png)
*The Vendors list.*

![The empty Add Vendor drawer](images/consumer/vendors-add-drawer-empty-d.png)
*The empty Add Vendor drawer.*

### How to add a vendor
1. Open **Inventory**, then **Vendors**.
2. Press **Add New Vendor**.
3. Type the **Vendor Name** and any other details.
4. Press **Create Vendor**.

**What happens next:** You see "Vendor created successfully" and the vendor is in the list.

![Vendor name is required](images/consumer/vendors-add-drawer-validation-d.png)
*Vendor name is required.*

![Phone and email messages](images/consumer/vendors-add-drawer-bad-values-d.png)
*Phone and email messages.*

![A filled form](images/consumer/vendors-add-drawer-filled-d.png)
*A filled form.*

![The new vendor in the list](images/consumer/vendors-created-toast-d.png)
*The new vendor in the list.*

### How to edit a vendor
1. Press the pencil icon on the vendor row.
2. Change the fields.
3. Press **Update Vendor**.

**What happens next:** You see "Vendor updated successfully".

![The Update Vendor drawer](images/consumer/vendors-edit-drawer-d.png)
*The Update Vendor drawer.*

![Vendor updated successfully](images/consumer/vendors-updated-toast-d.png)
*Vendor updated successfully.*

### How to delete a vendor
1. Press the red bin icon on the vendor row.
2. The question "Delete this vendor?" appears with the text "This action cannot be undone. All inventory batches from this vendor will lose vendor association."
3. Press **Yes** to delete or **No** to stop.

**What happens next:** If the vendor can be deleted you see "Vendor deleted successfully".

![The delete question](images/consumer/vendors-delete-confirm-d.png)
*The delete question.*

![A vendor with batches cannot be deleted](images/consumer/vendors-delete-refused-d.png)
*A vendor with batches cannot be deleted.*

> **Good to know:** The warning text says batches would lose their vendor. In practice a vendor that has any stock batches cannot be deleted. You see the message "Cannot delete vendor with N associated batches". Only vendors with no batches can be removed.

![A vendor with no batches was deleted](images/consumer/vendors-deleted-toast-d.png)
*A vendor with no batches was deleted.*

### How to open a vendor's page
1. Press the vendor's name or the eye icon.

**What happens next:** The Vendor Details page opens (next section).

| Message | What it means | What to do |
| --- | --- | --- |
| Vendor name is required | Name is empty. | Type a name. |
| Please enter a valid phone number | The phone has letters or other signs. | Use digits, spaces and - + ( ) only. |
| Please enter a valid email address | Email is not in a proper format. | Correct it or leave it empty. |
| Vendor created successfully / Vendor updated successfully / Vendor deleted successfully | Done. | Nothing. |
| Failed to create vendor / Failed to update vendor | The save did not work. | Check the fields and try again. |
| Cannot delete vendor with N associated batches | The vendor has stock batches. | Keep the vendor. |
| Failed to load vendors | The list did not load. | Reload the page. |

---

## Vendor Details

### What it is
A page about one vendor: contact details, what you bought, what you paid and what you still owe.

### Where to find it
On **Vendors**, press the vendor name or the eye icon. You need the Vendors permission.

### What you see
The title is the vendor name. **Back to Vendors** returns to the list. If the page cannot load you see "Failed to load vendor details" and you are sent back to Vendors.

- **Vendor Information** card: Name, Contact, Phone, Email, Address and Created.
- **Purchase History (N)** card: Batch #, Product, Branch, Qty, Cost Price, Total Cost, Paid, Remaining (red if money is owed), Status (Paid, Partial or Due) and Date. By default the first 50 batches are shown.
- **Payment History (N)** card (only if payments exist): Date, Batch #, Product, Method, Amount and Reference.
- Four cards at the right: **Total Purchases**, **Total Paid**, **Total Owed** (red when above 0) and **Total Batches**.

How the amount owed is worked out: for each batch, Total Cost is the cost price times the quantity you originally bought. It is not reduced by sales, returns or adjustments. Remaining is Total Cost minus Paid. Total Owed is all total costs minus all payments. Paid includes payments entered when stock was added and payments made on the Purchase Payments screen.

> **Good to know:** For a batch created by a transfer, the current quantity is used instead of the original quantity. Small negative remaining amounts can offset other batches in Total Owed.

![The Vendor Details page](images/consumer/vendor-details-d.png)
*The Vendor Details page.*

![Purchase History columns Cost Price to Date](images/consumer/vendor-details-scrolled-right-d.png)
*Purchase History columns Cost Price to Date.*

### How to see what you owe a vendor
1. Open **Vendors** and press the vendor name.
2. Read **Total Owed**, then check **Purchase History** for batches with a red Remaining.

**What happens next:** Nothing is changed. To pay, use Purchase Payments.

---

## Purchase Payments

![Purchase Payments](images/consumer/purchase-payments-d.png)
*The Purchase Payment Ledger showing one partly paid batch.*

### What it is
A list of purchased batches with what you paid and what you still owe your supplier. You can pay from here.

### Where to find it
Left menu, **Inventory**, then **Purchase Payments**. You need the Inventory Batches permission. The path at the top is Home > Purchase Payments.

### What you see
The page title is **Purchase Payments** and the card is **Purchase Payment Ledger**.

| Card | Meaning |
| --- | --- |
| Tracked Batches | Total number of batches. |
| Total Paid | Total of the rows on the current page only. |
| Total Owed | Total of the rows on the current page only. |

| Filter | Notes |
| --- | --- |
| Search box ("Search by batch #, product") | Waits about 0.3 seconds after typing. |
| Date range (Start date, End date) | Filters by the date the batch was created. Dates look like "Jan 05, 2026". |
| Payment status | **Unpaid** (the first choice, shows Due and Partial), **All**, **Due**, **Partial**, **Paid**, **No Vendor** (batches without a vendor). |
| **Filter by branch** | Shown only if you have more than one branch. |
| **Clear Filters** link | Appears when anything is different from the start. |

| Column | Meaning |
| --- | --- |
| Batch # | The batch number. |
| Product | "Product - Variant". |
| Vendor | The supplier. |
| Branch | The branch. |
| Qty | Current quantity. |
| Total Cost | Full cost of the purchase. |
| Paid | Amount paid. |
| Remaining | Amount still owed (red). |
| Status | PAID (green), DUE (red) or PARTIAL (orange). |
| Actions | Blue **Pay** button, or grey **View** button when the batch is paid, has no quantity or has nothing left to pay. |

At the bottom you see "Total N batches" and a page size of 10, 20, 50 or 100.

> **Good to know:** A purchase saved with no payment shows here as DUE with the full cost in Remaining. By default only unpaid batches (Due and Partial) are listed. Choose **All** or **Paid** to see paid ones. The Total Paid and Total Owed cards add up the rows on the current page only.

![The ledger with Due and Partial batches](images/consumer/purchase-payments-ledger-d.png)
*The ledger with Due and Partial batches.*

### How to find what you owe
1. Open **Inventory**, then **Purchase Payments**.
2. Leave the status as **Unpaid**, or choose another.
3. Use the search box, date range or branch to narrow the list.
4. Read the **Remaining** column.

**What happens next:** Nothing is changed. Press **Clear Filters** to go back to the start.

![The payment status list](images/consumer/purchase-payments-status-dropdown-d.png)
*The payment status list.*

![The date range picker](images/consumer/purchase-payments-date-picker-d.png)
*The date range picker.*

![The branch filter](images/consumer/purchase-payments-branch-dropdown-d.png)
*The branch filter.*

![Search with status All](images/consumer/purchase-payments-search-all-d.png)
*Search with status All.*

### How to open a batch to pay
1. Press **Pay** on the batch row (or **View** if it is paid).

**What happens next:** The Make Payment page opens.

---

## Make Payment

### What it is
The page where you record a payment to your supplier for one batch.

### Where to find it
On **Purchase Payments**, press **Pay** or **View** on a batch. You need the Inventory Batches permission.

### What you see
The title is "Make Payment - Batch #" followed by the batch number. **Back to Purchase Payments** is at the top. While loading you see "Loading batch details...". The last item in the path is "Make Payment", or "Payment Details" when nothing can be paid.

**Left side**

- **Batch Information** card: Batch Number, Product, Branch, Vendor ("No vendor" if none), Quantity and Status, then Total Cost, Paid Amount and Remaining Amount.
- **Payment History** card (only if payments exist): Date, Method, Amount and Reference.

**Right side**

- **Record New Payment** card with the Payment Methods rows (described at the start of this part). The first row is Cash and already holds the full remaining amount. Below are **Total Payment Amount:** and **Remaining After Payment:**, and the buttons **Record Payment** and **Cancel**.
- If nothing can be paid, the card is called **Payment Details** and says "This batch has no payable quantity or balance. Review the payment history on the left."

![Make Payment for a Due batch](images/consumer/make-payment-form-d.png)
*Make Payment for a Due batch.*

![Amount 0 is refused](images/consumer/make-payment-no-amount-d.png)
*Amount 0 is refused.*

![Paying more than is owed is refused](images/consumer/make-payment-too-much-d.png)
*Paying more than is owed is refused.*

![MFS with no provider chosen](images/consumer/make-payment-provider-missing-d.png)
*MFS with no provider chosen.*

![The MFS list](images/consumer/make-payment-mfs-dropdown-d.png)
*The MFS list.*

![Part payment by bKash](images/consumer/make-payment-filled-partial-d.png)
*Part payment by bKash.*

![Two payment rows](images/consumer/make-payment-two-rows-d.png)
*Two payment rows.*

![Payment recorded successfully](images/consumer/make-payment-success-d.png)
*Payment recorded successfully.*

![Partial batch with Payment History](images/consumer/make-payment-history-d.png)
*Partial batch with Payment History.*

![A paid batch shows Payment Details only](images/consumer/make-payment-paid-view-d.png)
*A paid batch shows Payment Details only.*

![Filtered to Paid](images/consumer/purchase-payments-paid-filter-d.png)
*Filtered to Paid.*

### How to pay a supplier for a batch
1. Open **Inventory**, then **Purchase Payments**.
2. Press **Pay** on the batch.
3. Check the amounts under **Batch Information**.
4. In **Record New Payment**, choose the **Method**. For Card, Bank Transfer or MFS, also choose the bank or MFS.
5. Change the **Amount** if you are paying only part of it.
6. Type a **Reference** if you have one.
7. Press **Add Payment Method** if you pay in more than one way.
8. Check **Total Payment Amount:** and **Remaining After Payment:**.
9. Press **Record Payment**.

**What happens next:** You see "Payment recorded successfully!" and go back to Purchase Payments. The batch becomes Paid when the total paid reaches the total cost. Otherwise it is Partial. The vendor's Total Paid and Total Owed are updated.

| Message | What it means | What to do |
| --- | --- | --- |
| Loading batch details... | The page is loading. | Wait. |
| Failed to load batch details | The batch could not load. You are sent back to the ledger. | Try again. |
| This batch has no payable quantity or balance | Nothing can be paid on this batch. | Press **Cancel** or go back. |
| Please add at least one payment with an amount | All amounts are empty or 0. | Type an amount. |
| CARD (or BANK TRANSFER, MFS) payment must have a provider selected | A bank or MFS is missing. | Choose it. |
| Total payment amount (BDT x) exceeds remaining amount (BDT y) | You are paying more than is owed. | Lower the amount to y or less. |
| Payment recorded successfully! | Done. | Nothing. |
| Failed to record payment (or a server message) | The payment was not saved. | Read the message and try again. |
| Batch is already fully paid | Nothing is left to pay. | Reload the ledger. |
| Cannot make a vendor payment for a batch with zero quantity | The batch has no stock left. | Nothing can be paid here. |
| Batch changed. Refresh and try the payment again. | The batch was changed by someone else. | Reload the page and try again. |
| Total payment amount must be greater than 0 | The total is 0. | Type an amount above 0. |
