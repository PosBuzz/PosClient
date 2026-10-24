# Part 1 - Getting started, dashboard and settings

This part explains how to sign in, how to move around the app, and how to use the Dashboard and the screens in Settings. All money in the app is in taka (BDT) and is shown with two decimals. All dates and "today" follow Bangladesh time (Asia/Dhaka).

## Signing in and moving around

### What it is

PosBuzz is opened from your own shop address in a web browser (for example, yourshop.posbuzz.xyz). Every shop has its own address. You sign in there with your email and password.

### How to sign in

1. Open your shop address in the browser. If you are not signed in, the **Login** page opens by itself.
2. Type your email in the **Email** box.
3. Type your password in the **Password** box. Click the eye icon to show or hide the password.
4. Click **Login**, or press Enter.

![Login page](images/consumer/login-empty-d.png)

*The Login page with both boxes empty.*

If you press **Login** with a box empty, a red message shows under that box.

![Login errors](images/consumer/login-errors-d.png)

*Pressing Login with both boxes empty shows two red messages.*

If the email is not in email format, this message shows under the Email box.

![Invalid email](images/consumer/login-invalid-email-d.png)

*An email such as "a@b" is refused with "Please enter a valid email!".*

**What happens next:** The button shows a spinner while the app checks your details. A green message "Login successful" appears. You go to the page you first tried to open, or to the Dashboard if there was none.

| Field | Required | Notes |
| --- | --- | --- |
| Email | Yes | Placeholder "Enter your email". Starts empty. |
| Password | Yes | Placeholder "Enter your password". Starts empty. Has a show/hide eye icon. |

| Message | What it means | What to do |
| --- | --- | --- |
| Please input your email! | The Email box is empty. | Type your email. |
| Please enter a valid email! | The text is not in email format. | Check for typing mistakes. |
| Please input your password! | The Password box is empty. | Type your password. |
| Login successful | You are signed in. | Nothing. |
| Invalid email or password | The email or the password is wrong. The app does not say which one. | Check both and try again. |
| Your subscription is not active. Please renew it or contact support to continue. | Your password was right, but the shop subscription has lapsed. | Renew the subscription or contact support. |
| Invalid credentials for this tenant | This account belongs to a different shop address. | Open the address of your own shop. |
| No valid subdomain found. Please access via tenant subdomain. | The address you opened is not a shop address. | Open your shop address. |
| Too many attempts. Please wait a minute and try again. | You tried to sign in too many times. | Wait one minute, then try again. |
| Can't reach the server. Check your connection and try again. | Your internet is off or weak. | Check your connection and try again. |
| Login failed | Sign-in failed and no reason was given. | Try again. |

> **Good to know:** The messages for a wrong password, a lapsed subscription and too many attempts come from the server and could not be shown in a picture here, because sign-in is limited. You can try to sign in 5 times per minute. Your sign-in renews quietly while you work and stays valid for about 7 days of activity. If it cannot renew, the app sends you back to the Login page. If you are already signed in and open the Login page, you are sent to the Dashboard.

### Subscription Inactive page

**What it is:** A page that tells you the shop subscription has lapsed.

**Where to find it:** It is not in the menu. It opens by itself when your shop address exists but the subscription is not active. No permission is needed.

**What you see:** The heading "Subscription Inactive", the text "Your subscription is currently inactive. Please contact support or renew your subscription to continue using our services.", the small text "If you believe this is an error, please reach out to our support team.", a **Contact Support** button (it opens an email to support@posbuzz.com), a **Retry** button, and two pictures. The pictures load from the internet.

![Subscription Inactive page](images/consumer/subscription-inactive-d.png)

*The Subscription Inactive page, shown for a shop whose paid period has ended.*

#### How to continue after renewing

1. Renew the subscription or contact support.
2. Click **Retry**. The button shows "Checking..." and is disabled while the app checks.

**What happens next:** If the subscription is now active, you go to the Dashboard (if you are signed in) or the Login page. If it is still inactive, the page reloads. If the shop address does not exist, the "Page not found" page opens. If the subscription is active, this page sends you away by itself.

### Page not found

**What it is:** A page shown when the address does not exist, or when the shop address itself is unknown.

**What you see:** The heading "Looks like you've found the doorway to the great nothing", the text "Sorry about that! Please visit our homepage to get where you need to go.", a **Take me there!** button and two pictures.

![Page not found](images/consumer/page-not-found-d.png)

*The Page not found page.*

#### How to get back

1. Click **Take me there!**

**What happens next:** The app reloads and opens the Dashboard (or the Login page if you are signed out).

### The main screen layout

All pages except Login, Page not found, Subscription Inactive and the full-screen POS (Express Sale) share the same layout: a top bar, a menu on the left, and the page in the middle. Every page shows a trail of links at the top (for example Dashboard > Roles), then the page title. Action buttons are at the right.

#### Top bar

![Dashboard with top bar and menu](images/consumer/dashboard-full-d.png)

*The Dashboard on a computer. The menu is on the left and the five icon buttons are at the top right.*

The five icons at the top right, from left to right, are: refresh, light bulb, book, person and logout.

| Item | What it does |
| --- | --- |
| Menu fold/unfold icon (top left) | Closes or opens the left menu. On screens narrower than 768 px the menu starts hidden. When opened, it covers the page. Tap outside it to close it. |
| Company name | Shows the name from your Company Profile. Only shown on screens 768 px wide or more. |
| Refresh icon (tooltip "Clear Application Cache") | Loads all screen data again. A green message "All caches cleared!" shows for 3 seconds. It does not sign you out and does not delete anything. |
| Light-bulb icon | Opens the theme menu: **Dark**, **Light**, **System**. The chosen one is highlighted. System follows your device. The choice is remembered on this device. |
| Book icon (tooltip "User Guide (PDF)") | Opens this manual as a PDF in a new browser tab. You can save it from there. |
| Person icon (tooltip "Account and Security") | Opens the Account & Security page. You need the Profile permission, or you land on the Dashboard. |
| Logout icon (tooltip "Logout") | Signs you out and returns to the Login page. |

