# Part 5 - Online orders, delivery, customers, rewards, reports and printing

This part covers the screens you use after a sale is made: online orders and couriers, goods delivered later, sales targets, staff sales figures, the Business Report, shop costs, customers, reward points, and printing.

Some notes that apply to every screen in this part:

- Money is in taka (BDT). On screen it shows a small round taka icon followed by the number with two decimals. A few older labels write "BDT" as text.
- Times and dates follow Bangladesh time (Asia/Dhaka). "Today" means midnight to midnight in Dhaka.
- You only see a menu entry if your role has the permission for it. A group such as **Sales** or **Customers** disappears when you can see none of the entries inside it. If you open a page you have no permission for, the app blocks it.
- Error messages appear as a small message at the top of the screen. Where the server gives a clear reason, you see that reason. Otherwise you see the fallback text listed in the tables below.

---

## Online Orders

*Page title: **Online Orders**. Menu name: **Online Orders**.*

### What it is

A list of every sale that was marked as an online order. You use it to move each order through its delivery stages, give it to a courier (delivery partner), and print a delivery slip.

### Where to find it

Menu: **Sales** > **Online Orders**. You need the **Sales** permission.

An order appears here when the cashier ticks **This is an Online Order** on **Sales** > **New Sale** before completing the sale. A different tick box on that screen, **Deliver products later (reserve inventory)**, sends the sale to **Pending Deliveries** instead (see that section).

### What you see

![Online Orders](images/consumer/online-orders-list-d.png)

*The Online Orders page with the summary cards, the filters and the first orders. The Customer column is empty because these demo orders have no customer.*

**Summary cards (top row).** They appear after the figures load. They follow the **Select Branch** filter only. The search box, status, partner, payout and date filters do not change them.

- **Today's Orders**: how many online orders were made today, with the money total in brackets, for example `2 (BDT 2850.00)`. Refunds given today on online orders are taken off this total.
- One more card for each status that has at least one order: Pending, Confirmed, Processing, Ready, Out for Delivery, Delivered, Cancelled or Returned. Each shows the number of orders and the total in brackets. These totals are before refunds. A status with no orders has no card. An order with no status is counted as Pending.

**Filters.**

| Filter | What it does |
|---|---|
| Search box ("Search by order #, customer...") | Finds orders by order number or customer as you type. A small x clears it. |
| **Select Branch** | Shows one branch. It lists the branches you belong to. You can clear it. |
| **Select Status** | Pending, Confirmed, Processing, Ready, Out for Delivery, Delivered, Cancelled, Returned. You can clear it. |
| **Delivery partner** | One of your couriers, active or inactive. Changing it takes you back to page 1. |
| **Partner payout** | **Waiting for payout** or **Settled with partner**. Changing it takes you back to page 1. |
| Start date / End date | Shows orders made between the two dates, whole days. |

![Status filter list](images/consumer/online-orders-status-dropdown-d.png)

*The **Select Status** list showing the eight statuses.*

![Partner payout filter](images/consumer/online-orders-payout-dropdown-d.png)

*The **Partner payout** list, with the status already set to Delivered.*

![Delivered orders only](images/consumer/online-orders-filter-delivered-d.png)

*The list after choosing Delivered. Orders paid out show a green Settled tag.*

**The orders table.**

| Column | What it shows |
|---|---|
| Order # | The sale number, in bold. |
| Date | For example "Oct 24, 2026 14:05". |
| Customer | The customer name, with the phone number under it in small grey text. |
| Branch | The branch name. |
| Status | A coloured tag: Pending (orange), Confirmed (blue), Processing (cyan), Ready (purple), Out for Delivery (blue-violet), Delivered (green), Cancelled (red), Returned (magenta). |
| Delivery Partner | The courier name as a link to that courier's page. A green tag **Settled #N** under it means this order is already paid out in payout number N. If only an old typed-in courier name was saved, that text shows. Otherwise you see a dash. |
| Total | The order total. |
| Payment | **PAID** (green), **PARTIAL** (orange) or **DUE** (red). |
| Actions | **View**, **Edit Order**, **Online Delivery Slip**. |

At the bottom you see a page-size changer and the text "Total N orders". The page shows 20 rows at a time.

### How to open an order

1. Go to **Sales** > **Online Orders**.
2. Find the order. Use the search box or a filter if the list is long.
3. Click **View** (eye icon) on its row.

**What happens next:** the sale detail page opens.

![Sale detail page](images/consumer/online-orders-view-sale-d.png)

*The sale detail page for an online order, with the sale information and the payment summary.*


### How to print the delivery slip

1. Click **Online Delivery Slip** on the order's row.
2. A window titled "Online Delivery Slip - " followed by the order number opens. At the bottom it shows "A4" and the file name.
3. Click **Print** to print, or **Download** to save the PDF. Click **Close** to leave.

**What happens next:** the slip prints or is saved on your computer. If the slip cannot be made you see "Failed to load the PDF".

### How to move an order to the next stage

1. Go to **Sales** > **Online Orders** and find the order.
2. Click **Edit Order** (sync icon). The window "Edit Online Order - " and the order number opens.
3. In **New Status**, choose the new stage. The current stage is already selected.
4. Click **OK**. A spinner shows while it saves.

**What happens next:** the window closes and you see "Order updated successfully". The Status tag in the list changes. The summary cards, courier balances and sales reports refresh.

### How to give an order to a courier and record what the courier collects

1. Click **Edit Order** on the order.
2. In **Delivery Partner**, choose the courier. **Cash to collect**, **Delivery charge** and **COD fee** fill in by themselves. Change any of them if this order is different. For an order the customer has already paid in full, set **Cash to collect** to 0.

![Choosing a courier](images/consumer/online-orders-edit-partner-list-d.png)

*The Edit Online Order window with the **Delivery Partner** list open (three couriers).*

3. In **New Status**, choose the stage, for example **Out for Delivery**. Click **OK**.
4. When the courier confirms delivery, open **Edit Order** again. Set **New Status** to **Delivered**. Check the amounts and click **OK**.

![Delivered with courier amounts](images/consumer/online-orders-edit-delivered-hint-d.png)

*Status Delivered with Pathao Courier chosen. The grey line shows what the courier owes you.*

5. If the parcel came back, open **Edit Order**, set **New Status** to **Returned**, enter the **Return charge**, and click **OK**.

**What happens next:**

- On **Delivered**, the courier now owes you the cash to collect, and you owe the courier the delivery charge and the COD fee. The customer's remaining due on that sale is marked as paid by "Delivery Partner (COD)".
- On **Returned**, you owe the courier the return charge only.
- Any other status (Pending up to Out for Delivery, and Cancelled) does not change what a courier owes.
- If you change a delivered order later, the courier's account gets correcting lines. Old lines are never edited.

### Fields in the Edit Online Order window

| Field | Required | Notes |
|---|---|---|
| **New Status** | Yes | Placeholder "Select new status". Shows the eight statuses as coloured tags. If you leave it empty you see "Please select a status". |
| **Delivery Partner** | No | Placeholder "No partner". You can clear it. It lists active couriers, plus the courier already on the order if it was made inactive later (shown as "name (inactive)"). If you have no couriers, the list shows a link **Add delivery partners first** that opens the Delivery Partners page. |
| **Cash to collect** | Only when a courier is chosen | Hover the help mark: "What the partner collects from the customer. 0 for a prepaid order." Hidden when the status is Returned. It cannot be more than the customer still owes. It fills in as the order total minus payments already taken. |
| **Delivery charge** (named **Return charge** when status is Returned) | Only when a courier is chosen | Fills in from the courier's default delivery charge. |
| **COD fee** | Only when a courier is chosen | Hidden when the status is Returned. Fills in as the courier's default COD percentage of the cash to collect, rounded to the paisa. |

Under the amounts a grey line explains the result:

- Delivered: "Once delivered, the partner owes you" the cash to collect minus the delivery charge minus the COD fee, "for this order, and the customer's due is marked paid."
- Returned: "A returned order costs you the return charge only."
- Any other status: "Nothing is owed until the order is delivered or returned."

Two banners can appear in the window:

- If the order is already in a payout: "Settled with the partner in payout #N. Void that payout on the partner's page to change the partner or amounts." The courier and the three amounts are greyed out.
- If the order has an old typed-in courier name that is not in your list: "Recorded as "name", which is not in your partner list. Choose a partner to track what is owed."

If you only change the status, an old typed-in courier name is kept.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Order updated successfully | The order was saved. | Nothing. |
| Please select a status | You left **New Status** empty. | Choose a status. |
| The customer owes (amount) | **Cash to collect** is more than the customer still owes. | Enter an amount up to the figure shown. |
| Failed to update order status | The save failed and the server gave no reason. | Try again. If it repeats, tell your manager. |
| (name) is inactive. Activate the partner first. | The courier was switched off. | Activate the courier on the Delivery Partners page, or choose another. |
| Cash to collect (X) is more than the customer still owes (Y) | Same as above, from the server. | Lower the amount. |
| The amount the partner collects is more than the customer still owes on this order | Same problem. | Lower the amount. |
| This order has returns against it, so the cash the partner collected can no longer change | A return was made on this order. | Leave the cash amount as it is. |
| This order is settled in payout #N. Void that payout first to change it. | The order is already paid out. | Void the payout on the courier's page, then edit the order. |
| Online order not found / Delivery partner not found | The record was removed. | Refresh the page. |
| Failed to load the PDF | The delivery slip could not be made. | Try again. |

![Cash to collect error](images/consumer/online-orders-edit-cash-error-d.png)

*Typing too large a **Cash to collect** shows "The customer owes 445.00" in red.*

![Order already in a payout](images/consumer/online-orders-edit-dialog-d.png)

*An order already paid out. The blue banner explains it, and the courier and amounts are greyed out.*

> **Good to know:** Once an order is part of a payout, its courier and amounts are locked until you void that payout.

---

## Delivery Partners

*Page title: **Delivery Partners**. Menu name: **Delivery Partners**.*

### What it is

Your list of courier companies, such as Pathao, Steadfast or RedX, with their default charges. It shows how much each courier owes you (cash they collected and have not paid over) or how much you owe them.

### Where to find it

Menu: **Sales** > **Delivery Partners**. You need the **Sales** permission. You can also reach it from the **Add delivery partners first** link in the Edit Online Order window.

### What you see

![Delivery Partners](images/consumer/delivery-partners-list-d.png)

*The Delivery Partners list with the three summary cards and three couriers.*

- Top-right buttons: **Export CSV** (greyed out when you have no partners) and **Add Partner**.
- Summary cards:
  - **Partners owe you**: the total of all couriers who owe you money (green).
  - **You owe partners**: the total of all couriers you owe money to (red when not zero).
  - **Orders waiting for payout**: the number of delivered or returned orders that are not yet in a payout.
- Table columns:

