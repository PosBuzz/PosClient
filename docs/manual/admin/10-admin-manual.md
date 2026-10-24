# Part 1 - Using the Admin Panel

## About the Admin Panel

The Admin Panel is the control room for the PosBuzz team. It is used to:

- sell and manage **plans** (what a shop is allowed to use),
- create and look after **consumers** (the shops that use PosBuzz),
- record **billing** (the paid periods that keep a shop's account switched on),
- answer **support tickets** from shops,
- manage the **marketing website** content and the sales leads it collects,
- manage the people who can sign in to the Admin Panel (**users and roles**),
- take and restore **database backups**.

It is not the app that shops use at the till. That app has its own manual, the *Shop App Manual*.

In this manual a **consumer** means one shop account. A shop's **subdomain** is the first part of its web address. For example, the subdomain `rahim` gives the shop the address `rahim.posbuzz.xyz`.

### Who can see what

Every Admin Panel user has a **role**, and every role holds a list of **permissions**. The left-hand menu only shows the screens your permissions allow. If a screen is missing from your menu, ask a colleague with the *Users* permission to change your role. If you open an address you are not allowed to see, the panel shows a not-allowed page with a **Take me there!** button (see below). A user without *show_consumers* sees 0 in the Dashboard counters.

| Permission | What it unlocks |
|---|---|
| plans | Plans screen |
| show_consumers | Consumers screen (list) |
| add_consumers | **Add New** button on Consumers |
| modify_consumers | Edit, Import data and the billing-history downloads on Consumers |
| delete_consumers | Delete, Restore and Delete forever on Consumers |
| billing | Billing & Subscriptions screen |
| portfolio | Portfolio Site screen |
| support | Support screen |
| users | Settings > Roles and Settings > Users |
| profile | Settings > Account & Security |
| backup&restore | Settings > Backup & Restore |

The **Settings** menu appears only if you hold at least one of its pages (*profile*, *users* or *backup&restore*). If none of them is allowed, the whole Settings group is hidden.

## Signing in and getting around

### Where to sign in

Open the Admin Panel address your team gave you. In production it starts with `admin.` (for example `admin.posbuzz.xyz`). The test (staging) copy lives at `admin.posbuzz.cloud`. Use the staging copy for practice, because its data is separate from the real data.

![Admin sign-in page](images/admin/login-d.png)
*The sign-in page.*

![Sign-in page with validation messages](images/admin/login-errors-d.png)
*The sign-in page after pressing Login with both boxes empty.*

### How to sign in

1. Open the Admin Panel address.
2. Type your email in **Email**.
3. Type your password in **Password**.
4. Click **Login**.

What happens next: you see the message **Login successful** and land on the Dashboard. If you were sent to the sign-in page from another screen, you return to that screen.

| Message | What it means | What to do |
|---|---|---|
| Please input your email! | The email box is empty. | Type your email. |
| Please enter a valid email! | The text is not shaped like an email address. | Check for typing mistakes. |
| Please input your password! | The password box is empty. | Type your password. |
| Login failed (or the reason given by the server) | The email or password is wrong, or sign-in is temporarily limited. | Check the details and try again. Sign-in is limited to a few attempts per minute, so wait a minute after repeated failures. |

If you are already signed in and open the sign-in page, you are taken straight to the Dashboard.

### The screen layout

![Admin dashboard with the menu on the left](images/admin/dashboard-d.png)
*The layout: menu on the left, top bar above, work area in the middle.*

![Settings menu opened](images/admin/menu-settings-open-d.png)
*The Settings group opened: Account & Security, Roles, Users and Backup & Restore.*

- **Menu (left).** Dashboard, Plans, Consumers, Billing & Subscriptions, Portfolio Site, Support and Settings (which opens Account & Security, Roles, Users and Backup & Restore). The bottom of the menu reads "Powered by PosBuzz".
- **Top bar (right side), icons from left to right:**
  1. **Clear All Admin Caches** (circular arrow). Reloads every list from the server. Use it if a screen looks out of date. You see "All admin caches cleared!".
  2. **Theme** (light bulb). Choose **Dark**, **Light** or **System**. The choice is remembered in your browser.
  3. **User Guide (PDF)** (book icon). Opens this manual as a PDF in a new tab.
  4. **Account and Security** (person). Opens your account page.
  5. **Logout** (arrow out of a door). Signs you out.
- **Fold button** (three lines, top left). Collapses or expands the menu.
- **Breadcrumbs** above each page title (for example *Dashboard > Consumers*). Click **Dashboard** to go back home.

### Using the Admin Panel on a phone

On a narrow screen the menu is hidden. Tap the fold button at the top left to open it, tap a menu item, and the menu closes. Tables scroll sideways. Forms open as a panel that fills the screen.

![The menu opened on a phone](images/admin/dashboard-menu-m.png)
*The menu opened on a phone-sized screen.*

![Dashboard on a phone](images/admin/dashboard-m.png)
*The Dashboard on a phone-sized screen.*

### Things every list and form have in common

- **Add New / Add Bill** (blue button, top right) opens a panel (drawer) from the right side with a form. Press **Save** to store it, or the **X** at the top of the panel to close it without saving.
- The pencil icon edits a row. The red bin icon deletes it and always asks you to confirm first ("Yes" / "No").
- Required fields show a red star. If you leave one empty the message **This field is required** appears under it.
- After a successful action a green message appears at the top: **Saved Successfully**, **Updated Successfully** or **Deleted Successfully**. If something goes wrong a red message explains why. If the server gives no reason you see **Something went wrong**.
- If a list cannot load you see **Failed to load data**. Use the Clear All Admin Caches button or reload the page.

![Menu seen by a Support Agent](images/admin/support-session-menu-d.png)
*The menu for a user whose role holds only Support, Plans and Profile. Billing, Consumers and Portfolio are missing.*

![Limited Settings group](images/admin/support-session-settings-open-d.png)
*Settings for the same user shows only Account & Security.*

![Page shown for a screen you may not open](images/admin/support-session-forbidden-d.png)
*Typing the address of a screen you are not allowed to open shows this 'doorway to the great nothing' page. Click **Take me there!** to go back.*

## Dashboard

**What it is.** A quick count of consumers and how many are currently paid up.

**Where to find it.** First item in the menu. Everyone who can sign in can open it.

**What you see.**

| Card | Meaning |
|---|---|
| Total Users | The number of consumer accounts (shops) in the list. |
| Active Users | How many of them have an active billing period today. |
| One card per plan (for example *Enterprise*) | How many active consumers are on that plan. A consumer without a plan name is counted under *Unknown*. |

The screenshot above shows the demo data: 6 shops, 4 active, 2 on Enterprise, 1 on Growth and 1 on Starter.

> **Good to know:** "Users" on this dashboard means shops, not people. A shop is "active" only while a bill covers today's date (see *Billing and Subscriptions*).

## Plans

**What it is.** A plan is a package. It sets a price, how many products a shop may create, and which permissions (features) the shop's staff can use.

**Where to find it.** Menu > **Plans**. Needs the *plans* permission.

![Plans list](images/admin/plans-d.png)
*The Plans list.*

**What you see.** A table with the columns **Name**, **Price**, **Max Products** (a green **Unlimited** tag when no limit is set), **Permissions** (one blue tag per permission) and **Actions** (edit and delete icons). The **Add New** button is at the top right.

### How to add a plan

1. Click **Add New**. The **Add Plan** panel opens.
2. Fill in the form.
3. Click **Save**.

![Add Plan panel](images/admin/plans-add-d.png)
*The Add Plan panel.*

![Add Plan with validation messages](images/admin/plans-add-errors-d.png)
*Saving an empty form, or Max Products set to 0, shows the messages under each box.*

![Permission picker](images/admin/plans-add-permissions-d.png)
*The Permissions drop-down lists every permission. Type to search, click to add.*

![Add Plan filled in](images/admin/plans-add-filled-d.png)
*A filled-in plan with four permissions chosen.*

![Plan saved](images/admin/plans-saved-d.png)
*After Save the green message appears and the plan joins the list.*

| Field | Required | Notes |
|---|---|---|
| Name | Yes | The plan's name, shown in lists and drop-downs. |
| Price | Yes | The amount charged for one month. It is filled into new bills automatically. |
| Max Products | No | The most products a shop on this plan may create. Leave blank for unlimited. If you type a number it must be at least 1 (otherwise: **Must be at least 1**). |
| Permissions | Yes | Pick one or more from the list. You can type to search. Click the small cross on a tag to remove it. |

What happens next: the panel closes, the list refreshes and you see **Saved Successfully**.

### How to change a plan

1. Click the pencil icon on the plan's row. The **Update Plan** panel opens with the current values.
2. Change what you need.
3. Click **Save**. You see **Updated Successfully**.

![Update Plan panel](images/admin/plans-edit-d.png)
*The Update Plan panel opens with the current values.*

> **Good to know:** a permission you add or remove here changes what the staff of **every shop on that plan** can do. Removing *sales*, for example, hides the Sales menu from those shops and blocks the Point of Sale page. Staff may need to reload the page to see the change.

### How to delete a plan

1. Click the red bin icon on the plan's row.
2. Read the question **Delete this item?** and the warning **This action cannot be undone**.
3. Click **Yes** to delete or **No** to keep it.

![Delete confirmation for a plan](images/admin/plans-delete-confirm-d.png)
*The confirmation question beside the red bin.*

![Plan deleted](images/admin/plans-deleted-d.png)
*After Yes the message Deleted Successfully appears.*

If the plan is still in use the server refuses and shows the reason in a red message. Move those shops to another plan first. The message reads: *This plan is still used by other records, so it can't be changed or deleted. Remove or reassign those first.*

![Plan in use cannot be deleted](images/admin/plans-delete-in-use-d.png)
*Trying to delete Starter, which shops still use.*

## Consumers (shop accounts)

**What it is.** The list of every shop account. From here you create new shops, edit their details, move them to another plan, download their billing history, copy data from one shop to another, and remove or restore a shop.

**Where to find it.** Menu > **Consumers**. Needs *show_consumers*. Buttons only appear if you also hold the matching permission (see the table near the start of this manual).

![Consumers list](images/admin/consumers-d.png)
*The Consumers list.*

![Consumers list scrolled to the right](images/admin/consumers-scrolled-d.png)
*Scrolled sideways: Plan, Max Branches, Billing Status and the action icons. Greenvalley is Inactive (last covered until 24 Sep 2026).*

![Consumers on a phone](images/admin/consumers-m.png)
*The Consumers list on a phone.*

**What you see.**

- A switch at the top: **Active** (default) and **Deleted**.
- Three filters: a search box (it searches name, email, secondary email, phone, business category and subdomain), **Filter by Status** (Active or Inactive) and **Filter by Plan**. The search waits half a second after you stop typing.
![Status filter options](images/admin/consumers-filter-status-options-d.png)
*Filter by Status offers Active and Inactive.*

![Inactive shops](images/admin/consumers-filter-inactive-d.png)
*Filtered to Inactive: Green Valley Grocery and Sylhet Tea Traders (its first bill starts in the future).*

![Plan filter options](images/admin/consumers-filter-plan-options-d.png)
*Filter by Plan lists every plan.*

![Starter shops](images/admin/consumers-filter-plan-starter-d.png)
*Filtered to the Starter plan.*

![Search](images/admin/consumers-search-d.png)
*Typing in the search box narrows the list.*

- The table. Scroll sideways to see every column:

| Column | Meaning |
|---|---|
| Company Name | The shop's name. |
| Owner Name | The name of the shop's main Admin user. |
| Products | Products used out of the plan limit, for example `6 / ∞` for unlimited. With a limit the tag turns orange at 80% of it and red at 100%. |
| Business Category | Free text, for example Electronics. |
| Email / Secondary Email / Phone / Address | Contact details. |
| Subdomain | The shop's address prefix. |
| Plan | The plan the shop is on. |
| Max Branches | How many branches the shop may create. |
| Billing Status | A green **Active** or red **Inactive** tag. Under it: *Active until* a date, *Last covered until* a date, or *No billing period*. |
| Actions | Icons and links, described below. |

![Row actions](images/admin/consumers-actions-d.png)
*The action icons: Excel, PDF, pencil, Import data and the red bin.*

**Action icons on each row** (only the ones you have permission for):

| Icon / link | What it does |
|---|---|
| Green spreadsheet icon | Downloads the shop's billing history as an Excel file. |
| Download icon | Opens the shop's billing history as a PDF in a new tab. |
| Pencil | Edits the shop. |
| **Import data** | Copies data from this shop into another shop (see below). |
| Red bin | Deletes (hides) the shop, after a confirmation. |

### How to add a consumer

1. Click **Add New** (visible only with *add_consumers*). The **Add Consumer** panel opens.
2. Fill in the form.
3. Click **Save**. You see **Saved Successfully**.

![Add Consumer panel](images/admin/consumers-add-d.png)
*The Add Consumer panel.*

![Add Consumer with validation messages](images/admin/consumers-add-errors-d.png)
*Saving an empty form.*

![Subdomain taken](images/admin/consumers-add-subdomain-taken-d.png)
*Typing rahim shows Subdomain is already taken.*

![Plan options](images/admin/consumers-add-plan-options-d.png)
*The Plan drop-down.*

![Add Consumer filled in](images/admin/consumers-add-filled-d.png)
*A completed form.*

![Consumer saved](images/admin/consumers-saved-d.png)
*The message Saved Successfully.*

![Add Consumer on a phone](images/admin/consumers-add-m.png)
*On a phone the panel fills the screen.*

| Field | Required | Notes |
|---|---|---|
| Company Name | Yes | |
| Business Category | No | |
| Phone | No | |
| Address | No | |
| Subdomain | Yes | Letters and numbers for the shop's web address. The panel checks it while you type. If it is used, you see **Subdomain is already taken**. If the check cannot run you see **Failed to validate subdomain**. Subdomains of deleted shops stay reserved. |
| Plan | Yes | Choose from the plan list. |
| Max Branches | Yes | A whole number, at least 1. Starts at 1. |
| Owner Name | Yes | Name of the shop's first user. |
| Primary Email | Yes | This is the owner's sign-in email. |
| Secondary Email | No | |
| Password | Yes when adding | The owner's first password. Share it with the owner through a safe channel and ask them to change it after the first sign-in. |

> **Good to know:** a new shop **cannot sign in until a bill covers today's date.** After adding a consumer, go to *Billing & Subscriptions* and add the first bill. Until then the shop's address shows a "subscription inactive" page.

![New shop without a bill](images/admin/consumers-new-no-billing-d.png)
*A shop added a moment ago. It reads Active here only because the demo bill was added next; before its first bill the Billing Status reads No billing period.*

### How to edit a consumer

1. Click the pencil icon. The **Update Consumer** panel opens with the current values.
2. Change what you need. **Password** is optional when editing: leave it empty to keep the current one.
3. Click **Save**. You see **Updated Successfully**.

Use this to change the plan or raise **Max Branches** when a shop grows. Changing the plan also changes which features the shop's staff can use.

![Update Consumer panel](images/admin/consumers-edit-d.png)
*The Update Consumer panel. Password is empty and optional.*

### How to download billing history

1. Click the green spreadsheet icon for an Excel file, or the download icon for a PDF.
2. The file opens or downloads. The Excel file is named `billing-history-<number>.xlsx`.

![Billing history PDF](images/admin/consumers-billing-history-pdf-d.png)
*The billing history PDF for Rahim Electronics. Amounts read BDT.*

If the Excel download fails you see an alert: **Failed to download file. Please try again.**

### How to copy a shop's data into another shop (Import data)

Use this when a customer opens a second account and wants their products, customers, vendors or branches copied over. The copy is **one-way** and a **snapshot**: the source shop is never changed, and you may run it again later to bring over newer records.

1. On the source shop's row click **Import data**. The window **Import data from <shop name>** opens.
2. Under **Destination account** choose the shop that will receive the data. Only active shops other than the source are listed.
3. Under **Information to import** tick what to copy.
4. Under **When a matching record already exists** choose one policy.
5. Click **Preview import**. Counts appear for each kind of record.
6. Type the destination shop's subdomain in the confirmation box.
7. Click **Import now**.

![Import data window](images/admin/consumers-import-d.png)
*The Import data window before anything is chosen.*

![Destination list](images/admin/consumers-import-destination-options-d.png)
*Step 2: the destination list.*

![Destination chosen](images/admin/consumers-import-destination-chosen-d.png)
*A destination chosen. Products is ticked by default and the safe policy is selected.*

![Inventory ticks others](images/admin/consumers-import-inventory-autoticks-d.png)
*Ticking Inventory also ticks Products and Branches.*

![Update policy warning](images/admin/consumers-import-update-warning-d.png)
*Choosing Update shows the yellow warning.*

![Preview counts](images/admin/consumers-import-preview-d.png)
*Step 5: Preview import shows counts per kind of record and the box for the destination's subdomain.*

![Wrong confirmation](images/admin/consumers-import-confirm-wrong-d.png)
*A wrong confirmation turns red and Import now stays disabled.*

![Ready to import](images/admin/consumers-import-update-ready-d.png)
*Typed correctly: Import now turns blue.*

![Import result](images/admin/consumers-import-result-d.png)
*The result message after a first import: 136 created.*

![Re-run with update](images/admin/consumers-import-result-update-d.png)
*Running it again with Update: 0 created, 130 updated.*

![Import could not continue](images/admin/consumers-import-error-d.png)
*A refused import: Branch limit exceeded: destination allows 1, has 1, and this import needs 5 more.*

![Recent imports](images/admin/consumers-import-history-d.png)
*Recent imports lists the earlier run with its status.*

| Choice | What it copies |
|---|---|
| Products | Catalogue, units, categories, brands, tags, variants and attributes. Stock and sales are not included. |
| Inventory | Current stock batches and quantities. Needs Products and Branches, which are ticked for you automatically. |
| Customers | Customer profiles only. Sales and reward history are not included. |
| Vendors | Vendor contact profiles. Purchase stock is not included. |
| Branches | Branch details. The destination keeps its own main branch. |

| Policy | Meaning |
|---|---|
| Keep destination data (add only missing records) | Records that already match are left alone; only missing ones are added. This is the safe choice. |
| Update destination matches with source values | Matching records in the destination are overwritten with the source values. A yellow warning, **Matching destination records may be changed**, appears. |

Good to know:

- **Import now** stays disabled until you have run **Preview import** and typed the destination's subdomain exactly. Changing any choice after previewing clears the preview and the confirmation.
- The import is all-or-nothing. If anything fails, nothing is copied. A red box titled **Import could not continue** shows the reason (for example when a plan's product or branch limit would be exceeded).
- When it works you see, for example, **Import completed: 12 created, 0 updated, 3 skipped**.
- The bottom of the window lists **Recent imports involving this account** with the status (COMPLETED, FAILED or in progress), the sections and the time. It reads **No import attempts yet** when empty.

### How to delete a consumer, restore it, or delete it forever

**Delete (hide).**

1. Click the red bin icon and confirm **Delete this consumer?** (it says the shop "will be hidden and can be restored later").
2. The shop disappears from the **Active** list. Its staff can no longer sign in, and its address looks the same as an address that does not exist.

**Look at deleted shops.** Click **Deleted** at the top of the list. A yellow notice explains the rules. The table gains a **Deleted** column with the date and, if given, the reason.

![Delete confirmation](images/admin/consumers-delete-confirm-d.png)
*The delete confirmation.*

![Deleted toast](images/admin/consumers-deleted-toast-d.png)
*After Yes the shop leaves the Active list.*

![Deleted consumers view](images/admin/consumers-deleted-d.png)
*The Deleted view.*

![Deleted view actions](images/admin/consumers-deleted-actions-d.png)
*The Deleted view: reason, date, Restore and Delete forever.*

![Restore confirmation](images/admin/consumers-restore-confirm-d.png)
*Restore asks for confirmation.*

![Delete forever window](images/admin/consumers-purge-empty-d.png)
*The Delete forever window with the red warning.*

![Subdomain typed](images/admin/consumers-purge-typed-d.png)
*Once the subdomain is typed, Delete forever is enabled.*

![Permanently deleted](images/admin/consumers-purged-toast-d.png)
*The message Consumer permanently deleted.*

**Restore.**

1. In the Deleted view click **Restore** on the shop's row.
2. Confirm **Restore this consumer?** ("The tenant will be able to log in again"). Click **Restore**.
3. You see **Consumer restored**. All its data is intact.

**Delete forever (cannot be undone).**

1. In the Deleted view click **Delete forever**.
2. The window **Permanently delete this consumer?** warns that every record the shop owns will be erased (products, sales, customers, payroll and audit history).
3. Type the shop's subdomain in the box. The red **Delete forever** button stays disabled until it matches exactly.
4. Click **Delete forever**. You see **Consumer permanently deleted**.

> **Good to know:** take a database backup first (see *Backup and Restore*) if there is any doubt. A permanent deletion cannot be reversed from the panel.

## Billing & Subscriptions

**What it is.** The record of each paid period. A shop can use PosBuzz only while one of its bills covers today's date. Adding, editing and deleting bills is how you switch a shop on, extend it, or let it lapse.

**Where to find it.** Menu > **Billing & Subscriptions** (page title **Billing Histories**). Needs the *billing* permission.

![Billing Histories](images/admin/billings-d.png)
*The Billing Histories list.*

![Billing on a phone](images/admin/billings-m.png)
*Billing on a phone.*

![Consumer filter](images/admin/billings-filter-consumer-options-d.png)
*Select Consumer(s) lets you choose several shops.*

![Filtered by two shops](images/admin/billings-filter-consumer-d.png)
*Filtered to Rahim Electronics and Chittagong Pharma Mart.*

![Reference search](images/admin/billings-filter-reference-d.png)
*Searching the reference for bKash.*

**What you see.**

- Filters: **Select Consumer(s)** (choose one or more shops) and **Search by Reference**.
- Table columns: **Name** (the shop), **Amount**, **Billing date** (when the payment was made), **Billing From**, **Billing Till**, **Reference** (a dash if empty) and **Actions** (download invoice, edit, delete). Dates read day-month-year.
- **Add Bill** button at the top right.

### How to add a bill

1. Click **Add Bill**. The **Add Bill** panel opens.
2. Choose the **Consumer**. The shop's plan is shown in brackets after its name.
3. Check the dates and amount that fill in for you, and change them if needed.
4. Optionally type a **Reference** (for example a payment or transaction number).
5. Click **Save**.

![Add Bill panel](images/admin/billings-add-d.png)
*The Add Bill panel before a consumer is chosen. The date boxes unlock once you pick one.*

![Add Bill validation](images/admin/billings-add-errors-d.png)
*Saving without a consumer.*

![Consumer options](images/admin/billings-add-consumer-options-d.png)
*Each shop shows its plan in brackets.*

![Auto-filled dates](images/admin/billings-add-autofilled-d.png)
*After choosing a consumer: today for Billing Date and From, one month later (less a day) for Till, and the plan price as Amount.*

![Date picker](images/admin/billings-add-datepicker-d.png)
*Clicking a date opens the calendar.*

![Add Bill filled in](images/admin/billings-add-filled-d.png)
*With a reference typed.*

![Bill saved](images/admin/billings-saved-d.png)
*Saved Successfully.*

![Second bill](images/admin/billings-add-second-bill-d.png)
*A second bill for the same shop starts the day after the first ends.*

![Till before From](images/admin/billings-add-till-before-from-d.png)
*Billing Till cannot be before Billing From.*

![Overlap error](images/admin/billings-overlap-error-d.png)
*This billing period overlaps an existing bill for the consumer.*

![Add Bill on a phone](images/admin/billings-add-m.png)
*Add Bill on a phone.*

| Field | Required | Notes |
|---|---|---|
| Consumer | Yes | The date boxes stay greyed out until you choose one. |
| Billing Date | Yes | Starts as today. |
| Billing From | Yes | Starts the day after the shop's latest paid period ends, or today if it has none. Changing it moves **Billing Till** to one month later automatically. |
| Billing Till | Yes | Starts one month after Billing From, less a day. It cannot be before Billing From (**Billing Till cannot be before Billing From**). |
| Amount | Yes | Starts as the plan's price. |
| Reference | No | Free text. Useful for searching later. |

What happens next: you see **Saved Successfully**, the list refreshes and the shop's status on the Consumers list updates. A shop is **Active** while *Billing From* is on or before today and *Billing Till* is on or after today.

> **Good to know:** two bills for the same shop may not overlap. If they would, you see **This billing period overlaps an existing bill for the consumer**. Start the new bill the day after the previous one ends.

### How to edit, download or delete a bill

- **Edit.** Click the pencil, change the fields in the **Update Bill** panel, click **Save**.

![Update Bill](images/admin/billings-edit-d.png)
*The Update Bill panel.*

- **Download invoice.** Click the download icon. The invoice PDF opens in a new tab.
- **Delete.** Click the red bin and confirm **Delete this item?**. Deleting a bill can switch the shop off straight away if it was the one covering today.

![Delete bill](images/admin/billings-delete-confirm-d.png)
*The delete confirmation.*

![Invoice PDF](images/admin/billings-invoice-pdf-d.png)
*An invoice PDF. Amounts read BDT.*

## Portfolio Site (marketing website)

**What it is.** The control panel for the public PosBuzz marketing website. It also holds the sales leads that website visitors send in.

**Where to find it.** Menu > **Portfolio Site**. Needs the *portfolio* permission.

![Portfolio Site, Leads tab](images/admin/portfolio-d.png)
*The Portfolio Site screen opens on the Leads tab.*

![Publish now hint](images/admin/portfolio-publish-tooltip-d.png)
*Hovering over Publish now.*

![Portfolio on a phone](images/admin/portfolio-m.png)
*Portfolio Site on a phone.*

The top right has a **Publish now** button. Edits to content go live automatically. Use **Publish now** to force the website to refresh straight away. You see **Site refreshed - edits are live now** when it works, or a warning, **Could not reach the site; it will pick up the changes on its next refresh**, if the website could not be reached. The button is greyed out when no publish link has been set up, and its hint then reads "Publish hook is not configured; the site refreshes on its own schedule."

There are eight tabs: **Leads**, **Site Settings**, **Pricing Plans**, **Features**, **Solutions**, **FAQs**, **Testimonials** and **POS Simulator**.

### Leads

![Leads tab](images/admin/portfolio-leads-d.png)
*The Leads tab.*

![Status filter](images/admin/portfolio-leads-status-filter-d.png)
*The status filter.*

![Qualified leads](images/admin/portfolio-leads-filtered-status-d.png)
*Only QUALIFIED leads.*

![Type filter](images/admin/portfolio-leads-type-filter-d.png)
*The type filter.*

![Demo requests](images/admin/portfolio-leads-filtered-type-d.png)
*Only demo requests.*

![Lead search](images/admin/portfolio-leads-search-d.png)
*Searching for bakery.*

![Lead detail](images/admin/portfolio-lead-detail-d.png)
*The lead panel with details, the message and Internal notes.*

![Notes saved](images/admin/portfolio-lead-saved-d.png)
*Lead updated after Save notes.*

![Status options](images/admin/portfolio-lead-status-options-d.png)
*The status drop-down in the row.*

![Delete lead](images/admin/portfolio-lead-delete-confirm-d.png)
*Delete this lead? asks Cancel or OK.*

Leads are messages and demo requests from the website's forms.

- **Summary cards:** New leads, Last 7 days, Won, All leads.
- **Filters:** **All statuses**, **All types** (Contact form or Demo request) and a search box (name, email or business).
- **Table:** Received (date and time), Name (click it to open the lead), Email, Business, Type (CONTACT or DEMO), Status (a drop-down you can change right in the row) and a bin icon.

**Lead statuses**, in the usual order: **NEW**, **CONTACTED**, **QUALIFIED**, **WON**, **LOST**.

How to work a lead:

1. Click the lead's name. A panel opens with the type, email (click to write an email), phone, business, industry, outlets, source page, received time and the visitor's message.
2. Type your own comments in **Internal notes** (up to 4000 characters) and click **Save notes**. You see **Lead updated**. Visitors never see these notes.
3. Change the status with the drop-down in the table row. You see **Lead updated**.
4. To remove a lead, click the bin and confirm **Delete this lead?**. You see **Lead deleted**.

### Site Settings

![Site Settings tab](images/admin/portfolio-settings-d.png)
*The Site Settings tab.*

![Settings saved](images/admin/portfolio-settings-saved-d.png)
*Site settings saved.*

The website's name, address and contact details, and the text search engines show.

| Group | Field | Notes |
|---|---|---|
| Identity | Site name, Author / company, Canonical URL, OG image URL | All required. The URL fields hint at the format, for example `https://posbuzz.com`. |
| Contact | Support email, Sales email, Phone, Address | Address is optional; the rest are required. |
| SEO / AEO | Meta title, Meta description, Keywords | Title and description are required. Type each keyword and press Enter. |

Click **Save site settings**. You see **Site settings saved**. If nothing has been saved before, a blue notice says "No site settings saved yet" and that the website is showing its built-in text. Saving takes over from that text. If loading fails, a red box offers **Retry**.

### Content tabs (Pricing Plans, Features, Solutions, FAQs, Testimonials, POS Simulator)

All six work the same way. Each shows a table of entries with a **Published** column (**Live** or **Hidden**), an **Order** column, and edit and delete icons.

![Pricing Plans tab](images/admin/portfolio-pricing-d.png)
*A content tab (Pricing Plans).*

How to add an entry:

1. Click the **Add ...** button above the table (the label changes by tab: Add Plan, Add Feature, Add Solution, Add FAQ, Add Testimonial, Add Demo Product).
2. Fill in the form in the panel.
3. Leave **Published** switched on to show it on the website, or switch it off to keep it hidden.
4. Use **Sort order** to place it (lower numbers come first; new entries go to the end).
5. Click the **Save ...** button at the bottom of the panel. You see, for example, **Plan saved**.

![Pricing add errors](images/admin/portfolio-pricing-add-errors-d.png)
*Required boxes flagged.*

![Pricing edit](images/admin/portfolio-pricing-edit-d.png)
*Editing a plan shows its lists, Sort order and Published.*

![Add Plan panel on the Pricing Plans tab](images/admin/portfolio-pricing-add-d.png)
*Adding a pricing plan to the website.*

To edit, click the pencil. To delete, click the bin and confirm (for example **Delete this plan?**, with **Cancel** and **OK**); you see, for example, **Plan deleted**. If a list cannot load, a red box offers **Retry**. Fields that take several entries ("list" fields) accept one entry per line: type it and press Enter.

![Features](images/admin/portfolio-features-d.png)
*Features tab.*

![Add Feature](images/admin/portfolio-features-add-d.png)
*Add Feature.*

![Feature errors](images/admin/portfolio-features-add-errors-d.png)
*Add Feature, validation.*

![Edit Feature](images/admin/portfolio-features-edit-d.png)
*Edit Feature.*

![Solutions](images/admin/portfolio-solutions-d.png)
*Solutions tab.*

![Add Solution](images/admin/portfolio-solutions-add-d.png)
*Add Solution.*

![Solution errors](images/admin/portfolio-solutions-add-errors-d.png)
*Add Solution, validation.*

![Edit Solution](images/admin/portfolio-solutions-edit-d.png)
*Edit Solution.*

![FAQs](images/admin/portfolio-faqs-d.png)
*FAQs tab.*

![Add FAQ](images/admin/portfolio-faqs-add-d.png)
*Add FAQ.*

![FAQ errors](images/admin/portfolio-faqs-add-errors-d.png)
*Add FAQ, validation.*

![FAQ filled](images/admin/portfolio-faqs-add-filled-d.png)
*Add FAQ filled in.*

![FAQ saved](images/admin/portfolio-faqs-saved-d.png)
*FAQ saved appears and the entry joins the list.*

![FAQ delete](images/admin/portfolio-faqs-delete-confirm-d.png)
*Delete this faq? asks Cancel or OK.*

![Edit FAQ](images/admin/portfolio-faqs-edit-d.png)
*Edit FAQ.*

![Testimonials](images/admin/portfolio-testimonials-d.png)
*Testimonials tab.*

![Add Testimonial](images/admin/portfolio-testimonials-add-d.png)
*Add Testimonial.*

![Testimonial errors](images/admin/portfolio-testimonials-add-errors-d.png)
*Add Testimonial, validation.*

![Edit Testimonial](images/admin/portfolio-testimonials-edit-d.png)
*Edit Testimonial.*

![POS Simulator](images/admin/portfolio-simulator-d.png)
*POS Simulator tab.*

![Add Demo Product](images/admin/portfolio-simulator-add-d.png)
*Add Demo Product.*

![Demo product errors](images/admin/portfolio-simulator-add-errors-d.png)
*Add Demo Product, validation.*

![Edit Demo Product](images/admin/portfolio-simulator-edit-d.png)
*Edit Demo Product.*

The fields in each tab:

| Tab | Fields (required unless marked optional) |
|---|---|
| Pricing Plans | Slug, Plan name, Badge (optional), Description, Monthly price, Annual price (per month), Highlight as most popular (switch), Included features (list), Not included (list), Call to action |
| Features | Slug, Category (one of: pos, inventory, multi-branch, loyalty, quotation-orders, hardware), Title, Tagline, Description, Highlights (list), Icon, Badge (optional) |
| Solutions | Slug (a stable id such as retail-apparel), Title, Subtitle, Icon, Badge, Description, Features (list), Benefits (list), Metric label, Metric value, Image key |
| FAQs | Question, Answer, AEO summary (one-sentence answer for answer engines), Category |
| Testimonials | Quote, Author, Role, Company, Rating (1 to 5), Metric badge (optional) |
| POS Simulator | Product name, SKU, Retail price, Wholesale price, Category, Emoji (shown as the tile in the live demo), Tax rate (a fraction: 0.05 means 5%), Serial / batch (optional) |

For the *Icon* fields use the name of a free icon from the lucide icon set (for example *Zap* or *ShoppingBag*). The *Slug* is a short fixed id: lower case, words joined with dashes, never changed once the website uses it.

> **Good to know:** the price columns in the Pricing Plans tab show a dollar sign (`$`) even though PosBuzz is billed in taka. The sign comes from the website's design. If prices on the website should read in another currency, check with the development team.

## Support

**What it is.** The inbox of help requests from shops. Each request is a **ticket** with a conversation. Shops raise tickets from their own Support page; you answer them here.

**Where to find it.** Menu > **Support** (page title **Support Tickets**). Needs the *support* permission.

![Support tickets](images/admin/support-d.png)
*The Support Tickets list.*

![Status filter](images/admin/support-filter-status-options-d.png)
*Status options.*

![Priority filter](images/admin/support-filter-priority-options-d.png)
*Priority options.*

![Consumer filter](images/admin/support-filter-consumer-options-d.png)
*Consumer options.*

![Waiting on Customer](images/admin/support-filter-waiting-d.png)
*Filtered to Waiting on Customer.*

![Urgent](images/admin/support-filter-urgent-d.png)
*Filtered to URGENT.*

![Subject search](images/admin/support-search-d.png)
*Searching the subject for printer.*

![Support on a phone](images/admin/support-list-m.png)
*Support on a phone.*

**What you see.**

- Four cards: **Open tickets**, **Unassigned**, **Urgent** (turns red when above zero) and **All tickets**.
- Filters: **All statuses**, **All priorities**, **All consumers** (only if you also hold *show_consumers*) and **Search by subject**.
- A table (20 per page): **#**, **Subject** (click to open), **Consumer** (name and subdomain), **Category**, **Priority**, **Status**, **Assignee** (or *Unassigned*) and **Last activity**.

**Statuses:** Open, In Progress, Waiting on Customer, Resolved, Closed. **Priorities:** LOW, MEDIUM, HIGH, URGENT. **Categories:** Billing & Subscription, Technical Issue, Feature Request, Account, Other.

### How to answer a ticket

1. Click the ticket's subject. A panel opens.
2. Read the summary (consumer, who raised it, plan, category, when it was opened) and the conversation. Shop messages sit on the left, support replies on the right.
3. Click **Assign to me** to take it. The note beside the button shows who it is assigned to. If it is already yours the button reads **Unassign me**. You see **Ticket updated**.
4. Change **Status** or **Priority** with the drop-downs. Each change is saved at once with **Ticket updated**.
5. Type your answer in the box **Reply to the customer...** (up to 5000 characters). If you leave it empty you see **Write a reply first**.
6. Click **Send reply**. You see **Reply sent**.

![A ticket with a reply](images/admin/support-ticket-d.png)
*An open ticket with the shop's message and a support reply.*

![Waiting ticket](images/admin/support-ticket-waiting-d.png)
*A ticket Waiting on Customer, already assigned.*

![Resolved ticket](images/admin/support-ticket-resolved-d.png)
*A Resolved ticket.*

![Closed ticket](images/admin/support-ticket-closed-d.png)
*A Closed ticket.*

![Open ticket](images/admin/support-ticket-open-d.png)
*An Open, unassigned ticket.*

![Status options](images/admin/support-ticket-status-options-d.png)
*Status drop-down.*

![Priority options](images/admin/support-ticket-priority-options-d.png)
*Priority drop-down.*

![Assigned](images/admin/support-ticket-assigned-d.png)
*After Assign to me the button reads Unassign me.*

![Empty reply](images/admin/support-ticket-reply-empty-d.png)
*Write a reply first.*

![Reply typed](images/admin/support-ticket-reply-typed-d.png)
*A reply typed.*

![Reply sent](images/admin/support-ticket-replied-d.png)
*Reply sent; the ticket moved to Waiting on Customer.*

![Ticket on a phone](images/admin/support-ticket-m.png)
*A ticket on a phone.*

> **Good to know:** a reply moves an open ticket to **Waiting on Customer**. If the ticket is already Resolved or Closed, a reply leaves it as it is. Use the **Status** drop-down for any other change. The text beside the **Send reply** button always tells you what will happen.

## Settings

### Account & Security

**Where to find it.** Menu > Settings > **Account & Security**, or the person icon in the top bar. Needs the *profile* permission.

![Account and Security](images/admin/account_security-d.png)
*The Account and Security page.*

![Password errors](images/admin/account_security-errors-d.png)
*Pressing Change Password with empty boxes.*

![Mismatch](images/admin/account_security-mismatch-d.png)
*A short new password and different confirmation.*

The page (titled **Home** in the breadcrumb) shows your **Name**, **Email** and **Role** and a **Change Password** form.

#### How to change your password

1. Type your current password in **Old Password**.
2. Type the new one in **New Password** (at least 6 characters).
3. Type it again in **Confirm Password**.
4. Click **Change Password**. You see **Password changed successfully!** and the boxes clear.

| Message | What it means |
|---|---|
| Please input your old password! | The old password box is empty. |
| Please input your new password! | The new password box is empty. |
| Password must be at least 6 characters long. | Use a longer password. |
| Please confirm your new password! | The confirm box is empty. |
| The two passwords do not match! | New and Confirm differ. Retype both. |
| An error occurred (or the server's reason) | Most often the old password is wrong. |

### Roles

**What it is.** A role is a named set of Admin Panel permissions. Give each person the role that fits their job.

**Where to find it.** Menu > Settings > **Roles**. Needs the *users* permission.

![Roles](images/admin/roles-d.png)
*The Roles list.*

The table shows **Name**, **Permissions** (one tag each) and **Actions**. The built-in **Admin** role has no edit or delete icons: it cannot be changed.

#### How to add or change a role

1. Click **Add New**, or the pencil on a row.
2. Type the **Name** (required).
3. Pick **Permissions** (required, one or more; you can search the list).
4. Click **Save**. You see **Saved Successfully** or **Updated Successfully**.

![Add Role panel](images/admin/roles-add-d.png)
*The Add Role panel.*

![Role errors](images/admin/roles-add-errors-d.png)
*Saving an empty form.*

![Role permissions](images/admin/roles-add-permissions-d.png)
*The permission list.*

![Role filled](images/admin/roles-add-filled-d.png)
*A filled form.*

![Role saved](images/admin/roles-saved-d.png)
*Saved Successfully.*

![Update Role](images/admin/roles-edit-d.png)
*Editing a role.*

![Role delete](images/admin/roles-delete-confirm-d.png)
*Delete confirmation.*

![Role in use](images/admin/roles-delete-in-use-d.png)
*The red message: Cannot delete a role that still has users assigned.*

To delete, click the bin and confirm **Delete this item?**. A role still given to a user cannot be deleted; the red message says why.

### Users

**What it is.** The people who can sign in to the Admin Panel.

**Where to find it.** Menu > Settings > **Users**. Needs the *users* permission.

![Users](images/admin/users-d.png)
*The Users list.*

![Role filter options](images/admin/users-filter-role-options-d.png)
*Filter by Role.*

![Filtered by role](images/admin/users-filter-role-d.png)
*Only Support Agents.*

![User search](images/admin/users-search-d.png)
*Searching for tania.*

You see a search box (**Search name or email**), a **Filter by Role** drop-down and a table with **Name**, **Email**, **Role** and **Actions**. The main (root) administrator has no edit or delete icons.

#### How to add or change a user

1. Click **Add New**, or the pencil on a row.
2. Fill in the form, then click **Save**.

![Add User panel](images/admin/users-add-d.png)
*The Add User panel.*

![User errors](images/admin/users-add-errors-d.png)
*Saving an empty form.*

![User role options](images/admin/users-add-role-options-d.png)
*The Role list.*

![User filled](images/admin/users-add-filled-d.png)
*A filled form.*

![User saved](images/admin/users-saved-d.png)
*Saved Successfully.*

![Update User](images/admin/users-edit-d.png)
*Editing a user. Password stays empty.*

![User delete](images/admin/users-delete-confirm-d.png)
*Delete confirmation.*

| Field | Required | Notes |
|---|---|---|
| Name | Yes | |
| Role | See note | Choose the role. The form does not insist, but a user without a role cannot do anything useful, so always choose one. |
| Email | Yes | Used to sign in. |
| Password | Yes when adding | When editing, leave it empty to keep the current password. |

To remove a user, click the bin and confirm **Delete this item?**.

### Backup & Restore

**What it is.** Two buttons to take a full copy of the whole PosBuzz database, and to put a copy back.

**Where to find it.** Menu > Settings > **Backup & Restore** (page title **Database Management**). Needs the *backup&restore* permission.

![Database Management](images/admin/backup_restore-d.png)
*The Database Management page.*

![Restore confirmation](images/admin/backup_restore-confirm-d.png)
*After choosing a .sql file this question appears. Cancel leaves everything unchanged.*

![Restore cancelled](images/admin/backup_restore-cancelled-d.png)
*After Cancel nothing happens.*

#### How to download a backup

1. Click **Download Backup**.
2. Wait. A file named `backup_<number>.sql` is saved by your browser and you see **Full database backup completed successfully**.
3. Store it somewhere safe. It contains every shop's data, so treat it like a bank key.

If it fails you see **Database backup failed** (or the server's reason).

#### How to restore a backup

1. Click **Restore Database** and choose a `.sql` backup file. Only `.sql` files are accepted.
2. A question appears: **Restore database?** with the text "This replaces the current database with the selected backup."
3. Click **Restore** (red) to go ahead, or cancel.
4. When it finishes you see **Database restored successfully**. If it fails you see **Database restore failed**.

> **Important:** a restore replaces everything that happened after the backup was taken, for every shop. Do not restore on the live system unless the engineering team has agreed, and take a fresh backup first. The servers also take their own automatic backups; ask the engineering team before relying on this button for disaster recovery.

## Signing out and security tips

- Click the **Logout** icon in the top bar when you leave a shared computer.
- Sessions renew themselves while you work. If you are away for a long time, you may be asked to sign in again.
- Never share your Admin Panel password. Create a separate user for each person.
- Change the password you were given on your first sign-in.
- Keep backup files private and delete copies you no longer need.

## Common situations

| Situation | What to do |
|---|---|
| A shop says "my account is inactive" | Open Consumers and look at **Billing Status**. If it reads Inactive, add or extend a bill in Billing & Subscriptions that covers today. |
| A new shop cannot sign in | Check it has a bill covering today, that its subdomain is spelled correctly, and that it is not in the Deleted list. |
| A shop reaches its product limit | Open the shop's row (Products column shows used / limit). Move it to a plan with a higher limit, or leave Max Products blank on a plan for unlimited. |
| A shop wants a second branch | Raise **Max Branches** on the shop (Edit). |
| A shop cannot see a menu item | Check the plan's permissions (Plans > edit). A feature missing from the plan is hidden from all its staff. |
| A shop was deleted by mistake | Consumers > **Deleted** > **Restore**. |
| The lists look out of date | Click **Clear All Admin Caches** in the top bar. |
| You see **Something went wrong** | Try again. If it keeps happening, tell the engineering team the screen and what you clicked. |