![Refresh message](images/consumer/topbar-cache-cleared-d.png)

*After the refresh icon is clicked, "All caches cleared!" shows at the top for 3 seconds. The tooltip "Clear Application Cache" shows under the icon.*

![Theme menu](images/consumer/topbar-theme-menu-d.png)

*The theme menu with Dark, Light and System. The chosen one is highlighted.*

![User Guide tooltip](images/consumer/topbar-tooltip-guide-d.png)

*Hover over the book icon to see "User Guide (PDF)".*

> **Good to know:** The top bar has no branch switcher, no notification bell and no offline message. The app checks for a new version in the background every hour, when you come back to the browser tab, and when the internet returns. It never reloads the page by itself, so a sale is never interrupted. To use a new version, refresh the page yourself (press F5). If a page file is missing after an update, the app reloads once by itself.

#### Left menu

- At the top is a small rounded square with your company icon, your logo, or initials such as "PB". Hover over it to see the company name.
- Menu groups open and close when clicked. The group of the page you are on opens by itself. A collapsed menu shows icons only.
- At the bottom you see "Powered by PosBuzz" ("PB" when the menu is collapsed).
- You only see the items your role allows. A group with no allowed items is hidden.

![Collapsed menu](images/consumer/layout-collapsed-d.png)

*The menu folded to icons only. "PB" shows at the bottom.*

![Menu on a phone](images/consumer/layout-menu-open-m.png)

*On a phone the menu opens over the page. Tap outside it to close it.*

The full menu is:

| Group | Items |
| --- | --- |
| Dashboard | Dashboard |
| Products | Add Product, View Products, Sales Stats, Product Audit, Categories, Brands, Tags, Units, Barcode Printing |
| Inventory | Add Inventory, View Inventory, Add Transfer, Inventory Transfer, Add Adjustment, Inventory Adjustment, Stock Overview, Expiring Items, Low Stock, Vendors, Purchase Payments |
| Sales | New Sale, View Sales, New Quotation, View Quotations, Create Return, View Returns, Disc. & Promo, Due Payments, Online Orders, Delivery Partners, Pending Deliveries, Sales Target, User Sales Stats |
| Operational Costs | (single item) |
| Business Report | (single item) |
| Customers | Customers, Reward Points |
| Settings | Company Profile, Branches, Printer Settings, Rewards, POS Layout, Roles, Users |
| Support | (single item) |

The menu depends on the role. The shop owner (Admin role) sees every group. A Manager sees almost everything, but not Product Audit, Printer Settings, Roles or Users. A Cashier sees a short menu.

![Manager menu](images/consumer/menu-manager-d.png)

*The menu of a user with the Manager role. Under Settings it shows Company Profile, Branches, Rewards and POS Layout.*

![Cashier menu](images/consumer/menu-cashier-d.png)

*The menu of a user with the Cashier role. The Dashboard shows only the three Sales shortcut cards, with no figures.*

#### What happens when you are not allowed

- If you are not signed in, any page sends you to the Login page. A full-screen spinner shows while the app checks your sign-in.
- If you are signed in but your role does not include the permission for a page, you are sent to the Dashboard without any message. A small spinner shows while your profile loads.

### Permissions

A role is a list of permissions. A menu item or page appears when you have any of the permissions listed for it. A role can only receive permissions that are included in the shop's plan.

| Permission name | What it unlocks |
| --- | --- |
| Profile | The Account & Security page (change your password) and the person icon in the top bar. |
| Company Profile | Settings > Company Profile. |
| Users & Roles | Settings > Roles and Settings > Users. This is an admin-level permission. |
| Branches | Settings > Branches. |
| Add Product | Products > Add Product and Barcode Printing. With Edit Product it also unlocks Categories, Brands, Tags and Units. |
| View Product | Products > View Products (list and details). |
| Edit Product | The edit product page. Categories, Brands, Tags and Units. |
| Delete Product | Deleting products and some setup records. |
| Product Audit | Products > Product Audit. |
| Inventory | Inventory > Add Inventory, View Inventory, Stock Overview, Expiring Items, Low Stock and Purchase Payments. Vendors (together with the Vendors permission). The "Inventory" shortcut card on the Dashboard. |
| Inventory Transfer | Inventory > Add Transfer and Inventory Transfer. |
| Inventory Adjustment | Inventory > Add Adjustment and Inventory Adjustment. |
| Vendors | Inventory > Vendors. |
| Sales | Sales > New Sale, View Sales, Create Return, View Returns, Disc. & Promo, Due Payments, Online Orders, Delivery Partners and Pending Deliveries. Settings > Rewards and POS Layout. The full-screen POS (Express Sale). Three shortcut cards on the Dashboard. |
| Quotations | Sales > New Quotation and View Quotations. |
| Customers | Customers > Customers and Reward Points. |
| Receipt & Printer Settings | Settings > Printer Settings. |
| Support | The Support page. |
| Business Insights | The figures and charts on the Dashboard. Products > Sales Stats. Sales > Sales Target and User Sales Stats. Operational Costs. Business Report. |

> **Good to know:** The Settings group in the menu shows for anyone who is allowed at least one of its pages. For example, a Cashier sees Settings with only Rewards and POS Layout. The Admin role always holds every permission that your shop's plan includes. Other roles hold only what was given to them.

## Dashboard

### What it is

The first page you see after signing in. It gives quick links and today's business numbers.

### Where to find it

Menu > **Dashboard** (the first item). Everyone who is signed in can open it. What you see on it depends on your permissions: the shortcut cards need Sales or Inventory, and the figures and charts need Business Insights.

### What you see

![Dashboard](images/consumer/dashboard-full-d.png)

*The Dashboard on a computer, with shortcut cards, today's figures, the breakdown lists, Top 5 Products and the Weekly Sales Trend chart.*