| Column | What it shows |
|---|---|
| Partner | The name as a link to the courier's page. A grey **Inactive** tag if switched off. The contact person and phone under it. |
| Balance | The amount without a sign, with a line under it: "Partner owes you" (green), "You owe partner" (red) or "All settled" (grey). |
| Waiting for payout | The net amount of orders not yet paid out, with "N order(s)" under it. Shows "None" when there are none. |
| Default charges | "Delivery" with an amount, and "COD fee" with a percentage. |
| Actions | Eye icon (view), pencil icon (edit), red bin icon (delete). |

There are 20 rows per page. Page buttons are hidden when everything fits on one page. If the list cannot load you see "Failed to load delivery partners".

### How to add a courier

1. Go to **Sales** > **Delivery Partners**.
2. Click **Add Partner**. A drawer titled "Add Delivery Partner" opens on the right.

![Add Delivery Partner drawer](images/consumer/delivery-partners-add-empty-d.png)

*The empty Add Delivery Partner drawer.*

3. Fill in the fields in the table below.
4. Click **Add partner**.

![Name required](images/consumer/delivery-partners-add-error-d.png)

*Clicking **Add partner** with the name empty shows "Name is required".*

![Filled drawer](images/consumer/delivery-partners-add-filled-d.png)

*The drawer filled in, ready to save.*


**What happens next:** the drawer closes, you see "Delivery partner added", and the courier appears in the list.

| Field | Required | Notes |
|---|---|---|
| **Partner name** | Yes | Up to 200 characters. Example shown: "e.g. Pathao, Steadfast, RedX". It cannot be blank or only spaces ("Name is required"). Each name can be used once. |
| **Contact person** | No | Up to 200 characters. |
| **Phone** | No | Up to 50 characters. Only digits, spaces and - + ( ). Otherwise "Enter a valid phone number". |
| **Default delivery charge** | No | Starts at 0. Taka. Help: "Filled in on an order when you choose this partner. You can change it per order." |
| **Default COD fee** | No | Starts at 0. A percentage from 0 to 100. Help: "Percentage of the cash the partner collects." |
| **Notes** | No | Up to 1000 characters. |
| **Active** | - | A switch, on by default. Help: "Inactive partners cannot be chosen for new orders." |

### How to change a courier or its default charges

1. Click the pencil icon on the courier's row. The drawer "Edit Delivery Partner" opens.
2. Change what you need.
3. Click **Save changes**.

**What happens next:** you see "Delivery partner updated". Orders that already have amounts keep them. Only orders where you choose this courier afterwards use the new defaults.

![Edit Delivery Partner drawer](images/consumer/delivery-partners-edit-d.png)

*The Edit Delivery Partner drawer, with the button **Save changes**.*

### How to stop using a courier

1. Click the pencil icon on the courier's row.
2. Switch **Active** off.
3. Click **Save changes**.

**What happens next:** the courier cannot be chosen for new orders. Its history and balance stay.

### How to delete a courier

1. Click the red bin icon on the courier's row.
2. The question "Delete this partner?" appears with the text "Only a partner with no orders can be deleted. Deactivate it otherwise."

![Delete confirmation](images/consumer/delivery-partners-delete-confirm-d.png)

*The delete question appears next to the bin icon.*

3. Click **Delete**. Click **Cancel** to keep it.

**What happens next:** you see "Delivery partner deleted" and the row disappears.

### How to download the list

1. Click **Export CSV**.

**What happens next:** a file named `delivery-partners-` followed by today's date is saved. It opens in Excel and has these columns: Partner, Phone, Active (Yes or No), Balance (BDT), Who owes, Unsettled orders and Unsettled amount (BDT).

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Delivery partner added / Delivery partner updated / Delivery partner deleted | The action worked. | Nothing. |
| Name is required | The name is empty or only spaces. | Type a name. |
| Enter a valid phone number | The phone has letters or odd characters. | Use digits, spaces, - + ( ) only. |
| A delivery partner named "name" already exists | The name is taken. | Use a different name. |
| This partner has N order(s) and M ledger row(s). Deactivate it instead so its history is kept. | The courier has been used, so it cannot be deleted. | Switch **Active** off instead. |
| Failed to save partner / Failed to delete partner | The action failed with no reason given. | Try again. |
| Failed to load delivery partners | The list did not load. | Refresh the page. |

---

## Delivery Partner page

*Page title: the courier's name. The browser tab reads "Delivery Partner - name".*

### What it is

One courier's account. It shows what they owe you, which delivered or returned orders are not yet paid out, every money movement, and the payouts you recorded. You record money received, money paid and corrections here.

### Where to find it

Menu: **Sales** > **Delivery Partners**, then click a courier's name or the eye icon. You can also click the courier's name in the Online Orders list. You need the **Sales** permission.

### What you see

- Top-right buttons: **Back** (returns to Delivery Partners), **Record payout**, **Pay partner**, **Adjust balance**.
- For an inactive courier, a blue banner: "This partner is inactive and cannot be chosen for new orders."
- Four cards:
  1. The balance card. Its title is "Partner owes you" (green figure), "You owe partner" (red figure) or "All settled". The figure has no minus sign.
  2. **Waiting for payout**: the net amount of orders not yet paid out, with "N order(s)".
  3. **Cash collected (all time)**: all the cash the courier collected on delivered orders.
  4. **Charges (delivery, COD, returns)**: delivery charges, COD fees and return charges added together.
- A line of small text: "Payouts received", "Paid to partner", "Adjustments" (green plus or red minus), "Last payout" with date and amount (only if there is one), and "Phone" (only if saved).
- Four tabs:

| Tab | What it shows |
|---|---|
| **Waiting for payout (N)** (opens first) | The button **Record payout for N order(s)** (it reads "Record payout for selected order(s)" and is greyed out until you tick a row). Grey text "Selected net: amount" when rows are ticked. A table with tick boxes and columns **Order #** (link to the sale), **Date**, **Customer**, **Status**, **Collected** (cash collected, only for Delivered), **Charges** (delivery charge plus COD fee for Delivered, return charge for Returned), **Net** (green plus or red minus). Up to 50 rows per page. Empty text: "No delivered or returned orders are waiting for a payout". |
| **All orders** | Every order ever given to this courier, with the same columns plus **Payout** (a green tag "#N" if paid out, or grey "Unsettled"). 20 per page. |
| **Ledger** | Every money line: **Date** (with time), **Entry**, **Order**, **Amount** (green plus or red minus) and **Balance** (running balance after that line). 20 per page. |
| **Payouts** | Columns **#** (payout number), **Date**, **Type**, **Amount**, **Method** (with "Ref" and the reference under it), **Orders** (how many it covers) and **Status**. Status shows a red **Voided** tag with the reason, or a red **Void** button. |

Ledger entry names are: Cash collected, Delivery charge, COD fee, Return charge, Payout received, Paid to partner, Adjustment, Payout voided. The note under an entry reads like "Cash collected for order #S-1001", or "Delivery charge for order #S-1001: corrected, order is returned".

If the courier cannot be loaded, a red banner shows the reason ("Failed to load delivery partner") with a **Back** button.

![Delivery partner page](images/consumer/partner-detail-waiting-d.png)

*The Pathao Courier page. The four cards, the totals line and the four tabs show at the top.*

![Order ticked](images/consumer/partner-detail-selected-d.png)

*One order ticked. The button reads **Record payout for 1 order(s)** and **Selected net** shows 260.12.*

### How the balance works

- The balance is everything the courier owes you minus everything you owe them. A positive balance means the courier owes you. A negative balance means you owe the courier.
- A **Delivered** order adds the cash collected and takes off the delivery charge and the COD fee. The net of one order is cash collected minus delivery charge minus COD fee.
- A **Returned** order takes off the return charge.
- A payout received lowers the balance by its amount. A payment to the courier raises it by its amount. An adjustment raises or lowers it as you choose. Voiding a payout adds its amount back.
- Example: an order totals 1,000 taka and is unpaid. The courier's default delivery charge is 60 and the COD fee is 1%. Cash to collect is 1,000. The COD fee is 10.00. The net is +930. Another order comes back with a return charge of 60, so the net is -60. The balance is 870. The courier sends 870 by bank. You tick both orders, record the payout, and the balance becomes 0 ("All settled").

### How to record a payout from a courier

1. Open the courier. Stay on the **Waiting for payout** tab.
2. Tick the orders that the courier's statement covers. Compare with their invoice. **Selected net** shows the total.
3. Click **Record payout for N order(s)**. The window "Record payout from" and the courier name opens.
4. Check **Amount received**. It is filled with the total of the ticked orders. If the courier paid a different amount, type what you really received.

![Record payout window](images/consumer/partner-payout-dialog-d.png)

*The Record payout window.*

![Write-off tick box](images/consumer/partner-payout-writeoff-d.png)

*After typing 100, the write-off tick box appears and says the courier paid 160.12 less.*

5. If the amount is different and you accept the gap, tick the write-off box.
6. Choose the **Method**, check the **Date**, and add the courier's **Reference** if they gave one.
7. Click **Save**.

**What happens next:** you see "Payout recorded". The orders leave the **Waiting for payout** tab. They show "Settled #N" in Online Orders. The balance goes down by the amount.

![Amount required](images/consumer/partner-payout-error-d.png)

*Clearing **Amount received** and clicking **Save** shows "Enter the amount".*

### How to record money received without choosing orders

1. Click **Record payout** at the top, with no rows ticked.
2. A banner says: "No orders chosen: the payout lowers the balance but no order is marked settled. To settle orders, pick them in the 'Waiting for payout' tab first."
3. Enter **Amount received** and click **Save**.

**What happens next:** the balance goes down but no order is marked as settled.

### How to record that you paid the courier

Use this when you owe the courier money, for example return charges.

1. Click **Pay partner**. The window "Record payment to" and the courier name opens.
2. Enter **Amount paid**. It is filled with the amount you owe, if you owe them.

![Record payment window](images/consumer/partner-pay-dialog-d.png)

*The Record payment window. **Amount paid** is empty here because this courier owes you money, not the other way round.*

3. Choose **Method** and **Date**. Add a **Reference** or **Note** if you wish.
4. Click **Save**.

**What happens next:** you see "Payment to partner recorded". The balance moves up toward zero.

### Fields in the payout and payment windows

| Field | Required | Notes |
|---|---|---|
| **Amount received** (payout) or **Amount paid** (payment) | Yes | Minimum 0.01, two decimals. If empty: "Enter the amount". With orders ticked it starts as their net total. Otherwise it starts as the balance the courier owes you (payout) or the amount you owe them (payment). |
| Write-off tick box | No | Appears only when orders are ticked and the amount differs from their total. Text: "The partner paid (difference) less/more than these orders add up to. Write the difference off so these orders end at zero." Not ticked at the start. |
| **Method** | Yes | Bank transfer (the start choice), MFS (bKash / Nagad), Cash, Cheque, Card, Mobile money. |
| **Date** | Yes | Starts as today. |
| **Reference** | No | Up to 200 characters. Placeholder "Transaction or invoice number". |
| **Note** | No | Up to 1000 characters. |

With orders ticked, a banner reads "Covers N order(s). They add up to (amount)."

### How to correct the balance

