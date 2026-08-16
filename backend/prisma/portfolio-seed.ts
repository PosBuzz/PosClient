import { PrismaClient } from '@prisma/client';

/**
 * Initial content for the marketing site CMS — mirrors what used to be
 * hardcoded in portfolio/src/lib/constants.ts. Every write is an upsert with an
 * empty `update`, so re-running the seed never overwrites edits made by an
 * admin in the dashboard.
 */
export async function seedPortfolio(prisma: PrismaClient) {
  await prisma.portfolioSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      site_name: 'PosBuzz',
      title:
        'PosBuzz - Cloud POS, Multi-Branch Inventory & Store Management Platform',
      description:
        'High-speed Cloud Point of Sale (POS), real-time multi-branch inventory, batch & serial tracking, customer rewards, quotation conversion, and local thermal printer agent designed for retail, apparel, and multi-outlet stores.',
      url: 'https://posbuzz.io',
      og_image: 'https://posbuzz.io/og-image.png',
      author: 'PosBuzz Technologies',
      contact_email: 'info@posbuzz.com',
      sales_email: 'info@posbuzz.com',
      phone: '+880-1829-898981',
      address: 'Dhaka, Bangladesh',
      keywords: [
        'PosBuzz',
        'cloud POS system',
        'multi branch POS',
        'retail inventory management',
        'batch expiry tracking POS',
        'product serial number tracking',
        'MFS bKash Nagad POS integration',
        'customer loyalty points POS',
        'quotation to sale conversion',
        'inter branch stock transfer',
        'thermal receipt printer agent',
        'barcode printing POS',
      ],
    },
  });

  const solutions = [
    {
      slug: 'retail-apparel',
      title: 'Apparel, Footwear & Boutiques',
      subtitle:
        'Variant Attribute Matrix (Size/Color), Thermal Barcodes & Exchanges',
      icon_name: 'ShoppingBag',
      badge: 'Variant Matrix',
      description:
        'Manage complex multi-attribute matrices (Size, Color, Brand, Material, Season). Generate thermal barcode stickers, track product movement across outlets, and handle multi-item returns with instant exchange billing.',
      features: [
        'Dynamic Variant Matrix with SKU, Barcode, Retail & Wholesale price types',
        'Instant 1D/2D Thermal Barcode Sticker Printing (Code128, EAN-13, QR)',
        'Single-transaction Return & Exchange with store credit calculations',
        'Customer loyalty points accrual and branch-scoped promotional campaigns',
      ],
      benefits: [
        'Process complex apparel exchanges in under 30 seconds',
        'Eliminate variant stock confusion with barcode printing',
        'Increase customer return visits through loyalty points',
      ],
      metric_label: 'Checkout & Exchange Speed',
      metric_value: '3.2x Faster',
      image_key: 'retail',
      sort_order: 1,
    },
    {
      slug: 'supermarket-grocery',
      title: 'Supermarkets & Grocery Stores',
      subtitle:
        'Batch Expiry (FEFO), Electronic Scales & Sub-Second Barcode Scanning',
      icon_name: 'Store',
      badge: 'High Throughput',
      description:
        'Built for fast-paced checkout lanes and large SKU catalogs. Features batch/lot expiry tracking with First-Expiry-First-Out (FEFO) alerts, direct weighing scale integration, and blind EOD cash drawer auditing.',
      features: [
        'Batch-wise inventory with purchase invoice tracking & expiry alerts',
        'Sub-second barcode scan response with wholesale & retail price tiers',
        'Direct RS232/USB digital weighing scale integration with auto-tare',
        'Blind End-of-Day (EOD) cash reconciliation preventing cashier discrepancies',
      ],
      benefits: [
        'Cut expired stock loss with automated batch expiry alerts',
        'Sub-second barcode search across huge product catalogs',
        '100% auditable cash drawer reconciliation at shift close',
      ],
      metric_label: 'Shrinkage Reduction',
      metric_value: '48% Saved',
      image_key: 'supermarket',
      sort_order: 2,
    },
    {
      slug: 'electronics-appliances',
      title: 'Electronics, Gadgets & Hardware',
      subtitle: 'Serial Number Warranty Tracking, Quotations & Vendor Bills',
      icon_name: 'Cpu',
      badge: 'Serial & Warranty',
      description:
        'Track unique serial numbers for every high-value unit sold with automated warranty logs. Generate professional pro-forma quotations and convert them to finalized sales in one click.',
      features: [
        'Individual Serial Number tracking for lifetime warranty & service lookup',
        'Pro-forma Quotation generator with 1-click conversion to finalized Sale',
        'Vendor purchase payments, partial payment ledgers, and bill tracking',
        'Multi-tender split payments (Bank transfer, Cards, Cash, Mobile Money)',
      ],
      benefits: [
        'Instant serial number warranty verification during customer returns',
        'Accelerate B2B sales cycles with instant quotation conversion',
        'Complete visibility over vendor payables and outstanding purchase balances',
      ],
      metric_label: 'Warranty Verification',
      metric_value: 'Instant',
      image_key: 'electronics',
      sort_order: 3,
    },
    {
      slug: 'restaurants-cafes',
      title: 'Restaurants, Cafes & Food Outlets',
      subtitle:
        'Online Orders Dispatch, Daily Targets & Operational Expense Logs',
      icon_name: 'Utensils',
      badge: 'Hospitality & Multi-Store',
      description:
        'Manage counter sales, track online delivery statuses from pending to out-for-delivery, set daily branch revenue targets, and track daily operational petty cash expenses right from the register.',
      features: [
        'Online order status pipeline (Pending -> Processing -> Out for Delivery -> Delivered)',
        'Daily Sales Targets per branch & cashier with live leaderboard tracking',
        'Operational cost logging (utilities, daily supplies, petty expenses)',
        'ESC/POS thermal kitchen and customer receipt printing',
      ],
      benefits: [
        'Real-time visibility over online delivery order fulfillment',
        'Motivate staff with live branch-by-branch daily target tracking',
        'Accurate net profit calculations including branch operational costs',
      ],
      metric_label: 'Daily Target Attainment',
      metric_value: '+28% Boost',
      image_key: 'restaurant',
      sort_order: 4,
    },
  ];

  for (const solution of solutions) {
    await prisma.portfolioSolution.upsert({
      where: { slug: solution.slug },
      update: {},
      create: solution,
    });
  }

  const features = [
    {
      slug: 'pos-billing',
      category: 'pos',
      title: 'High-Speed POS & Multi-Tender Engine',
      tagline:
        'Sub-second barcode scanning, flexible discount rules, MFS & bank integrations.',
      description:
        'PosBuzz POS terminal is optimized for high-volume cashier throughput. Supports retail & wholesale pricing, item-level and order-level discounts, instant customer loyalty lookup, suspended carts, and split tenders.',
      highlights: [
        'Multi-tender payments: Cash, Card, Bank Transfer, Cheque, Mobile Money (bKash, Nagad, Rocket, Upay, Cellfin), and Credit',
        'Single-screen Return & Exchange handling with automatic balance adjustment',
        'Wholesale vs Retail price type toggle and custom percentage/flat discounts',
        'Instant customer loyalty lookup and point redemption at register',
      ],
      icon: 'Zap',
      badge: 'Core Terminal',
      sort_order: 1,
    },
    {
      slug: 'inventory-batches-serials',
      category: 'inventory',
      title: 'Batch Expiry & Serial Number Inventory',
      tagline:
        'Total control over product variants, expiring batches, and serialized warranties.',
      description:
        'Eliminate stock discrepancies and inventory loss. Track stock adjustments with audited reason codes, batch-wise manufacturing and expiry dates, purchase supplier invoices, and individual serial numbers.',
      highlights: [
        'Product Serial Number tracking for warranty lookup and service history',
        'Inventory Batches with cost-per-unit, supplier lot tracking, and expiry alerts',
        'Audited stock adjustments (damage, shrinkage, count reconciliation)',
        'Comprehensive product audit logs tracking every stock movement',
      ],
      icon: 'Boxes',
      badge: 'Traceability',
      sort_order: 2,
    },
    {
      slug: 'multi-branch-transfers',
      category: 'multi-branch',
      title: 'Multi-Branch HQ & Inter-Store Transfers',
      tagline:
        'Centralized catalog control with branch assignments and stock transfers.',
      description:
        'Scale from 1 to 500+ locations. Manage master product catalogs, branch pricing overrides, user branch permissions, and inter-branch inventory transfer requests with dispatched/received confirmation.',
      highlights: [
        'Inter-branch transfer requests, dispatch tracking, and receiving confirmation',
        'Pending delivery management and driver assignment',
        'Centralized multi-store sales consolidation and branch comparison analytics',
        'Granular role permissions per branch (Cashier, Store Manager, Accountant, Admin)',
      ],
      icon: 'Building2',
      badge: 'Multi-Outlet',
      sort_order: 3,
    },
    {
      slug: 'quotations-promotions',
      category: 'quotation-orders',
      title: 'Quotations, Promotions & Online Orders',
      tagline:
        'Turn inquiries into sales and automate customer promotional campaigns.',
      description:
        'Generate pro-forma quotations and convert them to finalized invoices with one click. Manage time-bound branch promotions and track online orders through all fulfillment stages.',
      highlights: [
        '1-Click Quotation to Sale invoice conversion with customer details preserved',
        'Automated promotional rules: percentage/flat discounts, branch-scoped campaigns',
        'Online order status management (Pending, Confirmed, Ready, Out for Delivery, Delivered)',
        'Customer credit ledger and partial installment payment tracking',
      ],
      icon: 'FileText',
      badge: 'Sales Acceleration',
      sort_order: 4,
    },
    {
      slug: 'rewards-eod-finance',
      category: 'loyalty',
      title: 'Customer Rewards & Blind EOD Audits',
      tagline:
        'Gamify customer retention and close daily registers with zero cash discrepancy.',
      description:
        'Reward loyal shoppers with configurable points accrual and redemption rules. At shift end, run tamper-proof blind cash drawer reconciliations and log branch operational costs.',
      highlights: [
        'Configurable reward settings: Points-per-currency-spent & redemption thresholds',
        'Reward points transaction history and customer points redemption during checkout',
        'Blind End-of-Day (EOD) closing: cashiers count physical cash without bias',
        'Operational cost tracking per branch (rent, petty cash, utilities, supplies)',
      ],
      icon: 'Sparkles',
      badge: 'Retention & Finance',
      sort_order: 5,
    },
    {
      slug: 'hardware-barcode-printing',
      category: 'hardware',
      title: 'Thermal Hardware Agent & Barcode Printing',
      tagline:
        'Local HTTP printer agent for ESC/POS receipt printing and barcode generation.',
      description:
        'PosBuzz utilizes a local desktop HTTP printing agent communicating with thermal ESC/POS printers, automatic cash drawer opening, and custom barcode label generation.',
      highlights: [
        'Dedicated local HTTP print agent for driverless ESC/POS 58mm/80mm printing',
        'Customizable PDF & thermal receipt templates with VAT registration & logos',
        'Barcode sticker generator for Code128, EAN-13, and QR codes',
        'Automatic cash drawer RJ11 kick and digital weighing scale COM integration',
      ],
      icon: 'Printer',
      badge: 'Printer Agent',
      sort_order: 6,
    },
  ];

  for (const feature of features) {
    await prisma.portfolioFeature.upsert({
      where: { slug: feature.slug },
      update: {},
      create: feature,
    });
  }

  const plans = [
    {
      slug: 'starter',
      name: 'Starter / Single Store',
      description:
        'Ideal for boutique retail shops, single-outlet supermarkets, and small cafes.',
      price_monthly: 29,
      price_annual_monthly: 24,
      is_popular: false,
      cta: 'Start 14-Day Free Trial',
      features: [
        '1 Store Branch & 2 Active POS Registers',
        'Up to 5,000 Products & Variant SKUs',
        'High-Speed Barcode Scanning & Label Printing',
        'Multi-Tender Payments (Cash, Card, Bank, MFS bKash/Nagad)',
        'Basic Inventory & Low Stock Alerts',
        'Blind EOD Cash Reconciliation',
        'Customer Directory & Standard Receipts',
        'Email & Chat Support (24/5)',
      ],
      not_included: [
        'Multi-Branch Inter-Store Transfers',
        'Customer Loyalty & Rewards Engine',
        'Batch Expiry & Serial Number Tracking',
      ],
      sort_order: 1,
    },
    {
      slug: 'growth',
      name: 'Professional / Multi-Branch',
      badge: 'Most Popular',
      description:
        'Engineered for growing retail chains, multi-outlet stores, and high-volume businesses.',
      price_monthly: 79,
      price_annual_monthly: 64,
      is_popular: true,
      cta: 'Launch with Pro',
      features: [
        'Up to 5 Store Outlets (Expandable)',
        'Unlimited Products, Variants & SKUs',
        'Inter-Branch Stock Transfers & Pending Deliveries',
        'Batch Expiry (FEFO) & Serial Number Tracking',
        'Customer Loyalty Points & Rewards Engine',
        'Quotations & 1-Click Sale Invoicing',
        'Daily Sales Targets & Cashier Leaderboards',
        'Operational Cost Ledger & Profit Margins',
        'Custom Thermal Receipt & Barcode Designer',
        'Priority 24/7 Phone, WhatsApp & Ticket Support',
      ],
      not_included: [
        'Dedicated Private Cloud / On-Premise VM Cluster',
        'Custom Accounting & Inventory Webhooks',
      ],
      sort_order: 2,
    },
    {
      slug: 'enterprise',
      name: 'Enterprise & Franchises',
      badge: 'Full Custom Stack',
      description:
        'For large retail chains, hypermarket networks, and multi-outlet brand enterprises.',
      price_monthly: 199,
      price_annual_monthly: 169,
      is_popular: false,
      cta: 'Schedule Enterprise Consultation',
      features: [
        'Unlimited Store Outlets & POS Registers',
        'Unlimited Transactions, SKUs & Cashier Accounts',
        'Dedicated PostgreSQL / Redis Cloud or On-Premise VM',
        'Custom Accounting & Inventory Webhooks',
        'Custom Thermal Receipt & Barcode Designer Support',
        'High-Throughput RabbitMQ Queue Architecture',
        '99.99% Guaranteed SLA Uptime',
        'Dedicated Solution Architect & Onsite Cashier Training',
      ],
      not_included: [],
      sort_order: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.portfolioPricingPlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: plan,
    });
  }

  const faqs = [
    {
      question: 'What exact modules and capabilities are included in PosBuzz?',
      answer:
        'PosBuzz is a cloud Point of Sale (POS) and Multi-Branch Management platform encompassing: 1) High-speed POS Terminal with multi-tender splits (Cash, Cards, Banks, MFS bKash/Nagad), 2) Multi-branch inventory with inter-store transfers, 3) Batch expiry tracking (FEFO) & Serial number warranty logs, 4) Quotations to Sale conversion, 5) Customer loyalty point rewards, 6) Blind EOD cash drawer reconciliation & operational cost logs, and 7) Local HTTP thermal printer agent and barcode label printing.',
      aeo_summary:
        'PosBuzz is a cloud-native POS and inventory platform featuring multi-branch inventory, batch/serial tracking, MFS/bank payments, quotations, loyalty rewards, blind EOD audits, and thermal receipt printing.',
      category: 'POS & Checkout',
      sort_order: 1,
    },
    {
      question:
        'How does PosBuzz handle Mobile Financial Services (MFS) and local bank payments?',
      answer:
        'PosBuzz has built-in support for all major MFS and banking channels. Cashiers can record payments with provider selection and transaction IDs for bKash, Nagad, Rocket, Upay, Cellfin, OK Wallet, Tap, Islamic Wallet, and over 40+ commercial banks (BRAC, DBBL, City Bank, EBL, Islami Bank, Sonali Bank, Standard Chartered, etc.), as well as split multi-tender payments.',
      aeo_summary:
        'PosBuzz natively supports MFS (bKash, Nagad, Rocket, Upay) and 40+ commercial banks with transaction ID tracking and split-payment capabilities.',
      category: 'MFS & Bank Payments',
      sort_order: 2,
    },
    {
      question:
        'How does batch expiry tracking and serial number management work?',
      answer:
        'Every inventory batch records purchase prices, supplier lot numbers, manufacturing dates, and expiry dates with automated alerts for expiring stock. For electronics and appliances, individual Serial Numbers are assigned and tracked from purchase to sale, enabling instant warranty lookup and service verification.',
      aeo_summary:
        'PosBuzz tracks batch-wise expiry dates with FEFO alerts and assigns serial numbers for instant product warranty lookup.',
      category: 'Inventory & Batches',
      sort_order: 3,
    },
    {
      question: 'Can we transfer stock between different store branches?',
      answer:
        'Yes. PosBuzz provides a full Inter-Branch Inventory Transfer workflow. Outlets can create transfer requests, warehouse managers dispatch stock, delivery statuses are tracked in real-time, and receiving branch managers confirm receipt before stock ledgers are updated.',
      aeo_summary:
        'PosBuzz includes complete inter-branch stock transfer workflows with dispatch tracking and destination verification.',
      category: 'Multi-Branch Transfers',
      sort_order: 4,
    },
    {
      question: 'How does the End of Day (EOD) cash reconciliation work?',
      answer:
        'PosBuzz includes a tamper-proof Blind EOD Cash Closing process. Cashiers enter physical cash counts without seeing the system-calculated expected total. Once submitted, the manager dashboard highlights any discrepancy (over/short), records petty cash expenses, and logs the closing timestamp for audit security.',
      aeo_summary:
        'PosBuzz utilizes blind EOD cash drawer reconciliation to eliminate cashier bias and provide automated variance reports.',
      category: 'EOD & Daily Targets',
      sort_order: 5,
    },
    {
      question: 'How does receipt printing work in PosBuzz?',
      answer:
        'PosBuzz uses a lightweight local HTTP printing agent (`Printer.exe` / `PrintingFromWebToPOSPrinter` running on port 8080) that connects the web application to any standard ESC/POS 58mm/80mm thermal printer. It automatically formats the receipt, cuts paper, and opens the connected RJ11 cash drawer.',
      aeo_summary:
        'PosBuzz uses a local HTTP print agent to send receipt jobs directly from web browser to thermal ESC/POS printers and trigger cash drawers.',
      category: 'Hardware & Printer Agent',
      sort_order: 6,
    },
  ];

  if ((await prisma.portfolioFaq.count()) === 0) {
    await prisma.portfolioFaq.createMany({ data: faqs });
  }

  const testimonials = [
    {
      quote:
        'PosBuzz handles our 5 fashion outlets effortlessly. The variant matrix, thermal barcode printing, and instant quotation-to-sale conversion saved our sales reps hundreds of hours.',
      author: 'Karim Rahman',
      role: 'Managing Director',
      company: 'Urban Threads Apparel (5 Outlets)',
      rating: 5,
      metrics: '3.2x Faster Checkout',
      sort_order: 1,
    },
    {
      quote:
        'The batch expiry alerts and weighing scale integration eliminated over 40% of our grocery shrinkage. The blind EOD cash closing keeps our registers completely honest.',
      author: 'Tariq Al-Mansoor',
      role: 'Founder & CEO',
      company: 'GrandMart Supermarket Chain',
      rating: 5,
      metrics: '48% Loss Reduction',
      sort_order: 2,
    },
    {
      quote:
        'Having POS, inter-branch transfers, bKash/Card multi-tender, and loyalty rewards in a single unified platform is a game changer for our operations.',
      author: 'Farhana Ahmed',
      role: 'Operations Head',
      company: 'Apex Lifestyle & Retail',
      rating: 5,
      metrics: 'Unified POS Platform',
      sort_order: 3,
    },
  ];

  if ((await prisma.portfolioTestimonial.count()) === 0) {
    await prisma.portfolioTestimonial.createMany({ data: testimonials });
  }

  const demoProducts = [
    {
      name: 'Premium Slim-Fit Denim Jeans (Blue / 32)',
      sku: 'APP-DNM-32',
      price: 48.0,
      wholesale_price: 38.0,
      category: 'Apparel',
      image: '👖',
      tax: 0.05,
      serial: 'SN-882910',
      sort_order: 1,
    },
    {
      name: 'Gourmet Angus Burger Combo (Medium)',
      sku: 'FNB-BGR-01',
      price: 11.5,
      wholesale_price: 9.5,
      category: 'Food & Beverage',
      image: '🍔',
      tax: 0.08,
      sort_order: 2,
    },
    {
      name: 'Artisan Caramel Iced Latte (Large)',
      sku: 'FNB-COF-04',
      price: 4.5,
      wholesale_price: 3.5,
      category: 'Beverages',
      image: '☕',
      tax: 0.08,
      sort_order: 3,
    },
    {
      name: 'Fresh Farm Organic Milk 1L (Exp: 7 Days)',
      sku: 'GRO-MLK-01',
      price: 3.2,
      wholesale_price: 2.7,
      category: 'Grocery',
      image: '🥛',
      tax: 0,
      serial: 'BATCH-2026-08',
      sort_order: 4,
    },
    {
      name: 'Wireless Ergonomic Mouse (1-Yr Warranty)',
      sku: 'ELE-MOU-09',
      price: 26.0,
      wholesale_price: 20.0,
      category: 'Electronics',
      image: '🖱️',
      tax: 0.08,
      serial: 'WM-7821-44X',
      sort_order: 5,
    },
    {
      name: 'Cotton Casual Polo Shirt (Navy / L)',
      sku: 'APP-POLO-L',
      price: 22.0,
      wholesale_price: 17.0,
      category: 'Apparel',
      image: '👕',
      tax: 0.05,
      serial: 'SN-991023',
      sort_order: 6,
    },
    {
      name: 'Hass Avocado Pack of 3 (Weighted)',
      sku: 'GRO-AVO-03',
      price: 5.4,
      wholesale_price: 4.2,
      category: 'Grocery',
      image: '🥑',
      tax: 0,
      serial: 'BATCH-2026-09',
      sort_order: 7,
    },
    {
      name: 'ESC/POS Thermal Paper Roll 80mm (Box of 10)',
      sku: 'POS-PPR-80',
      price: 14.0,
      wholesale_price: 10.5,
      category: 'Supplies',
      image: '🧾',
      tax: 0.08,
      sort_order: 8,
    },
  ];

  for (const product of demoProducts) {
    await prisma.portfolioDemoProduct.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  console.log('🌱 Portfolio CMS content seeded');
}