From top to bottom:

- The heading "Welcome to PosBuzz".
- Shortcut cards. Click a card to open that screen.

| Card | Text on the card | Opens | Permission |
| --- | --- | --- | --- |
| Express Sale | Sale with our POS interface | The full-screen POS | Sales |
| Sales Management | View and manage all your sales | View Sales | Sales |
| New Sale | Create a detailed sale transaction | New Sale | Sales |
| Inventory | Manage products and inventory | View Inventory | Inventory |

- With the Business Insights permission, a row of six cards:

| Card | What it shows |
| --- | --- |
| Today's Sale Amount | The total of today's sales that are not cancelled. Below it, "Collected:" is the money actually received. If something is unpaid, a red "Due:" amount also shows. |
| Today's Sale Count | The number of sales today. Caption "Completed invoices". |
| Today's Returns | The total value of returns made today, with the number of returns in brackets. Below it, "Refund:" is the money-back part and "Exchange:" is the exchange part. |
| Today's Net Sale | Today's sales minus refunds. Caption "Gross Sale - Refunds". Exchanges are not taken off. |
| Low Stock | A number followed by "Items", with a warning icon and the caption "Critical threshold". Click it to open Low Stock. It counts items whose available stock (stock minus reserved stock) is at or below the alert quantity set for that item. Items with an alert quantity of 0 are never counted. |
| Expiring Soon | A number followed by "Items", with a clock icon and the caption "Expiring in 30 days". Click it to open Expiring Items. It counts stock batches that still have quantity and expire between today and 30 days ahead. |

- Four cards in two rows. Each shows a small spinner while loading.

| Card | What it shows | Empty text |
| --- | --- | --- |
| Payment Breakdown | A numbered list of payment methods with the amount received in the chosen period, as coloured tags. Has a **Daily / Weekly / Monthly** dropdown (starts on Daily). | No payment method data |
| Return Payment Breakdown | Money paid out on returns, by payment method. Has a **Daily / Weekly / Monthly** dropdown (starts on Daily). | No return payment data |
| Top 5 Products | Up to five best sellers by quantity. The product name is shown with the variant name below it, and a tag such as "N sold". Has a **Daily / Weekly / Monthly** dropdown (starts on Daily). | No product data |
| Weekly Sales Trend | A line chart of this week with one point for each day that had sales or returns. | No trend data |

The Weekly Sales Trend lines are: **Amount** (blue, total sales), **Net** (green dashed, sales minus refunds), **Returns** (red) and **Sales** (cyan, the number of sales). Hover over the chart to see the values. Money values start with "BDT".

Payment method names you may see: Cash, Card, MFS (bKash/Nagad/Rocket), Reward Points / Credit, Product Exchange, Collected by Delivery Partner, Cheque, Bank Transfer and Mobile Money. A method not in this list is shown by its code written in plain words.

If loading fails, a red message appears above the cards with the error text, or "Failed to load dashboard data".

![Chart tooltip](images/consumer/dashboard-chart-hover-d.png)

*Hover over a point on the Weekly Sales Trend to see the day and the Amount, Net, Returns and Sales values. Here the Payment Breakdown is set to Weekly and Top 5 Products to Monthly.*

On a phone the cards stack one under the other.

![Dashboard on a phone](images/consumer/dashboard-m.png)

*The Dashboard on a phone. The menu is hidden and the shortcut cards stack down the page.*

### How to open a screen from a shortcut card

1. Open the Dashboard.
2. Click the card you want (for example **New Sale**).

**What happens next:** The screen opens. If your role has no access to it, you are sent back to the Dashboard.

![Period dropdown](images/consumer/dashboard-period-dropdown-d.png)

*The Daily / Weekly / Monthly dropdown, opened.*

### How to change the period of a card

1. Find the card (Payment Breakdown, Return Payment Breakdown or Top 5 Products).
2. Click the dropdown at its top right.
3. Choose **Daily**, **Weekly** or **Monthly**.

**What happens next:** A small spinner shows in that card only and the figures are calculated again. The page does not jump.

### How the figures are counted

- A day is today in Bangladesh time, from midnight to 23:59.
- A week runs from Saturday to Friday. A month is the calendar month, from the 1st to the last day.
- Cancelled and deleted sales are left out.
- A return is counted on the day it was made, not on the day of the original sale.
- Payment Breakdown counts payments received in the period (by payment date). The "Today" cards count sales dated today.
- The figures cover all branches together.
- The data is refreshed each time you open the page and when you press the refresh icon in the top bar.
- Without Business Insights, you see only the welcome heading and the shortcut cards.

> **Good to know:** A user with only Sales permission, such as a Cashier, sees the welcome heading and only the three Sales shortcut cards. A user without the Inventory permission does not see the Inventory card.

> **Good to know:** Money amounts on the cards are written with the taka sign, and the chart tooltip writes "BDT". If you have little data, the Weekly Sales Trend may show just one point, and its left-hand scale numbers may not look in order. Read the values from the tooltip instead.

> **Good to know:** The Low Stock number is counted for each branch and item together. When all branches are shown, the number can be higher than the number of different products that are low.

## Account & Security

### What it is

A page where you see your own sign-in details and change your own password.

### Where to find it

Click the person icon in the top bar (tooltip "Account and Security"). It is not in the left menu. You need the Profile permission.

### What you see

![Account and Security](images/consumer/account-security-d.png)

*The Account & Security page with your details and the Change Password form.*

- The trail "Dashboard > Account & Security".
- A card **User Information** with your Name, Email and Role. You cannot change these here.
- A card **Change Password** with three fields and a **Change Password** button. Each field has a show/hide eye icon and starts empty.

| Field | Required | Notes |
| --- | --- | --- |
| Old Password | Yes | Your current password. |
| New Password | Yes | At least 6 characters. |
| Confirm Password | Yes | Must be the same as New Password. It is checked again when you change New Password. |