1. Click **Adjust balance**.
2. Under **Effect**, choose "Partner owes you more" or "Partner owes you less" ("less" is chosen at the start).
3. Enter the **Amount**.
4. Type the **Reason**.
5. Click **Save**.

**What happens next:** you see "Adjustment recorded" and the balance changes. The change shows in the **Ledger** tab as "Adjustment".

![Adjust balance window](images/consumer/partner-adjust-dialog-d.png)

*The Adjust balance window.*

![Adjust balance errors](images/consumer/partner-adjust-error-d.png)

*Clicking **Save** with nothing filled in shows "Enter the amount" and "Say why the balance changes".*


| Field | Required | Notes |
|---|---|---|
| **Effect** | - | Two choices, as above. |
| **Amount** | Yes | Minimum 0.01. If empty: "Enter the amount". |
| **Reason** | Yes | Up to 500 characters. Placeholder "e.g. damaged parcel claim, opening balance". If empty or only spaces: "Say why the balance changes". |

![All orders tab](images/consumer/partner-tab-all-orders-d.png)

*The **All orders** tab, with the **Payout** column.*

![Ledger tab](images/consumer/partner-tab-ledger-d.png)

*The **Ledger** tab with each money line and the running balance.*

![Payouts tab](images/consumer/partner-tab-payouts-d.png)

*The **Payouts** tab. Payout 2 is voided and shows its reason. Payout 1 still has a red **Void** button.*

### How to undo a wrong payout

1. Open the **Payouts** tab.
2. Click the red **Void** button on the payout. The window "Void payout #N" opens. It says: "The payout stays in the history as voided, its amount is added back to the balance, and its orders go back to waiting for payout."
3. Type the reason in the box "Why is it voided? (required)". Up to 500 characters.
4. Click the red **Void payout** button. It stays greyed out until you type a reason.

![Void payout window](images/consumer/partner-void-dialog-d.png)

*The Void payout window. The red button is greyed out until a reason is typed.*


**What happens next:** you see "Payout voided. Its orders are unsettled again." The payout stays in the list as **Voided** with the reason. Record the payout again correctly.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Payout recorded / Payment to partner recorded / Adjustment recorded | The action worked. | Nothing. |
| Enter the amount | The amount is empty. | Type an amount of at least 0.01. |
| Say why the balance changes | The reason is empty. | Type a reason. |
| Choose the orders this payout covers to write off a difference | You ticked the write-off box without choosing orders. | Tick orders in the **Waiting for payout** tab first. |
| Some chosen orders are not unsettled delivered or returned orders of this partner. Refresh and choose again. | The order list changed since you opened the page. | Refresh the page and tick the orders again. |
| Failed to record payout / Failed to record adjustment | The save failed with no reason given. | Try again. |
| This payout is already voided / Payout not found | The payout was already undone or removed. | Refresh the page. |
| Payout voided. Its orders are unsettled again. | The void worked. | Record the correct payout if needed. |
| Failed to void payout | The void failed. | Try again. |
| Failed to load delivery partner | The courier page did not load. | Click **Back** and open it again. |

---

## Pending Deliveries

*Page title: **Pending Deliveries**. Menu name: **Pending Deliveries**.*

### What it is

A list of sales where the customer paid now (fully or in part) but will take the goods later. The stock is held back for them until you mark the sale delivered. Then the stock is taken off your inventory. If you cancel, the held stock is released.

### Where to find it

Menu: **Sales** > **Pending Deliveries**. You need the **Sales** permission.

A sale comes here when the cashier ticks **Deliver products later (reserve inventory)** on **Sales** > **New Sale** before completing the sale.

### What you see

![Pending Deliveries](images/consumer/pending-deliveries-list-d.png)

*Pending Deliveries with three sales waiting. Each row has View, Chalan, Delivered and Cancel.*

- A search box with the hint "Sale number or customer", and a magnifier button. Press Enter or click the magnifier to search. A small x clears it.
- A status list with **Pending** (chosen at the start), **Delivered** and **Cancelled**.
- A table:

| Column | What it shows |
|---|---|
| Sale | The sale number, in bold. |
| Created | For example "24 Oct 2026, 02:30 PM". |
| Customer | The customer name, or "Walk-in". |
| Items | The total quantity. |
| Total | The sale total. |
| Payment | **PAID** (green), **PARTIAL** (orange) or **DUE** (red). |
| Delivery | **PENDING** (orange), **DELIVERED** (green) or **CANCELLED** (red). |
| Actions | **View** (eye icon, opens the sale), **Chalan** (printer icon, opens the delivery challan PDF in a new browser tab). For PENDING rows only: **Delivered** (tick icon) and **Cancel** (red stop icon). |

The page shows up to 100 rows and has no page buttons.

### How to deliver the goods

1. Go to **Sales** > **Pending Deliveries**. The list shows pending sales.
2. Find the sale. Use the search box if needed.
3. If you want a printed challan for the customer to sign, click **Chalan**.
4. Click **Delivered**.
5. The question "Mark this order delivered and deduct its reserved inventory?" appears. Click **OK**. Click **Cancel** to go back.

![Delivered confirmation](images/consumer/pending-deliveries-complete-confirm-d.png)

*The delivered question appears above the **Delivered** button.*


**What happens next:** you see "Delivery completed and inventory updated". The row leaves the Pending list. To see it, change the status list to **Delivered**.

### How to cancel a delivery

1. Find the sale and click **Cancel** (red stop icon).
2. The question "Cancel delivery and release reserved inventory?" appears. Confirm it.

![Cancel confirmation](images/consumer/pending-deliveries-cancel-confirm-d.png)

*The cancel question, with **Cancel** and **OK**.*


**What happens next:** you see "Delivery cancelled and reservation released". The held stock becomes available again. The row moves to the **Cancelled** list.

![Delivered filter](images/consumer/pending-deliveries-filter-delivered-d.png)

*The status list set to Delivered.*

![Cancelled filter](images/consumer/pending-deliveries-filter-cancelled-d.png)

*The status list set to Cancelled.*

> **Good to know:** Cancelling a delivery does not give money back to the customer. If the customer must be refunded, do it through **Returns**. If a cancel fails, the app does not show a clear error message, so check the list again.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Delivery completed and inventory updated | The goods are marked delivered and stock is deducted. | Nothing. |
| Delivery cancelled and reservation released | The delivery is cancelled and the stock is free again. | Handle any refund through Returns. |
| Could not complete delivery | The delivery could not be marked done. The server may give a reason. | Read the reason, fix it, and try again. |

---

## Sales Target

*Menu name: **Sales Target**. Page title: **Daily Sales Target**.*

### What it is

A read-only page. For one day and one branch it shows how many units of each product variant were sold against the daily target you set for it, and whether the target was met.

### Where to find it

Menu: **Sales** > **Sales Target**. You need the **Business insights** permission.

### Where the target is set

On the product's variant form (**Products** > Add Product, or edit a product). The field is **Daily Target**. It takes a whole number, 0 or more. Only variants with a target above 0 appear on this page. Leave it at 0 to keep a variant off the page.

### What you see

![Daily Sales Target](images/consumer/daily-target-list-d.png)

*The Daily Sales Target page for 24 October 2026, Main Store, with Filled and Failed tags.*

Four boxes in a row:

| Box | What it does |
|---|---|
| **Search:** ("Search name, variant, SKU...") | Narrows the rows by product name, variant name or SKU. |
| **Date:** | The day to look at, written like 2026-10-24. Starts as today. You cannot pick a future day and you cannot clear it. |
| **Branch:** | One of your branches. The first branch is chosen for you. |
| **Target Status:** ("Filter Status") | **Achieved** (target reached) or **Not Achieved**. You can clear it. |

Table columns:

| Column | What it shows |
|---|---|
| Product | The product name in bold, then " - " and the variant name. "SKU:" and the SKU under it, when there is one. |
| Daily Target | The target quantity. |
| Sold | Units sold that day. |
| Returned | Units returned that day, in red. A dash if none. |
| Actual Sold | Sold minus Returned. Never below 0. Shown in bold. |
| Gap | How many more units were needed to reach the target. 0 once reached. |
| Status | A green **Filled** tag when the Gap is 0, a red **Failed** tag when it is not. |

At the bottom: a page-size changer and "Total N items". 20 rows per page.

![Search box](images/consumer/daily-target-search-d.png)

*Typing "rice" in **Search:** leaves one row. The page shows "Total 1 items".*

![Not Achieved filter](images/consumer/daily-target-filter-not-achieved-d.png)

***Target Status:** set to **Not Achieved**. Only red Failed rows remain.*

![Target Status list](images/consumer/daily-target-status-dropdown-d.png)

*The **Target Status:** list with Achieved and Not Achieved.*

![Date picker](images/consumer/daily-target-date-picker-d.png)

*The **Date:** calendar. Future days cannot be picked.*

![Branch list](images/consumer/daily-target-branch-dropdown-d.png)

*The **Branch:** list.*

### How to see how a day went

1. Go to **Sales** > **Sales Target**.
2. In **Date:**, pick the day. Today is chosen at the start.
3. In **Branch:**, pick the branch.
4. Read the table. Red **Failed** rows are variants that missed their target.
5. To look at only hits or misses, choose **Achieved** or **Not Achieved** in **Target Status:**.
6. To find one product, type in **Search:**.

**What happens next:** the table shows the figures for that day and branch. There is nothing to save.

### How the figures are worked out

- A day runs from 00:00 to 23:59 Dhaka time.
- **Sold** counts every item sold that day in that branch, on sales that were not deleted.
- **Returned** counts items returned that day in that branch, even when the original sale was on an earlier day.
- **Actual Sold** is Sold minus Returned. **Gap** is Daily Target minus Actual Sold, never below 0.
- Only variants that have stock records in the chosen branch are listed.

> **Good to know:** **Search:** and **Target Status:** now filter across all pages, not only the page you are looking at. The page also does not show any summary cards. Only the table is shown.

---

## User Sales Stats

*Menu name: **User Sales Stats**. Page title: **User Sales Statistics**. The path at the top reads "Dashboard > Sales > User Stats".*

### What it is

A comparison of how much each staff member sold over a period. A sale counts for the person recorded as "served by" on the sale.

### Where to find it

Menu: **Sales** > **User Sales Stats**. You need the **Business insights** permission.

### What you see

![User Sales Statistics](images/consumer/user-sales-stats-list-d.png)

*The User Sales Statistics list for one day, with three staff members.*

- Top-right button: **Back to Sales** (goes to View Sales).
- **Filter by Date**: two dates, a start and an end, written like 2026-10-24. Starts as today to today. Future dates cannot be picked. You cannot clear it.
- **Branch:** with the hint **All Branches**. You can clear it. With no branch chosen, all branches are included.
- A table:

| Column | What it shows |
|---|---|
| User Name | The staff member, in bold. |
| Email | Hidden on narrow screens. |
| Total Sales | The amount sold, in green bold. You can sort by it. |
| Refunds | Money given back, in red, with the number of returns in brackets, for example "120.00 (2)". A dash if none. You can sort by it. |
| Net Sales | Total Sales minus Refunds. You can sort by it. |
| Transactions | The number of sales, in a green tag (grey if 0). |
| Actions | **View** with an eye icon. It is greyed out when the person has 0 transactions. |