### How to change your password

1. Click the person icon in the top bar.
2. Type your current password in **Old Password**.
3. Type the new password in **New Password**.
4. Type the same new password in **Confirm Password**.
5. Click **Change Password**.

![Password errors](images/consumer/account-security-errors-d.png)

*A New Password with fewer than 6 characters, and a Confirm Password that is different, show red messages.*

![Required messages](images/consumer/account-security-required-d.png)

*Pressing Change Password with empty boxes shows the "Please input..." messages.*

![Wrong old password](images/consumer/account-security-wrong-old-d.png)

*A wrong Old Password gives the message "Old password is incorrect".*

**What happens next:** A message "Password changed successfully!" appears and the three boxes are cleared. You stay signed in. No email is sent.

| Message | What it means | What to do |
| --- | --- | --- |
| Please input your old password! | Old Password is empty. | Type your current password. |
| Please input your new password! | New Password is empty. | Type a new password. |
| Password must be at least 6 characters long. | The new password is too short. | Use 6 or more characters. |
| Please confirm your new password! | Confirm Password is empty. | Type the new password again. |
| The two passwords do not match! | Confirm Password is different from New Password. | Type both again, exactly the same. |
| Password changed successfully! | The password is changed. | Nothing. |
| Old password is incorrect | The Old Password you typed is wrong. | Type your current password again. |
| An error occurred | The change failed and no reason was given. | Try again. If it keeps happening, contact support. |

> **Good to know:** You can only change your own password here. To set a new password for another person, an admin edits that person in Settings > Users.

## Company Profile

### What it is

A page to change your shop's contact details and to upload the logo and app icon used in the app, on receipts and in PDFs.

### Where to find it

Menu > **Settings** > **Company Profile**. The page needs the Company Profile permission. The Settings group in the menu is only visible with the Users & Roles permission.

### What you see

![Company Profile](images/consumer/profile-top-d.png)

*The Profile page with the company details and the start of the logo section.*

![Logo and app icon with Preview](images/consumer/profile-uploads-preview-d.png)

*The Company Logo and App Icon boxes with images chosen, and the three Preview tiles below them.*

- The trail "Dashboard > Profile" and the title "Profile".
- A card **Company / Contact Info** with the fields below. The business sign-in email cannot be changed here.
- A divider **Logo & app icon** with the text: "Upload your full logo once. PosBuzz trims empty margins and makes the right size for receipts, PDFs and the app. Add a square app icon too if your logo is wide or has small text."
- Upload boxes for **Company Logo** and **App Icon (optional)**, a **Preview** area and an **Update Profile** button.

| Field | Required | Notes |
| --- | --- | --- |
| Company Name | No | Text. Filled in with the current name. |
| Secondary Email | No | If you fill it in, it must be a valid email. |
| Phone | No | Text. The format is not checked. |
| Address | No | A multi-line box (3 rows). |
| Company Logo | No | One image. Used on receipts, invoices, quotations and PDFs. |
| App Icon (optional) | No | One image. Used in the sidebar and POS header. |

Help text next to the **Company Logo** box:

- Used on receipts, invoices, quotations and PDFs.
- PNG with a transparent or white background (JPG works too).
- At least 600 px wide; a wide (landscape) logo prints best.
- Dark on light: thermal receipts print in black only.

Help text next to the **App Icon (optional)** box:

- Used in the sidebar and POS header, shown about 40 px square.
- Square PNG, at least 256 × 256 px.
- Just the symbol or initials, no small text.
- Leave empty to use your logo.

Each box holds one image. While a file uploads, the box says "Uploading...". To remove an uploaded image, click the delete icon on its thumbnail.

**Preview** shows three tiles. They update at once when you pick an image or type the company name.

| Tile | What it shows |
| --- | --- |
| App sidebar & POS | Two square samples (36 and 42 px). A note says "Uses your app icon" or "Uses your logo (no app icon yet)". If there is no image, the initials of the company name show. |
| Receipts & PDFs | A sample receipt with your logo, your company name (or "Your shop") and "Receipt #1001". |
| Thermal printer (black only) | The same sample receipt in black and white. |

### How to update the company details

1. Open **Settings** > **Company Profile**.
2. Change **Company Name**, **Secondary Email**, **Phone** or **Address**.
3. Check the **Preview** tiles.
4. Click **Update Profile**.

**What happens next:** A message "Profile updated successfully!" appears. The page reloads so the new details show everywhere.

### How to upload a logo or app icon

1. Open **Settings** > **Company Profile**.
2. In the **Company Logo** box (or the **App Icon (optional)** box), click and choose a JPG or PNG file under 10 MB.
3. Wait until "Uploading..." goes away and the thumbnail shows.
4. Look at the **Preview** tiles to see how it will look.
5. Click **Update Profile**.

**What happens next:** The image is trimmed and resized for each use: square for the sidebar, and up to 600 px wide for receipts. If the App Icon is empty, your logo is used in the sidebar. If there is neither, the sidebar shows initials (the first letters of up to two words of the company name, or "PB").

![Logo too small](images/consumer/profile-logo-warning-d.png)

*An orange warning appears at the top when the logo is narrower than 300 px. The upload still goes ahead.*

![Icon not square](images/consumer/profile-icon-warning-d.png)

*An orange warning appears when the icon is not square.*

![Email error](images/consumer/profile-email-error-d.png)

*A Secondary Email that is not valid shows "Please enter a valid email". An empty upload box shows an Upload button.*

> **Good to know:** When you choose an image, the Preview tiles update at once, but nothing is saved until you click **Update Profile**. If there is no image at all, the Preview shows the initials of your company name.

### How to remove a logo or app icon

1. Open **Settings** > **Company Profile**.
2. Click the delete icon on the thumbnail.
3. Click **Update Profile**.

**What happens next:** The saved image is removed.