10 rows per page, with a page-size changer. Rows are ordered by total sales, highest first.

![Branch list](images/consumer/user-sales-stats-branch-dropdown-d.png)

*The **Branch:** list on User Sales Statistics.*

### How the figures are worked out

- Only real sales count. Quotations, deleted sales and cancelled sales do not.
- A refund is credited against whoever served the original sale, for returns of sales in the same period. So a seller does not keep credit for money given back.
- Days are whole days in Dhaka time.

### How to compare staff sales

1. Go to **Sales** > **User Sales Stats**.
2. Pick the period in **Filter by Date**.
3. Pick a branch in **Branch:**, or leave it on **All Branches**.
4. Click a column title such as **Total Sales** to sort.

**What happens next:** the table updates by itself. Nothing is saved.

### How to see one person's sales

1. On the list, click **View** on the person's row.

**What happens next:** the page "Sales by" and the person's name opens. The date range you chose carries over.

![Sales by one person](images/consumer/user-sales-stats-detail-d.png)

*The Sales by page for one staff member, with the date range, the five cards and the start of the sales table.*


### The person's page ("Sales by name")

*The browser tab reads "Sales - name". If you open the page from a direct link, the name shows as "User #number".*

- Top-right button: **Back**.
- **Date Range**: a start and end date. If you opened the page directly, it starts at the 1st of this month and ends today. Future dates cannot be picked.
- Cards:
  - **Total Sales Amount**.
  - **Refunds** (red when above 0).
  - **Net Sales Amount**.
  - **Average Sales Amount**: total sales amount divided by the number of sales in the period.
  - **Total Transactions**: the number of sales rows on the page you are looking at.
- A table named "name's Sales" with columns **Sale #** (blue link to the sale), **Date**, **Customer** (name or grey "Walk-in"), **Total**, **Refunded** (red, or a dash), and **Status** (**PAID** green, **PARTIAL** orange, **DUE** red, **CANCELLED** grey). 20 rows per page, with a page-size changer.

> **Good to know:** **Total Transactions** counts only the sales shown on the current page. If the person has more than 20 sales, or you are on page 2, it is not the count for the whole period. Use **Transactions** on the list page for the full count.

---

## Business Report

*Menu name: **Business Report**. Page title: **Business Report**. The tooltip reads "Daily and Monthly Business Report". Staff may still call it "EOD" (end of day).*

### What it is

A one-page money summary for a day, a month, or everything up to a date. It shows what was sold, what money really came in, what customers still owe, refunds, shop costs, and a net result. Shops use it to close the till at the end of the day.

### Where to find it

Menu: **Business Report** (a top-level item with a document icon). You need the **Business insights** permission.

> **Good to know:** This report has **no profit figure, no cost of goods and no margin**. It is a report of sales and money collected. The card **Net Operating Result** is sales minus refunds minus operational costs only. The buying price of the goods is not taken off, so **Net Operating Result is not profit**.

### What you see

![Business Report](images/consumer/business-report-daily-top-d.png)

*The top of the Business Report for one day: the filter box and the first three rows of cards.*

- Top-right button: **Preview PDF**.
- **Report period:** a switch with **Daily** (chosen at the start), **Monthly** and **Till Date**.
- A date box whose name changes with the period: **Date:** for Daily, **Month:** for Monthly (a month picker), **Through date:** for Till Date. Written like 2026-10-24. Starts as today. You cannot clear it.
- **Branch:** with the hint **All Branches**. You can clear it.

What each period covers:

| Period | Covers |
|---|---|
| Daily | The chosen day, 00:00 to 23:59 Dhaka time. |
| Monthly | The 1st to the last day of the chosen month. |
| Till Date | From the very beginning up to the end of the chosen day. |

While loading you see "Loading business report...". If nothing comes back you see "No data available for the selected date and branch."

### The cards, in plain words

**Row 1: sales and collection**

| Card | What it means | Small text under it |
|---|---|---|
| **Gross Sales** | The total of all sales made in the period. Each sale total already includes discounts, tax and shipping. | "N transactions", and " · Disc:" with the total discount if there was any. |
| **Real Money Collected** (green) | Cash and digital payments actually received in the period, plus money couriers paid over to you. It includes late payments by customers on older invoices. | "Physical Cash & Digital Banking", plus " · Partner payouts:" and " · Due paid:" when above 0. |
| **Due / Receivables** (red when above 0) | The unpaid balance on sales made in this period. Old debts from earlier periods are not included. | "N invoice(s) with due". |
| **Net Sales** | Gross Sales minus refunds. | "Gross sales minus refunds". |

**Row 2: how money was paid**

| Card | What it means | Small text |
|---|---|---|
| **Cash Sales** | Cash payments received. | "Net Cash in Drawer:" and the amount. |
| **Digital Sales (Card/MFS)** | Card, bank transfer, cheque, mobile money and MFS payments. | "Card, bKash, Nagad, Bank". |
| **Reward Points Redeemed** (amber when above 0) | The value paid with reward points or store credit. This is not money received. | "Store credit / customer loyalty". |
| **Product Exchanges** (blue when above 0) | The value of goods exchanged. Each exchange is counted once. This is not money received. | "Deduplicated exchange value". |

**Delivery partner notice.** A blue box appears only when courier money exists in the period. It can show these lines, each only when above 0:

- "(amount) was paid by customers to delivery partners. It counts as money only when the partner pays it over."
- "Delivery partners paid you (amount) ((part) in cash). It is in Real Money Collected, and the cash part is in the drawer."
- "You paid delivery partners (amount) ((part) from the drawer)."
- When one branch is chosen: "Partner payouts belong to no branch, so this branch report leaves them out."
- A link **See what partners owe** that opens Delivery Partners.

**Row 3: drawer and costs**

| Card | What it means | Small text |
|---|---|---|
| **Cash Refunds** (red when above 0) | Cash paid back to customers for returns. | "Cash paid out from drawer". |
| **Net Cash in Drawer** | The cash that should be in the drawer for the period: cash received, minus cash refunds, plus cash received from couriers, minus cash paid to couriers. It does not count the starting float. | "Cash sales minus cash refunds", or with courier cash "Cash sales minus cash refunds, plus partner cash". |
| **Operational Costs** (red) | The total of costs you declared with a date in the period. | "Business daily expenses". |
| **Net Operating Result** (green at 0 or more, red below 0) | Gross Sales minus refunds minus Operational Costs. Not profit. | "After refunds & operational costs". |

**Row 4**

| Card | What it means | Small text |
|---|---|---|
| **Total Refunds** (red when above 0) | Money refunded for returns. Refunds count on the day the refund was made, not the day of the original sale. | "N return(s) · M item(s)". |
| **Average Transaction** | Gross Sales divided by the number of sales. | "Average ticket size". |
| **Items Sold** | The total quantity sold, with the word "items". | "N unique products". |
| **Report Date** | The date, for example "Oct 24, 2026". | "Branch:" and the name, when one branch is chosen. |

![Business Report, whole page](images/consumer/business-report-daily-full-d.png)

*The whole Daily report: all cards, the delivery partner notice, the payment tables, the pie chart and the hourly chart.*

### The panels below the cards

1. **Payment Method Breakdown**: a table (**Payment Method**, **Total Amount**, **Transactions**, sortable) and a pie chart. Methods are Cash, Card, Bank Transfer, Cheque, Mobile Money, MFS (bKash/Nagad), Reward Points / Store Credit, Product Exchange, and Collected by Delivery Partner.
2. **Sales by Payment Status**: shown when there is data. Columns **Payment Status** (**Fully Paid** green, **Partially Paid** orange, **Full Due / Unpaid** red), **Sales Count** and **Invoiced Amount**.
3. **Refund Method Breakdown**: shown only when there were refunds. Same columns as the payment method table, for money paid back.
4. **Hourly Sales Distribution**: for the Daily period only, when there were sales. A bar chart by hour of the day with two bars: **Sales Count** (left scale) and **Amount** (right scale).
5. **Product Sales Statistics**: columns **Product** (name, variant, SKU), **Qty Sold**, **Total Amount**, **Qty Returned** (red or a dash), **Net Amount** and **Avg Unit Price**. You can sort. 20 rows per page, with a page-size changer, a jump box and the text "1-20 of N products".
6. **Operational Costs**: columns **Date**, **Cost name**, **Branch** ("All business" when not tied to a branch) and **Amount**.
7. **ACCOUNTING DEFINITIONS & REPORT CLOSURE**: a box at the bottom that gives the app's own short definitions of Gross Sales, Real Money Collected, Net Cash in Drawer, Due / Receivables, Product Exchanges and Net Operating Result, and a closing line that it is a computer-generated report.

![Monthly report](images/consumer/business-report-monthly-full-d.png)

*The **Monthly** view. The hourly chart is not shown for months.*

![Till Date report](images/consumer/business-report-till-date-full-d.png)

*The **Till Date** view.*

### How to close the day

1. Click **Business Report** in the menu.
2. Leave the period on **Daily** and the date on today.
3. Choose your branch in **Branch:**.
4. Count the cash in the till. Compare it with **Net Cash in Drawer**.
5. Click **Preview PDF**. A window titled "Business Report" opens. At the bottom it shows "A4" and the file name `business-report-` followed by the date.
6. Click **Print** or **Download**. Click **Close** to leave.

**What happens next:** the report prints or is saved. If it cannot be made you see "Failed to load the PDF".

### How to see a month

1. Click **Monthly** under **Report period:**.
2. In **Month:**, pick the month.

**What happens next:** the cards and tables show the whole month.

### How to see everything since the beginning

1. Click **Till Date**.
2. In **Through date:**, pick the last day to include.

**What happens next:** the figures run from the very start up to the end of that day.

### Things to know about the figures

- A sale made at 11:30 PM belongs to that day. A sale made at 12:05 AM belongs to the next day.
- With one branch chosen, you see only that branch's sales, refunds and costs. Courier payouts are left out because they belong to no branch.
- A cost marked "All business" appears in the all-branches report only. A cost tied to a branch appears in that branch's report and in the all-branches report.
- Reward points, product exchanges and cash that a courier collected are not counted as money received until the courier pays it over.
- **Digital Sales** is every payment that is not cash, reward points, exchange or courier collection.

---

## Operational Costs

*Page title: **Operational Costs**. Menu name: **Operational Costs**.*

### What it is

A place to record everyday shop expenses such as rent, electricity, transport and salaries. They are taken off in the Business Report's **Net Operating Result**.

### Where to find it

Menu: **Operational Costs** (a top-level item with a taka sign icon). You need the **Business insights** permission.

### What you see

![Operational Costs](images/consumer/operational-costs-list-d.png)

*The Operational Costs list for October 2026 with the total cost card.*

- Top-right button: **Declare cost**.
- A month picker (the current month at the start, cannot be cleared) and a branch list with the hint **All branches** (you can clear it).
- A card **Total operational cost**: the total of the costs listed for the chosen month and branch.
- A table: **Date**, **Cost name** (bold, with the notes in grey under it), **Branch** (the branch name or "All business"), **Amount**, and **Actions** (a pencil to edit and a red bin to delete). 20 rows per page.

### How to declare a cost

1. Click **Operational Costs** in the menu.
2. Click **Declare cost**. A drawer titled "Declare operational cost" opens.

![Declare cost drawer](images/consumer/operational-costs-declare-empty-d.png)

*The empty drawer.*

3. Fill in the fields in the table below.
4. Click **Save cost**.

**What happens next:** the drawer closes and you see "Operational cost saved". The cost appears in the list, and the Business Report includes it for the day of its **Date**, not the day you typed it in.

![Required fields](images/consumer/operational-costs-declare-error-d.png)

*Clicking **Save cost** with nothing filled in.*

![Filled drawer](images/consumer/operational-costs-declare-filled-d.png)

*The drawer filled in.*

![Saved message](images/consumer/operational-costs-saved-toast-d.png)

*The green "Operational cost saved" message.*


| Field | Required | Notes |
|---|---|---|
| **Cost name** | Yes | Up to 120 characters. Example shown: "Rent, electricity, transport...". If empty you see "Please enter Cost name". |
| **Amount** | Yes | Minimum 0.01, two decimals. If empty you see "Please enter Amount". |
| **Date** | Yes | Starts as today. Change it if the cost was on another day. |
| **Branch** | No | The hint says "Applies to the whole business". Choose a branch if the cost belongs to one shop only. It is filled in with the branch from the filter, if any. You can clear it. |
| **Notes** | No | Up to 500 characters. |

### How to fix a cost

1. Click the pencil icon on the row. The drawer "Edit operational cost" opens.
2. Change what you need.
3. Click **Save cost**.

**What happens next:** you see "Operational cost saved" and the Business Report updates.

![Edit operational cost](images/consumer/operational-costs-edit-d.png)

*The Edit operational cost drawer.*


### How to remove a cost

1. Click the red bin icon on the row.
2. The question "Delete this cost?" appears. Click **OK**. Click **Cancel** to keep it.

![Delete confirmation](images/consumer/operational-costs-delete-confirm-d.png)

*The delete question, with **Cancel** and **OK**.*


**What happens next:** you see "Operational cost deleted".

![Month picker](images/consumer/operational-costs-month-picker-d.png)

*The month calendar.*

![Branch list](images/consumer/operational-costs-branch-dropdown-d.png)

*The branch list.*

### How to review a month

1. Change the month picker.
2. Optionally choose a branch.
3. Read the **Total operational cost** card.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Operational cost saved | The cost was saved. | Nothing. |
| Operational cost deleted | The cost was removed. | Nothing. |
| Could not save operational cost | The save failed with no reason given. | Try again. |
| Operational cost not found | The cost was already removed. | Refresh the page. |
| Branch not found | The chosen branch no longer exists. | Choose another branch. |

---

## Customers

*Page title: **Customers**. Menu name: **Customers**.*

### What it is

Your customer list. You add, change and delete customers, find them by name or phone, and open each customer's history. A customer chosen on a sale earns reward points and has their dues tracked.

### Where to find it

Menu: **Customers** > **Customers**. You need the **Customers** permission.

### What you see

![Customers](images/consumer/customers-list-d.png)

*The Customers list with the search box, the type list and the first customers. The birthday column shows the date.*

- Top-right buttons: **Export** (a drop-down with one choice, **Export as PDF**, which saves a file named `customers.pdf`) and **Add New Customer**.
- A search box ("Search customers..."). It waits about a third of a second after you stop typing, then searches and goes to page 1. A small x clears it.
- A **Customer Type** list: **Individual** or **Business**. You can clear it.
- A table:

| Column | What it shows |
|---|---|
| Customer | The name, with email and phone in small grey text under it. |
| Type | A tag: **Business** (blue) or **Individual** (green). |
| Birthday | The date like "14 Mar 1990", plus a magenta **Today** tag when the birthday is today. A dash if none. |
| Address | In small grey text. |
| Actions | Eye icon (**View Customer History**), pencil icon (**Edit Customer**), red bin icon (**Delete Customer**). Hover to see these names. |

At the bottom: a page-size changer, a jump box and the text "1-20 of N customers". 20 rows per page.

![Customer Type list](images/consumer/customers-type-dropdown-d.png)

*The **Customer Type** list.*

![Customer search](images/consumer/customers-search-d.png)

*Typing "nus" in the search box.*

![Export menu](images/consumer/customers-export-menu-d.png)

*The **Export** menu with the one choice **Export as PDF**.*

### How to add a customer

1. Go to **Customers** > **Customers**.
2. Click **Add New Customer**. The drawer "Add Customer" opens.
3. Fill in the fields in the table below.
4. Click **Create Customer**.

![Add Customer drawer](images/consumer/customers-add-empty-d.png)

*The empty Add Customer drawer.*

![Name required](images/consumer/customers-add-error-d.png)

*Clicking **Create Customer** with the name empty shows "Customer name is required".*

![Format errors](images/consumer/customers-add-format-error-d.png)

*A wrong email and phone number show their messages.*

![Filled drawer](images/consumer/customers-add-filled-d.png)

*The drawer filled in.*


**What happens next:** the drawer closes and you see "Customer created successfully". The customer appears in the list.

![Created message](images/consumer/customers-created-toast-d.png)

*The green "Customer created successfully" message.*


You can also add a customer on the New Sale screen while selling.

| Field | Required | Notes |
|---|---|---|
| **Customer Name** | Yes | Placeholder "Enter customer name". If empty: "Customer name is required". |
| **Customer Type** | Yes | **Individual** (chosen at the start) or **Business**. Placeholder "Select customer type". If empty: "Customer type is required". |
| **Email** | No | Placeholder "Enter email address". Must be a real email, or you see "Please enter a valid email address". |
| **Phone** | Treat as required | The form does not mark it as required, but the save fails without it. Placeholder "Enter phone number". Only digits, spaces and - + ( ). Otherwise "Please enter a valid phone number". |
| **Birthday** | No | Pick a date. Placeholder "Select date of birth (optional)". A future date cannot be picked. When you edit, clearing it removes the saved birthday. |
| **Address** | No | Placeholder "Enter customer address (optional)". |

### How to change a customer

1. Click the pencil icon on the row. The drawer "Update Customer" opens.
2. Change what you need.
3. Click **Update Customer**.

**What happens next:** you see "Customer updated successfully" and the list refreshes.

![Update Customer drawer](images/consumer/customers-edit-d.png)

*The Update Customer drawer with the saved details.*

### How to find a customer

1. Type part of the name, phone or email in the search box.
2. To narrow by kind, choose **Individual** or **Business** in **Customer Type**.

### How to find birthdays

Look for the magenta **Today** tag in the **Birthday** column.

### How to delete a customer

1. Click the red bin icon on the row.
2. The question "Are you sure you want to delete this customer?" appears. Click **Yes**. Click **No** to keep the customer.

![Delete confirmation](images/consumer/customers-delete-confirm-d.png)

*The delete question, with **No** and **Yes**.*


**What happens next:** you see "Customer deleted successfully".

### How to download the list

1. Click **Export**, then **Export as PDF**.

**What happens next:** a file named `customers.pdf` is saved. If it fails you see "Failed to export the list".

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Customer created successfully / Customer updated successfully / Customer deleted successfully | The action worked. | Nothing. |
| Customer name is required | The name is empty. | Type a name. |
| Customer type is required | No type chosen. | Choose a type. |
| Please enter a valid email address | The email is not in a proper form. | Correct it or leave it empty. |
| Please enter a valid phone number | The phone has letters or odd characters. | Use digits, spaces and - + ( ) only. |
| Failed to create customer / Failed to update customer / Failed to delete customer | The action failed. If the server gave a reason, you see it instead. | Read the reason, or try again. A missing phone number is a common cause. |
| Customer not found | The customer was already removed. | Refresh the page. |
| Failed to export the list | The PDF could not be made. | Try again. |

---

## Customer history

*Page title: the customer's name (while loading it reads "Customer history"). The browser tab reads "name - Customer".*

### What it is

Everything about one customer: totals, what they still owe, returns, their reward balance, and the history of sales, returns and reward movements.

### Where to find it

Menu: **Customers** > **Customers**, then click the eye icon on the customer's row. You need the **Customers** permission.

### What you see

- Top-right button: **Back to customers**.
- If the link is wrong you see "Invalid customer ID". If the customer cannot be loaded you see "Customer could not be loaded" with the text "The customer may not exist or you may not have access to it." and a **Back to customers** button.
- Four tabs: **Summary**, **Sales (N)**, **Returns (N)** and **Rewards**. The numbers in brackets are counts.

**Summary tab**

- Four cards:
  - **Total sales**: the number of sales, with "Gross:" and the amount.
  - **Outstanding due** (red when above 0): what the customer still owes, with "Paid:" and the amount.
  - **Returns**: the number of returns, with "Refunded:" and the amount.
  - **Reward balance**: points, with "pts", and "Earned lifetime:" and the number.
- **Customer details**: Name, Type (a tag), Phone, Email, Birthday, Customer since, Address. A dash when empty.
- **Recent sales** with a **View all** link that opens the Sales tab (only when the customer has sales). Columns **Invoice**, **Date**, **Branch**, **Total**, **Payment**. Empty text: "No sales yet".

**Sales tab:** **Invoice** (link to the sale), **Date**, **Branch**, **Total**, **Due** (what is still unpaid on that invoice), **Payment** (**PAID** green, **PARTIAL** gold, **DUE** red). 20 per page.

**Returns tab:** **Return** (link), **Date**, **Original invoice** (link), **Branch**, **Refund**, **Exchange**, **Reason** (a dash if none). 20 per page.

**Rewards tab:** **Date**, **Type** (a tag such as EARN, REDEEM or ADJUSTMENT), **Points** (green "+N" for earned, red "-N" for used), **Balance** (the balance after that line), **Invoice** (a link or a dash), **Details** (a dash if none). 20 per page.

There are no forms here. You can only read, switch tabs and follow links.

![Customer history, Summary](images/consumer/customer-detail-summary-d.png)

*The **Summary** tab: four cards, the customer details and recent sales.*

![Sales tab](images/consumer/customer-detail-sales-d.png)

*The **Sales** tab.*

![Returns tab](images/consumer/customer-detail-returns-d.png)

*The **Returns** tab. This customer has no returns.*

![Rewards tab](images/consumer/customer-detail-rewards-d.png)

*The **Rewards** tab, with EARN lines and the balance after each.*


### How to see a customer's history

1. Go to **Customers** > **Customers**.
2. Click the eye icon on the customer's row.
3. Click the tabs to see sales, returns and rewards.
4. Click **Back to customers** when done.

**What happens next:** nothing is changed. Use this page to check what a customer owes before they pay.

---

## Reward Points

*Menu name: **Reward Points**. Page title: **Customer Rewards**.*

### What it is