| Message | What it means | What to do |
| --- | --- | --- |
| Please enter a valid email | The Secondary Email is not in email format. | Correct the email. |
| You can only upload JPG/PNG file! | The file is not a JPG or PNG. | Choose a JPG or PNG file. |
| Image must be smaller than 10MB! | The file is too big. | Choose a smaller file. |
| (file name) upload failed. | The upload did not work. | Try again. |
| This logo is only N px wide, so it may print blurry. Use one at least 600 px wide. | The logo is narrower than 300 px. This is an orange warning for 8 seconds. The upload still goes ahead. | Use a wider logo if you want it sharp. |
| This icon is W×H px, not square, so it will look small in square spots. Use a square image. | The icon is clearly not square. Orange warning. The upload still goes ahead. | Use a square image. |
| This icon is only W×H px and may look blurry. Use at least 256×256 px. | The icon is smaller than 128 px. Orange warning. The upload still goes ahead. | Use a larger icon. |
| Profile updated successfully! | The changes are saved. | Nothing. |
| An error occurred | Saving failed and no reason was given. The app may show the server's own message instead. | Try again. |

## Branches

### What it is

A page to manage your shop locations (outlets).

### Where to find it

Menu > **Settings** > **Branches**. You need the Branches permission. The Settings group in the menu is only visible with the Users & Roles permission.

### What you see

![Branches](images/consumer/branches-list-d.png)

*The Branches list. The main branch has a gold tag and no bin icon. A missing email or VAT number shows in grey.*

- The trail "Dashboard > Branches", the title and the **Add New Branch** button.
- A table with these columns:

| Column | What it shows |
| --- | --- |
| Name | The branch name. The main branch has a gold "Main Branch" tag. |
| Phone | The phone with a phone icon, or grey "No phone". |
| Email | The email with a mail icon, or grey "No email". |
| Address | The address, or grey "No address". |
| VAT Registration Number | The number, or grey "No VAT Registration Number". |
| Created Date | The date the branch was made, in your browser's date format. |
| Actions | A pencil icon (edit) and a red bin icon (delete). The main branch has no bin icon. |

- The main branch is listed first.
- Below the table: "x-y of N branches", page buttons, a jump-to-page box and a page-size chooser.
- If loading fails: "Failed to load branches".

### Form fields (drawer "Add Branch" or "Update Branch")

| Field | Required | Notes |
| --- | --- | --- |
| Branch Name | Yes | Placeholder "Enter branch name". Must be different from every other branch name in the shop. |
| VAT Registration Number | Yes | Placeholder "Enter VAT registration number". Printed on that branch's receipts. |
| Phone | No | Only digits, spaces and the signs - + ( ) are allowed. |
| Email | No | Must be a valid email. |
| Address | No | A multi-line box. Placeholder "Enter branch address (optional)". |
| Main Branch | No | A switch. Help text: "Only one branch can be marked as main branch". |

The button at the bottom is **Create Branch** when adding, and **Update Branch** when editing.

![Add Branch](images/consumer/branches-add-empty-d.png)

*The Add Branch drawer.*

![Branch errors](images/consumer/branches-add-errors-d.png)

*Pressing Create Branch with the two required boxes empty.*

![Branch format errors](images/consumer/branches-add-format-errors-d.png)

*A phone with letters and an email that is not valid.*

### How to add a branch

1. Open **Settings** > **Branches**.
2. Click **Add New Branch**.
3. Fill in **Branch Name** and **VAT Registration Number**. Add the other fields if you wish.
4. Switch on **Main Branch** only if this should become the main branch.
5. Click **Create Branch**.

![Branch created](images/consumer/branches-created-toast-d.png)

*"Branch created successfully" shows and the new branch is in the list.*

**What happens next:** A message "Branch created successfully" appears and the new branch shows in the list. New branches are given automatically to admin users.

### How to edit a branch

1. Click the pencil icon on the branch row.
2. Change the fields in the **Update Branch** drawer.
3. Click **Update Branch**.

![Update Branch](images/consumer/branches-edit-d.png)

*The Update Branch drawer.*

![Main Branch switch on](images/consumer/branches-edit-main-on-d.png)

*The Main Branch switch turned on.*

**What happens next:** A message "Branch updated successfully" appears. If you switch a branch to Main, the old main branch stops being main.

![Main branch switched](images/consumer/branches-main-switched-d.png)

*After saving, the chosen branch is listed first with the Main Branch tag, and the old main branch has a bin icon again.*

### How to delete a branch

1. Click the red bin icon on the branch row.
2. Read the question "Delete this branch?" and the note "This action cannot be undone. All inventory in this branch will be moved to warehouse."
3. Click **Yes** to delete, or **No** to cancel.

![Delete branch](images/consumer/branches-delete-confirm-d.png)

*The question "Delete this branch?" with No and Yes.*

**What happens next:** A message "Branch deleted successfully" appears and the row is removed.

| Message | What it means | What to do |
| --- | --- | --- |
| Branch name is required | Branch Name is empty. | Type a name. |
| VAT registration number is required | The VAT number is empty. | Type the number. |
| Please enter a valid phone number | Phone has a character that is not allowed. | Use digits, spaces and - + ( ) only. |
| Please enter a valid email address | The email is not in email format. | Correct it. |
| Branch created successfully | The branch was added. | Nothing. |
| Branch updated successfully | The branch was changed. | Nothing. |
| Branch deleted successfully | The branch was deleted. | Nothing. |
| Branch limit reached. This account can create up to N branch(es). | Your plan allows only N branches. | Delete a branch you do not need, or contact support about your plan. |
| Cannot delete the main branch | The main branch cannot be deleted. | Make another branch the main branch first, then delete this one. |
| Cannot delete the last remaining branch | You must keep at least one branch. | Nothing. |
| This branch is still used by other records, so it can't be changed or deleted. Remove or reassign those first. | The branch already has sales or returns. | Keep the branch. |
| Failed to create branch / Failed to update branch / Failed to delete branch | The action failed and no reason was given. | Try again. |
| Failed to load branches | The list could not load. | Press the refresh icon in the top bar or reload the page. |