A list of every customer with a reward-points balance. Staff can take points off (**Redeem Points**), add or remove points (**Adjust Points**), and see each customer's point history.

### Where to find it

Menu: **Customers** > **Reward Points**. You need the **Customers** permission. A customer appears here once they have a points record, which happens when they earn points on a sale or when points are adjusted. The rules for earning points are set in **Rewards** (see the next section).

### What you see

![Customer Rewards](images/consumer/reward-points-d.png)

*The Customer Rewards page with three customers and the three action buttons on each row.*

- A search box with the hint "Search customers by name, phone, or email". Use the magnifier or press Enter. A small x clears it.
- A table, with the highest balance first:

| Column | What it shows |
|---|---|
| Customer | The name, with phone and email in small grey text. |
| Current Points | A gift-icon tag with the balance (green above 0, grey at 0). |
| Lifetime Earned | A green number. |
| Lifetime Redeemed | An amber number. |
| Last Activity | "Earned" or "Redeemed", whichever is more recent, with the date under it. Or "No activity". |
| Actions | Three icon buttons: **Redeem Points** (blue minus icon, greyed out when the balance is 0), **Adjust Points** (plus icon), **Transaction History** (clock icon). Hover to see their names. |

At the bottom: a page-size changer, a jump box and "1-20 of N customers". 20 rows per page. If the list cannot load you see "Failed to load customer rewards data".

![Reward points search](images/consumer/reward-points-search-d.png)

*Searching for one customer.*

### How points are earned and used

- **Earning:** when a sale with a customer chosen is fully paid, the customer earns points equal to the sale total times **Points per ৳1 Spent**, rounded down to whole points. No points are earned if the sale is below the **Minimum Purchase Amount**, if rewards are switched off, or if the result is 0. **Maximum Points per Sale** caps it if set. The part of a bill paid with reward points does not earn points. A part-paid sale earns nothing at the time of the sale.
- **Value:** each point is worth the **Taka Value per Point**, in taka, when used as payment. With the standard settings you earn 1 point per taka spent, and 100 points are worth 1 taka. You need at least 100 points to redeem.
- **Paying with points at the till:** on the sale screen, choose the payment method **Credit** and enter the amount. The points needed are the amount divided by the value per point, rounded up. The app checks that rewards are on, that the customer has enough points, and that the number of points is within the minimum and maximum. The Business Report counts this under **Reward Points Redeemed**.
- **Return refunded to Credit:** the points come back as an ADJUSTMENT line that reads "Refunded N points for ...".

> **Good to know:** All amounts in messages are in taka, for example "Maximum credit available: ৳250.00". Reward history lines also use the taka sign, for example "Redeemed 34 points for ৳10.00 credit".

> **Good to know:** If you set **Points Expire After (Days)** in Rewards settings, expired points are removed by the app when the customer list, a customer's points, a redemption or a Credit payment is looked at (at most once a minute). There is no separate screen for it. If points seem to be still there, open the Reward Points page again.

### How to redeem points by hand

1. Go to **Customers** > **Reward Points**.
2. Find the customer and click the minus icon (**Redeem Points**). The window "Redeem Points - " and the customer name opens. It shows the tag "Available Points:" and the balance.
3. Enter **Points to Redeem**.
4. If you like, fill in **Reference (Optional)** and **Notes (Optional)**.
5. Click **Redeem Points**. Click **Cancel** to leave.

![Redeem Points window](images/consumer/reward-points-redeem-empty-d.png)

*The Redeem Points window showing the available points.*

![Points required](images/consumer/reward-points-redeem-error-d.png)

*Clicking **Redeem Points** with the box empty shows "Please enter points to redeem".*


**What happens next:** you see "Points redeemed successfully". The points are taken off the balance and added to Lifetime Redeemed.

> **Good to know:** In testing, when we typed a number larger than the customer's balance, the box changed it to the full balance, and clicking **Redeem Points** used all the points. Check the number in the box before you click.

> **Good to know:** This button only changes the points. It gives the customer no discount and no money. Use it to record points that were used outside a sale. To pay a bill with points, use the payment method **Credit** on the sale screen.

| Field | Required | Notes |
|---|---|---|
| **Points to Redeem** | Yes | A whole number from 1 up to the balance. Placeholder "Enter points to redeem". If empty: "Please enter points to redeem". If out of range: "Must be between 1 and (balance)". |
| **Reference (Optional)** | No | Placeholder "e.g., Receipt number, transaction ID". |
| **Notes (Optional)** | No | Placeholder "Additional notes". |

### How to add or remove points

1. Click the plus icon (**Adjust Points**) on the customer's row. The window "Adjust Points - " and the customer name opens. It shows "Current Points:" and the balance.
2. In **Points Adjustment**, type a positive number to add points, or a negative number to remove them. For example 100 adds, -50 removes.
3. Type the **Reason**.
4. If you like, fill in **Notes (Optional)**.
5. Click **Adjust Points**. Click **Cancel** to leave.

![Adjust Points window](images/consumer/reward-points-adjust-empty-d.png)

*The Adjust Points window.*

![Adjust errors](images/consumer/reward-points-adjust-error-d.png)

*Both required boxes show their messages.*

![Adjust filled](images/consumer/reward-points-adjust-filled-d.png)

*A removal of 50 points with a reason typed.*


**What happens next:** you see "Points adjusted successfully". The current balance changes. Lifetime Earned and Lifetime Redeemed do not change.

| Field | Required | Notes |
|---|---|---|
| **Points Adjustment** | Yes | A number. Help text: "Use positive numbers to add points, negative to remove points". Placeholder "e.g., 100 (add) or -50 (remove)". If empty: "Please enter points adjustment". If not a number: "Must be a number". |
| **Reason** | Yes | Placeholder "e.g., Customer service credit, Correction". If empty: "Please provide a reason for the adjustment". |
| **Notes (Optional)** | No | Placeholder "Additional notes". |

### How to see a customer's point history

1. Click the clock icon (**Transaction History**) on the customer's row.
2. The window "Transaction History - " and the customer name opens.
3. Read the strip at the top: **Current Points** (green), **Lifetime Earned** (blue), **Lifetime Redeemed** (orange).
4. Read the table: **Date**, **Type**, **Points**, **Description**, **Reference** (a "-" if none), **Balance After**. The type tag is **EARN** (green), **REDEEM** (orange), or **ADJUSTMENT** or **EXPIRE** (blue). It shows 10 rows per page (you can choose 10, 20 or 50) and "1-10 of N transactions".

**What happens next:** nothing is changed. If the list cannot load you see "Failed to load transaction history".

![Transaction History](images/consumer/reward-points-history-d.png)

*The Transaction History window for one customer.*


> **Good to know:** The **Points** column shows EARN as "+N" and REDEEM as "-N". ADJUSTMENT and EXPIRE rows show the number with no sign, even when points were taken away. Read the **Balance After** column to see whether the balance went up or down.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Points redeemed successfully | The points were taken off. | Nothing. |
| Points adjusted successfully | The balance was changed. | Nothing. |
| Please enter points to redeem | The field is empty. | Enter a number. |
| Must be between 1 and (balance) | The number is too low or more than the balance. | Enter a number in range. |
| Please enter points adjustment / Must be a number | The field is empty or not a number. | Enter a number such as 100 or -50. |
| Please provide a reason for the adjustment | The reason is empty. | Type a reason. |
| Rewards system is disabled | Rewards are switched off in Rewards settings. | Switch **Enable Rewards System** on. |
| Minimum redemption is N points | You asked for fewer points than the minimum. | Enter at least N. |
| Maximum redemption is N points | You asked for more points than the maximum. | Enter N or fewer. |
| Insufficient points balance | The customer does not have that many points. | Enter a smaller number. |
| Customer not found | The customer was removed. | Refresh the page. |
| Failed to redeem points / Failed to adjust points | The action failed with no reason given. | Try again. |

---

## Rewards

*Menu name: **Rewards**. Page title: **Rewards Settings**.*

### What it is

The page that switches the reward-points programme on or off and sets how points are earned and spent.

### Where to find it

Menu: **Settings** > **Rewards**. You need the **Sales** permission.

> **Good to know:** The **Settings** group appears in the menu for anyone allowed at least one of its pages. What you see inside depends on your role. In our demo shop the Manager sees Company Profile, Branches, Rewards and POS Layout. The Cashier sees only Rewards and POS Layout. Printer Settings, Roles and Users show only to roles that have those permissions. The shop owner (Admin role) holds every permission of the shop's plan.

![Cashier menu](images/consumer/menu-cashier-online-orders-d.png)

*A Cashier's menu: no Sales Target, User Sales Stats, Operational Costs or Business Report, and only Rewards and POS Layout under Settings.*

### What you see

![Rewards Settings](images/consumer/rewards-settings-full-d.png)

*The whole Rewards Settings page with the new taka labels and the help text under the two switches.*

- A blue box **Important Note**: "Changes to rewards settings will apply to future transactions only. Existing points and transactions will not be affected."
- The form. It is greyed out while loading. If your shop never saved settings, these standard values show: enabled, 1 point per taka, minimum purchase 0, no maximum, value per point 0.01, minimum redemption 100, no maximum, no expiry, partial redemption Yes, earn on sales only Yes.
- Buttons: **Reload** (loads the saved values again), **Reset** (throws away what you typed and goes back to the values loaded) and **Save Settings**.

| Section | Field | Required | Notes |
|---|---|---|---|
| Top | **Enable Rewards System** | - | A switch showing "Enabled" or "Disabled". |
| **Earning Rules** | **Points per ৳1 Spent** | Yes | How many points per taka spent. 0 or more, two decimals. Example "e.g., 1.00". If empty: "Please enter points per taka". If negative: "Must be a positive number". |
| | **Minimum Purchase Amount** | Yes | The smallest sale that earns points, in taka. Example "e.g., 10.00". If empty: "Please enter minimum purchase amount". |
| | **Maximum Points per Sale (Optional)** | No | A whole number, 1 or more. Hint "Leave empty for no limit". |
| | **Points Expire After (Days)** | No | A whole number, 1 or more. Hint "Leave empty for no expiration". |
| **Redemption Rules** | **Taka Value per Point** | Yes | What one point is worth in taka. Minimum 0.0001, four decimals. Example "e.g., 0.01". If empty: "Please enter redemption value". If 0 or less: "Must be greater than 0". |
| | **Minimum Points to Redeem** | Yes | A whole number, 1 or more. Example "e.g., 100". If empty: "Please enter minimum redemption". If wrong: "Must be a whole number at least 1". |
| | **Maximum Points per Transaction (Optional)** | No | A whole number, 1 or more. Hint "Leave empty for no limit". |
| **Additional Settings** | **Allow Partial Redemption** | - | A Yes or No switch. Help text on screen: "On: points can pay part of a sale and the rest is paid another way. Off: points must pay the whole sale." |
| | **Earn Points on Fully Paid Sales Only** | - | A Yes or No switch. Help text on screen: "On: points are earned only on fully paid sales. Off: part-paid sales also earn, on the amount already received. Quotations never earn points." |