> **Good to know:** The Branch Name box in the drawer cuts the label "VAT Registration Number" short. The box is still the VAT number box. When a branch has no phone, email or address, grey words "No phone", "No email" and "No address" show instead.

> **Good to know:** The first branch you create is always the main branch. The delete note says stock moves to the warehouse. This has not been checked, so look at your stock after deleting a branch.

## Roles

### What it is

A page to create job roles (for example Cashier or Manager) and choose which screens each role can use.

### Where to find it

Menu > **Settings** > **Roles**. You need the Users & Roles permission.

### What you see

![Roles](images/consumer/roles-list-d.png)

*The Roles list. Each permission is a blue tag. The Admin role has no edit or delete icons.*

- The trail "Dashboard > Roles", the title and the **Add New** button.
- A table with three columns: **Name**, **Permissions** (one blue tag per permission) and **Actions** (a pencil icon to edit and a red bin icon to delete).
- The tags show the short internal names (for example sales, view_product, business_insights) and not the friendly names used in the Permissions table in this manual.
- The role named "admin" (in any capital letters) has no actions. It cannot be edited or deleted.
- The list shows 10 roles per page. If loading fails: "Failed to load data".

### Form fields (drawer "Add Role" or "Update Role")

| Field | Required | Notes |
| --- | --- | --- |
| Name | Yes | Must be different from other role names in your shop. |
| Permissions | Yes | A multi-select box with search. Each choice shows its friendly title and a one-line explanation. You can search by title, internal name or explanation. Only permissions in your shop's plan are listed. A clear-all x clears the choices. |
| Permission Guide | (read only) | A collapsible list with one item per available permission, showing the title, the internal name, an explanation and blue tags of what it gives. The first two items start open. Before it loads it says "Permission guide will appear after permissions load." |

The button at the bottom is **Save**.

![Add Role](images/consumer/roles-add-empty-d.png)

*The Add Role drawer. The Permission Guide is below the two boxes.*

![Role errors](images/consumer/roles-add-errors-d.png)

*"This field is required" shows under both boxes.*

![Permission picker](images/consumer/roles-permission-picker-d.png)

*Click Permissions to see the list. Each choice has its name and a one-line explanation. You can also type to search.*

![Role filled](images/consumer/roles-add-filled-d.png)

*Three permissions chosen. The Permission Guide opens the first two items.*

![Permission Guide](images/consumer/roles-permission-guide-d.png)

*The lower part of the drawer, with the rest of the Permission Guide and the Save button.*

What each permission means in the guide:

| Permission | Guide text |
| --- | --- |
| Profile | Lets users access their own profile and password/security actions. |
| Company Profile | Lets users view and update company/business profile information. |
| Users & Roles | Lets users manage staff accounts and roles. This is an admin-level permission. |
| Branches | Lets users manage branches and branch-related setup. |
| Add Product | Lets users create products and supporting product setup records. |
| View Product | Lets users view product catalog, product details, and product sales stats. |
| Edit Product | Lets users update product records and product setup data. |
| Delete Product | Lets users delete products and deletable product setup records. |
| Product Audit | Lets users review product audit/history records. |
| Inventory | Lets users manage stock batches, stock reports, vendors from inventory, and purchase payments. |
| Inventory Transfer | Lets users move inventory between branches or locations. |
| Inventory Adjustment | Lets users adjust stock counts for correction, loss, or reconciliation. |
| Vendors | Lets users create and manage vendor/supplier records. |
| Sales | Lets users run the POS sales workflow and related sales operations. |
| Quotations | Lets users create, view, update, and convert quotations. |
| Customers | Lets users manage customers, reward points, and customer reward data. |
| Receipt & Printer Settings | Lets users configure receipt templates and printer/PDF receipt settings. |
| Support | Lets users raise support tickets with PosBuzz and follow the conversation. |
| Business Insights | Shows the generic text "Controls access to this permission's related pages and actions." |

### How to add a role

1. Open **Settings** > **Roles**.
2. Click **Add New**.
3. Type the role name in **Name**.
4. Click **Permissions** and choose each permission the role needs. You can type to search.
5. Check the **Permission Guide** if you are not sure what a permission does.
6. Click **Save**.

![Role saved](images/consumer/roles-saved-toast-d.png)

*"Saved Successfully" shows and the new role is in the list.*

**What happens next:** A message "Saved Successfully" appears, the drawer closes and the list refreshes.

### How to edit a role

1. Click the pencil icon on the role row. The **Update Role** drawer opens with the current values.
2. Change the **Name** or the **Permissions**.
3. Click **Save**.

![Update Role](images/consumer/roles-edit-d.png)

*The Update Role drawer, filled with the current name and permissions (shown here for Cashier).*

**What happens next:** A message "Updated Successfully" appears. The permissions you pick replace the old ones. People with this role get the new access the next time their profile loads. To be sure, ask them to log out and log in again.

### How to delete a role

1. Click the red bin icon on the role row.
2. Read "Delete this item?" and "This action cannot be undone".
3. Click **Yes** to delete, or **No** to cancel.

![Delete role](images/consumer/roles-delete-confirm-d.png)

*The question "Delete this item?" with No and Yes.*

**What happens next:** A message "Deleted Successfully" appears and the row is removed.

> **Good to know:** When we deleted a role that still had a person attached, the app said "Deleted Successfully" and that person no longer appeared in the Users list. The role's old message about records "still used" did not show. To be safe, move people to another role before you delete a role.

| Message | What it means | What to do |
| --- | --- | --- |
| This field is required | Name or Permissions is empty. | Fill it in. |
| Saved Successfully | The role was added. | Nothing. |
| Updated Successfully | The role was changed. | Nothing. |
| Deleted Successfully | The role was deleted. | Nothing. |
| A role with this name already exists. | Another role has the same name. | Choose a different name. |
| One or more permissions are not included in your plan | You chose a permission your plan does not have. | Remove it, or contact support about your plan. |
| This role is still used by other records, so it can't be changed or deleted. Remove or reassign those first. | The role is tied to other records. We did not see this message when a role had a person attached (see the note above). | If you see it, move those people to another role in Settings > Users first. |
| Something went wrong | The action failed and no reason was given. | Try again. |
| Failed to load data | The list could not load. | Reload the page. |

> **Good to know:** A role cannot give anything outside your shop's plan.

## Users

### What it is

A page to create staff logins, give each person a role, and choose which branches they can work in.

### Where to find it

Menu > **Settings** > **Users**. You need the Users & Roles permission.

### What you see

![Users](images/consumer/users-list-d.png)

*The Users list with the search box, the two filters and the Branch Access column. The owner's account has no edit or delete icons.*

- The trail "Dashboard > Users", the title and the **Add New** button.
- A search box (placeholder "Search name or email", with a magnifier icon and a clear button). The list updates about half a second after you stop typing.
- A dropdown **Filter by Role**.
- A dropdown **Filter by Branch**. Branch names carry the suffix "(Main)" or "(Warehouse)" where it applies.
- A table:

| Column | What it shows |
| --- | --- |
| Name | The person's name. |
| Email | The sign-in email. |
| Role | The role as a blue tag. |
| Branch Access | A green "All branches" tag, a red "No access" tag, or one blue tag for each branch. |
| Actions | A pencil icon (edit) and a red bin icon (delete). The shop owner's own account (the one with the company email) has no actions. |

- The list shows 10 users per page. If loading fails: "Failed to load data".

### Form fields (drawer "Add User" or "Update User")

| Field | Required | Notes |
| --- | --- | --- |
| Name | Yes | The person's name. |
| Role | Yes | A dropdown of your roles, with a clear button. A role must be chosen when you add a user. Changing the role clears the branches you picked. |
| Email | Yes | Used to sign in. Must be different from every other user in the shop. |
| Password | Yes when adding. No when editing | When editing, leave it empty to keep the current password. No minimum length is checked here. |
| Branch Access | See notes | Placeholder "Select branches". Shown only when the chosen role's name does not contain the word "admin". Above it is the text "Select branches this user can access:" and a link-button **Select All** (it turns into **Deselect All**). |

The button at the bottom is **Save**.

![Add User](images/consumer/users-add-empty-d.png)

*The Add User drawer.*

![User errors](images/consumer/users-add-errors-d.png)

*Pressing Save with the boxes empty. Name, Email and Password show "This field is required".*

![Role dropdown](images/consumer/users-role-dropdown-d.png)

*The Role dropdown lists the roles of your shop.*

![Branch dropdown](images/consumer/users-branch-dropdown-d.png)

*The Branch Access dropdown lists your branches.*

![Branch picker filled](images/consumer/users-add-filled-d.png)

*A filled form after Select All. The link now reads Deselect All.*

### How to add a user

1. Open **Settings** > **Users**.
2. Click **Add New**.
3. Type the **Name**.
4. Choose a **Role**.
5. Type the **Email**.
6. Type a **Password**.
7. If the branch picker shows, click **Branch Access** and choose the branches, or click **Select All**.
8. Click **Save**.

![User saved](images/consumer/users-saved-toast-d.png)

*"Saved Successfully" shows and the new person is in the list.*

**What happens next:** A message "Saved Successfully" appears. The new person can sign in at the shop address with this email and password.

### How to edit a user

1. Click the pencil icon on the user row.
2. Change the fields you need.
3. Click **Save**.

![Update User](images/consumer/users-edit-d.png)

*The Update User drawer. Password is empty. Leave it empty to keep the current password.*

**What happens next:** A message "Updated Successfully" appears. If you typed a new password, that person's password is reset to it.

### How to delete a user

1. Click the red bin icon on the user row.
2. Read "Delete this item?" and "This action cannot be undone".
3. Click **Yes** to delete, or **No** to cancel.

![Delete user](images/consumer/users-delete-confirm-d.png)

*The question "Delete this item?" with No and Yes.*

**What happens next:** A message "Deleted Successfully" appears. The person's login is removed. Their past sales stay, but are no longer linked to their name.

### How to search and filter users

1. Type a name or email in **Search name or email**, or
2. Pick a role in **Filter by Role**, or
3. Pick a branch in **Filter by Branch**.

![User search](images/consumer/users-search-d.png)

*Searching for "rubel".*

![Role filter](images/consumer/users-filter-role-applied-d.png)

*The table filtered to the Cashier role.*

![Branch filter](images/consumer/users-filter-branch-d.png)

*The Filter by Branch dropdown. The main branch has "(Main)" after its name.*

**What happens next:** The table updates. Use the clear button on a box to remove that filter.

| Message | What it means | What to do |
| --- | --- | --- |
| This field is required | Name, Email or (when adding) Password is empty. | Fill it in. |
| Saved Successfully | The user was added. | Nothing. |
| Updated Successfully | The user was changed. | Nothing. |
| Deleted Successfully | The user was deleted. | Nothing. |
| A user with this email address already exists. | The email is already used in your shop. | Use a different email. |
| Role not found | The chosen role no longer exists. | Choose another role. |
| Branch not found | A chosen branch no longer exists. | Choose the branches again. |
| Something went wrong | The action failed and no reason was given. | Try again. |
| Failed to load data | The list could not load. | Reload the page. |

> **Good to know:** A role whose name contains "admin" gives access to all branches automatically, including branches added later, so the branch picker is hidden. For any other role, a person with no branch ticked shows "No access" and cannot work in any branch.

## Support

### What it is

A page to send help requests (tickets) to PosBuzz support and follow the conversation.

### Where to find it

Menu > **Support** (the last item). You need the Support permission.

### What you see

![Support](images/consumer/support-list-d.png)

*The Support page with the filters and a list of tickets.*