> **Good to know:** **Allow Partial Redemption** set to No means a sale paid with reward points (payment method **Credit**) must be covered entirely by points. Otherwise the sale is refused with "Partial redemption is turned off: reward points must cover the whole sale". **Earn Points on Fully Paid Sales Only** set to No means part-paid sales also earn points, on the amount already received. Quotations never earn points.

> **Good to know:** **Points Expire After (Days)** removes expired points when points are looked at or spent (see the note on the Reward Points page).

![Required field error](images/consumer/rewards-settings-validation-error-d.png)

*Clearing **Points per ৳1 Spent** and clicking **Save Settings** shows "Please enter points per taka". In testing the message showed twice. Nothing was saved.*

### How to start a loyalty programme

1. Go to **Settings** > **Rewards**.
2. Switch **Enable Rewards System** on.
3. Set **Points per ৳1 Spent**, for example 1.
4. Set **Taka Value per Point**, for example 0.01 (so 100 points are worth 1 taka).
5. Set **Minimum Points to Redeem**, for example 100.
6. Click **Save Settings**.

**What happens next:** you see "Rewards settings saved successfully". The new rules apply to future sales only. With these example values, a sale of 2,500 taka earns 2,500 points, worth 25 taka when used.

### How to pause the programme

1. Switch **Enable Rewards System** off.
2. Click **Save Settings**.

**What happens next:** no points are earned or redeemed while it is off. Existing balances stay.

### How to undo changes you have not saved

Click **Reset** to go back to the values that were loaded, or **Reload** to fetch the saved values again.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Rewards settings saved successfully | The settings were saved. | Nothing. |
| Failed to save rewards settings | The save failed. If the server gave a reason, you see it. | Fix any red field messages and try again. |
| Failed to load rewards settings | The page could not load the saved values. | Click **Reload**. |
| The field messages listed in the table above | A required field is empty or wrong. | Correct the field. |

---

## POS Layout

*Page title: **POS Layout**. The browser tab reads "POS Layout Settings". Menu name: **POS Layout**.*

### What it is

A page where each counter chooses which sales screen the POS uses. One is the detailed table-style screen. The other is a touch-friendly picture menu, useful for restaurants and cafes.

### Where to find it

Menu: **Settings** > **POS Layout**. You need the **Sales** permission. The **Settings** group shows in the menu for anyone allowed at least one of its pages (see the note under Rewards).

### What you see

![POS Layout](images/consumer/pos-layout-settings-d.png)

*The POS Layout page with Classic POS selected.*

- The heading **Choose your sales workspace**, with grey text: "Select the interface that best fits this device and business. This is a browser-level setting, so different counters can use different layouts."
- A blue box: "Classic POS remains the default for browsers that have not selected a layout."
- Two cards. The chosen card has an orange border and an orange tick next to its title.
  1. **Classic POS**: "The current detailed workspace with table-based cart, discounts, and payments visible together."
  2. **Restaurant POS**: "An image-first, touch-friendly menu with categories and a compact live order panel."
- A button **Save POS layout** at the bottom right.

### How to change the POS layout

1. Go to **Settings** > **POS Layout**.
2. Click **Classic POS** or **Restaurant POS**. The current choice is already selected.
3. Click **Save POS layout**.
4. Open the POS screen.

**What happens next:** you see "POS layout saved. It will be used the next time POS opens." The POS screen opens in the layout you chose. Nothing changes until you click **Save POS layout**. There are no error messages on this page.

![Restaurant POS selected](images/consumer/pos-layout-restaurant-selected-d.png)

***Restaurant POS** selected. It only takes effect after **Save POS layout**.*

> **Good to know:** The choice is kept in the web browser on this one computer or tablet. It is not saved for your user name and it is not shared with other counters. Each counter must set its own. If someone clears the browser data, the counter goes back to **Classic POS**.

> **Good to know:** **Restaurant POS** shows product pictures. Products without pictures will look empty, so add pictures first.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| POS layout saved. It will be used the next time POS opens. | Your choice was stored on this browser. | Open the POS screen. |

---

## Printer Settings

*Menu name: **Printer Settings**. Page title: **Receipt PDF Settings**. The path at the top reads "Dashboard > Settings > Receipt PDF".*

### What it is

The page that controls how every printed document looks: receipts, quotations, returns, challans, money receipts, delivery slips and transfer slips. You can set one look for the whole shop and a different look for a branch. The page also holds the switch for automatic small-roll (thermal) receipt printing and the download of the Windows print program.

### Where to find it

Menu: **Settings** > **Printer Settings**. You need the **Receipt settings** permission. The **Settings** group shows in the menu for anyone allowed at least one of its pages (see the note under Rewards).

### What you see

![Receipt PDF Settings](images/consumer/printer-settings-receipt-list-d.png)

*The Receipt PDF Settings page with the Receipt type chosen. Three receipt layouts are listed and one is active. The active one has no bin icon.*

- Top-right button: **Create Setting**.
- A box of controls:
  - Document type buttons: **Receipt** (chosen at the start), **Quotation**, **Return**, **Chalan**, **Money Receipt**, **Online Delivery Slip**, **Delivery Slip**, **Transfer Slip**, **Transfer Chalan**. The list below shows only layouts of the chosen type.
  - **Auto Print Thermal**: a switch showing **ON** or **OFF**. It is saved in this browser only.
  - **Download Print Server**: downloads the Windows print program (a file named `PosBuzz-Print-Server.zip`). The hint reads: "Windows app that prints receipts on the thermal printer. Update: quit it, delete the old folder, extract the new zip, run. Your settings are kept."
  - **All Branches**: a branch list. You can clear it. It shows the branch's layouts plus the shop-wide defaults.
  - **Refresh**: reloads the list.
- Four cards: **Total Settings**, **Active**, **Consumer Defaults** (shop-wide layouts, not tied to a branch) and **Branch Overrides** (layouts tied to a branch). They count only the rows now listed, for the chosen type and branch.
- A table:

| Column | What it shows |
|---|---|
| Name | The layout name in bold, with the document type under it (for example "Receipt", "Delivery Chalan", "Delivery Slip / Sticker", "Inventory Transfer Slip", "Online Delivery Slip", "Money Receipt", "Transfer Chalan", "Quotation", "Return"). |
| Scope | A purple tag **Consumer Default** (all branches) or a blue tag with the branch name. |
| Active | A switch. |
| Created By | The person's name, or "System". |
| Created | For example "Oct 24, 2026". |
| Actions | Eye icon (**Preview PDF**), blue pencil (**Edit**), copy icon (**Copy to Branch**), red bin (**Delete**). The bin is hidden for an active shop-wide default. |

There are no page buttons. Active rows are highlighted.

![Another document type](images/consumer/printer-settings-chalan-list-d.png)

*After clicking **Chalan** the list shows only chalan layouts.*

![Branch list](images/consumer/printer-settings-branch-dropdown-d.png)

*The **All Branches** list.*

### How layouts work

- Each document type can have several named layouts. Only one is active for a type and scope.
- A branch uses its own active layout if it has one. Otherwise it uses the shop-wide default (**Consumer Default**).
- Copy a layout to a branch to start a branch version, then edit and activate it.
- The small-roll thermal receipt is a different thing. It is printed by the Windows print program, not by these PDF layouts. **Auto Print Thermal** only decides whether the POS sends each new sale to that program.

### How to switch a layout on or off

1. Pick the document type button, for example **Receipt**.
2. Click the switch in the **Active** column of the layout.

**What happens next:**

- Switching on makes it the one in use for that type and scope. Other layouts of the same type and scope switch off. You see "Setting activated successfully".
- Switching off a branch layout makes that branch use the shop default. You see "Setting deactivated. Branch will use consumer default."
- A shop-wide default that is active cannot be switched off. The switch is greyed out. Activate another layout instead.

### How to preview a layout

1. Click the eye icon (**Preview PDF**) on the row.
2. A wide window "Sample Receipt Preview" opens. It first shows "Generating sample preview..." and "Using fake sample data with this receipt setting".
3. Click **Download PDF** to save `sample-receipt-preview.pdf`, or **Close** to leave.

**What happens next:** nothing is changed. If it fails you see "Failed to generate preview".

### How to copy a layout to a branch

1. Click the copy icon (**Copy to Branch**) on the row. The window "Copy Setting to Branch" opens with the question "Copy (layout name) to which branch?".
2. In the list (hint "Select target branch") choose the branch. You can type to search. The layout's own branch is not listed.
3. An orange note appears: "The copied setting will be created as inactive. Activate it from the list after creation."
4. Click **Copy**. The button is greyed out until you choose a branch. Click **Cancel** to leave.

![Copy Setting to Branch](images/consumer/printer-settings-copy-dialog-d.png)

*The Copy Setting to Branch window with a branch chosen and the orange note.*

5. Back in the list, switch the new copy to **Active**.

**What happens next:** you see "Setting copied to branch successfully". The copy exists but is not used until you switch it on.

### How to delete a layout

1. Click the red bin icon on the row.
2. The window **Delete Setting** asks "Are you sure you want to delete this setting?". Click **Delete**. Click **Cancel** to keep it.

![Delete Setting](images/consumer/printer-settings-delete-confirm-d.png)

*The delete question next to the bin icon.*


**What happens next:** you see "Setting deleted successfully".

### How to turn automatic thermal printing on or off

1. Click the **Auto Print Thermal** switch.

**What happens next:** you see "Auto print thermal receipt enabled" or "Auto print thermal receipt disabled". When it is **ON**, the POS sends each new sale to the thermal printer program right after the sale is made.

> **Good to know:** **Auto Print Thermal** is saved in the browser on this computer only. Switch it on in the browser of each counter. It needs the print program running (see "Setting up receipt printing" below).

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Setting activated successfully | The layout is now in use. | Nothing. |
| Setting deactivated. Branch will use consumer default. | The branch layout is off. The shop default is used. | Nothing. |
| Failed to activate setting / Failed to deactivate setting | The switch did not work. | Try again. |
| Setting copied to branch successfully | The copy was made, switched off. | Switch it on if you want to use it. |
| Failed to copy setting | The copy failed. | Try again. |
| Setting deleted successfully | The layout was removed. | Nothing. |
| Failed to delete setting | The delete failed. | Try again. |
| Failed to generate preview | The sample could not be made. | Try again. |
| Auto print thermal receipt enabled / disabled | The switch was changed for this browser. | Nothing. |

---

## Create or Edit Receipt Setting

*Page title: **Create Receipt Setting** or **Edit Receipt Setting**.*

### What it is

The form where you design how one printed document looks: which blocks and fields show, the page size, the currency, the font sizes and the footer text. You can see a sample before you save.

### Where to find it

Menu: **Settings** > **Printer Settings**, then click **Create Setting** (top right), or click the pencil icon (**Edit**) on a row. You need the **Receipt settings** permission. The path at the top reads "Dashboard > Settings > Receipt PDF > Create" or "... > Edit". Clicking **Settings** in that path takes you back to the list.

### What you see

![Create Receipt Setting, whole form](images/consumer/receipt-setting-create-full-d.png)