![Status filter](images/consumer/support-status-dropdown-d.png)

*The status dropdown with its choices.*

- The trail "Home > Support", the title and the **New ticket** button.
- A filter card with a status dropdown (placeholder "All statuses", with a clear button) and a search box (placeholder "Search by subject", with a clear button and a magnifier button).
- Status choices: **Open**, **In Progress**, **Waiting on You**, **Resolved**, **Closed**.
- Search runs when you press Enter or click the magnifier. It matches part of the subject and ignores capital letters.
- A table of your shop's tickets only. The newest activity is first, with 20 per page.

| Column | What it shows |
| --- | --- |
| # | The ticket number. |
| Subject | A blue link. Click it to open the ticket. |
| Category | Billing & Subscription, Technical Issue, Feature Request, Account or Other. |
| Priority | A coloured tag: LOW, MEDIUM, HIGH or URGENT. |
| Status | A coloured tag: Open (blue), In Progress (gold), Waiting on You (orange), Resolved (green), Closed (grey). |
| Replies | The number of messages. |
| Last activity | The date and time, for example 24 Oct 2026, 03:15 PM. |

### Form fields (drawer "Raise a support ticket")

| Field | Required | Notes |
| --- | --- | --- |
| Subject | Yes | Up to 150 characters. Placeholder "Short summary of the issue". |
| Category | Yes | Starts on Technical Issue. Choices: Billing & Subscription, Technical Issue, Feature Request, Account, Other. |
| Priority | No | Starts on Medium. Choices: Low, Medium, High, Urgent. |
| Describe the problem | Yes | A multi-line box (6 rows), up to 5000 characters, with a character counter. |

The button at the bottom is **Submit ticket**. It is full width.

![Raise a support ticket](images/consumer/support-new-ticket-empty-d.png)

*The Raise a support ticket drawer.*

![Ticket errors](images/consumer/support-new-ticket-errors-d.png)

*Pressing Submit ticket with the required boxes empty. The messages read "Please enter Subject" and "Please enter Describe the problem".*

![Category dropdown](images/consumer/support-category-dropdown-d.png)

*The Category dropdown.*

![Ticket filled](images/consumer/support-new-ticket-filled-d.png)

*A filled form. The counter under the box shows how many of the 5000 characters are used.*

### How to raise a ticket

1. Open **Support**.
2. Click **New ticket**.
3. Type the **Subject**.
4. Check the **Category** and choose another if needed.
5. Choose a **Priority** if you want to change it.
6. Describe the problem in **Describe the problem**.
7. Click **Submit ticket**.

**What happens next:** A message "Support ticket created" appears and the drawer closes. The new ticket's conversation opens by itself.

![Ticket created](images/consumer/support-ticket-created-d.png)

*"Support ticket created" shows while the conversation opens.*

![Ticket conversation](images/consumer/support-ticket-conversation-d.png)

*The ticket drawer: status and priority tags, your first message, the reply box and the Close ticket button.*

### How to read a ticket and reply

1. Click the blue subject of a ticket. The ticket drawer opens, with the title "#(number) · (subject)".
2. Read the messages from top to bottom. Replies from support are on the left, headed "(name) (PosBuzz Support)". Your shop's messages are indented and headed with the staff name. Each shows a date, a time and the text. If there are none, it says "No messages".
3. Under the title you see the status tag, the priority tag, "Opened (date) by (name)", and "Handled by (name)" once support has given it to someone.
4. Type in the box that says "Write a reply…" (up to 5000 characters).
5. Click **Send reply**. The reply text is required.

![Reply sent](images/consumer/support-reply-sent-d.png)

*Your reply is added to the conversation.*

![Reply from support](images/consumer/support-ticket-agent-reply-d.png)

*A ticket with a reply from PosBuzz support, headed "(name) (PosBuzz Support)". "Handled by" shows under the tags.*

**What happens next:** The box clears and your message shows in the conversation. Your reply puts the ticket back to Open (or keeps it In Progress) and removes the closed state. Any user of the shop can reply to a ticket, even one they did not create.

### How to close a ticket

1. Open the ticket.
2. Click the red **Close ticket** button at the top right.
3. When asked "Close this ticket?", click **OK** (or **Cancel** to stop).

![Close ticket](images/consumer/support-close-confirm-d.png)

*The question "Close this ticket?" with Cancel and OK.*

![Ticket closed](images/consumer/support-ticket-closed-d.png)

*The status shows Closed and the button becomes Reopen.*

**What happens next:** A message "Ticket closed" appears. Any user with the Support permission can close a ticket.

### How to reopen a ticket

1. Open a ticket whose status is Resolved or Closed.
2. Click **Reopen** at the top right.

![Ticket reopened](images/consumer/support-ticket-reopened-d.png)

*"Ticket reopened" shows and the status is Open again.*

**What happens next:** A message "Ticket reopened" appears and the status becomes Open.

### How to find a ticket

1. To filter, click the status dropdown and choose a status. Click the clear button to see all again.
2. To search, type part of the subject and press Enter or click the magnifier.

![Ticket search](images/consumer/support-search-d.png)

*Searching for "printer".*

**What happens next:** The table shows only the matching tickets.

| Message | What it means | What to do |
| --- | --- | --- |
| Support ticket created | The ticket was sent. | Nothing. |
| Could not create the ticket | The ticket could not be sent. The app may show the server's own message instead. | Try again. |
| Could not send the reply | The reply could not be sent. The app may show the server's own message instead. | Try again. |
| Ticket closed | The ticket is closed. | Nothing. |
| Ticket reopened | The ticket is open again. | Nothing. |
| Please enter Subject | The Subject box is empty. | Type a subject. |
| Please enter Describe the problem | The description box is empty. | Describe the problem. |

> **Good to know:** Tickets cannot be deleted. Only PosBuzz support can set a ticket to In Progress, Waiting on You or Resolved. This screen does not send email notifications, so open the page again to see new replies.