*The whole Create Receipt Setting form with every section open.*

Top-right buttons:

- **Load Preset Defaults** (new settings only): sets every option back to the standard preset for the chosen **Type**. You see "Preset defaults loaded". If no type is chosen you see "Please select a type first". Choosing a different **Type** on a new setting loads that type's preset by itself.
- **Preview**: makes a sample PDF with fake data using the values in the form. If the form has errors you see "Please fix form errors before previewing".

**Basic Information**

| Field | Required | Notes |
|---|---|---|
| **Setting Name** | Yes | Example "e.g., Default Receipt, Branch Custom". If empty: "Please enter a name". The name must be new for that type and scope. |
| **Type** | Yes | Receipt (chosen at the start), Quotation, Return Receipt, Delivery Chalan, Money Receipt, Online Delivery Slip, Delivery Slip / Sticker, Inventory Transfer Slip, Transfer Chalan. If empty: "Please select a type". It cannot be changed when editing. |
| **Branch Scope** | No | The hint says "Consumer Default (all branches)". Choose a branch for a branch-only layout. You can clear it. It cannot be changed when editing. |

A blue note appears on new settings: "Consumer-level settings apply to all branches unless overridden by a branch-specific setting. Only one setting can be active per scope per type."

![Name required](images/consumer/receipt-setting-create-error-d.png)

*Clicking **Create Setting** with the name empty shows "Please enter a name".*

![Type list](images/consumer/receipt-setting-type-dropdown-d.png)

*The **Type** list.*

**Sections.** All sections are open at the start. You can fold each one. A master On/Off switch turns a whole block on or off. Turning the master off greys out its small options and switches them off. Turning the master on switches them all on again, and then you can change them one by one.

| Section | What you can set |
|---|---|
| **Page & Layout** | **Page Size**: A4 (210 × 297 mm), A5 (148 × 210 mm), A6 (105 × 148 mm) for labels or stickers, Letter (8.5 × 11 in), Legal (8.5 × 14 in). **Currency Symbol**: ৳, Tk or BDT. **Currency Position**: "Before Amount (৳100)" or "After Amount (100৳)". **Margins (points)**: four boxes **Top**, **Right**, **Bottom**, **Left**, minimum 0. |
| **Header** | **Show Header** (switch). **Header Text** (hint "RECEIPT"). **Layout**: the list shows "centered" at the start, and a Logo Left choice. **Show Logo** (small switch). When the header is on: **Logo Max Width** (20 to 500) and **Logo Max Height** (20 to 300). |
| **Store Information** | Master **Show Store Info**. Small switches: **Store Name**, **Branch Name**, **Address**, **Phone**, **Email**, **VAT Registration**. |
| **Order Information** | Master **Show Order Info**. Small switches: **Sale Number**, **Date**, **Sale Type**, **Price Type**, **Cashier**, **Served By**. |
| **Customer Information** | Master **Show Customer Info**. Small switches: **Name**, **Phone**, **Email**, **Address**, **Reward Points**. |
| **Items Table** | Master **Show Items Table**. Small switches: **Product Name / Variant**, **SKU**, **Quantity**, **Unit Price**, **Discount**, **Tax**, **Line Total**. When on: **Discount Display** ("Total Only" or "Breakdown (Special, Promo, Avg)") and **Tax Display** ("Total Only" or "Breakdown (Rate & Method)"). |
| **Totals** | Master **Show Totals**. **Totals Position**: Regular or Right aligned. Small switches: **Subtotal**, **Discount**, **Shipping**, **Tax**. |
| **Payment** | Master **Show Payment Info**. **Payment Position**: Regular or Right aligned. Small switches: **Payment Breakdown**, **Received Amount**, **Change**, **Due Amount**, **Payment Date**, **Reference / Txn ID**. A note shows when Payment Breakdown is off: "Payment date and reference are printed per payment line, so they need "Payment Breakdown" turned on." |
| **Notes** | One switch **Show Notes**, which prints the sale notes. |
| **Footer** | Switches **Barcode**, **Terms & Conditions**, **Thank You Message**, **Print Date**. A text box **Terms & Conditions Text** (example "e.g., All sales are final. Items must be returned within 7 days..."). |
| **Font Sizes** | Five sliders: **Title** (14 to 32), **Subtitle** (10 to 24), **Heading** (8 to 20), **Body** (6 to 16), **Small** (4 to 12). |

![Currency Symbol list](images/consumer/receipt-setting-currency-dropdown-d.png)

*The **Currency Symbol** list: ৳, Tk and BDT.*

Not every option applies to every document type. For example, a chalan has no payment block. Use **Preview** to see the result.

Bottom buttons: **Preview Before Saving** (left), **Cancel** (back to the list without saving), and **Create Setting** (new) or **Update Setting** (edit).

![Bottom of the form](images/consumer/receipt-setting-create-bottom-d.png)

*The font size sliders and the three bottom buttons: **Preview Before Saving**, **Cancel** and **Create Setting**.*

**Preview window.** Titled "Sample Receipt Preview". It shows "Generating sample preview..." and "Using fake sample data with your current settings". Buttons: **Close** and **Download PDF** (saves `sample-receipt-preview.pdf`).

### How to create a layout

1. Go to **Settings** > **Printer Settings**.
2. Click the document type button, for example **Receipt**.
3. Click **Create Setting**.
4. Type a **Setting Name**.
5. Keep or change **Type**. Choose a **Branch Scope**, or leave it empty for all branches.
6. Change the sections you want. The standard preset for the type is already loaded.
7. Click **Preview Before Saving** and look at the sample. Click **Close**.
8. Click **Create Setting**.
9. Back in the list, switch **Active** on for the new layout.

**What happens next:** you see "Setting created successfully" and the list opens. The new layout is saved as inactive, so it is not used until you switch **Active** on.

> **Good to know:** A new receipt setting starts inactive. If you forget to switch it on, printing keeps using the old active layout.

### How to change a layout

1. In the list, click the pencil icon (**Edit**) on the row.
2. Change the options.
3. Click **Preview Before Saving** to check.
4. Click **Update Setting**.

**What happens next:** you see "Setting updated successfully" and the list opens. If the layout is active, the change applies right away to new prints. **Type** and **Branch Scope** cannot be changed. To change them, create a new layout.

### How to use one layout in another branch

1. In the list, click the copy icon.
2. Choose the branch and click **Copy**.
3. Switch the copy to **Active**.
4. Edit it if the branch needs something different.

### Messages on this screen

| Message | What it means | What to do |
|---|---|---|
| Setting created successfully / Setting updated successfully | The layout was saved. | If it is new, switch it to Active in the list. |
| Preset defaults loaded | The options went back to the standard preset. | Nothing. |
| Please select a type first | You clicked **Load Preset Defaults** with no type chosen. | Choose a **Type**. |
| Please enter a name | **Setting Name** is empty. | Type a name. |
| Please select a type | **Type** is empty. | Choose a type. |
| Please fix form errors before previewing | A field has a problem. | Fix the red fields, then click **Preview** again. |
| Failed to generate preview | The sample could not be made. | Try again. |
| A setting with the name "name" already exists for this branch/consumer and type "type". Please choose a different name. | The name is already used for that type and scope. | Choose a different name. |
| A name is required for the receipt setting. | The name is empty. | Type a name. |
| Failed to create setting / Failed to update setting | The save failed with no reason given. | Try again. |
| Setting not found / Branch not found | The layout or branch was removed. | Go back to the list and refresh. |

> **Good to know:** Only one layout can be active for each type and scope. Switching one on switches the previous one off. The shop-wide default cannot be switched off or deleted while it is active.

---

## Setting up receipt printing

Use these steps once on the Windows computer where the receipt printer is connected. This is for the small roll (thermal) receipt that prints right after a sale. The PDF layouts in Printer Settings are a separate thing.

**What you need:** a Windows computer (Windows 7, 8, 10 or 11) with the receipt printer connected and working. The program needs .NET Framework 4.6.1 or newer, which most Windows computers already have. The program must run on the same computer as the web browser you use for the POS. A different computer on the network cannot print through it unless your technician has set that up.

### How to install the print program

1. On that Windows computer, open the app and go to **Settings** > **Printer Settings**.
2. Click **Download Print Server**. The file `PosBuzz-Print-Server.zip` is saved.
3. Extract all the files into a folder, for example `C:\PosBuzz-Print-Server\`.
4. Open the folder and run **Printer.exe**.
5. A green icon appears in the system tray, near the clock.

### How to set the program up

1. Right-click the green tray icon and choose **Configure**.
2. Fill in the store name, address, phone and email.
3. Type the **receipt printer name**. It must be exactly the name Windows shows. To check, open Windows Settings > Devices > Printers & scanners.
4. If you want a logo, add a PNG or JPG file.
5. If you print barcode labels, type the **barcode label printer name**.
6. Set the currency symbol.
7. If a cash drawer is connected through the receipt printer, switch on the cash drawer option.
8. Tick the option to start with Windows, so the program opens every time the computer starts.
9. Save.

### How to test the printer

1. Right-click the tray icon and choose **Test Receipt**.
2. A test receipt should print. Alternatively, open `http://localhost:8080/print/test-receipt` in the browser on the same computer.

### How to turn on automatic printing in the app

1. In the app, go to **Settings** > **Printer Settings**.
2. Switch **Auto Print Thermal** to **ON**. Do this in the browser on each counter.
3. Make a test sale on the POS screen.

**What happens next:** the receipt prints after the sale. If the sale is paid in cash and a cash drawer is connected, the drawer opens. Keep the tray program running while you sell.

If the program is not running, nothing prints by itself. The app may then show: "Printing agent is not running. Please start the printing agent and try again." Start **Printer.exe** and try again.

### How to set the label size

Set the label size once in the barcode printer's driver: Printers > the barcode printer > Printing Preferences > Page Setup > Stock.

### How to update the print program

1. Quit the tray program.
2. Delete the old program folder.
3. Extract the new zip file.
4. Run **Printer.exe**.

Your settings are kept in your Windows user folder. The first time you run a new major version, enter the configuration once again.

### If something goes wrong

| Problem | What it means | What to do |
|---|---|---|
| "Printer not found" | The printer name in the program is not the same as the name in Windows, or the printer is off or not connected. | Print a Windows test page first. Then type the printer name exactly as Windows shows it. |
| The program does not start | Another program may be using the same connection (port 8080), or the firewall may be blocking it. | Right-click **Printer.exe** and choose **Run as administrator**. Check the Windows Firewall. |
| The green icon is missing | The program is not running, or the icon is hidden. | Open Task Manager and look for the program. Check the notification area settings in Windows. |
| It does not start with Windows | The start-up option did not save. | Run **Printer.exe** as administrator once and switch on **Start with Windows**. |
| Nothing prints after a sale | The program is not running, or **Auto Print Thermal** is **OFF** in this browser. | Start the program. Switch **Auto Print Thermal** to **ON** on this counter's browser. |

> **Good to know:** The Printer Settings page has no test buttons. Test from the tray program as described above.
